'use client';

import React, { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';
import {
  GameState,
  Player,
  HierarchyLevel,
  Department,
  GamePhase,
  RoleLimits,
} from '../lib/types';
import { generateSalaryAndLore } from '../lib/lore';
import PlayerTerminal from '../components/PlayerTerminal';
import CinematicIntro from '../components/CinematicIntro';
import EndgameScreen from '../components/EndgameScreen';
import { Skull, User, Plug, ShieldAlert, RotateCcw, ArrowLeft, UserX, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const [inGame, setInGame] = useState(false);

  // Two-Step Join Flow States
  const [joinStep, setJoinStep] = useState<1 | 2>(1);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [connectedRoomCode, setConnectedRoomCode] = useState('');
  const [roomRoleLimits, setRoomRoleLimits] = useState<RoleLimits | null>(null);
  const [roomRoleCounts, setRoomRoleCounts] = useState<Record<string, number>>({
    'Керівник': 0,
    'Тімлід': 0,
    'Менеджер': 0,
  });

  // Step 2: Player Onboarding Fields
  const [playerName, setPlayerName] = useState('');
  const [playerLevel, setPlayerLevel] = useState<HierarchyLevel>('Менеджер');
  const [playerDepartment, setPlayerDepartment] = useState<Department>('Форвард');

  // Kicked State
  const [isKicked, setIsKicked] = useState(false);
  const [kickedReason, setKickedReason] = useState('');

  // Active User & Synced Game State
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize Socket.io connection & restore session (isolated per browser tab via sessionStorage)
  useEffect(() => {
    localStorage.removeItem('corporate_bunker_session');

    const socket = getSocket();

    socket.on('connect', () => {
      const savedSession = sessionStorage.getItem('corporate_bunker_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if (parsed.player && parsed.roomCode) {
            setCurrentUser(parsed.player);
            setConnectedRoomCode(parsed.roomCode);
            setInGame(true);
            socket.emit('join_room', {
              roomCode: parsed.roomCode,
              player: parsed.player,
              isHost: false,
            });
          }
        } catch (e) {
          console.error('Failed to restore tab session:', e);
        }
      }
    });

    // Step 1 check room result
    socket.on('room_check_result', (data: {
      exists: boolean;
      roomCode?: string;
      roleLimits?: RoleLimits;
      roleCounts?: Record<string, number>;
      error?: string;
    }) => {
      if (data.exists && data.roomCode) {
        setConnectedRoomCode(data.roomCode);
        if (data.roleLimits) setRoomRoleLimits(data.roleLimits);
        if (data.roleCounts) {
          setRoomRoleCounts(data.roleCounts);
          // If default selected level is full, pick next available
          const limits = data.roleLimits || { 'Керівник': 2, 'Тімлід': 4, 'Менеджер': 0 };
          if (limits['Менеджер'] > 0 && (data.roleCounts['Менеджер'] || 0) >= limits['Менеджер']) {
            if (limits['Тімлід'] === 0 || (data.roleCounts['Тімлід'] || 0) < limits['Тімлід']) {
              setPlayerLevel('Тімлід');
            } else if (limits['Керівник'] === 0 || (data.roleCounts['Керівник'] || 0) < limits['Керівник']) {
              setPlayerLevel('Керівник');
            }
          }
        }
        setJoinStep(2);
        setErrorMsg(null);
      } else {
        setErrorMsg(data.error || 'Кімнату не знайдено.');
      }
    });

    // Kicked by Admin
    socket.on('kicked_from_room', (data: { reason?: string }) => {
      setIsKicked(true);
      setKickedReason(data?.reason || 'Вас було видалено ведучим (Admin).');
      sessionStorage.removeItem('corporate_bunker_session');
      localStorage.removeItem('corporate_bunker_session');
      setCurrentUser(null);
      setGameState(null);
      setInGame(false);
      setJoinStep(1);
    });

    socket.on('state_update', (updatedState: GameState) => {
      setGameState(updatedState);
      if (updatedState.roleLimits) {
        setRoomRoleLimits(updatedState.roleLimits);
      }
      // Update role counts dynamically
      const counts: Record<string, number> = { 'Керівник': 0, 'Тімлід': 0, 'Менеджер': 0 };
      Object.values(updatedState.players).forEach((p) => {
        if (!p.isEliminated && counts[p.level] !== undefined) {
          counts[p.level]++;
        }
      });
      setRoomRoleCounts(counts);

      if (currentUser && updatedState.players[currentUser.id]) {
        setCurrentUser(updatedState.players[currentUser.id]);
      }
    });

    socket.on('timer_tick', ({ remainingSeconds, totalSeconds, isRunning }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          timer: {
            ...prev.timer,
            remainingSeconds,
            totalSeconds,
            isRunning,
          },
        };
      });
    });

    socket.on('error_message', (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    });

    return () => {
      socket.off('room_check_result');
      socket.off('kicked_from_room');
      socket.off('state_update');
      socket.off('timer_tick');
      socket.off('error_message');
    };
  }, [currentUser]);

  // ─── ACTION HANDLERS ──────────────────────────────────────────────

  // Step 1: Connect to Room
  const handleConnectRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCodeInput.trim().toLowerCase();
    if (!cleanCode) {
      setErrorMsg('Будь ласка, введіть код кімнати.');
      return;
    }
    setErrorMsg(null);
    getSocket().emit('check_room', { roomCode: cleanCode });
  };

  // Step 2: Complete Player Onboarding & Join
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = playerName.trim();
    const cleanCode = connectedRoomCode.trim().toLowerCase() || roomCodeInput.trim().toLowerCase();

    if (!cleanName) {
      setErrorMsg("Будь ласка, введіть ваше ім'я та прізвище.");
      return;
    }
    if (!cleanCode) {
      setErrorMsg('Будь ласка, введіть код кімнати.');
      return;
    }

    // Role limit validation
    const limit = roomRoleLimits ? roomRoleLimits[playerLevel] : 0;
    const currentCount = roomRoleCounts[playerLevel] || 0;
    if (limit > 0 && currentCount >= limit) {
      setErrorMsg(`Ліміт на роль "${playerLevel}" вичерпано (${currentCount}/${limit}). Оберіть іншу роль.`);
      return;
    }

    if (playerDepartment === 'Над усіма' && playerLevel !== 'Керівник') {
      setErrorMsg('Департамент "Над усіма" доступний тільки для Керівників.');
      return;
    }

    const { salary, lore } = generateSalaryAndLore(playerLevel);

    const newPlayer: Player = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: cleanName,
      level: playerLevel,
      department: playerDepartment,
      salary,
      lore,
      flaw: null,
      isAcknowledged: false,
      isEliminated: false,
      shieldActive: false,
      socketId: '',
      online: true,
      lastAction: null,
      hasVoted: false,
    };

    const socket = getSocket();
    setCurrentUser(newPlayer);
    setInGame(true);

    // Save strictly to this tab's sessionStorage
    sessionStorage.setItem(
      'corporate_bunker_session',
      JSON.stringify({ isHost: false, roomCode: cleanCode, player: newPlayer })
    );

    socket.emit('join_room', {
      roomCode: cleanCode,
      player: newPlayer,
      isHost: false,
    });
  };

  // 3. Leave Room / Clear Session on this tab
  const handleLeaveRoom = () => {
    if (gameState && currentUser) {
      getSocket().emit('leave_room', {
        roomCode: gameState.roomCode,
        playerId: currentUser.id,
      });
    }
    sessionStorage.removeItem('corporate_bunker_session');
    localStorage.removeItem('corporate_bunker_session');
    setCurrentUser(null);
    setGameState(null);
    setInGame(false);
  };

  const handleStartGame = () => {
    if (!gameState) return;
    getSocket().emit('start_game', { roomCode: gameState.roomCode });
  };

  const handleFinishIntro = () => {
    if (!gameState) return;
    getSocket().emit('finish_intro', { roomCode: gameState.roomCode });
  };

  const handleAcknowledge = () => {
    if (!gameState || !currentUser) return;
    getSocket().emit('acknowledge_profile', {
      roomCode: gameState.roomCode,
      playerId: currentUser.id,
    });
  };

  const handleTriggerCrisis = (crisisId: number) => {
    if (!gameState) return;
    getSocket().emit('trigger_crisis', { roomCode: gameState.roomCode, crisisId });
  };

  const handleCascadeDecision = (
    optionId: string,
    text: string,
    isFlawed: boolean,
    isSabotage?: boolean
  ) => {
    if (!gameState || !currentUser) return;
    const socket = getSocket();

    if (currentUser.level === 'Керівник') {
      socket.emit('submit_head_decision', {
        roomCode: gameState.roomCode,
        playerId: currentUser.id,
        optionId,
        text,
        isFlawed,
      });
    } else if (currentUser.level === 'Тімлід') {
      socket.emit('submit_teamlead_decision', {
        roomCode: gameState.roomCode,
        playerId: currentUser.id,
        optionId,
        text,
        isFlawed,
      });
    } else {
      socket.emit('submit_manager_decision', {
        roomCode: gameState.roomCode,
        playerId: currentUser.id,
        optionId,
        text,
        isFlawed,
        isSabotage,
      });
    }
  };

  const handleRespondToMutiny = (accept: boolean) => {
    if (!gameState || !currentUser) return;
    getSocket().emit('respond_to_mutiny', {
      roomCode: gameState.roomCode,
      playerId: currentUser.id,
      accept,
    });
  };

  const handleAdvanceToNegotiation = () => {
    if (!gameState) return;
    getSocket().emit('advance_to_negotiation', { roomCode: gameState.roomCode });
  };

  const handleControlTimer = (action: 'start' | 'pause' | 'add' | 'skip', seconds?: number) => {
    if (!gameState) return;
    getSocket().emit('control_timer', { roomCode: gameState.roomCode, action, seconds });
  };

  const handleVoteReady = (ready: boolean) => {
    if (!gameState || !currentUser) return;
    getSocket().emit('submit_voting_ready_response', {
      roomCode: gameState.roomCode,
      playerId: currentUser.id,
      ready,
    });
  };

  const handleForceStartVoting = () => {
    if (!gameState) return;
    getSocket().emit('force_start_voting', { roomCode: gameState.roomCode });
  };

  const handleSubmitVote = (
    targetDepartment: Department,
    targetPlayerId: string,
    reason: string
  ) => {
    if (!gameState || !currentUser) return;
    getSocket().emit('submit_purge_vote', {
      roomCode: gameState.roomCode,
      voterId: currentUser.id,
      targetDepartment,
      targetPlayerId,
      reason,
    });
  };

  const handleForceTallyVotes = () => {
    if (!gameState) return;
    getSocket().emit('force_tally_votes', { roomCode: gameState.roomCode });
  };

  const handleNextCrisis = () => {
    if (!gameState) return;
    getSocket().emit('next_crisis', { roomCode: gameState.roomCode });
  };

  const handleActivateSuperpower = () => {
    if (!gameState || !currentUser) return;
    getSocket().emit('activate_superpower', {
      roomCode: gameState.roomCode,
      playerId: currentUser.id,
    });
  };

  const handleSendGhostMessage = (message: string) => {
    if (!gameState || !currentUser) return;
    getSocket().emit('send_ghost_message', {
      roomCode: gameState.roomCode,
      playerId: currentUser.id,
      message,
    });
  };

  const handleRestart = () => {
    sessionStorage.removeItem('corporate_bunker_session');
    localStorage.removeItem('corporate_bunker_session');
    window.location.reload();
  };

  // ─── RENDER ROUTING ───────────────────────────────────────────────

  // ─── RENDER ROUTING ───────────────────────────────────────────────

  // View: Kicked by Host Screen
  if (isKicked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card w-full max-w-md p-8 text-center space-y-6 border border-red-500/50 neon-glow-red">
          <div className="w-16 h-16 rounded-full bg-red-950/80 border-2 border-red-500 flex items-center justify-center mx-auto text-red-500 animate-pulse">
            <UserX className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-red-500 neon-text-red">
              ВАС БУЛО ВИДАЛЕНО З ГРИ
            </h1>
            <p className="text-xs text-gray-300 font-mono">
              {kickedReason || 'Адміністратор бункеру вигнав вас із симуляції.'}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-black/60 border border-gray-800 text-[11px] text-gray-400 font-sans">
            Ваше сесійне з'єднання було миттєво розірвано. Ви більше не є частиною команди бункеру.
          </div>

          <button
            onClick={() => {
              setIsKicked(false);
              setJoinStep(1);
              setRoomCodeInput('');
              setErrorMsg(null);
            }}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-lg transition-all text-xs"
          >
            Повернутися на Головну
          </button>
        </div>
      </div>
    );
  }

  // View A: Onboarding & Entry Point (Strictly Player-Only 2-Step Flow)
  if (!inGame || !gameState) {
    const headLimit = roomRoleLimits?.['Керівник'] ?? 2;
    const headCount = roomRoleCounts?.['Керівник'] ?? 0;
    const isHeadFull = headLimit > 0 && headCount >= headLimit;

    const tlLimit = roomRoleLimits?.['Тімлід'] ?? 4;
    const tlCount = roomRoleCounts?.['Тімлід'] ?? 0;
    const isTLFull = tlLimit > 0 && tlCount >= tlLimit;

    const mgrLimit = roomRoleLimits?.['Менеджер'] ?? 0;
    const mgrCount = roomRoleCounts?.['Менеджер'] ?? 0;
    const isMgrFull = mgrLimit > 0 && mgrCount >= mgrLimit;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card w-full max-w-lg p-6 sm:p-8 space-y-6 text-center">
          {/* Logo & Header */}
          <div>
            <Skull className="w-16 h-16 text-red-500 mx-auto mb-3 animate-pulse" />
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-red-500 neon-text-red">
              КОРПОРАТИВНИЙ БУНКЕР
            </h1>
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
              High-Stakes Psychological Corporate Survival Game
            </p>
          </div>

          {joinStep === 1 ? (
            /* STEP 1: Room Connect */
            <form onSubmit={handleConnectRoom} className="space-y-4 text-left pt-2">
              <div>
                <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wide block mb-1.5">
                  Крок 1: Введіть Код Кімнати:
                </label>
                <input
                  type="text"
                  required
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  placeholder="напр. bunker-4829"
                  className="w-full px-4 py-3.5 bg-black/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:border-green-500 focus:outline-none font-mono tracking-wider"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(34,197,94,0.4)] text-sm sm:text-base flex items-center justify-center gap-2"
              >
                <Plug className="w-5 h-5" />
                <span>Підключитися до Кімнати</span>
              </button>
            </form>
          ) : (
            /* STEP 2: Name & Role Selection */
            <form onSubmit={handleJoinRoom} className="space-y-4 text-left pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <span className="text-xs text-green-400 font-mono flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Кімната: {connectedRoomCode}
                </span>
                <button
                  type="button"
                  onClick={() => setJoinStep(1)}
                  className="text-[11px] text-gray-400 hover:text-gray-200 font-mono flex items-center gap-1 underline"
                >
                  <ArrowLeft className="w-3 h-3" /> Змінити код
                </button>
              </div>

              <div>
                <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wide block mb-1">
                  Ім'я та Прізвище:
                </label>
                <input
                  type="text"
                  required
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="напр. Олексій Мельник"
                  className="w-full px-4 py-3 bg-black/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wide block mb-1">
                    Рівень Ієрархії:
                  </label>
                  <select
                    value={playerLevel}
                    onChange={(e) => setPlayerLevel(e.target.value as HierarchyLevel)}
                    className="w-full px-3 py-3 bg-black/60 border border-gray-700 rounded-lg text-sm text-gray-100 focus:border-green-500 focus:outline-none cursor-pointer"
                  >
                    {/* Head option */}
                    <option
                      value="Керівник"
                      disabled={isHeadFull}
                      className={isHeadFull ? 'text-gray-600 bg-gray-900' : ''}
                    >
                      {isHeadFull
                        ? `Керівник (Level 1) — Заповнено (${headCount}/${headLimit})`
                        : `Керівник (Level 1)${headLimit > 0 ? ` (${headCount}/${headLimit})` : ''}`}
                    </option>
                    {/* Team Lead option */}
                    <option
                      value="Тімлід"
                      disabled={isTLFull}
                      className={isTLFull ? 'text-gray-600 bg-gray-900' : ''}
                    >
                      {isTLFull
                        ? `Тімлід (Level 2) — Заповнено (${tlCount}/${tlLimit})`
                        : `Тімлід (Level 2)${tlLimit > 0 ? ` (${tlCount}/${tlLimit})` : ''}`}
                    </option>
                    {/* Manager option */}
                    <option
                      value="Менеджер"
                      disabled={isMgrFull}
                      className={isMgrFull ? 'text-gray-600 bg-gray-900' : ''}
                    >
                      {isMgrFull
                        ? `Менеджер (Level 3) — Заповнено (${mgrCount}/${mgrLimit})`
                        : `Менеджер (Level 3)${mgrLimit > 0 ? ` (${mgrCount}/${mgrLimit})` : ' (Без ліміту)'}`}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wide block mb-1">
                    Департамент:
                  </label>
                  <select
                    value={playerDepartment}
                    onChange={(e) => setPlayerDepartment(e.target.value as Department)}
                    className="w-full px-3 py-3 bg-black/60 border border-gray-700 rounded-lg text-sm text-gray-100 focus:border-green-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Форвард">Форвард (Booking)</option>
                    <option value="Методист">Методист (Lessons/Sales)</option>
                    <option value="Друга лінія">Друга лінія (Follow-up)</option>
                    <option value="Ретеншн">Ретеншн (Renewals)</option>
                    {playerLevel === 'Керівник' && (
                      <option value="Над усіма">Над усіма (Executive)</option>
                    )}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(34,197,94,0.4)] text-sm sm:text-base flex items-center justify-center gap-2 pt-3"
              >
                <Plug className="w-5 h-5" />
                <span>Увійти в Бункер</span>
              </button>
            </form>
          )}

          {/* Quick Footer Links */}
          <div className="pt-4 border-t border-gray-800 flex items-center justify-center text-[11px] font-mono text-gray-500">
            <button
              onClick={() => {
                sessionStorage.clear();
                localStorage.clear();
                window.location.reload();
              }}
              className="hover:text-gray-300 flex items-center gap-1 underline"
            >
              <RotateCcw className="w-3 h-3" /> Очистити сесію вкладки
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/50 text-red-300 text-xs font-mono">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  // View: Cinematic Intro Overlay
  if (gameState.phase === 'INTRO_CINEMATIC') {
    return (
      <CinematicIntro
        isHost={false}
        onFinish={handleFinishIntro}
      />
    );
  }

  // View: Endgame Victory/Defeat Overlay
  if (gameState.phase === 'ENDGAME') {
    return (
      <EndgameScreen
        isVictory={gameState.isVictory}
        isHost={false}
        onRestart={handleRestart}
      />
    );
  }

  // View: Player Terminal (Mobile)
  if (currentUser) {
    return (
      <PlayerTerminal
        player={currentUser}
        gameState={gameState}
        onAcknowledge={handleAcknowledge}
        onSubmitCascadeDecision={handleCascadeDecision}
        onRespondToMutiny={handleRespondToMutiny}
        onVoteReady={handleVoteReady}
        onSubmitVote={handleSubmitVote}
        onActivateSuperpower={handleActivateSuperpower}
        onSendGhostMessage={handleSendGhostMessage}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-xs font-mono text-gray-500">
      Завантаження системи бункеру...
    </div>
  );
}
