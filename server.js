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
      roleLimits: {
        'Керівник': 2,
        'Тімлід': 4,
        'Менеджер': 0, // 0 = unlimited
      },
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

  // ─── CONSENSUS ENGINE HELPERS ──────────────────────────────────────
  function initConsensusStep(room, step) {
    if (!room.cascade) return;
    room.cascade.currentStep = step;

    const activePlayers = Object.values(room.players).filter((p) => !p.isEliminated);

    if (step === 'head') {
      const activeHeads = activePlayers.filter((p) => p.level === 'Керівник');
      if (activeHeads.length === 0) {
        addLog(room, 'system', 'CASCADE STEP 1', 'Немає призначених Керівників. Автоматичний перехід до Тімлідів.');
        initConsensusStep(room, 'teamLead');
        return;
      }
      room.cascade.consensusGroups['head'] = {
        groupId: 'head',
        level: 'Керівник',
        department: 'Всі',
        displayName: 'Керівники (Heads)',
        expectedVoterIds: activeHeads.map((h) => h.id),
        votes: {},
        isResolved: false,
        winningOptionId: null,
        winningText: null,
        winningIsFlawed: false,
        winningIsSabotage: false,
        voteCounts: {},
        hasTie: false,
        tiedOptionIds: [],
      };
      addLog(room, 'system', 'CASCADE STEP 1', `Очікується консенсус Керівників (${activeHeads.length} гравців)...`);
    } else if (step === 'teamLead') {
      const activeTLs = activePlayers.filter((p) => p.level === 'Тімлід');
      if (activeTLs.length === 0) {
        addLog(room, 'system', 'CASCADE STEP 2', 'Немає призначених Тімлідів. Автоматичний перехід до Менеджерів.');
        initConsensusStep(room, 'manager');
        return;
      }
      const depts = Array.from(new Set(activeTLs.map((tl) => tl.department)));
      depts.forEach((dept) => {
        const deptTLs = activeTLs.filter((tl) => tl.department === dept);
        const groupId = 'teamLead:' + dept;
        room.cascade.consensusGroups[groupId] = {
          groupId,
          level: 'Тімлід',
          department: dept,
          displayName: `${dept} (Тімліди)`,
          expectedVoterIds: deptTLs.map((tl) => tl.id),
          votes: {},
          isResolved: false,
          winningOptionId: null,
          winningText: null,
          winningIsFlawed: false,
          winningIsSabotage: false,
          voteCounts: {},
          hasTie: false,
          tiedOptionIds: [],
        };
      });
      addLog(room, 'system', 'CASCADE STEP 2', `Очікується консенсус Тімлідів по відділах (${depts.join(', ')})...`);
    } else if (step === 'manager') {
      const activeManagers = activePlayers.filter((p) => p.level === 'Менеджер');
      if (activeManagers.length === 0) {
        addLog(room, 'system', 'CASCADE STEP 3', 'Немає менеджерів. Каскад завершено.');
        room.cascade.currentStep = 'completed';
        return;
      }
      const depts = Array.from(new Set(activeManagers.map((m) => m.department)));
      depts.forEach((dept) => {
        const deptManagers = activeManagers.filter((m) => m.department === dept);
        const groupId = 'manager:' + dept;
        room.cascade.consensusGroups[groupId] = {
          groupId,
          level: 'Менеджер',
          department: dept,
          displayName: `${dept} (Менеджери)`,
          expectedVoterIds: deptManagers.map((m) => m.id),
          votes: {},
          isResolved: false,
          winningOptionId: null,
          winningText: null,
          winningIsFlawed: false,
          winningIsSabotage: false,
          voteCounts: {},
          hasTie: false,
          tiedOptionIds: [],
        };
      });
      addLog(room, 'system', 'CASCADE STEP 3', `Директива дійшла до передової. Очікується консенсус Менеджерів по відділах (${depts.join(', ')})...`);
    }
  }

  function resolveGroupWithOption(room, group, winningOptionId) {
    group.isResolved = true;
    group.hasTie = false;
    group.winningOptionId = winningOptionId;

    const winningVote = Object.values(group.votes).find((v) => v.optionId === winningOptionId);
    let winningText = winningVote ? winningVote.text : '';
    let isFlawed = winningVote ? winningVote.isFlawed : false;
    let isSabotage = winningVote ? winningVote.isSabotage : false;

    if (!winningText) {
      const crisis = CRISES_DATA[room.currentCrisisIndex] || CRISES_DATA[0];
      const stepOptions =
        group.level === 'Керівник'
          ? crisis.steps.head.options
          : group.level === 'Тімлід'
          ? crisis.steps.teamLead.options
          : crisis.steps.manager.options;
      const opt = stepOptions.find((o) => o.id === winningOptionId);
      if (opt) {
        winningText = opt.text;
        isFlawed = opt.type === 'flawed' || opt.type === 'sabotage';
        isSabotage = !!opt.isSabotage;
      }
    }

    group.winningText = winningText;
    group.winningIsFlawed = isFlawed;
    group.winningIsSabotage = isSabotage;

    const voteCount = group.voteCounts[winningOptionId] || 1;
    addLog(
      room,
      isSabotage ? 'sabotage' : isFlawed ? 'sabotage' : 'cascade',
      group.displayName,
      `Рішення прийнято більшістю (${voteCount}/${group.expectedVoterIds.length} голосів): "${winningText}"`,
      { isFlawed, isSabotage }
    );

    if (group.level === 'Керівник') {
      room.cascade.headDecision = {
        playerId: winningVote?.playerId || 'consensus',
        playerName: group.displayName,
        optionId: winningOptionId,
        text: winningText,
        isFlawed,
      };
    } else if (group.level === 'Тімлід') {
      room.cascade.teamLeadDecisions[group.department] = {
        playerId: winningVote?.playerId || 'consensus',
        playerName: group.displayName,
        optionId: winningOptionId,
        text: winningText,
        isFlawed,
        department: group.department,
      };
    } else if (group.level === 'Менеджер') {
      room.cascade.managerDecisions[group.department] = {
        playerId: winningVote?.playerId || 'consensus',
        playerName: group.displayName,
        optionId: winningOptionId,
        text: winningText,
        isFlawed,
        department: group.department,
      };

      if (isSabotage) {
        room.cascade.mutinyProposal = {
          initiatorName: winningVote?.playerName || 'Менеджер',
          initiatorId: winningVote?.playerId || 'consensus',
          department: group.department,
          accepted: [winningVote?.playerId || 'consensus'],
          rejected: [],
        };
        addLog(
          room,
          'sabotage',
          `⚠ БУНТ У ВІДДІЛІ ${group.department}`,
          `Більшість менеджерів проголосувала за саботаж: "${winningText}"!`
        );
      }
    }

    checkAndAdvanceCascadeStep(room);
  }

  function checkAndAdvanceCascadeStep(room) {
    if (!room.cascade) return;
    const currentStep = room.cascade.currentStep;

    const currentStepGroups = Object.values(room.cascade.consensusGroups).filter((g) => {
      if (currentStep === 'head') return g.level === 'Керівник';
      if (currentStep === 'teamLead') return g.level === 'Тімлід';
      if (currentStep === 'manager') return g.level === 'Менеджер';
      return false;
    });

    const allResolved = currentStepGroups.length > 0 && currentStepGroups.every((g) => g.isResolved);

    if (allResolved) {
      if (currentStep === 'head') {
        initConsensusStep(room, 'teamLead');
      } else if (currentStep === 'teamLead') {
        initConsensusStep(room, 'manager');
      } else if (currentStep === 'manager') {
        room.cascade.currentStep = 'completed';
        addLog(
          room,
          'system',
          'CASCADE ЗАВЕРШЕНО',
          'Всі відділи ухвалили рішення! Ведучий може переходити до таймеру обговорення.'
        );
      }
    }
  }

  function processConsensusVote(room, player, optionId, text, isFlawed, isSabotage) {
    if (!room.cascade) return;

    let groupId;
    if (player.level === 'Керівник') {
      groupId = 'head';
    } else if (player.level === 'Тімлід') {
      groupId = 'teamLead:' + player.department;
    } else {
      groupId = 'manager:' + player.department;
    }

    let group = room.cascade.consensusGroups[groupId];
    if (!group) {
      group = {
        groupId,
        level: player.level,
        department: player.department,
        displayName: `${player.department} (${player.level})`,
        expectedVoterIds: [player.id],
        votes: {},
        isResolved: false,
        winningOptionId: null,
        winningText: null,
        winningIsFlawed: false,
        winningIsSabotage: false,
        voteCounts: {},
        hasTie: false,
        tiedOptionIds: [],
      };
      room.cascade.consensusGroups[groupId] = group;
    }

    if (group.isResolved) return;

    group.votes[player.id] = {
      playerId: player.id,
      playerName: player.name,
      department: player.department,
      level: player.level,
      optionId,
      text,
      isFlawed: !!isFlawed,
      isSabotage: !!isSabotage,
      timestamp: timestamp(),
    };

    group.voteCounts[optionId] = (group.voteCounts[optionId] || 0) + 1;

    // Secret vs public logging:
    // If 1 Flawed Manager votes "Sabotage", record sabotage attempt in Host's logs
    if (isSabotage) {
      addLog(
        room,
        'sabotage',
        `⚠ СПРОБА САБОТАЖУ: ${player.name} (${player.department})`,
        `Проголосував за саботаж: "${text}"`,
        { isFlawed: true, isSabotage: true }
      );
    } else if (isFlawed) {
      addLog(
        room,
        'sabotage',
        `⚠ ТОКСИЧНИЙ ГОЛОС: ${player.name} (${player.level} · ${player.department})`,
        `Проголосував за деструктивний варіант: "${text}"`,
        { isFlawed: true }
      );
    } else {
      addLog(
        room,
        'cascade',
        `${player.name} (${player.level} · ${player.department})`,
        `Віддав голос: "${text}"`
      );
    }

    const submittedCount = Object.keys(group.votes).length;
    const expectedCount = group.expectedVoterIds.length;
    const allVoted = group.expectedVoterIds.every((id) => group.votes[id]);

    if (allVoted || submittedCount >= expectedCount) {
      const counts = group.voteCounts;
      let maxCount = -1;
      Object.values(counts).forEach((c) => {
        if (c > maxCount) maxCount = c;
      });

      const topOptions = Object.keys(counts).filter((optId) => counts[optId] === maxCount);

      if (topOptions.length === 1) {
        resolveGroupWithOption(room, group, topOptions[0]);
      } else {
        group.hasTie = true;
        group.tiedOptionIds = topOptions;
        addLog(
          room,
          'cascade',
          `⚖ НІЧИЯ В ГРУПІ: ${group.displayName}`,
          `Голоси розділилися порівну (${maxCount} голосів на кожен варіант). Очікується вирішальний голос ведучого!`
        );
      }
    }
  }

  // ─── SOCKET.IO CONNECTIONS ────────────────────────────────────────
  io.on('connection', (socket) => {
    let currentRoomCode = null;
    let currentPlayerId = null;

    // 0. Step 1 Room Connect Check
    socket.on('check_room', ({ roomCode }) => {
      const cleanCode = (roomCode || '').trim().toLowerCase();
      const room = rooms[cleanCode];
      if (!room) {
        socket.emit('room_check_result', {
          exists: false,
          error: `Кімнату з кодом "${cleanCode}" не знайдено. Перевірте правильність введеного коду.`,
        });
        return;
      }

      const counts = { 'Керівник': 0, 'Тімлід': 0, 'Менеджер': 0 };
      Object.values(room.players).forEach((p) => {
        if (!p.isEliminated && counts[p.level] !== undefined) {
          counts[p.level]++;
        }
      });

      socket.emit('room_check_result', {
        exists: true,
        roomCode: cleanCode,
        roleLimits: room.roleLimits,
        roleCounts: counts,
        phase: room.phase,
      });
    });

    // 0.1 Update Role Limits (Host only)
    socket.on('update_role_limits', ({ roomCode, roleLimits }) => {
      const room = getRoom(roomCode);
      if (room && roleLimits) {
        room.roleLimits = {
          ...room.roleLimits,
          ...roleLimits,
        };
        addLog(room, 'system', 'HOST', 'Оновлено ліміти ролей для кімнати.');
        io.to(roomCode).emit('state_update', sanitizeState(room));
      }
    });

    // 0.2 Host Kick Player Functionality
    socket.on('kick_player', ({ roomCode, playerId }) => {
      const room = rooms[roomCode];
      if (!room || !room.players[playerId]) return;

      const player = room.players[playerId];
      const pName = player.name;
      const pSocketId = player.socketId;

      // 1. Notify player and instantly sever WebSocket connection
      if (pSocketId) {
        io.to(pSocketId).emit('kicked_from_room', {
          reason: 'Вас було видалено з гри адміністратором бункеру.',
        });
        const targetSock = io.sockets.sockets.get(pSocketId);
        if (targetSock) {
          targetSock.disconnect(true);
        }
      }

      // 2. Remove player from room state
      delete room.players[playerId];
      addLog(
        room,
        'system',
        'ADMIN',
        `Гравця ${pName} (${player.level} · ${player.department}) вигнано з бункеру адміністратором.`
      );

      // 3. Adjust consensus if in CASCADE phase
      if (room.cascade && room.cascade.consensusGroups) {
        Object.values(room.cascade.consensusGroups).forEach((group) => {
          if (group.expectedVoterIds.includes(playerId)) {
            group.expectedVoterIds = group.expectedVoterIds.filter((id) => id !== playerId);
            if (group.votes[playerId]) {
              const optId = group.votes[playerId].optionId;
              delete group.votes[playerId];
              if (group.voteCounts[optId]) {
                group.voteCounts[optId]--;
                if (group.voteCounts[optId] <= 0) delete group.voteCounts[optId];
              }
            }

            if (!group.isResolved && group.expectedVoterIds.length > 0) {
              const allVoted = group.expectedVoterIds.every((id) => group.votes[id]);
              if (allVoted) {
                const counts = group.voteCounts;
                let maxCount = -1;
                Object.values(counts).forEach((c) => {
                  if (c > maxCount) maxCount = c;
                });
                const topOptions = Object.keys(counts).filter((optId) => counts[optId] === maxCount);
                if (topOptions.length === 1) {
                  resolveGroupWithOption(room, group, topOptions[0]);
                } else if (topOptions.length > 1) {
                  group.hasTie = true;
                  group.tiedOptionIds = topOptions;
                }
              }
            } else if (!group.isResolved && group.expectedVoterIds.length === 0) {
              group.isResolved = true;
              checkAndAdvanceCascadeStep(room);
            }
          }
        });
      }

      // 4. Broadcast updated state
      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 0.3 Host Tiebreaker Resolution
    socket.on('resolve_tiebreaker', ({ roomCode, groupId, winningOptionId, isRandom }) => {
      const room = getRoom(roomCode);
      if (!room.cascade || !room.cascade.consensusGroups) return;
      const group = room.cascade.consensusGroups[groupId];
      if (!group || !group.hasTie) return;

      let chosenOptionId = winningOptionId;
      if (isRandom && group.tiedOptionIds && group.tiedOptionIds.length > 0) {
        const randomIndex = Math.floor(Math.random() * group.tiedOptionIds.length);
        chosenOptionId = group.tiedOptionIds[randomIndex];
        addLog(room, 'system', 'ВИПАДКОВИЙ ВИБІР', `Ведучий обрав випадкове вирішення нічиєї для ${group.displayName}.`);
      } else {
        addLog(room, 'system', 'РІШЕННЯ ВЕДУЧОГО', `Ведучий вручну вирішив нічию для ${group.displayName}.`);
      }

      resolveGroupWithOption(room, group, chosenOptionId);
      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 1. Join / Reconnect to Room
    socket.on('join_room', ({ roomCode, player, isHost, roleLimits }) => {
      currentRoomCode = roomCode;
      socket.join(roomCode);
      const room = getRoom(roomCode);

      if (isHost) {
        if (roleLimits) {
          room.roleLimits = {
            ...room.roleLimits,
            ...roleLimits,
          };
        }
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
          // Check role limits before creating new player
          const limit = room.roleLimits ? room.roleLimits[player.level] : 0;
          if (limit > 0) {
            const currentCount = Object.values(room.players).filter(
              (p) => !p.isEliminated && p.level === player.level
            ).length;
            if (currentCount >= limit) {
              socket.emit('error_message', `Ліміт на роль "${player.level}" вичерпано (${limit}/${limit}). Оберіть іншу роль.`);
              return;
            }
          }

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
        consensusGroups: {},
      };

      addLog(room, 'crisis', 'CEO / РАДА ДИРЕКТОРІВ', `АКТИВОВАНО КРИЗУ ${crisis.id}: ${crisis.title}`);
      addLog(room, 'crisis', 'АМБІГУАЛЬНИЙ БРИФІНГ', crisis.ambiguousPrompt);

      initConsensusStep(room, 'head');

      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 6. Cascade Step: Head Decision (via Consensus Engine)
    socket.on('submit_head_decision', ({ roomCode, playerId, optionId, text, isFlawed }) => {
      const room = getRoom(roomCode);
      if (!room.cascade) return;

      const player = room.players[playerId];
      if (!player) return;

      processConsensusVote(room, player, optionId, text, isFlawed, false);
      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 7. Cascade Step: Team Lead Decision (via Consensus Engine)
    socket.on('submit_teamlead_decision', ({ roomCode, playerId, optionId, text, isFlawed }) => {
      const room = getRoom(roomCode);
      if (!room.cascade) return;

      const player = room.players[playerId];
      if (!player) return;

      processConsensusVote(room, player, optionId, text, isFlawed, false);
      io.to(roomCode).emit('state_update', sanitizeState(room));
    });

    // 8. Cascade Step: Manager Decision (via Consensus Engine)
    socket.on('submit_manager_decision', ({ roomCode, playerId, optionId, text, isFlawed, isSabotage }) => {
      const room = getRoom(roomCode);
      if (!room.cascade) return;

      const player = room.players[playerId];
      if (!player) return;

      processConsensusVote(room, player, optionId, text, isFlawed, isSabotage);
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
