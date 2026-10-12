const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { ALL_FLAWS } = require('./lib/flaws');
const { CRISES_DATA } = require('./lib/crises');
const { generateSalaryAndLore } = require('./lib/lore');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ─── IN-MEMORY GAME STATE ───────────────────────────────────────────
const rooms = {};

// Helper: Get or initialize a game room
function getRoom(roomCode) {
  if (!rooms[roomCode]) {
    rooms[roomCode] = {
      roomCode,
      phase: 'LOBBY',
      currentCrisisIndex: 0,
      players: {}, // playerId -> Player
      cascade: null,
      timer: {
        totalSeconds: 420, // 7:00 minutes
        remainingSeconds: 420,
        isRunning: false,
        votingReadyVotes: {}, // playerId -> boolean
      },
      timerInterval: null,
      votes: [],
      eliminatedThisRound: null,
      logs: [],
      isGameOver: false,
      isVictory: false,
      gameStartedAt: null,
    };
    addLog(rooms[roomCode], 'system', 'SYSTEM', `Бункер активовано. Код кімнати: ${roomCode}`);
  }
  return rooms[roomCode];
}

function timestamp() {
  const d = new Date();
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function addLog(room, type, sender, message, details = {}, isGhostMessage = false) {
  const entry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    timestamp: timestamp(),
    type,
    sender,
    message,
    details,
    isGhostMessage,
  };
  room.logs.push(entry);
  if (room.logs.length > 300) {
    room.logs.shift(); // keep last 300 logs
  }
  return entry;
}

