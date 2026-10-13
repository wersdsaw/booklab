const { createServer } = require('node:http');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { resolve } = require('node:path');
const next = require('next');
const { Server } = require('socket.io');
const { Store } = require('./server/store');
const { createRoom, addPlayer, apply, view, tick, assert } = require('./server/game');
const hash = value => createHash('sha256').update(value).digest('hex');
const safeEqual = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const adminPassword = process.env.ADMIN_PASSWORD || (dev ? 'bunker-local' : '');
if (!adminPassword || (!dev && adminPassword.length < 12)) throw new Error('Set ADMIN_PASSWORD to at least 12 characters in production.');
const app = next({ dev, hostname, port });
const store = new Store(resolve(process.env.DATABASE_PATH || 'data/bunker.sqlite'));
const rooms = store.loadAll();
app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const httpServer = createServer((req, res) => {
    if (req.url === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    handle(req, res).catch(err => { console.error(err); res.statusCode = 500; res.end('Internal server error'); });
  });
  const io = new Server(httpServer, {
    maxHttpBufferSize: 16 * 1024,
    // Full personalized snapshots on rejoin avoid replaying stale/private packets.
    allowRequest: (req, done) => {
      const origin = req.headers.origin;
      if (!origin) return done(null, true); // CLI/integration clients still require credentials.
      try {
        const url = new URL(origin);
        const allowed = process.env.APP_ORIGIN ? origin === process.env.APP_ORIGIN : url.host === req.headers.host;
        done(null, allowed);
      } catch { done(null, false); }
    },
  });
  function lobbySnapshot(room) {
    const people = Object.values(room.players).filter(p => !p.isKicked);
    const roleCounts = {};
    people.forEach(p => { roleCounts[p.level] = (roleCounts[p.level] || 0) + 1; });
    return { exists: room.phase === 'LOBBY', roomCode:room.roomCode, roleLimits:room.roleLimits, roleCounts,
      seats:people.map(p => ({level:p.level,department:p.department})), error:room.phase === 'LOBBY' ? undefined : 'Гра вже почалася.' };
  }
  function broadcast(room) {
    for (const client of io.sockets.sockets.values()) if (client.data.watchingRoom === room.roomCode) client.emit('lobby_update', lobbySnapshot(room));
    for (const client of io.sockets.sockets.values()) if (client.data.actor?.roomCode === room.roomCode) client.emit('state_update', view(room, client.data.actor));
  }
  function commit(room) { store.save(room); broadcast(room); }
  io.on('connection', socket => {
    let rateStart = Date.now(), calls = 0;
    socket.use((packet, nextMiddleware) => {
      if (Date.now() - rateStart > 10000) { calls = 0; rateStart = Date.now(); }
      if (++calls > 180) return nextMiddleware(new Error('Too many commands'));
      nextMiddleware();
    });
    const on = (name, handler) => socket.on(name, (payload = {}, ack) => {
      try {
        assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'Некоректний запит.');
        handler(payload, ack);
      } catch (error) {
        socket.emit('error_message', error.message);
        if (typeof ack === 'function') ack({ ok: false, error: error.message });
      }
    });
    on('check_room', ({ roomCode }) => {
      const code = typeof roomCode === 'string' ? roomCode.trim().toLowerCase() : '';
      const room = rooms[code];
      if (!room || room.phase !== 'LOBBY') { socket.emit('room_check_result', { exists:false, error:'Кімнату не знайдено або гра вже почалася.' }); return; }
      socket.data.watchingRoom = code;
      socket.emit('room_check_result', lobbySnapshot(room));
    });
    on('join_room', ({ roomCode, player, isHost, sessionToken, hostPassword }, ack) => {
      assert(!socket.data.actor, 'Ви вже в кімнаті.');
      let actor, room, token = sessionToken;
      if (typeof sessionToken === 'string' && sessionToken.length <= 100) {
        const session = store.session(hash(sessionToken));
        assert(session, 'Сесія закінчилась або відкликана. Увійдіть знову.');
        room = rooms[session.room_code];
        actor = { roomCode:session.room_code, isHost:!!session.is_host, playerId:session.player_id };
        assert(room && (actor.isHost || (room.players[actor.playerId] && !room.players[actor.playerId].isKicked)), 'Сесію відкликано.');
      } else if (isHost) {
        assert(typeof hostPassword === 'string' && hostPassword.length <= 200 && safeEqual(hostPassword, adminPassword), 'Невірний пароль ведучого.');
        const code = typeof roomCode === 'string' && roomCode.trim() ? roomCode.trim().toLowerCase() : 'bunker-' + randomBytes(4).toString('hex');
        assert(/^[a-z0-9-]{4,32}$/.test(code), 'Код: 4–32 латинські літери, цифри або дефіс.');
        room = rooms[code];
        // Existing rooms require their room-specific host credential.
        assert(!room, 'Для відновлення наявної кімнати потрібна збережена сесія ведучого.');
        assert(Object.keys(rooms).length < 1000, 'Ліміт кімнат досягнуто.');
        room = createRoom(code); rooms[code] = room;
        actor = { roomCode:code, isHost:true, playerId:null };
      } else {
        const code = typeof roomCode === 'string' ? roomCode.trim().toLowerCase() : '';
        room = rooms[code]; assert(room, 'Кімнату не знайдено.');
        const p = addPlayer(room, player || {});
        actor = { roomCode:code, isHost:false, playerId:p.id };
      }
      // Exactly one connected host / one connection per player credential.
      for (const client of io.sockets.sockets.values()) {
        const previous = client.data.actor;
        if (client.id !== socket.id && previous?.roomCode === actor.roomCode && previous.isHost === actor.isHost && previous.playerId === actor.playerId) {
          client.emit('session_replaced'); client.data.actor = null; client.disconnect(true);
        }
      }
      socket.data.watchingRoom = null;
      socket.data.actor = actor;
      if (!actor.isHost) Object.assign(room.players[actor.playerId], { online:true, socketId:socket.id });
      store.save(room);
      if (!token) { token = randomBytes(32).toString('base64url'); store.addSession(hash(token), actor.roomCode, actor.playerId, actor.isHost); }
      socket.emit('session_joined', { sessionToken:token, roomCode:actor.roomCode, playerId:actor.playerId, isHost:actor.isHost });
      broadcast(room);
      if (typeof ack === 'function') ack({ ok:true });
    });
    const events = ['start_game','finish_intro','acknowledge_profile','trigger_crisis','understand_crisis','submit_head_decision',
      'submit_teamlead_decision','submit_manager_decision','advance_to_negotiation','pass_speaker','skip_speaker','control_timer',
      'submit_voting_ready_response','force_start_voting','submit_purge_vote','force_tally_votes','next_crisis','activate_superpower',
      'send_ghost_message','kick_player','reset_room','acknowledge_superpower_unlock','set_vote_intent','support_budget_recovery'];
    for (const event of events) on(event, (payload, ack) => {
      const actor = socket.data.actor;
      assert(actor, 'Приєднайтеся до кімнати.');
      assert(!payload.roomCode || payload.roomCode === actor.roomCode, 'Недоступна кімната.');
      if (payload.playerId && event !== 'kick_player') assert(payload.playerId === actor.playerId, 'Не можна діяти за іншого гравця.');
      if (payload.voterId) assert(payload.voterId === actor.playerId, 'Не можна діяти за іншого гравця.');
      const room = rooms[actor.roomCode];
      // A rejected command cannot partially mutate the authoritative state.
      const draft = structuredClone(room);
      apply(draft, actor, event, payload);
      store.save(draft); rooms[actor.roomCode] = draft;
      if (event === 'kick_player') {
        store.revoke(actor.roomCode, payload.playerId);
        for (const client of io.sockets.sockets.values()) if (client.data.actor?.roomCode === actor.roomCode && client.data.actor?.playerId === payload.playerId) {
          client.emit('kicked_from_room', {reason:'Ведучий від’єднав вас від бункеру.'}); client.data.actor=null; client.disconnect(true);
        }
      }
      broadcast(draft);
      if (typeof ack === 'function') ack({ ok:true });
    });
    on('leave_room', () => {
      const actor = socket.data.actor; if (!actor) return;
      const room = rooms[actor.roomCode];
      if (!actor.isHost) {
        const draft = structuredClone(room);
        if (room.phase === 'LOBBY') delete draft.players[actor.playerId];
        else draft.players[actor.playerId].online=false;
        store.revoke(actor.roomCode,actor.playerId); rooms[actor.roomCode]=draft; commit(draft);
      }
      socket.data.actor=null;
    });
    socket.on('disconnect', () => {
      const actor = socket.data.actor;
      if (!actor || actor.isHost) return;
      const room = rooms[actor.roomCode], p = room?.players[actor.playerId];
      if (p && p.socketId === socket.id) { p.online=false; p.socketId=''; commit(room); }
    });
  });
  const interval = setInterval(() => {
    for (const room of Object.values(rooms)) {
      const phaseBefore = room.phase;
      if (!tick(room)) continue;
      const transitioned = room.phase !== phaseBefore;
      if (transitioned || !room.timer.isRunning) store.save(room);
      for (const client of io.sockets.sockets.values()) if (client.data.actor?.roomCode === room.roomCode) client.emit('timer_tick', room.timer);
      if (transitioned || !room.timer.isRunning) broadcast(room);
    }
  }, 250);
  httpServer.listen(port, hostname, () => console.log(`Corporate Bunker: http://localhost:${port}`));
  const shutdown = () => { clearInterval(interval); for (const room of Object.values(rooms)) store.save(room); io.close(); httpServer.close(() => {store.close(); process.exit(0);}); setTimeout(() => process.exit(0), 5000).unref(); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}).catch(error => {console.error(error); process.exit(1);});
