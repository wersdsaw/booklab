'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GameState, Player, AuditLogEntry } from '../lib/types';
import { CRISES_DATA } from '../lib/crises';
import NodeTree from './NodeTree';
import {
  Skull,
  Play,
  Pause,
  PlusCircle,
  FastForward,
  Copy,
  Check,
  Users,
  Ghost,
  Terminal,
  AlertTriangle,
  Flame,
  Radio,
  Eye,
  Award,
} from 'lucide-react';

interface HostDashboardProps {
  gameState: GameState;
  onStartGame: () => void;
  onFinishIntro: () => void;
  onTriggerCrisis: (crisisId: number) => void;
  onAdvanceToNegotiation: () => void;
  onControlTimer: (action: 'start' | 'pause' | 'add' | 'skip', seconds?: number) => void;
  onForceStartVoting: () => void;
  onForceTallyVotes: () => void;
  onNextCrisis: () => void;
}

export default function HostDashboard({
  gameState,
  onStartGame,
  onFinishIntro,
  onTriggerCrisis,
  onAdvanceToNegotiation,
  onControlTimer,
  onForceStartVoting,
  onForceTallyVotes,
  onNextCrisis,
}: HostDashboardProps) {
  const [activeTab, setActiveTab] = useState<'tree' | 'crises' | 'votes'>('tree');
  const [logFilter, setLogFilter] = useState<'all' | 'sabotage' | 'votes' | 'ghost'>('all');
  const [copied, setCopied] = useState(false);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  const players = Object.values(gameState.players);
  const alivePlayers = players.filter((p) => !p.isEliminated);
  const ghostPlayers = players.filter((p) => p.isEliminated);
  const acknowledgedCount = players.filter((p) => p.isAcknowledged).length;

  const currentCrisis = CRISES_DATA[gameState.currentCrisisIndex] || CRISES_DATA[0];

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [gameState.logs]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = gameState.logs.filter((log) => {
    if (logFilter === 'all') return true;
    if (logFilter === 'sabotage') return log.type === 'sabotage' || log.message.includes('Саботаж');
    if (logFilter === 'votes') return log.type === 'vote';
    if (logFilter === 'ghost') return log.isGhostMessage;
    return true;
  });

  const minutes = Math.floor(gameState.timer.remainingSeconds / 60);
  const seconds = gameState.timer.remainingSeconds % 60;
  const timerDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#0a0510] text-gray-100 flex flex-col font-sans">
      {/* ─── TOP COMMAND BAR ────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-black/60 backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Skull className="w-7 h-7 text-red-500 animate-pulse" />
          <div>
            <h1 className="text-base sm:text-lg font-black uppercase tracking-widest text-red-500 neon-text-red">
              КОМАНДНИЙ ЦЕНТР СЕО
            </h1>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider block">
              Corporate Bunker Control System
            </span>
          </div>
        </div>

        {/* Room Code & Stats */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap font-mono">
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-2 bg-gray-900/80 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-xs transition-colors group"
          >
            <span className="text-gray-400">КОД:</span>
            <span className="text-green-400 font-bold tracking-widest">{gameState.roomCode}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-green-400" />
            )}
          </button>

          <div className="flex items-center gap-2 text-xs">
            <Users className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-bold">{alivePlayers.length}</span>
            <span className="text-gray-500">живих</span>
            {ghostPlayers.length > 0 && (
              <>
                <span className="text-gray-700">|</span>
                <Ghost className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 font-bold">{ghostPlayers.length}</span>
                <span className="text-gray-500">привидів</span>
              </>
            )}
          </div>

          <div className="px-3 py-1 rounded bg-red-950/40 border border-red-500/40 text-red-400 font-bold text-xs uppercase tracking-wider">
            Фаза: {gameState.phase}
          </div>
        </div>
      </header>

      {/* ─── SUBHEADER ACTION TOOLBAR ────────────────────────────── */}
      <div className="bg-gray-950/70 border-b border-gray-800 px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap text-xs">
        {/* Quick Phase Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {gameState.phase === 'LOBBY' && (
            <button
              onClick={onStartGame}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.4)]"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Запустити гру (Start Simulation)</span>
            </button>
          )}

          {gameState.phase === 'INTRO_CINEMATIC' && (
            <button
              onClick={onFinishIntro}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Пропустити інтро → Ознайомлення</span>
            </button>
          )}

          {gameState.phase === 'PROFILE_ACK' && (
            <div className="flex items-center gap-2 text-amber-400 font-mono">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Ознайомились: {acknowledgedCount} / {players.length}</span>
            </div>
          )}

          {gameState.phase === 'CASCADE' && (
            <button
              onClick={onAdvanceToNegotiation}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Завершити каскад → Таймер 7:00</span>
            </button>
          )}

          {gameState.phase === 'NEGOTIATION_TIMER' && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black text-amber-400 bg-black/60 px-2 py-1 rounded border border-amber-500/30">
                ⏱ {timerDisplay}
              </span>
              <button
                onClick={() => onControlTimer(gameState.timer.isRunning ? 'pause' : 'start')}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded"
                title={gameState.timer.isRunning ? 'Пауза' : 'Пуск'}
              >
                {gameState.timer.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onControlTimer('add', 60)}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded flex items-center gap-1 text-[11px]"
                title="+1 хвилина"
              >
                <PlusCircle className="w-3.5 h-3.5" /> +1хв
              </button>
              <button
                onClick={onForceStartVoting}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold uppercase tracking-wider transition-all"
              >
                Перейти до чистки (Голосування)
              </button>
            </div>
          )}

          {gameState.phase === 'PURGE_VOTING' && (
            <div className="flex items-center gap-3">
              <span className="text-red-400 font-mono">
                Проголосували: {players.filter((p) => p.hasVoted).length} / {alivePlayers.length}
              </span>
              <button
                onClick={onForceTallyVotes}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold uppercase tracking-wider transition-all"
              >
                Підрахувати голоси зараз
              </button>
            </div>
          )}

          {gameState.phase === 'VOTE_RESULTS' && (
            <button
              onClick={onNextCrisis}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Перейти до наступної кризи ({gameState.currentCrisisIndex + 2} / 5)</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── MAIN 2-COLUMN WORKSPACE ─────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
        {/* Left Column: Interactive Visuals & Controls (2 cols) */}
        <div className="lg:col-span-2 border-r border-gray-800 p-6 overflow-y-auto space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border border-gray-800 rounded-lg p-1 bg-black/40 gap-1 text-xs">
            <button
              onClick={() => setActiveTab('tree')}
              className={`flex-1 py-2 font-bold uppercase tracking-wider rounded transition-colors ${
                activeTab === 'tree' ? 'bg-red-600/30 text-red-400 border border-red-500/40' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 inline mr-1.5" />
              Ієрархія (Live Node Tree)
            </button>
            <button
              onClick={() => setActiveTab('crises')}
              className={`flex-1 py-2 font-bold uppercase tracking-wider rounded transition-colors ${
                activeTab === 'crises' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/40' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 inline mr-1.5" />
              Кризи ({CRISES_DATA.length})
            </button>
            <button
              onClick={() => setActiveTab('votes')}
              className={`flex-1 py-2 font-bold uppercase tracking-wider rounded transition-colors ${
                activeTab === 'votes' ? 'bg-purple-600/30 text-purple-400 border border-purple-500/40' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Skull className="w-3.5 h-3.5 inline mr-1.5" />
              Бюлетені Голосування ({gameState.votes.length})
            </button>
          </div>

          {/* TAB 1: Live Node Tree */}
          {activeTab === 'tree' && (
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">
                  Карта Організаційної Структури та Саботажу
                </h3>
                <span className="text-[11px] font-mono text-gray-500">
                  Підсвічено жовтим = затримує каскад
                </span>
              </div>
              <NodeTree
                players={gameState.players}
                phase={gameState.phase}
                cascade={gameState.cascade}
              />
            </div>
          )}

          {/* TAB 2: Crisis Launcher */}
          {activeTab === 'crises' && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                Запуск Сюжетних Криз (Total 5 Crises):
              </h3>
              <div className="space-y-3">
                {CRISES_DATA.map((cr) => {
                  const isCurrent = gameState.currentCrisisIndex === cr.id - 1;
                  return (
                    <div
                      key={cr.id}
                      className={`glass-card p-4 border transition-all ${
                        isCurrent
                          ? 'border-red-500/70 bg-red-950/20 neon-glow-red'
                          : 'border-gray-800 bg-black/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase text-red-400 font-bold">
                            КРИЗА #{cr.id}
                          </span>
                          <h4 className="font-bold text-sm text-gray-100">{cr.title}</h4>
                          <p className="text-xs text-gray-400 font-sans mt-1">
                            {cr.ambiguousPrompt}
                          </p>
                        </div>
                        <button
                          onClick={() => onTriggerCrisis(cr.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex-shrink-0 transition-colors"
                        >
                          Запустити
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Voting Results */}
          {activeTab === 'votes' && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">
                Журнал Голосування на Виліт:
              </h3>
              {gameState.votes.length === 0 ? (
                <p className="text-xs text-gray-500 font-mono italic">
                  Голосів ще не зафіксовано.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {gameState.votes.map((v, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-black/50 border border-gray-800 text-xs font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-red-400 font-bold">{v.voterName}</span>
                        <span className="text-gray-500">→ проти →</span>
                        <span className="text-amber-400 font-bold">
                          {v.targetPlayerName} ({v.targetDepartment})
                        </span>
                      </div>
                      <p className="text-gray-300 font-sans text-[11px] pt-1 border-t border-gray-900">
                        Причина: "{v.reason}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Audit Log / Mutation Terminal (1 col) */}
        <div className="flex flex-col h-[600px] lg:h-[calc(100vh-100px)] bg-black/60">
          {/* Terminal Header & Filter Bar */}
          <div className="p-3 border-b border-gray-800 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-400" />
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                Термінал Аудиту
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px]">
              {(['all', 'sabotage', 'votes', 'ghost'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-2 py-0.5 rounded uppercase ${
                    logFilter === filter
                      ? 'bg-green-600 text-white font-bold'
                      : 'text-gray-500 hover:text-gray-300 bg-gray-900'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Scrolling Terminal Output */}
          <div
            ref={logTerminalRef}
            className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1.5 terminal-scanlines"
          >
            {filteredLogs.map((entry) => {
              const isSabotage =
                entry.type === 'sabotage' || entry.message.includes('Саботаж') || entry.message.includes('бунт');

              return (
                <div
                  key={entry.id}
                  className={`leading-relaxed ${
                    entry.isGhostMessage
                      ? 'text-purple-300 bg-purple-950/20 p-2 rounded border border-purple-500/30'
                      : isSabotage
                      ? 'text-red-400 bg-red-950/20 p-2 rounded border border-red-500/30 font-bold'
                      : entry.type === 'vote'
                      ? 'text-amber-300'
                      : entry.type === 'crisis'
                      ? 'text-red-300'
                      : 'text-gray-400'
                  }`}
                >
                  <span className="text-gray-600">[{entry.timestamp}]</span>{' '}
                  <span
                    className={
                      isSabotage
                        ? 'text-red-500 font-extrabold'
                        : entry.isGhostMessage
                        ? 'text-purple-400 font-bold'
                        : 'text-green-400'
                    }
                  >
                    [{entry.sender}]
                  </span>
                  : {entry.message}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
