'use client';

import React from 'react';
import { GameState, Player, Department } from '../lib/types';
import { CRISES_DATA } from '../lib/crises';
import ProfileAcknowledgment from './ProfileAcknowledgment';
import CrisisCascade from './CrisisCascade';
import MutinyModal from './MutinyModal';
import NegotiationTimer from './NegotiationTimer';
import PurgeVoting from './PurgeVoting';
import GhostMode from './GhostMode';
import { User, ShieldAlert, Zap, Ghost, Radio, LogOut } from 'lucide-react';

interface PlayerTerminalProps {
  player: Player;
  gameState: GameState;
  onAcknowledge: () => void;
  onSubmitCascadeDecision: (optionId: string, text: string, isFlawed: boolean, isSabotage?: boolean) => void;
  onRespondToMutiny: (accept: boolean) => void;
  onVoteReady: (ready: boolean) => void;
  onSubmitVote: (targetDept: Department, targetPlayerId: string, reason: string) => void;
  onActivateSuperpower: () => void;
  onSendGhostMessage: (message: string) => void;
  onLeaveRoom?: () => void;
}

export default function PlayerTerminal({
  player,
  gameState,
  onAcknowledge,
  onSubmitCascadeDecision,
  onRespondToMutiny,
  onVoteReady,
  onSubmitVote,
  onActivateSuperpower,
  onSendGhostMessage,
  onLeaveRoom,
}: PlayerTerminalProps) {
  const currentCrisis = CRISES_DATA[gameState.currentCrisisIndex] || CRISES_DATA[0];

  const isMutinyForMe =
    gameState.cascade?.mutinyProposal &&
    gameState.cascade.mutinyProposal.department === player.department &&
    gameState.cascade.mutinyProposal.initiatorId !== player.id &&
    !gameState.cascade.mutinyProposal.accepted.includes(player.id) &&
    !gameState.cascade.mutinyProposal.rejected.includes(player.id);

  return (
    <div
      className={`min-h-screen bg-[#0a0510] text-gray-100 flex flex-col font-sans transition-all ${
        player.isEliminated ? 'ghost-mode-active' : ''
      }`}
    >
      {/* ─── MOBILE-OPTIMIZED PLAYER HEADER ──────────────────────── */}
      <header className="border-b border-gray-800 bg-black/60 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center text-green-400 flex-shrink-0">
            {player.isEliminated ? <Ghost className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-100 truncate">
              {player.name}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 truncate">
              <span>{player.level}</span>
              <span>•</span>
              <span className="text-gray-300">{player.department}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Salary Badge */}
          <span className="text-[11px] font-mono font-bold text-green-400 bg-green-950/40 border border-green-500/30 px-2 py-0.5 rounded">
            {player.salary.toLocaleString('uk-UA')} ₴
          </span>

          {/* Superpower Trigger Pill (if flaw exists and superpower unused) */}
          {player.flaw && !player.flaw.superpowerUsed && !player.isEliminated && (
            <button
              onClick={onActivateSuperpower}
              title={`Активувати суперсилу: ${player.flaw.superpower}`}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-300 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Суперсила</span>
            </button>
          )}

          {/* Leave Room / End Session */}
          {onLeaveRoom && (
            <button
              onClick={onLeaveRoom}
              title="Завершити сесію та вийти"
              className="p-1.5 bg-gray-900 hover:bg-red-950/60 border border-gray-700 hover:border-red-500/60 text-gray-400 hover:text-red-400 rounded transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* ─── MAIN CONTENT FEED ────────────────────────────────────── */}
      <main className="flex-1 p-4 max-w-2xl w-full mx-auto space-y-4">
        {/* Collapsible Profile & Flaw Bar */}
        <ProfileAcknowledgment
          player={player}
          onAcknowledge={onAcknowledge}
          isCollapsedDefault={gameState.phase !== 'PROFILE_ACK'}
        />

        {/* Phase-Driven Dynamic Action Views */}
        {gameState.phase === 'LOBBY' && (
          <div className="glass-card p-8 text-center space-y-4 my-8">
            <Radio className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
            <h3 className="text-base font-black uppercase tracking-widest text-amber-400">
              Очікування Запуску Симуляції
            </h3>
            <p className="text-xs text-gray-400 font-mono">
              Ви успішно підключені до бункеру. Ведучий (СЕО) незабаром почне гру.
            </p>
          </div>
        )}

        {gameState.phase === 'CRISIS_TRIGGER' && (
          <div className="glass-card p-6 text-center space-y-3 my-6">
            <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500 flex items-center justify-center mx-auto text-red-500 animate-spin">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">
              Очікування Директиви від Керівництва
            </h3>
            <p className="text-xs text-gray-500 font-mono">
              Рада директорів формулює кризовий сценарій...
            </p>
          </div>
        )}

        {/* Phase 4: Cascade Action Feed */}
        {gameState.phase === 'CASCADE' && gameState.cascade && (
          <CrisisCascade
            player={player}
            crisis={currentCrisis}
            cascade={gameState.cascade}
            onSubmitDecision={onSubmitCascadeDecision}
          />
        )}

        {/* Phase 5: Consequence & Negotiation Timer */}
        {gameState.phase === 'NEGOTIATION_TIMER' && (
          <NegotiationTimer
            consequenceText={currentCrisis.consequenceText}
            remainingSeconds={gameState.timer.remainingSeconds}
            totalSeconds={gameState.timer.totalSeconds}
            isRunning={gameState.timer.isRunning}
            hasVotedReady={player.id in gameState.timer.votingReadyVotes}
            myReadyVote={gameState.timer.votingReadyVotes[player.id]}
            onVoteReady={onVoteReady}
            showConsensusPrompt={gameState.timer.remainingSeconds <= 120}
          />
        )}

        {/* Phase 6: 3-Step Purge Voting */}
        {gameState.phase === 'PURGE_VOTING' && !player.isEliminated && (
          <PurgeVoting
            currentUser={player}
            players={gameState.players}
            onSubmitVote={onSubmitVote}
          />
        )}

        {/* Results of Purge Voting */}
        {gameState.phase === 'VOTE_RESULTS' && gameState.eliminatedThisRound && (
          <div className="glass-card p-6 border-2 border-red-500 text-center space-y-4 my-6 neon-glow-red">
            <div className="w-14 h-14 rounded-full bg-red-600/30 border-2 border-red-500 flex items-center justify-center mx-auto text-red-400">
              <Ghost className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black uppercase tracking-widest text-red-400">
              Співробітника Звільнено!
            </h3>
            <p className="text-sm font-bold text-gray-100">
              {gameState.eliminatedThisRound.name} набрав більшість голосів ({gameState.eliminatedThisRound.votesCount}) і переходить у Режим Привида.
            </p>
            {gameState.eliminatedThisRound.hadShield && (
              <p className="text-xs text-amber-400 font-mono">
                🛡️ Співробітник використав "Командний щит", але це не врятувало його від повної чистки.
              </p>
            )}
          </div>
        )}

        {/* Ghost Mode Terminal if eliminated */}
        {player.isEliminated && (
          <GhostMode
            playerName={player.name}
            onSendGhostMessage={onSendGhostMessage}
          />
        )}
      </main>

      {/* Secret Mutiny Overlay Modal */}
      {isMutinyForMe && gameState.cascade?.mutinyProposal && (
        <MutinyModal
          initiatorName={gameState.cascade.mutinyProposal.initiatorName}
          department={player.department}
          onRespond={onRespondToMutiny}
        />
      )}
    </div>
  );
}
