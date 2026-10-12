'use client';

import React, { useState, useEffect } from 'react';
import { getSocket } from '../../lib/socket';
import { GameState } from '../../lib/types';
import HostDashboard from '../../components/HostDashboard';
import CinematicIntro from '../../components/CinematicIntro';
import EndgameScreen from '../../components/EndgameScreen';
import { Lock, KeyRound, ShieldAlert, RotateCcw, UserPlus, LogOut, Crown } from 'lucide-react';

const ADMIN_PASSWORD = 'admin'; // Пароль адміністратора за замовчуванням

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  const [roomCode, setRoomCode] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Check saved admin session in sessionStorage
  useEffect(() => {
    const savedAuth = sessionStorage.getItem('corporate_bunker_admin_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }

    const savedRoom = sessionStorage.getItem('corporate_bunker_admin_room');
    if (savedRoom && savedAuth === 'true') {
      setRoomCode(savedRoom);
      joinAsAdmin(savedRoom);
    }
  }, []);

  const joinAsAdmin = (code: string) => {
    const socket = getSocket();
    setIsJoined(true);
    sessionStorage.setItem('corporate_bunker_admin_room', code);

    socket.emit('join_room', { roomCode: code, isHost: true });

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError('');
      sessionStorage.setItem('corporate_bunker_admin_auth', 'true');
    } else {
      setAuthError('Невірний пароль адміністратора.');
    }
  };

  const handleCreateOrJoinRoom = (codeToJoin?: string) => {
    const targetCode = codeToJoin || roomCode.trim().toLowerCase() || 'bunker-' + Math.floor(1000 + Math.random() * 9000);
    setRoomCode(targetCode);
    joinAsAdmin(targetCode);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('corporate_bunker_admin_auth');
    sessionStorage.removeItem('corporate_bunker_admin_room');
    setIsAuthenticated(false);
    setIsJoined(false);
    window.location.reload();
  };

  // Admin Actions
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

  const handleAddTestBots = (count: number = 10) => {
    if (!gameState) return;
    getSocket().emit('add_test_bots', { roomCode: gameState.roomCode, count });
  };

  const handleResetRoom = () => {
    if (!gameState) return;
    if (confirm('Скинути всю кімнату до початкового стану (Лобі)? Всі прогреси скинуться.')) {
      getSocket().emit('reset_room', { roomCode: gameState.roomCode });
    }
  };

  // ─── 1. Password Protection Modal ──────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0510] flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 border border-red-500/40 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-600/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-500 animate-pulse">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-red-500 neon-text-red">
              Панель Адміністратора (СЕО)
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Введіть пароль для доступу до командного центру
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введіть пароль (за замовчуванням: admin)"
                className="w-full px-4 py-3 bg-black/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:border-red-500 focus:outline-none font-mono"
              />
              <KeyRound className="w-4 h-4 text-gray-500 absolute right-3 top-3.5" />
            </div>

            {authError && (
              <p className="text-xs text-red-400 font-mono">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-lg transition-all text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            >
              <Crown className="w-4 h-4" />
              <span>Увійти як Адміністратор</span>
            </button>
          </form>

          <div className="pt-2 text-[11px] text-gray-500 font-mono">
            Підказка: стандартний пароль — <strong className="text-gray-300">admin</strong>
          </div>
        </div>
      </div>
    );
  }

  // ─── 2. Room Selection / Creation ──────────────────────────────
  if (!isJoined || !gameState) {
    return (
      <div className="min-h-screen bg-[#0a0510] flex items-center justify-center p-4">
        <div className="glass-card max-w-lg w-full p-8 border border-gray-800 text-center space-y-6">
          <Crown className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-black uppercase tracking-widest text-red-400">
            Керування Ігровою Кімнатою
          </h2>

          <div className="space-y-4">
            <button
              onClick={() => handleCreateOrJoinRoom()}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-lg transition-all text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            >
              <span>Створити нову кімнату (Auto Code)</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
              <span className="flex-1 border-t border-gray-800" />
              <span>АБО ПРИЄДНАТИСЯ ДО НАЯВНОЇ</span>
              <span className="flex-1 border-t border-gray-800" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="напр. bunker-4829"
                className="flex-1 px-4 py-3 bg-black/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:border-red-500 focus:outline-none font-mono"
              />
              <button
                onClick={() => handleCreateOrJoinRoom(roomCode)}
                disabled={!roomCode.trim()}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-bold uppercase rounded-lg text-xs"
              >
                Підключитись
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 font-mono underline block mx-auto pt-2"
          >
            Вийти з сесії адміністратора
          </button>
        </div>
      </div>
    );
  }

  // ─── 3. Active Admin Command Center ────────────────────────────
  return (
    <div>
      {/* Top Admin Tools Ribbon */}
      <div className="bg-red-950/60 border-b border-red-500/40 px-6 py-2 flex items-center justify-between text-xs font-mono text-red-200">
        <div className="flex items-center gap-3">
          <span className="font-bold flex items-center gap-1">
            <ShieldAlert className="w-4 h-4 text-red-400" /> АДМІН-РЕЖИМ (СЕО)
          </span>
          <span className="text-gray-500">•</span>
          <span>Кімната: <strong className="text-white">{gameState.roomCode}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Test Bots Button */}
          <button
            onClick={() => handleAddTestBots(10)}
            className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 rounded font-bold uppercase flex items-center gap-1 text-[11px] transition-colors"
            title="Швидко наповнити кімнату 10 ботами для тестування гри"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+10 тестових гравців</span>
          </button>

          {/* Reset Room Button */}
          <button
            onClick={handleResetRoom}
            className="px-2.5 py-1 bg-gray-800 hover:bg-red-950/60 border border-gray-700 hover:border-red-500/50 text-gray-300 hover:text-red-300 rounded font-bold uppercase flex items-center gap-1 text-[11px] transition-colors"
            title="Скинути стан гри до Лобі"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Скинути гру</span>
          </button>

          {/* Exit Admin */}
          <button
            onClick={handleLogout}
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
        />
      )}
    </div>
  );
}
