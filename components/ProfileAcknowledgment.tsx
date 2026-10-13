'use client';

import { DockActions } from './ActionDock';
import React, { useState, useEffect } from 'react';
import { Player } from '../lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, ChevronDown, ChevronUp, Wallet, Flame, Info } from 'lucide-react';

interface ProfileAckProps {
  player: Player;
  onAcknowledge: () => void;
  isCollapsedDefault?: boolean;
}

export default function ProfileAcknowledgment({
  player,
  onAcknowledge,
  isCollapsedDefault = false,
}: ProfileAckProps) {
  const [isExpanded, setIsExpanded] = useState(!isCollapsedDefault);

  useEffect(() => { setIsExpanded(!player.isAcknowledged && !isCollapsedDefault); }, [player.isAcknowledged, isCollapsedDefault]);

  return (
    <div className="w-full max-w-xl mx-auto my-4">
      {/* Header Bar */}
      <button type="button" aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
        className="glass-card w-full text-left p-4 flex items-center justify-between cursor-pointer border border-gray-700 hover:border-gray-500 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="profile-avatar w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg">
            {player.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-gray-100">
              {player.name}
            </h3>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <span>{player.level}</span>
              <span>•</span>
              <span className="text-gray-300">{player.department}</span>
              <span>•</span>
              <span className="text-green-400 font-bold">
                {player.salary.toLocaleString('uk-UA')} ₴
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {player.isAcknowledged ? (
            <span className="flex items-center gap-1 text-xs text-green-400 font-mono bg-green-950/60 border border-green-500/30 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ознайомлено
            </span>
          ) : (
            <span className="text-xs text-amber-400 font-mono bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded animate-pulse">
              Потрібне підтвердження
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-card mt-2 p-5 border border-gray-800 space-y-4 overflow-hidden"
          >
            {/* Lore Story */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Ваша Життєва Легенда:</span>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed bg-black/40 p-3 rounded-lg border border-gray-800/80 font-sans">
                {player.lore.story}
              </p>
            </div>

            {/* Expenses & Lifestyle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-black/30 p-3 rounded-lg border border-gray-800 space-y-1">
                <span className="text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-amber-400" /> Щомісячні витрати:
                </span>
                <p className="text-gray-300">{player.lore.expenses}</p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-gray-800 space-y-1">
                <span className="text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-200" /> Спосіб життя:
                </span>
                <p className="text-gray-300">{player.lore.lifestyle}</p>
              </div>
            </div>

            {/* Secret Flaw Block (if assigned) */}
            {player.flaw ? (
              <div className="profile-flaw p-4 rounded-lg space-y-2.5">
                <div className="flex items-center gap-2 text-red-400 font-black text-sm uppercase tracking-wider">
                  <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                  <span>ТАЄМНА ВАДА: {player.flaw.name}</span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="p-2.5 bg-black/50 rounded border border-red-900/60 text-red-200 text-xs">
                    <span className="font-bold uppercase text-red-400 block mb-0.5">
                      Критичне правило поведінки:
                    </span>
                    {player.flaw.behaviorRestriction}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-green-950/20 border border-green-500/30 text-xs font-mono text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>У вас немає прихованих вад. Ви граєте за здоровий колектив.</span>
              </div>
            )}

            {/* Prominent Green "Ознайомився" Button */}
            {!player.isAcknowledged && (
              <DockActions><button
                onClick={() => {
                  onAcknowledge();
                  setIsExpanded(false);
                }}
                className="primary-action"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Ознайомився (Acknowledged)</span>
              </button></DockActions>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
