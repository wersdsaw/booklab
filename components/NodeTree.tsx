'use client';

import React from 'react';
import { Player, GamePhase, CascadeState } from '../lib/types';
import { Crown, Shield, Users, Ghost, AlertTriangle, CheckCircle2, Clock, UserX } from 'lucide-react';

interface NodeTreeProps {
  players: Record<string, Player>;
  phase: GamePhase;
  cascade: CascadeState | null;
  onSelectPlayer?: (player: Player) => void;
  onKickPlayer?: (playerId: string) => void;
}

export default function NodeTree({ players, phase, cascade, onSelectPlayer, onKickPlayer }: NodeTreeProps) {
  const allPlayers = Object.values(players);

  const heads = allPlayers.filter((p) => p.level === 'Керівник');
  const teamLeads = allPlayers.filter((p) => p.level === 'Тімлід');
  const managers = allPlayers.filter((p) => p.level === 'Менеджер');

  // Determine who is currently holding up the game
  const isPending = (p: Player): boolean => {
    if (p.isEliminated || !p.online) return false;

    if (phase === 'PROFILE_ACK') {
      return !p.isAcknowledged;
    }

    if (phase === 'CASCADE' && cascade) {
      if (cascade.currentStep === 'head' && p.level === 'Керівник') {
        const group = cascade.consensusGroups?.['head'];
        return group ? !group.votes[p.id] : !cascade.headDecision;
      }
      if (cascade.currentStep === 'teamLead' && p.level === 'Тімлід') {
        const group = cascade.consensusGroups?.['teamLead:' + p.department];
        return group ? !group.votes[p.id] : !cascade.teamLeadDecisions[p.id];
      }
      if (cascade.currentStep === 'manager' && p.level === 'Менеджер') {
        const group = cascade.consensusGroups?.['manager:' + p.department];
        return group ? !group.votes[p.id] : !cascade.managerDecisions[p.id];
      }
    }

    if (phase === 'PURGE_VOTING') {
      return !p.hasVoted;
    }

    return false;
  };

  const hasVotedInCascade = (p: Player): boolean => {
    if (!cascade || phase !== 'CASCADE') return false;
    if (cascade.currentStep === 'head' && p.level === 'Керівник') {
      return !!cascade.consensusGroups?.['head']?.votes[p.id];
    }
    if (cascade.currentStep === 'teamLead' && p.level === 'Тімлід') {
      return !!cascade.consensusGroups?.['teamLead:' + p.department]?.votes[p.id];
    }
    if (cascade.currentStep === 'manager' && p.level === 'Менеджер') {
      return !!cascade.consensusGroups?.['manager:' + p.department]?.votes[p.id];
    }
    return false;
  };

  const renderPlayerCard = (p: Player) => {
    const pending = isPending(p);
    const votedInCascade = hasVotedInCascade(p);

    return (
      <div
        key={p.id}
        onClick={() => onSelectPlayer && onSelectPlayer(p)}
        className={`p-3 rounded-lg border transition-all duration-300 relative ${
          p.isEliminated
            ? 'bg-gray-900/40 border-gray-800 text-gray-500 opacity-60'
            : pending
            ? 'bg-amber-950/20 border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse'
            : 'bg-black/40 border-gray-800 hover:border-gray-600'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                p.online ? 'bg-green-500' : 'bg-gray-600'
              }`}
            />
            <span
              className={`font-bold text-xs truncate ${
                p.isEliminated ? 'line-through text-gray-500' : 'text-gray-100'
              }`}
            >
              {p.name}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {p.isEliminated && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400 font-mono bg-gray-800/80 px-1.5 py-0.5 rounded">
                <Ghost className="w-3 h-3" /> Привид
              </span>
            )}

            {votedInCascade && !p.isEliminated && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-400 font-mono bg-green-950/80 border border-green-500/40 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" /> Проголосував
              </span>
            )}

            {pending && !p.isEliminated && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded animate-pulse">
                <Clock className="w-3 h-3" /> Очікує
              </span>
            )}

            {/* Host Kick Button */}
            {onKickPlayer && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Ви впевнені, що хочете вигнати гравця "${p.name}" з бункеру?`)) {
                    onKickPlayer(p.id);
                  }
                }}
                title={`Вигнати гравця ${p.name}`}
                className="p-1 rounded bg-red-950/70 hover:bg-red-800 text-red-400 hover:text-white border border-red-500/40 transition-colors"
              >
                <UserX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
          <span>{p.department}</span>
          <span className="text-gray-300 font-semibold">
            {p.salary.toLocaleString('uk-UA')} ₴
          </span>
        </div>

        {/* Host Secret Flaw Indicator */}
        {p.flaw && (
          <div className="mt-1.5 pt-1.5 border-t border-red-500/20 flex items-center gap-1 text-[10px] text-red-400 font-bold uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
            <span className="truncate">{p.flaw.name}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tier 1: Керівники (Heads) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-red-400" />
          <h4 className="text-xs font-black uppercase tracking-widest text-red-400">
            Рівень 1: Керівники ({heads.length})
          </h4>
          <span className="text-[10px] text-gray-500 font-mono">Фіксовано 30,000 ₴</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {heads.length > 0 ? (
            heads.map(renderPlayerCard)
          ) : (
            <p className="text-xs text-gray-600 font-mono italic">Немає призначених керівників</p>
          )}
        </div>
      </div>

      {/* Tier 2: Тімліди (Team Leads) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">
            Рівень 2: Тімліди ({teamLeads.length})
          </h4>
          <span className="text-[10px] text-gray-500 font-mono">Фіксовано 15,000 ₴</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {teamLeads.length > 0 ? (
            teamLeads.map(renderPlayerCard)
          ) : (
            <p className="text-xs text-gray-600 font-mono italic">Немає призначених тімлідів</p>
          )}
        </div>
      </div>

      {/* Tier 3: Менеджери (Managers) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-green-400" />
          <h4 className="text-xs font-black uppercase tracking-widest text-green-400">
            Рівень 3: Менеджери ({managers.length})
          </h4>
          <span className="text-[10px] text-gray-500 font-mono">1,000 - 25,000 ₴</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
          {managers.length > 0 ? (
            managers.map(renderPlayerCard)
          ) : (
            <p className="text-xs text-gray-600 font-mono italic">Немає призначених менеджерів</p>
          )}
        </div>
      </div>
    </div>
  );
}
