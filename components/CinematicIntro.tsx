'use client'

import { motion } from 'framer-motion'
import { FastForward, Skull } from 'lucide-react'

interface CinematicIntroProps {
  onFinish?: () => void
  isHost?: boolean
}

export default function CinematicIntro({ onFinish, isHost }: CinematicIntroProps) {
  const introLines = [
    'Ми спокійно працювали в компанії.',
    'Раптом ринок обвалився.',
    'Тепер, щоб наша компанія залишилась цілою,',
    'ми маємо позбутися дисфункцій, що руйнують команду.',
    'Відділи більше не мають значення,',
    'ми всі допомагаємо один одному.'
  ]

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0510] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      {/* Background glowing orb */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-amber-600/5 blur-[120px] pointer-events-none" />

      {/* Floating Cyber Skull */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [1, 1.08, 1], opacity: 1 }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="mb-8"
      >
        <div className="absolute inset-0 bg-red-600 rounded-full blur-2xl opacity-20 transform scale-75 pointer-events-none" />
        <Skull className="w-20 h-20 text-red-500 filter drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]" />
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
              ease: 'easeOut'
            }}
            className={`font-black tracking-widest uppercase ${
              idx === 0 || idx === 1
                ? 'text-zinc-500 text-base md:text-xl'
                : idx === 2 || idx === 3
                  ? 'text-red-400/80 text-lg md:text-2xl'
                  : 'text-[#ff2a2a] text-xl md:text-3xl font-extrabold filter drop-shadow-[0_0_8px_rgba(255,42,42,0.6)]'
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
          onClick={isHost ? onFinish : undefined}
          disabled={!isHost}
          className="px-6 py-3 bg-zinc-950/80 hover:bg-red-950/40 border border-zinc-800 hover:border-red-900/60 text-zinc-400 hover:text-red-100 rounded-lg text-sm font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 group shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        >
          <span>{isHost ? 'Пропустити інтро для всіх' : 'Очікуємо ведучого…'}</span>
          <FastForward className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </motion.div>
    </div>
  )
}
