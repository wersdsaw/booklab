'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Skull, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface EndgameScreenProps {
  isVictory: boolean;
  budget?: number;
  onRestart?: () => void;
  isHost?: boolean;
}

export default function EndgameScreen({ isVictory, onRestart, isHost, budget = 100 }: EndgameScreenProps) {
  useEffect(() => {
    if (isVictory) {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#10b981', '#34d399', '#f59e0b'],
      });
    }
  }, [isVictory]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center select-none ${
        isVictory
          ? 'bg-gradient-to-b from-[#05180d] via-[#0a0510] to-[#05180d]'
          : 'bg-gradient-to-b from-[#25080c] via-[#0a0510] to-[#25080c]'
      }`}
    >
      <div className="max-w-2xl w-full space-y-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="mx-auto"
        >
          {isVictory ? (
            <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto text-green-400 drop-shadow-[0_0_35px_rgba(34,197,94,0.8)]">
              <Trophy className="w-12 h-12" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-500 drop-shadow-[0_0_35px_rgba(239,68,68,0.8)]">
              <Skull className="w-12 h-12" />
            </div>
          )}
        </motion.div>

        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-widest ${
              isVictory ? 'text-green-400 neon-text-green' : 'text-red-500 neon-text-red'
            }`}
          >
            {isVictory ? 'ТРІУМФ КОРПОРАЦІЇ' : 'КРАХ БУНКЕРУ'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base sm:text-xl font-medium leading-relaxed font-sans text-gray-200 bg-black/50 p-6 rounded-xl border border-gray-800"
          >
            {isVictory
              ? budget <= 25 ? "Хоча наш бюджет був мінімальним, ми змогли зберегти все та почати процвітати завдяки професійній команді!" : "Команда подолала внутрішню кризу та зберегла фінансову стійкість. Професійний колектив готовий розвивати компанію!"
              : budget < 10 ? "Бюджет компанії опустився нижче критичного порога. Фінансової стійкості не вдалося зберегти." : "Компанія програла внутрішню боротьбу: у команді залишилися приховані дисфункції. Що ми зробили не так?"}
          </motion.p>
        </div>

        <p className="font-mono text-sm text-gray-300">Бюджет компанії: {budget}%</p>
        {isHost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <button
              onClick={onRestart}
              className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all duration-300 flex items-center gap-2 mx-auto ${
                isVictory
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-[0_0_25px_rgba(34,197,94,0.5)]'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)]'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Почати нову симуляцію</span>
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
