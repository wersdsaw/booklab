'use client';

import React, { useState } from 'react';
import { Player, Crisis, CascadeState, CrisisOption } from '../lib/types';
import { motion } from 'framer-motion';
import { AlertTriangle, Send, Skull, CheckCircle, ShieldAlert, Clock } from 'lucide-react';

interface CrisisCascadeProps {
  player: Player;
  crisis: Crisis;
  cascade: CascadeState;
  onSubmitDecision: (optionId: string, text: string, isFlawed: boolean, isSabotage?: boolean) => void;
}

export default function CrisisCascade({
  player,
  crisis,
  cascade,
  onSubmitDecision,
}: {
  player: Player;
  crisis: Crisis;
  cascade: CascadeState;
  onSubmitDecision: (optionId: string, text: string, isFlawed: boolean, isSabotage?: boolean) => void;
}) {
  const [customText, setCustomText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Consensus group for this player
  const myGroupId =
    player.level === 'Керівник'
      ? 'head'
      : player.level === 'Тімлід'
      ? 'teamLead:' + player.department
      : 'manager:' + player.department;

  const myGroup = cascade.consensusGroups?.[myGroupId];

  // Check if player has already made a decision in this crisis
  const hasPlayerDecided = (): boolean => {
    if (submitted) return true;
    if (myGroup && myGroup.votes && myGroup.votes[player.id]) {
      return true;
    }
    if (myGroup && myGroup.isResolved) {
      return true;
    }
    if (player.level === 'Керівник') {
      return cascade.headDecision?.playerId === player.id;
    }
    if (player.level === 'Тімлід') {
      return !!cascade.teamLeadDecisions[player.department] || !!cascade.teamLeadDecisions[player.id];
    }
    if (player.level === 'Менеджер') {
      return !!cascade.managerDecisions[player.department] || !!cascade.managerDecisions[player.id];
    }
    return false;
  };

  const isCurrentStepForPlayer = (): boolean => {
    if (player.level === 'Керівник') return cascade.currentStep === 'head';
    if (player.level === 'Тімлід') return cascade.currentStep === 'teamLead';
    if (player.level === 'Менеджер') return cascade.currentStep === 'manager';
    return false;
  };

  const alreadyDecided = hasPlayerDecided();
  const isMyTurn = isCurrentStepForPlayer();

  // Get current step configuration based on level
  const stepConfig =
    player.level === 'Керівник'
      ? crisis.steps.head
      : player.level === 'Тімлід'
      ? crisis.steps.teamLead
      : crisis.steps.manager;

  // ─── STRICT CONDITIONAL RENDERING FOR FLAWED VS NORMAL PLAYERS ────
  // Normal players receive: constructive options + custom text input
  // Flawed players receive: ONLY options matching their flaw, NO constructive escape!
  const availableOptions: CrisisOption[] = React.useMemo(() => {
    if (player.flaw) {
      // Filter options specifically matching this flaw ID
      const flawOptions = stepConfig.options.filter(
        (opt) => opt.type === 'flawed' && opt.flawMatch === player.flaw?.id
      );

      // If sabotage option exists for this flaw, include it
      const sabotageOptions = stepConfig.options.filter(
        (opt) => opt.type === 'sabotage' && opt.flawMatch === player.flaw?.id
      );

      const combined = [...flawOptions, ...sabotageOptions];
      // Fallback if none matched
      return combined.length > 0 ? combined : stepConfig.options.filter((o) => o.type !== 'constructive');
    }

    // Normal player: constructive options only
    return stepConfig.options.filter((opt) => opt.type === 'constructive');
  }, [player.flaw, stepConfig.options]);

  const handleSelectOption = (opt: CrisisOption) => {
    if (alreadyDecided) return;
    setSubmitted(true);
    onSubmitDecision(opt.id, opt.text, opt.type === 'flawed' || opt.type === 'sabotage', opt.isSabotage);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || alreadyDecided) return;
    setSubmitted(true);
    onSubmitDecision('custom_' + Date.now(), customText.trim(), false, false);
  };

  return (
    <div className="w-full max-w-xl mx-auto my-4 space-y-4">
      {/* Crisis Header Banner */}
      <div className="glass-card p-5 border-l-4 border-red-500 neon-glow-red space-y-2">
        <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase tracking-widest">
          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
          <span>КРИЗА {crisis.id}: {crisis.title}</span>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed font-sans">
          {crisis.ambiguousPrompt}
        </p>
      </div>

      {/* Upstream Directives / Information Flow Downwards */}
      {player.level !== 'Керівник' && cascade.headDecision && (
        <div className="p-4 rounded-lg bg-gray-900/60 border border-gray-800 space-y-1 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-red-400 font-bold uppercase">
            <span>Директива Керівника ({cascade.headDecision.playerName}):</span>
          </div>
          <p className="text-gray-300 italic">"{cascade.headDecision.text}"</p>
        </div>
      )}

      {player.level === 'Менеджер' && Object.keys(cascade.teamLeadDecisions).length > 0 && (
        <div className="p-4 rounded-lg bg-gray-900/60 border border-gray-800 space-y-1 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase">
            <span>Вказівка Тімліда:</span>
          </div>
          {Object.values(cascade.teamLeadDecisions).map((tl, i) => (
            <p key={i} className="text-gray-300 italic">
              {tl.playerName}: "{tl.text}"
            </p>
          ))}
        </div>
      )}

      {/* Action Decision Box */}
      <div className="glass-card p-5 border border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-300">
            {stepConfig.prompt}
          </h4>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400">
            {player.level}
          </span>
        </div>

        {/* State 1: Already voted in this step */}
        {alreadyDecided && (
          <div className="space-y-3">
            {myGroup && !myGroup.isResolved ? (
              <div className="p-5 rounded-lg bg-amber-950/20 border border-amber-500/40 text-center space-y-2">
                <Clock className="w-8 h-8 text-amber-400 mx-auto animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Очікування рішень інших колег...
                </p>
                <p className="text-xs text-gray-300 font-mono">
                  {myGroup.displayName}:{" "}
                  <strong className="text-amber-400">
                    {Object.keys(myGroup.votes || {}).length} / {myGroup.expectedVoterIds.length} проголосували
                  </strong>
                </p>
                <p className="text-[11px] text-gray-500 font-sans">
                  Рішення буде затверджено більшістю голосів групи.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-green-950/30 border border-green-500/40 text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
                <p className="text-xs font-bold uppercase tracking-wider text-green-400">
                  Ваше рішення зафіксовано в системі!
                </p>
                {myGroup?.winningText && (
                  <p className="text-xs text-gray-200 font-sans italic border-t border-green-900/40 pt-2">
                    Затверджене рішення групи: "{myGroup.winningText}"
                  </p>
                )}
                <p className="text-[11px] text-gray-400 font-mono">
                  Очікуйте дій інших співробітників та початку фази обговорення...
                </p>
              </div>
            )}
          </div>
        )}

        {/* State 2: Waiting for upstream level (Not their turn) */}
        {!alreadyDecided && !isMyTurn && (
          <div className="p-6 rounded-lg bg-black/40 border border-gray-800 text-center space-y-3">
            <Clock className="w-8 h-8 text-amber-400 mx-auto animate-spin" />
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {cascade.currentStep === 'head'
                ? 'Очікування рішення Керівників (Level 1)...'
                : cascade.currentStep === 'teamLead'
                ? 'Очікування трансляції від Тімлідів (Level 2)...'
                : 'Очікування завершення каскаду...'}
            </p>
            <p className="text-[11px] text-gray-500 font-mono">
              Інформація спускається ієрархією. Ваш термінал розблокується автоматично.
            </p>
          </div>
        )}

        {/* State 3: Active Turn — Render Available Options */}
        {!alreadyDecided && isMyTurn && (
          <div className="space-y-3">
            {/* Flawed warning reminder */}
            {player.flaw && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-[11px] text-red-300 font-mono flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>
                  <strong>Увага:</strong> Через ваду "{player.flaw.name}" ваші варіанти обмежені!
                </span>
              </div>
            )}

            {/* List of Option Buttons */}
            <div className="space-y-2">
              {availableOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(opt)}
                  className={`w-full p-3.5 text-left rounded-lg text-xs font-semibold transition-all duration-200 border flex items-start gap-2.5 ${
                    opt.type === 'sabotage'
                      ? 'bg-red-950/40 hover:bg-red-900/60 border-red-500 text-red-200 neon-glow-red'
                      : opt.type === 'flawed'
                      ? 'bg-amber-950/30 hover:bg-amber-900/50 border-amber-500/50 text-amber-200'
                      : 'bg-black/50 hover:bg-green-950/30 border-gray-700 hover:border-green-500/60 text-gray-200 hover:text-green-200'
                  }`}
                >
                  {opt.type === 'sabotage' ? (
                    <Skull className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 mt-1.5" />
                  )}
                  <span className="leading-relaxed">{opt.text}</span>
                </button>
              ))}
            </div>

            {/* Custom Text Input (ONLY for Normal Players) */}
            {!player.flaw && stepConfig.allowsCustomInput && (
              <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-gray-800 space-y-2">
                <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wide block">
                  Або запропонуйте власний конструктивний варіант:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Ваше персональне рішення..."
                    className="flex-1 px-3 py-2.5 bg-black/60 border border-gray-700 rounded-lg text-xs text-gray-100 placeholder-gray-500 focus:border-green-500 focus:outline-none font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!customText.trim()}
                    className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Відправити</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
