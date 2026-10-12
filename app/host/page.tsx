'use client';

import React, { useState, useEffect } from 'react';
import { getSocket } from '../../lib/socket';
import { GameState, RoleLimits } from '../../lib/types';
import HostDashboard from '../../components/HostDashboard';
import CinematicIntro from '../../components/CinematicIntro';
import EndgameScreen from '../../components/EndgameScreen';
import { Crown, Shield, Users, Radio, RotateCcw, LogOut, Settings, Plus } from 'lucide-react';

export default function HostPage() {
  const [roomCode, setRoomCode] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Role Limits Configuration when creating room
  const [roleLimits, setRoleLimits] = useState<RoleLimits>({
    'Керівник': 2,
    'Тімлід': 4,
    'Менеджер': 0, // 0 = unlimited
  });

  // Restore saved session in sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('corporate_bunker_host_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.roomCode) {
          setRoomCode(parsed.roomCode);
          joinAsHost(parsed.roomCode, parsed.roleLimits);
        }
      } catch (e) {
        console.error('Failed to parse host session:', e);
      }
    }
  }, []);

  const joinAsHost = (targetCode: string, limits?: RoleLimits) => {
    const socket = getSocket();
    setIsJoined(true);
    const activeLimits = limits || roleLimits;

    sessionStorage.setItem(
      'corporate_bunker_host_session',
      JSON.stringify({ roomCode: targetCode, roleLimits: activeLimits })
    );

    socket.emit('join_room', {
      roomCode: targetCode,
      isHost: true,
      roleLimits: activeLimits,
    });

    socket.on('state_update', (updated: GameState) => {
      setGameState(updated);
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
  };

  const handleCreateRoom = () => {
    const randomCode = 'bunker-' + Math.floor(1000 + Math.random() * 9000);
    setRoomCode(randomCode);
    joinAsHost(randomCode, roleLimits);
  };

  const handleConnectExisting = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCode.trim().toLowerCase();
    if (!clean) return;
    joinAsHost(clean);
  };

  const handleLeaveHostSession = () => {
    sessionStorage.removeItem('corporate_bunker_host_session');
    setIsJoined(false);
    setGameState(null);
    window.location.reload();
  };

  // Host Game Master Actions
  const handleStartGame = () => {
    if (!gameState) return;
    getSocket().emit('start_game', { roomCode: gameState.roomCode });
  };

  const handleFinishIntro = () => {
    if (!gameState) return;
    getSocket().emit('finish_intro', { roomCode: gameState.roomCode });
  };

  const handleTriggerCrisis = (crisisId: number) => {
    if (!gameState) return;
    getSocket().emit('trigger_crisis', { roomCode: gameState.roomCode, crisisId });
  };

  const handleAdvanceToNegotiation = () => {
    if (!gameState) return;
    getSocket().emit('advance_to_negotiation', { roomCode: gameState.roomCode });
  };

  const handleControlTimer = (action: 'start' | 'pause' | 'add' | 'skip', seconds?: number) => {
    if (!gameState) return;
    getSocket().emit('control_timer', { roomCode: gameState.roomCode, action, seconds });
  };

  const handleForceStartVoting = () => {
    if (!gameState) return;
    getSocket().emit('force_start_voting', { roomCode: gameState.roomCode });
  };

  const handleForceTallyVotes = () => {
    if (!gameState) return;
    getSocket().emit('force_tally_votes', { roomCode: gameState.roomCode });
  };

  const handleNextCrisis = () => {
    if (!gameState) return;
    getSocket().emit('next_crisis', { roomCode: gameState.roomCode });
  };

  const handleKickPlayer = (playerId: string) => {
    if (!gameState) return;
    getSocket().emit('kick_player', { roomCode: gameState.roomCode, playerId });
  };

  const handleResolveTiebreaker = (groupId: string, winningOptionId: string, isRandom?: boolean) => {
    if (!gameState) return;
    getSocket().emit('resolve_tiebreaker', {
      roomCode: gameState.roomCode,
      groupId,
      winningOptionId,
      isRandom,
    });
  };

  const handleUpdateRoleLimits = (newLimits: RoleLimits) => {
    if (!gameState) return;
    setRoleLimits(newLimits);
    getSocket().emit('update_role_limits', {
      roomCode: gameState.roomCode,
      roleLimits: newLimits,
    });
  };

  const handleResetRoom = () => {
    if (!gameState) return;
    if (confirm('Скинути всю кімнату до початкового стану (Лобі)?')) {
      getSocket().emit('reset_room', { roomCode: gameState.roomCode });
    }
  };

  // ─── 1. Host Room Setup Screen ──────────────────────────────────
  if (!isJoined || !gameState) {
    return (
      <div className="min-h-screen bg-[#0a0510] flex items-center justify-center p-4">
        <div className="glass-card max-w-lg w-full p-8 border border-red-500/40 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-600/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-500 animate-pulse">
            <Crown className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-red-500 neon-text-red">
              ПАНЕЛЬ ВЕДУЧОГО (GAME MASTER)
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Створення ігрової кімнати та налаштування лімітів ролей
            </p>
          </div>

          {/* Role Limits Settings Panel */}
          <div className="p-4 rounded-lg bg-black/60 border border-gray-800 text-left space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300 uppercase tracking-wider">
              <Settings className="w-4 h-4 text-red-400" />
              <span>Конфігурація Лімітів Ролей:</span>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <div className="p-2.5 rounded bg-gray-900/80 border border-gray-800 space-y-1">
                <label className="text-[10px] text-gray-400 uppercase block">Керівники (Max):</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={roleLimits['Керівник']}
                  onChange={(e) =>
                    setRoleLimits({ ...roleLimits, 'Керівник': Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className="w-full px-2 py-1.5 bg-black/80 border border-gray-700 rounded text-center text-white font-bold"
                />
              </div>

              <div className="p-2.5 rounded bg-gray-900/80 border border-gray-800 space-y-1">
                <label className="text-[10px] text-gray-400 uppercase block">Тімліди (Max):</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={roleLimits['Тімлід']}
                  onChange={(e) =>
                    setRoleLimits({ ...roleLimits, 'Тімлід': Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className="w-full px-2 py-1.5 bg-black/80 border border-gray-700 rounded text-center text-white font-bold"
                />
              </div>

              <div className="p-2.5 rounded bg-gray-900/80 border border-gray-800 space-y-1">
                <label className="text-[10px] text-gray-400 uppercase block">Менеджери (0 = Без ліміту):</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={roleLimits['Менеджер']}
                  onChange={(e) =>
                    setRoleLimits({ ...roleLimits, 'Менеджер': Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="w-full px-2 py-1.5 bg-black/80 border border-gray-700 rounded text-center text-white font-bold"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleCreateRoom}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-lg transition-all text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            >
              <Crown className="w-5 h-5" />
              <span>Створити Нову Кімнату</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-gray-600 font-mono py-1">
              <span className="flex-1 border-t border-gray-800" />
              <span>АБО ПІДКЛЮЧИТИСЯ ДО НАЯВНОЇ</span>
              <span className="flex-1 border-t border-gray-800" />
            </div>

            <form onSubmit={handleConnectExisting} className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="напр. bunker-4829"
                className="flex-1 px-4 py-3 bg-black/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:border-red-500 focus:outline-none font-mono"
              />
              <button
                type="submit"
                disabled={!roomCode.trim()}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-bold uppercase rounded-lg text-xs"
              >
                Підключитись
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── 2. Active Game Master Command Center ──────────────────────
  return (
    <div>
      {/* Top Ribbon */}
      <div className="bg-red-950/60 border-b border-red-500/40 px-6 py-2 flex items-center justify-between text-xs font-mono text-red-200">
        <div className="flex items-center gap-3">
          <span className="font-bold flex items-center gap-1">
            <Crown className="w-4 h-4 text-red-400" /> РЕЖИМ ВЕДУЧОГО (GAME MASTER)
          </span>
          <span className="text-gray-500">•</span>
          <span>
            Кімната: <strong className="text-white">{gameState.roomCode}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetRoom}
            className="px-2.5 py-1 bg-gray-800 hover:bg-red-950/60 border border-gray-700 hover:border-red-500/50 text-gray-300 hover:text-red-300 rounded font-bold uppercase flex items-center gap-1 text-[11px] transition-colors"
            title="Скинути стан гри до Лобі"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Скинути гру</span>
          </button>

          <button
            onClick={handleLeaveHostSession}
            className="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-gray-200 rounded font-bold uppercase flex items-center gap-1 text-[11px] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Вийти</span>
          </button>
        </div>
      </div>

      {/* Main View Logic */}
      {gameState.phase === 'INTRO_CINEMATIC' ? (
        <CinematicIntro isHost={true} onFinish={handleFinishIntro} />
      ) : gameState.phase === 'ENDGAME' ? (
        <EndgameScreen isVictory={gameState.isVictory} isHost={true} onRestart={handleResetRoom} />
      ) : (
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
          onKickPlayer={handleKickPlayer}
          onResolveTiebreaker={handleResolveTiebreaker}
          onUpdateRoleLimits={handleUpdateRoleLimits}
        />
      )}
    </div>
  );
}
