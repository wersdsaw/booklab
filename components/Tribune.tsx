'use client';
import { DockActions } from './ActionDock';
import { motion } from 'framer-motion';
import { Mic, ArrowRight } from 'lucide-react';
import { GameState } from '../lib/types';
export default function Tribune({state,playerId,isHost=false,onPass}:{state:GameState;playerId?:string;isHost?:boolean;onPass:()=>void}) {
  const speaker = state.players[state.tribune.queue[state.tribune.index]];
  const next = state.players[state.tribune.queue[state.tribune.index+1]];
  const mine = !!speaker && !!playerId && speaker.id === playerId;
  return <motion.section key={speaker?.id||'done'} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="tribune glass-card">
    <div className="eyebrow"><Mic size={16}/> ТРИБУНА / {Math.min(state.tribune.index+1,state.tribune.queue.length)} ІЗ {state.tribune.queue.length}</div>
    <h3>{speaker?`${speaker.name}, ваш захист.`:'Усі висловились.'}</h3>
    <p>{speaker?`${speaker.level} · ${speaker.department}`:'Перевірте готовність команди до голосування.'}</p>
    {speaker&&mine&&<div className="speaker-action">Ви обрали: «{speaker.lastAction}». Обґрунтуйте рішення вголос!</div>}
    {next&&<p className="tribune-next">Далі: {next.name} / {next.level}</p>}
    {speaker&&(mine||isHost)&&<DockActions><button className="primary-action" onClick={onPass}>{isHost?'ПРОПУСТИТИ СПІКЕРА':'ЗАХИСТИВ / ПЕРЕДАТИ СЛОВО'}<ArrowRight size={16}/></button></DockActions>}
  </motion.section>;
}
