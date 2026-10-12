'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Skull, AlertTriangle, Check, X } from 'lucide-react';

interface MutinyModalProps {
  initiatorName: string;
  department: string;
  onRespond: (accept: boolean) => void;
}

export default function MutinyModal({ initiatorName, department, onRespond }: MutinyModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-card max-w-md w-full p-6 border-2 border-red-500 neon-glow-red space-y-5 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-red-600/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-500 animate-pulse">
          <Skull className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-mono text-red-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> ТАЄМНИЙ ЗАКОЛОТ ДЕПАРТАМЕНТУ ({department})
          </span>
          <h3 className="text-lg font-black text-white uppercase tracking-wide">
            {initiatorName} ініціював бунт!
          </h3>
          <p className="text-xs text-red-200 leading-relaxed font-sans">
            "Керівництво веде нас на дно, плани нереальні, бонуси вкрадені. Давайте відмовимось виконувати вказівки разом!"
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onRespond(true)}
            className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
          >
            <Check className="w-4 h-4" />
            <span>Приєднатися (Так)</span>
          </button>
          <button
            onClick={() => onRespond(false)}
            className="py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            <span>Відмовитись (Ні)</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
