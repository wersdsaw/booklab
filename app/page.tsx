'use client';

import React, { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';
import {
  GameState,
  Player,
  HierarchyLevel,
  Department,
  GamePhase,
} from '../lib/types';
import { generateSalaryAndLore } from '../lib/lore';
import HostDashboard from '../components/HostDashboard';
import PlayerTerminal from '../components/PlayerTerminal';
import CinematicIntro from '../components/CinematicIntro';
import EndgameScreen from '../components/EndgameScreen';
import { Skull, Crown, User, Plug, ShieldAlert, KeyRound, RotateCcw } from 'lucide-react';

export default function HomePage() {
  const [isHost, setIsHost] = useState(false);
  const [inGame, setInGame] = useState(false);

  // Player Onboarding Fields
  const [playerName, setPlayerName] = useState('');
  const [playerLevel, setPlayerLevel] = useState<HierarchyLevel>('Менеджер');
  const [playerDepartment, setPlayerDepartment] = useState<Department>('Форвард');
  const [roomCodeInput, setRoomCodeInput] = useState('');

  // Active User & Synced Game State
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize Socket.io connection & restore session (isolated per browser tab via sessionStorage)
  useEffect(() => {
    // Clear old shared localStorage if present so it doesn't pollute tabs
    localStorage.removeItem('corporate_bunker_session');

    const socket = getSocket();

    socket.on('connect', () => {
      // Check for saved session in sessionStorage (specific to THIS browser tab!)
      const savedSession = sessionStorage.getItem('corporate_bunker_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if (parsed.isHost && parsed.roomCode) {
            setIsHost(true);
            setInGame(true);
            socket.emit('join_room', { roomCode: parsed.roomCode, isHost: true });
          } else if (parsed.player && parsed.roomCode) {
            setCurrentUser(parsed.player);
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

    socket.on('state_update', (updatedState: GameState) => {
      setGameState(updatedState);
      // If we are a player, update our own profile reference from server state
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
      socket.off('state_update');
      socket.off('timer_tick');
      socket.off('error_message');
    };
  }, [currentUser]);

  // ─── ACTION HANDLERS ──────────────────────────────────────────────

  // 1. Create Room as Host
  const handleCreateRoom = () => {
    const randomCode = 'bunker-' + Math.floor(1000 + Math.random() * 9000);
    const socket = getSocket();
    setIsHost(true);
    setInGame(true);

    // Isolated per tab via sessionStorage
    sessionStorage.setItem(
      'corporate_bunker_session',
      JSON.stringify({ isHost: true, roomCode: randomCode })
    );

    socket.emit('join_room', { roomCode: randomCode, isHost: true });
  };

  // 2. Join Room as Player
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = playerName.trim();
    const cleanCode = roomCodeInput.trim().toLowerCase();

    if (!cleanName) {
      setErrorMsg("Будь ласка, введіть ваше ім'я та прізвище.");
      return;
    }
    if (!cleanCode) {
      setErrorMsg('Будь ласка, введіть код кімнати.');
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

  // View A: Onboarding & Entry Point
  if (!inGame || !gameState) {
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

          {/* Mode Switch Tabs */}
          <div className="flex border border-gray-700 rounded-lg overflow-hidden text-xs sm:text-sm font-bold uppercase tracking-wider">
            <button
              onClick={() => setIsHost(false)}
              className={`flex-1 py-3 transition-colors flex items-center justify-center gap-1.5 ${
                !isHost
                  ? 'bg-red-600/20 text-red-400 border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <User className="w-4 h-4" /> Я Гравець
            </button>
            <button
              onClick={() => setIsHost(true)}
              className={`flex-1 py-3 transition-colors flex items-center justify-center gap-1.5 ${
                isHost
                  ? 'bg-red-600/20 text-red-400 border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Crown className="w-4 h-4" /> Я Ведучий
            </button>
          </div>

          {/* Host Mode UI */}
          {isHost ? (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-gray-300 font-sans">
                Створіть ігрову кімнату для проекції на великий екран.
              </p>
              <button
                onClick={handleCreateRoom}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-300 shadow-[0_0_25px_rgba(239,68,68,0.5)] text-sm sm:text-base flex items-center justify-center gap-2"
              >
                <Crown className="w-5 h-5" />
                <span>Створити Кімнату</span>
              </button>

              <div className="pt-2">
                <a
                  href="/admin"
                  className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-mono underline"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Перейти до захищеної Панелі СЕО (/admin)</span>
                </a>
              </div>
            </div>
          ) : (
            /* Player Mode UI */
            <form onSubmit={handleJoinRoom} className="space-y-3.5 text-left pt-2">
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
                    <option value="Керівник">Керівник (Level 1)</option>
                    <option value="Тімлід">Тімлід (Level 2)</option>
                    <option value="Менеджер">Менеджер (Level 3)</option>
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

              <div>
                <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wide block mb-1">
                  Код Кімнати:
                </label>
                <input
                  type="text"
                  required
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  placeholder="напр. bunker-4829"
                  className="w-full px-4 py-3 bg-black/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:border-green-500 focus:outline-none font-mono tracking-wider"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(34,197,94,0.4)] text-sm sm:text-base flex items-center justify-center gap-2 pt-3"
              >
                <Plug className="w-5 h-5" />
                <span>Підключитись до Бункеру</span>
              </button>
            </form>
          )}

          {/* Quick Footer Links */}
          <div className="pt-4 border-t border-gray-800 flex items-center justify-between text-[11px] font-mono text-gray-500">
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

            <a
              href="/admin"
              className="text-red-400 hover:text-red-300 flex items-center gap-1 underline"
            >
              <KeyRound className="w-3 h-3" /> Вхід СЕО (/admin)
            </a>
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
        isHost={isHost}
        onFinish={handleFinishIntro}
      />
    );
  }

  // View: Endgame Victory/Defeat Overlay
  if (gameState.phase === 'ENDGAME') {
    return (
      <EndgameScreen
        isVictory={gameState.isVictory}
        isHost={isHost}
        onRestart={handleRestart}
      />
    );
  }

  // View: Host Command Center (Desktop)
  if (isHost) {
    return (
      <HostDashboard
        gameState={gameState}
        onStartGame={handleStartGame}
        onFinishIntro={handleFinishIntro}
        onTriggerCrisis={handleTriggerCrisis}
        onAdvanceToNegotiation={handleAdvanceToNegotiation}
        onControlTimer={handleControlTimer}
        onForceStartVoting={handleForceStartVoting}
        onForceTallyVotes={handleForceTallyVotes}
        onNextCrisis={handleNextCrisis}
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
