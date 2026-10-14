'use client';
import { Pause, Play, PlusCircle, FastForward } from 'lucide-react';
import { GameState } from '../lib/types';

type TimerAction = 'start' | 'pause' | 'add' | 'skip';
export default function HostTimerControls({state,onControl}:{state:GameState;onControl:(action:TimerAction,seconds?:number)=>void}) {
  if (!['NEGOTIATION_TIMER','PURGE_VOTING','OPEN_DISCUSSION'].includes(state.phase)) return null;
  const remaining=Math.max(0,state.timer.remainingSeconds);
  const label=state.phase==='NEGOTIATION_TIMER'?'Обговорення':state.phase==='PURGE_VOTING'?'Таємне голосування':'Обговорення перед вигнанням';
  return <section className="host-timer-controls" aria-label="Керування таймером етапу">
    <span className="font-mono text-xs text-gray-300">{label}</span>
    <strong role="timer" className="font-mono text-lg text-amber-400">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</strong>
    <button className="secondary-action" onClick={()=>onControl(state.timer.isRunning?'pause':'start')}>
      {state.timer.isRunning?<Pause size={14}/>:<Play size={14}/>}{state.timer.isRunning?'Призупинити':'Продовжити'}
    </button>
    <button className="secondary-action" onClick={()=>onControl('add',30)}><PlusCircle size={14}/>+30 с</button>
    <button className="secondary-action" onClick={()=>onControl('add',60)}><PlusCircle size={14}/>+1 хв</button>
    <button className="secondary-action" onClick={()=>onControl('skip')}><FastForward size={14}/>{state.phase==='OPEN_DISCUSSION'?'Оголосити результат':state.phase==='PURGE_VOTING'?'Закрити бюлетені':'Завершити обговорення'}</button>
  </section>;
}
