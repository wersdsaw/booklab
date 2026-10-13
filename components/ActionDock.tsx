'use client';
import { ReactNode } from 'react';
import { GameState } from '../lib/types';

// Sticky controls reserve their own space and never relocate buttons via portals.
export function DockActions({children}:{children:ReactNode}) {
  return <div className="inline-actions">{children}</div>;
}
export default function ActionDock({state,children}:{state:GameState;children:ReactNode}) {
  const timed=['NEGOTIATION_TIMER','PURGE_VOTING','OPEN_DISCUSSION'].includes(state.phase);
  const remaining=Math.max(0,state.timer.remainingSeconds);
  const label=state.phase==='NEGOTIATION_TIMER'?'Обговорення':state.phase==='PURGE_VOTING'?'Голосування':'Відкрите обговорення';
  return <div className={`game-layout ${timed?'has-round-timer':''}`}>
    {children}
    {timed&&<aside className={`round-timer-bar ${remaining<=30?'timer-urgent':''}`} aria-label="Таймер поточного етапу">
      <span>{label}</span><strong role="timer">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</strong>
    </aside>}
  </div>;
}
