'use client';

import React, { useState } from 'react';
import { Ghost, Send, Eye, ShieldAlert } from 'lucide-react';

interface GhostModeProps {
  playerName: string;
  onSendGhostMessage: (message: string) => void;
}

export default function GhostMode({ playerName, onSendGhostMessage }: GhostModeProps) {
  const [message, setMessage] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendGhostMessage(message.trim());
    setMessage('');
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 3000);
  };

  return (
    <div className="w-full max-w-xl mx-auto my-4 p-5 rounded-xl bg-gray-900/80 border border-gray-600 shadow-2xl space-y-4">
      <div className="flex items-center gap-3 border-b border-gray-700 pb-3">
        <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-gray-300">
          <Ghost className="w-6 h-6 animate-bounce" />
        </div>
        <div>
          <h3 className="font-black text-sm uppercase tracking-wider text-gray-200">
            Режим Привида (Ghost Mode)
          </h3>
          <p className="text-[11px] text-gray-400 font-mono">
            Ви усунені з компанії. Ви можете спостерігати за симуляцією у прямому ефірі.
          </p>
        </div>
      </div>

      <div className="p-3 bg-black/60 rounded-lg border border-gray-800 text-xs text-gray-400 font-mono flex items-center gap-2">
        <Eye className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <span>Усі ваші права голосу заморожено. Спостерігайте за каскадом подій.</span>
      </div>

      {/* Secret Message to Host Textbox */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-1">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
          <span>Написати ведучому (Host Secret Inbox):</span>
        </label>
        <p className="text-[11px] text-gray-500 font-mono">
          Це повідомлення бачить виключно Ведучий (СЕО) у своєму терміналі аудиту.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Хто насправді винен? Ваша таємна думка ведучому..."
            className="flex-1 px-3 py-2.5 bg-black/80 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:border-gray-400 focus:outline-none font-sans"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Надіслати</span>
          </button>
        </div>
        {sentSuccess && (
          <p className="text-[11px] text-green-400 font-mono text-center">
            ✓ Повідомлення доставлено на екран Ведучого!
          </p>
        )}
      </form>
    </div>
  );
}
