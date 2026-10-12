'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Skull, FastForward } from 'lucide-react';

interface CinematicIntroProps {
  onFinish?: () => void;
  isHost?: boolean;
}

export default function CinematicIntro({ onFinish, isHost }: CinematicIntroProps) {
  const introLines = [
    "Ми спокійно працювали в компанії.",
    "Все було класно, але в один день зламалось все.",
    "Тепер, щоб наша компанія залишилась цілою,",
    "ми маємо відібрати тих співробітників, які цього заслуговують.",
    "Відділи більше не мають значення,",
    "ми всі допомагаємо один одному.",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0510] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      {/* Background glowing orb */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-red-600/10 blur-[120px] pointer-events-none" />

      {/* Floating Cyber Skull */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [1, 1.08, 1], opacity: 1 }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="mb-8"
      >
        <Skull className="w-20 h-20 text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.8)]" />
      </motion.div>

      {/* Narrative Crawl with Staggered Fade & Slide */}
      <div className="max-w-2xl space-y-6">
        {introLines.map((line, idx) => (
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: idx * 1.4,
              duration: 1.2,
              ease: 'easeOut',
            }}
            className={`font-black tracking-widest uppercase ${
              idx === 0 || idx === 1
                ? 'text-gray-400 text-base md:text-xl'
                : idx === 2 || idx === 3
                ? 'text-red-400 text-lg md:text-2xl neon-text-red'
                : 'text-green-400 text-xl md:text-3xl font-extrabold neon-text-green'
            }`}
          >
            {line}
          </motion.p>
        ))}
      </div>

      {/* Auto-continue timer bar or Host finish button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: introLines.length * 1.4 + 0.5 }}
        className="mt-12 flex flex-col items-center gap-4"
      >
        <button
          onClick={onFinish}
          className="px-6 py-3 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 hover:border-red-500 text-red-300 hover:text-white rounded-lg text-sm font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 group shadow-[0_0_20px_rgba(239,68,68,0.2)]"
        >
          <span>{isHost ? 'Пропустити інтро для всіх' : 'Продовжити до профілю'}</span>
          <FastForward className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </motion.div>
    </div>
  );
}
