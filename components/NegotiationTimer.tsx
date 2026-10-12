'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertOctagon, HelpCircle, Check, X } from 'lucide-react';

interface NegotiationTimerProps {
  consequenceText: string;
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  hasVotedReady?: boolean;
  myReadyVote?: boolean;
  onVoteReady: (ready: boolean) => void;
  showConsensusPrompt: boolean;
}

export default function NegotiationTimer({
  consequenceText,
  remainingSeconds,
  totalSeconds,
  isRunning,
  hasVotedReady,
  myReadyVote,
  onVoteReady,
  showConsensusPrompt,
}: NegotiationTimerProps) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100));

  return (
    <div className="w-full max-w-xl mx-auto my-4 space-y-5">
      {/* Consequence Impact Card */}
      <div className="glass-card p-5 border-l-4 border-amber-500 neon-glow-amber space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest">
          <AlertOctagon className="w-4 h-4 text-amber-500 animate-pulse" />
          <span>ФАЗА 5: НАСЛІДКИ ТА ОБГОВОРЕННЯ</span>
        </div>
        <p className="text-sm text-amber-100 font-sans leading-relaxed">
          {consequenceText}
        </p>
      </div>

      {/* Cyber Countdown Display */}
      <div className="glass-card p-6 border border-gray-800 text-center space-y-4">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">
          Час на обговорення (Live Negotiation)
        </span>

        <div className="relative inline-flex items-center justify-center">
          <motion.div
            animate={{ scale: isRunning && remainingSeconds <= 30 ? [1, 1.05, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 1 }}
            className={`font-mono text-5xl sm:text-6xl font-black tracking-widest ${
              remainingSeconds <= 30 ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'text-gray-100'
            }`}
          >
            {formattedTime}
          </motion.div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              remainingSeconds <= 30 ? 'bg-red-500' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-[11px] text-gray-500 font-mono">
          Говоріть вголос! З'ясуйте, хто порушив довіру або саботував процес.
        </p>
      </div>

      {/* "Ready to vote?" Consensus Prompt */}
      {showConsensusPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 border-2 border-amber-500 neon-glow-amber space-y-4 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-amber-400 font-black text-sm uppercase tracking-wide">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            <span>Готові перейти до голосування на виліт?</span>
          </div>

          <p className="text-xs text-gray-300 font-sans">
            Увага: якщо ХОЧ ОДИН гравець натисне "НІ", до таймеру автоматично додасться +1:00 хвилина!
          </p>

          {hasVotedReady ? (
            <div className="p-3 bg-black/40 rounded-lg text-xs font-mono text-gray-300">
              Ваша відповідь: <strong className={myReadyVote ? 'text-green-400' : 'text-red-400'}>{myReadyVote ? 'ТАК' : 'НІ'}</strong>. Очікуємо голосів решти команди...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => onVoteReady(true)}
                className="py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.4)]"
              >
                <Check className="w-4 h-4" />
                <span>Так (До голосування)</span>
              </button>
              <button
                onClick={() => onVoteReady(false)}
                className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              >
                <X className="w-4 h-4" />
                <span>Ні (+1:00 хв)</span>
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