// Strip internal fields like timerInterval before sending to clients
function sanitizeState(room) {
  const { timerInterval, ...rest } = room;
  return rest;
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // ─── TIMER MANAGEMENT ─────────────────────────────────────────────
  function startRoomTimer(room) {
    if (room.timerInterval) clearInterval(room.timerInterval);
    room.timer.isRunning = true;

    room.timerInterval = setInterval(() => {
      if (room.timer.remainingSeconds > 0) {
        room.timer.remainingSeconds -= 1;
        io.to(room.roomCode).emit('timer_tick', {
          remainingSeconds: room.timer.remainingSeconds,
          totalSeconds: room.timer.totalSeconds,
          isRunning: true,
        });
      } else {
        clearInterval(room.timerInterval);
        room.timer.isRunning = false;
        io.to(room.roomCode).emit('timer_ended');
        addLog(room, 'system', 'SYSTEM', 'Час обговорення вичерпано. Перевірка готовності до голосування.');
        io.to(room.roomCode).emit('state_update', sanitizeState(room));
      }
    }, 1000);
  }

  function pauseRoomTimer(room) {
    if (room.timerInterval) clearInterval(room.timerInterval);
    room.timer.isRunning = false;
    io.to(room.roomCode).emit('timer_tick', {
      remainingSeconds: room.timer.remainingSeconds,
      totalSeconds: room.timer.totalSeconds,
      isRunning: false,
    });
  }

  // ─── SOCKET.IO CONNECTIONS ────────────────────────────────────────
  io.on('connection', (socket) => {
    let currentRoomCode = null;
    let currentPlayerId = null;

    // 1. Join / Reconnect to Room
    socket.on('join_room', ({ roomCode, player, isHost }) => {
      currentRoomCode = roomCode;
      socket.join(roomCode);
      const room = getRoom(roomCode);

      if (isHost) {
        addLog(room, 'system', 'HOST', 'Ведучий підключився до панелі управління.');
        socket.emit('state_update', sanitizeState(room));
        return;
      }

      if (player && player.id) {
        currentPlayerId = player.id;
        // Check if player is reconnecting
        if (room.players[player.id]) {
          room.players[player.id].online = true;
          room.players[player.id].socketId = socket.id;
          addLog(room, 'system', room.players[player.id].name, 'Перепідключився до бункеру.');
        } else {
          // New player join
          room.players[player.id] = {
            ...player,
            socketId: socket.id,
            online: true,
            isAcknowledged: false,
            isEliminated: false,
            shieldActive: false,
            hasVoted: false,
            lastAction: null,
          };
          addLog(
            room,
            'system',
            `${player.name} (${player.level} · ${player.department})`,
            `Приєднався до бункеру. Зарплата: ${player.salary.toLocaleString('uk-UA')} ₴`
          );
        }

        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 2. Start Game (Host only)
    socket.on('start_game', ({ roomCode }) => {
      try {
        const room = getRoom(roomCode);
        const playerIds = Object.keys(room.players);

        if (playerIds.length === 0) {
          socket.emit('error_message', 'Немає підключених гравців.');
          return;
        }

        // Assign exactly 5 flaws across any level
        const flawCount = Math.min(5, playerIds.length);
        const shuffled = [...playerIds].sort(() => 0.5 - Math.random());
        const selectedIds = shuffled.slice(0, flawCount);

        // Reset all flaws
        playerIds.forEach((id) => {
          room.players[id].flaw = null;
        });

        // Assign flaws
        selectedIds.forEach((id, index) => {
          const flawTemplate = ALL_FLAWS[index % ALL_FLAWS.length];
          room.players[id].flaw = {
            ...flawTemplate,
            superpowerUsed: false,
          };
        });

        room.phase = 'INTRO_CINEMATIC';
        room.gameStartedAt = Date.now();
        room.isGameOver = false;
        room.isVictory = false;

        addLog(room, 'system', 'SYSTEM', '═══════════════════════════════════════════');
        addLog(room, 'system', 'SYSTEM', `СИМУЛЯЦІЮ ЗАПУЩЕНО! Розподілено ${flawCount} таємних вад.`);
        addLog(room, 'system', 'SYSTEM', '═══════════════════════════════════════════');

        // Log flaw assignments secretly for Host
        selectedIds.forEach((id) => {
          const p = room.players[id];
          addLog(room, 'system', 'HOST SECRET', `⚠ ${p.name} (${p.level}) отримав ваду: "${p.flaw.name}"`);
        });

        io.to(roomCode).emit('state_update', sanitizeState(room));
      } catch (err) {
        console.error('Error starting game:', err);
        socket.emit('error_message', 'Помилка запуску гри: ' + err.message);
      }
    });

    // 3. Skip / Finish Intro Cinematic
    socket.on('finish_intro', ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (room.phase === 'INTRO_CINEMATIC') {
        room.phase = 'PROFILE_ACK';
        addLog(room, 'system', 'SYSTEM', 'Фаза 2: Ознайомлення з профілями та вадами.');
        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 4. Acknowledge Profile ("Ознайомився")
    socket.on('acknowledge_profile', ({ roomCode, playerId }) => {
      const room = getRoom(roomCode);
      if (room.players[playerId]) {
        room.players[playerId].isAcknowledged = true;
        addLog(room, 'system', room.players[playerId].name, 'Ознайомився з легендою та обов\'язками.');

        // Check if all connected alive players have acknowledged
        const activePlayers = Object.values(room.players).filter((p) => p.online && !p.isEliminated);
        const allAck = activePlayers.every((p) => p.isAcknowledged);

        if (allAck && room.phase === 'PROFILE_ACK') {
          room.phase = 'CRISIS_TRIGGER';
          addLog(room, 'system', 'SYSTEM', 'Всі гравці ознайомились! Готовність до запуску Кризи.');
        }

        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 5. Trigger Crisis (Host only)
    socket.on('trigger_crisis', ({ roomCode, crisisId }) => {
      const room = getRoom(roomCode);
      const crisis = CRISES_DATA.find((c) => c.id === crisisId) || CRISES_DATA[0];

      room.phase = 'CASCADE';
      room.currentCrisisIndex = crisis.id - 1;
      room.cascade = {
        crisisId: crisis.id,
        currentStep: 'head',
        headDecision: null,
        teamLeadDecisions: {},
        managerDecisions: {},
        mutinyProposal: null,
      };

      addLog(room, 'crisis', 'CEO / РАДА ДИРЕКТОРІВ', `АКТИВОВАНО КРИЗУ ${crisis.id}: ${crisis.title}`);
      addLog(room, 'crisis', 'АМБІГУАЛЬНИЙ БРИФІНГ', crisis.ambiguousPrompt);
      addLog(room, 'system', 'CASCADE STEP 1', 'Запит відправлено Керівникам (Heads)...');

      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 6. Cascade Step: Head Decision
    socket.on('submit_head_decision', ({ roomCode, playerId, optionId, text, isFlawed }) => {
      const room = getRoom(roomCode);
      if (!room.cascade) return;

      const player = room.players[playerId];
      const pName = player ? player.name : 'Керівник';

      room.cascade.headDecision = {
        playerId,
        playerName: pName,
        optionId,
        text,
        isFlawed: !!isFlawed,
      };

      room.cascade.currentStep = 'teamLead';

      const logType = isFlawed ? 'sabotage' : 'cascade';
      addLog(
        room,
        logType,
        `${pName} (Керівник)`,
        `Рішення: "${text}"`,
        { isFlawed }
      );
      addLog(room, 'system', 'CASCADE STEP 2', 'Директива спускається до Тімлідів (Team Leads)...');

      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 7. Cascade Step: Team Lead Decision
    socket.on('submit_teamlead_decision', ({ roomCode, playerId, optionId, text, isFlawed }) => {
      const room = getRoom(roomCode);
      if (!room.cascade) return;

      const player = room.players[playerId];
      const pName = player ? player.name : 'Тімлід';

      room.cascade.teamLeadDecisions[playerId] = {
        playerId,
        playerName: pName,
        optionId,
        text,
        isFlawed: !!isFlawed,
      };

      const logType = isFlawed ? 'sabotage' : 'cascade';
      addLog(
        room,
        logType,
        `${pName} (Тімлід · ${player?.department})`,
        `Трансляція команді: "${text}"`,
        { isFlawed }
      );

      // Check if all team leads (or at least 1) answered to move to managers
      const activeTLs = Object.values(room.players).filter(
        (p) => p.level === 'Тімлід' && !p.isEliminated
      );
      const allTLAnswered = activeTLs.every((tl) => room.cascade.teamLeadDecisions[tl.id]);

      if (allTLAnswered || activeTLs.length === 0) {
        room.cascade.currentStep = 'manager';
        addLog(room, 'system', 'CASCADE STEP 3', 'Директива спускається до Менеджерів (Managers)...');
      }

      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 8. Cascade Step: Manager Decision
    socket.on('submit_manager_decision', ({ roomCode, playerId, optionId, text, isFlawed, isSabotage }) => {
      const room = getRoom(roomCode);
      if (!room.cascade) return;

      const player = room.players[playerId];
      const pName = player ? player.name : 'Менеджер';

      room.cascade.managerDecisions[playerId] = {
        playerId,
        playerName: pName,
        optionId,
        text,
        isFlawed: !!isFlawed,
      };

      if (isSabotage) {
        // Trigger mutiny modal for peers in the same department
        room.cascade.mutinyProposal = {
          initiatorName: pName,
          initiatorId: playerId,
          department: player.department,
          accepted: [playerId],
          rejected: [],
        };
        addLog(
          room,
          'sabotage',
          `⚠ САБОТАЖ: ${pName} (${player.department})`,
          `Ініціював таємний бунт у відділі: "${text}"!`
        );
      } else {
        const logType = isFlawed ? 'sabotage' : 'cascade';
        addLog(
          room,
          logType,
          `${pName} (Менеджер · ${player?.department})`,
          `Дія: "${text}"`,
          { isFlawed }
        );
      }

      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 9. Mutiny Response (Peer Managers)
    socket.on('respond_to_mutiny', ({ roomCode, playerId, accept }) => {
      const room = getRoom(roomCode);
      if (!room.cascade || !room.cascade.mutinyProposal) return;

      const player = room.players[playerId];
      const pName = player ? player.name : 'Менеджер';

      if (accept) {
        if (!room.cascade.mutinyProposal.accepted.includes(playerId)) {
          room.cascade.mutinyProposal.accepted.push(playerId);
        }
        addLog(room, 'sabotage', pName, `Приєднався до таємного бунту у відділі ${player?.department}!`);
      } else {
        if (!room.cascade.mutinyProposal.rejected.includes(playerId)) {
          room.cascade.mutinyProposal.rejected.push(playerId);
        }
        addLog(room, 'cascade', pName, `Відмовився від бунту у відділі ${player?.department}.`);
      }

      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 10. Advance to Negotiation Timer
    socket.on('advance_to_negotiation', ({ roomCode }) => {
      const room = getRoom(roomCode);
      const crisis = CRISES_DATA[room.currentCrisisIndex] || CRISES_DATA[0];

      room.phase = 'NEGOTIATION_TIMER';
      room.timer.totalSeconds = 420; // 7 minutes
      room.timer.remainingSeconds = 420;
      room.timer.votingReadyVotes = {};

      addLog(room, 'system', 'ФАЗА 5: НАСЛІДКИ ТА ОБГОВОРЕННЯ', crisis.consequenceText);
      addLog(room, 'system', 'ТАЙМЕР', 'Запущено таймер обговорення (7:00 хвилин).');

      startRoomTimer(room);
      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 11. Timer Controls (Host)
    socket.on('control_timer', ({ roomCode, action, seconds }) => {
      const room = getRoom(roomCode);
      if (action === 'start') {
        startRoomTimer(room);
      } else if (action === 'pause') {
        pauseRoomTimer(room);
      } else if (action === 'add') {
        room.timer.remainingSeconds += seconds || 60;
        room.timer.totalSeconds += seconds || 60;
        addLog(room, 'system', 'ТАЙМЕР', `Додано +${Math.round((seconds || 60) / 60)} хв.`);
        io.to(roomCode).emit('state_update', sanitizeState(room));
      } else if (action === 'skip') {
        pauseRoomTimer(room);
        room.timer.remainingSeconds = 0;
        addLog(room, 'system', 'ТАЙМЕР', 'Таймер примусово завершено ведучим.');
        io.to(roomCode).emit('timer_ended');
        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 12. Voting Ready Consensus Prompt Response ("Готові перейти до голосування? [Так / Ні]")
    socket.on('submit_voting_ready_response', ({ roomCode, playerId, ready }) => {
      const room = getRoom(roomCode);
      const player = room.players[playerId];
      const pName = player ? player.name : 'Гравець';

      room.timer.votingReadyVotes[playerId] = ready;

      if (!ready) {
        // "Ні" adds exactly 1:00 minute to the timer!
        room.timer.remainingSeconds += 60;
        room.timer.totalSeconds += 60;
        addLog(
          room,
          'system',
          'ОБГОВОРЕННЯ ПРОДОВЖЕНО',
          `Гравець ${pName} відповів "НІ". До таймеру додано +1:00 хв!`
        );
        // Restart timer if paused
        if (!room.timer.isRunning) {
          startRoomTimer(room);
        }
      } else {
        addLog(room, 'system', pName, 'Підтвердив готовність до голосування (ТАК).');
      }

      // Check if ALL alive active players clicked "Так"
      const activeAlive = Object.values(room.players).filter((p) => p.online && !p.isEliminated);
      const allReady = activeAlive.every((p) => room.timer.votingReadyVotes[p.id] === true);

      if (allReady && activeAlive.length > 0) {
        pauseRoomTimer(room);
        room.phase = 'PURGE_VOTING';
        room.votes = [];
        activeAlive.forEach((p) => (p.hasVoted = false));
        addLog(room, 'system', 'ФАЗА 6: ЧИСТКА', 'Всі підтвердили готовність! Розпочато 3-етапне голосування на виліт.');
      }

      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 13. Force Start Voting (Host bypass)
    socket.on('force_start_voting', ({ roomCode }) => {
      const room = getRoom(roomCode);
      pauseRoomTimer(room);
      room.phase = 'PURGE_VOTING';
      room.votes = [];
      Object.values(room.players).forEach((p) => (p.hasVoted = false));
      addLog(room, 'system', 'HOST COMMAND', 'Ведучий примусово запустив голосування на виліт.');
      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 14. Submit Purge Vote (3-step UI)
    socket.on('submit_purge_vote', ({ roomCode, voterId, targetDepartment, targetPlayerId, reason }) => {
      const room = getRoom(roomCode);
      const voter = room.players[voterId];
      const target = room.players[targetPlayerId];

      if (!voter || voter.isEliminated || voter.hasVoted) return;

      voter.hasVoted = true;

      const record = {
        voterId,
        voterName: voter.name,
        targetDepartment,
        targetPlayerId,
        targetPlayerName: target ? target.name : 'Невідомий',
        reason: reason.trim(),
      };

      room.votes.push(record);

      addLog(
        room,
        'vote',
        `ГОЛОС: ${voter.name}`,
        `Проголосував проти ${record.targetPlayerName} (${targetDepartment}): "${reason}"`
      );

      // Check if all alive players have voted
      const activeAlive = Object.values(room.players).filter((p) => p.online && !p.isEliminated);
      const allVoted = activeAlive.every((p) => p.hasVoted);

      if (allVoted && activeAlive.length > 0) {
        tallyRoomVotes(room, io);
      } else {
        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 15. Tally Votes Manual / Automatic
    socket.on('force_tally_votes', ({ roomCode }) => {
      const room = getRoom(roomCode);
      tallyRoomVotes(room, io);
    });

    function tallyRoomVotes(room, ioInstance) {
      if (room.votes.length === 0) {
        addLog(room, 'system', 'ГОЛОСУВАННЯ', 'Немає відданих голосів.');
        return;
      }

      // Count votes per target
      const counts = {};
      room.votes.forEach((v) => {
        counts[v.targetPlayerId] = (counts[v.targetPlayerId] || 0) + 1;
      });

      // Find top target
      let maxVotes = -1;
      let eliminatedId = null;

      Object.entries(counts).forEach(([pid, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          eliminatedId = pid;
        }
      });

      if (eliminatedId && room.players[eliminatedId]) {
        const victim = room.players[eliminatedId];
        let hadShield = false;

        // Check if victim used "Командний щит"
        if (victim.shieldActive) {
          hadShield = true;
          maxVotes = Math.max(0, maxVotes - 1);
          victim.shieldActive = false; // consumed
          addLog(
            room,
            'superpower',
            '🛡️ КОМАНДНИЙ ЩИТ',
            `Суперсила "${victim.name}" анулювала 1 голос проти нього!`
          );
        }

        victim.isEliminated = true; // Turn into Ghost

        room.eliminatedThisRound = {
          playerId: eliminatedId,
          name: victim.name,
          votesCount: maxVotes,
          hadShield,
        };

        addLog(
          room,
          'system',
          '☠️ ЧИСТКА ВІДБУЛАСЯ',
          `Співробітника ${victim.name} (${victim.level} · ${victim.department}) ЗВІЛЬНЕНО (${maxVotes} голосів)! Переходить у Режим Привида.`
        );

        room.phase = 'VOTE_RESULTS';

        // Check Endgame conditions
        checkEndgameConditions(room);
      }

      ioInstance.to(room.roomCode).emit('state_update', sanitizeState(room));
    }

    function checkEndgameConditions(room) {
      const allPlayers = Object.values(room.players);
      const flawedPlayers = allPlayers.filter((p) => p.flaw !== null);
      const aliveFlawed = flawedPlayers.filter((p) => !p.isEliminated);

      // Victory Condition: All 5 Flawed players eliminated
      if (flawedPlayers.length > 0 && aliveFlawed.length === 0) {
        room.isGameOver = true;
        room.isVictory = true;
        room.phase = 'ENDGAME';
        addLog(
          room,
          'system',
          '🏆 ПЕРЕМОГА БУНКЕРУ',
          'Всі носії вад були виявлені та усунені! Компанія врятована і починає стрімкий ріст.'
        );
        return;
      }

      // Defeat Condition: After Crisis 5 (index 4) and at least 1 flaw remains
      if (room.currentCrisisIndex >= 4 && aliveFlawed.length > 0) {
        room.isGameOver = true;
        room.isVictory = false;
        room.phase = 'ENDGAME';
        addLog(
          room,
          'system',
          '💀 КРАХ КОМПАНІЇ',
          'Пройдено всі 5 криз, але шкідники залишилися в команді. Бізнес збанкрутував.'
        );
      }
    }

    // 16. Next Crisis (Host)
    socket.on('next_crisis', ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (room.currentCrisisIndex < 4) {
        room.currentCrisisIndex += 1;
        room.phase = 'CRISIS_TRIGGER';
        room.cascade = null;
        room.votes = [];
        room.eliminatedThisRound = null;
        Object.values(room.players).forEach((p) => (p.hasVoted = false));

        addLog(
          room,
          'system',
          'НАСТУПНИЙ РАУНД',
          `Перехід до кризи ${room.currentCrisisIndex + 1} з 5.`
        );
        io.to(roomCode).emit('state_update', sanitizeState(room));
      } else {
        // Finished 5 crises -> check endgame
        checkEndgameConditions(room);
        room.phase = 'ENDGAME';
        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 17. Activate Superpower
    socket.on('activate_superpower', ({ roomCode, playerId }) => {
      const room = getRoom(roomCode);
      const player = room.players[playerId];

      if (player && player.flaw && !player.flaw.superpowerUsed && !player.isEliminated) {
        player.flaw.superpowerUsed = true;
        const flaw = player.flaw;

        if (flaw.id === 'indifference') {
          // Team Shield: Cancel 1 vote against them
          player.shieldActive = true;
          addLog(
            room,
            'superpower',
            player.name,
            `Активував суперсилу "${flaw.superpower}": захистить від 1 голосу на виліт!`
          );
        } else if (flaw.id === 'fear_of_conflict') {
          // Right to Veto
          pauseRoomTimer(room);
          addLog(
            room,
            'superpower',
            player.name,
            `Активував суперсилу "${flaw.superpower}": дискусію зупинено правом вето!`
          );
        } else if (flaw.id === 'avoidance') {
          // Pass the Blame
          addLog(
            room,
            'superpower',
            player.name,
            `Активував суперсилу "${flaw.superpower}": перевів підозру на суміжний відділ!`
          );
        } else if (flaw.id === 'low_standards') {
          // Quiet Sabotage
          addLog(
            room,
            'superpower',
            player.name,
            `Активував суперсилу "${flaw.superpower}": таємно знизив стандарти якості відділу!`
          );
        } else if (flaw.id === 'lack_of_trust') {
          // Mutiny
          addLog(
            room,
            'superpower',
            player.name,
            `Активував суперсилу "${flaw.superpower}": закликав відділ до заколоту!`
          );
        }

        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 18. Ghost Mode: Send Message to Host
    socket.on('send_ghost_message', ({ roomCode, playerId, message }) => {
      const room = getRoom(roomCode);
      const player = room.players[playerId];
      if (player && player.isEliminated) {
        addLog(
          room,
          'ghost',
          `👻 ПРИВИД: ${player.name}`,
          message.trim(),
          { playerId },
          true // isGhostMessage
        );
        // Emit updated logs to Host
        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 19. Leave Room / Clear Session
    socket.on('leave_room', ({ roomCode, playerId }) => {
      const room = rooms[roomCode];
      if (room && room.players[playerId]) {
        const pName = room.players[playerId].name;
        delete room.players[playerId];
        addLog(room, 'system', pName, 'Покинув гру та завершив сесію.');
        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 20. Admin: Reset Room to Lobby
    socket.on('reset_room', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (room) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        room.phase = 'LOBBY';
        room.currentCrisisIndex = 0;
        room.cascade = null;
        room.votes = [];
        room.eliminatedThisRound = null;
        room.isGameOver = false;
        room.isVictory = false;
        room.gameStartedAt = null;
        room.timer.remainingSeconds = 420;
        room.timer.totalSeconds = 420;
        room.timer.isRunning = false;
        room.timer.votingReadyVotes = {};
        Object.values(room.players).forEach((p) => {
          p.isAcknowledged = false;
          p.isEliminated = false;
          p.shieldActive = false;
          p.hasVoted = false;
          p.flaw = null;
        });
        addLog(room, 'system', 'ADMIN', 'Кімнату повністю скинуто до початкового стану (Лобі).');
        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 21. Admin / Dev: Add Test Bots for Instant Testing
    socket.on('add_test_bots', ({ roomCode, count = 10 }) => {
      const room = getRoom(roomCode);
      const testNames = [
        { name: 'Олександр Коваль', level: 'Керівник', dept: 'Методист' },
        { name: 'Марина Шевченко', level: 'Керівник', dept: 'Форвард' },
        { name: 'Дмитро Бондар', level: 'Тімлід', dept: 'Друга лінія' },
        { name: 'Юлія Ткаченко', level: 'Тімлід', dept: 'Ретеншн' },
        { name: 'Ігор Кравчук', level: 'Тімлід', dept: 'Методист' },
        { name: 'Анна Мороз', level: 'Менеджер', dept: 'Форвард' },
        { name: 'Максим Лисенко', level: 'Менеджер', dept: 'Форвард' },
        { name: 'Вікторія Поліщук', level: 'Менеджер', dept: 'Друга лінія' },
        { name: 'Сергій Марченко', level: 'Менеджер', dept: 'Друга лінія' },
        { name: 'Тетяна Руденко', level: 'Менеджер', dept: 'Ретеншн' },
        { name: 'Андрій Мельник', level: 'Менеджер', dept: 'Ретеншн' },
        { name: 'Олена Сидоренко', level: 'Менеджер', dept: 'Методист' },
      ];

      const toAdd = testNames.slice(0, count);
      toAdd.forEach((b, i) => {
        const pid = 'bot_' + Date.now() + '_' + i;
        const { salary, lore } = generateSalaryAndLore(b.level);
        room.players[pid] = {
          id: pid,
          name: b.name + ' (Бот)',
          level: b.level,
          department: b.dept,
          salary,
          lore,
          flaw: null,
          isAcknowledged: true,
          isEliminated: false,
          shieldActive: false,
          socketId: 'bot_socket_' + pid,
          online: true,
          lastAction: null,
          hasVoted: false,
        };
      });
      addLog(room, 'system', 'ADMIN', `Додано ${toAdd.length} тестових співробітників для тестування.`);
      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 22. Disconnect
    socket.on('disconnect', () => {
      if (currentRoomCode && currentPlayerId) {
        const room = rooms[currentRoomCode];
        if (room && room.players[currentPlayerId]) {
          room.players[currentPlayerId].online = false;
          addLog(room, 'system', room.players[currentPlayerId].name, 'Втратив зв\'язок (offline).');
          io.to(currentRoomCode).emit('state_update', sanitizeState(room));
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Corporate Bunker server ready on http://${hostname}:${port}`);
  });
});
