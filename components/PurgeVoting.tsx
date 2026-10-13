'use client';

import { DockActions } from './ActionDock';
import React, { useState, useId } from 'react';
import { getSocket } from '../lib/socket';
import { Player, Department } from '../lib/types';
import { Skull, UserX, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';

interface PurgeVotingProps {
  currentUser: Player;
  players: Record<string, Player>;
  onSubmitVote: (targetDepartment: Department, targetPlayerId: string, reason: string) => void;
}

export default function PurgeVoting({
  currentUser,
  players,
  onSubmitVote,
}: PurgeVotingProps) {
  const voteFormId=useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // Alive players excluding current user
  const candidates = Object.values(players).filter(
    (p) => !p.isEliminated && !p.isKicked && p.id !== currentUser.id
  );

  // Departments with active candidates
  const departments: Department[] = ['Форвард', 'Методист', 'Друга лінія', 'Ретеншн', 'Над усіма'];
  const activeDepartments = departments.filter((d) =>
    candidates.some((c) => c.department === d)
  );

  const deptCandidates = candidates.filter((c) => c.department === selectedDept);
  const targetPlayer = selectedPlayerId ? players[selectedPlayerId] : null;

  const handleDepartmentSelect = (dept: Department) => {
    setSelectedDept(dept);
    setSelectedPlayerId(null);
    getSocket().emit('set_vote_intent',{targetPlayerId:null});
    setStep(2);
  };

  const handlePlayerSelect = (pId: string) => {
    setSelectedPlayerId(pId);
    getSocket().emit('set_vote_intent',{targetPlayerId:pId});
    setStep(3);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !selectedPlayerId || !reason.trim()) return;
    onSubmitVote(selectedDept, selectedPlayerId, reason.trim());
  };

  if (currentUser.hasVoted) {
    return (
      <div className="w-full max-w-xl mx-auto my-4 glass-card p-6 border border-green-500/40 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
        <h3 className="text-sm font-black uppercase tracking-wider text-green-400">
          Ваш голос зараховано!
        </h3>
        <p className="text-xs text-gray-400 font-mono">
          Очікуємо завершення таємного голосування іншими членами команди...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto my-4 glass-card p-6 border border-slate-600 space-y-5">
      {/* Step Indicator Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2 text-amber-200 font-black text-xs uppercase tracking-widest">
          <Skull className="w-4 h-4 animate-pulse" />
          <span>ФАЗА 6: ЧИСТКА — 3-ЕТАПНЕ ГОЛОСУВАННЯ</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className={step >= 1 ? 'text-amber-200 font-bold' : 'text-gray-600'}>1.Відділ</span>
          <span className="text-gray-600">→</span>
          <span className={step >= 2 ? 'text-amber-200 font-bold' : 'text-gray-600'}>2.Особа</span>
          <span className="text-gray-600">→</span>
          <span className={step === 3 ? 'text-amber-200 font-bold' : 'text-gray-600'}>3.Обґрунтування</span>
        </div>
      </div>

      {/* STEP 1: Select Department */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-300">
            Крок 1: Оберіть департамент, у якому стався найбільший провал:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeDepartments.map((dept) => {
              const count = candidates.filter((c) => c.department === dept).length;
              return (
                <button
                  key={dept}
                  onClick={() => handleDepartmentSelect(dept)}
                  className="p-3.5 bg-black/50 hover:bg-slate-800/60 border border-gray-800 hover:border-slate-500 rounded-lg text-left transition-all flex items-center justify-between group"
                >
                  <span className="font-bold text-xs text-gray-200 group-hover:text-amber-200">
                    {dept}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500">
                    {count} чол.
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Select Person */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-300">
              Крок 2: Оберіть співробітника з відділу <span className="text-amber-200">"{selectedDept}"</span>:
            </p>
            <button
              onClick={() => {setStep(1);setSelectedPlayerId(null);getSocket().emit('set_vote_intent',{targetPlayerId:null});}}
              className="text-[11px] font-mono text-gray-500 hover:text-gray-300 underline"
            >
              ← Назад
            </button>
          </div>

          <div className="space-y-2">
            {deptCandidates.map((cand) => (
              <button
                key={cand.id}
                onClick={() => handlePlayerSelect(cand.id)}
                className="w-full p-3.5 bg-black/50 hover:bg-slate-800/60 border border-gray-800 hover:border-slate-500 rounded-lg text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-xs text-gray-100 group-hover:text-amber-200">
                    {cand.name}
                  </div>
                  <div className="text-[11px] font-mono text-gray-500">
                    {cand.level} • Зарплата: {cand.salary.toLocaleString('uk-UA')} ₴
                  </div>
                </div>
                <UserX className="w-4 h-4 text-gray-600 group-hover:text-amber-200 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Text Input Justification */}
      {step === 3 && targetPlayer && (
        <form id={voteFormId} onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-300">
              Крок 3: Чому на вашу думку <span className="text-amber-200 font-bold">{targetPlayer.name}</span> зробив неправильний вибір?
            </p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-[11px] font-mono text-gray-500 hover:text-gray-300 underline"
            >
              ← Назад
            </button>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-gray-800 text-xs font-mono flex items-center justify-between text-gray-400">
            <span>Ціль на виліт: <strong>{targetPlayer.name}</strong></span>
            <span>{selectedDept}</span>
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            minLength={3}
            maxLength={1000}
            placeholder="Вкажіть конкретні факти: саботував роботу, мовчав у кризі, звинувачував інших чи знижував планку..."
            className="w-full p-3 bg-black/60 border border-gray-700 rounded-lg text-xs text-gray-100 placeholder-gray-500 focus:border-sky-400 focus:outline-none font-sans"
          />

          <DockActions><button
            type="submit"
            form={voteFormId}
            disabled={reason.trim().length < 3}
            className="primary-action"
          >
            <Skull className="w-4 h-4" />
            <span>Віддати голос на звільнення</span>
          </button></DockActions>
        </form>
      )}
    </div>
  );
}
