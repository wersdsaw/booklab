'use client';
import { useEffect, useState } from 'react';
import { LockKeyhole, Zap } from 'lucide-react';
import { DockActions } from './ActionDock';
import { GameState, Player } from '../lib/types';
import { getSocket } from '../lib/socket';
export default function SuperpowerPanel({state,player}:{state:GameState;player:Player}) {
  const [target,setTarget]=useState('');
  const [revealReady,setRevealReady]=useState(false);
  const begun=state.currentCrisisIndex >= 2 && !['LOBBY','INTRO_CINEMATIC','PROFILE_ACK','CRISIS_TRIGGER'].includes(state.phase);
  const reveal=!!player.flaw && !player.isEliminated && begun && !player.powerUnlockAcknowledged;
  useEffect(()=>{setRevealReady(false);if(!reveal)return;const timer=setTimeout(()=>setRevealReady(true),1000);return()=>clearTimeout(timer);},[reveal]);
  if(!player.flaw || player.isEliminated)return null;
  if(!begun || !player.powerUnlockAcknowledged)return <>
    <section className="glass-card power-locked"><LockKeyhole size={20}/><div><strong>ТАЄМНИЙ ПРОТОКОЛ</strong><p>Активація можлива лише у випадку критичної загрози.</p></div></section>
    {reveal&&<div className={`protocol-unlock ${revealReady?'':'protocol-glitch'}`} role="dialog" aria-modal="true" aria-label="Розблокування суперсили"><span>CRITICAL STRESS LEVEL</span><h2>КРИТИЧНИЙ РІВЕНЬ СТРЕСУ.<br/>ВАШУ СУПЕРСИЛУ РОЗБЛОКОВАНО.</h2><div className="modal-confirm"><button className="primary-action" disabled={!revealReady} onClick={()=>getSocket().emit('acknowledge_superpower_unlock')}>ВІДКРИТИ ПРОТОКОЛ</button></div></div>}
  </>;
  const power=player.flaw.powerId;
  const targeted=power==='blackmail'||power==='talent_pool';
  const targets=Object.values(state.players).filter(p=>!p.isKicked&&p.id!==player.id&&(power==='talent_pool'?p.isEliminated&&!p.canGhostVote:!p.isEliminated&&!p.voteSuppressed));
  const allowed=['CASCADE','NEGOTIATION_TIMER','PURGE_VOTING'].includes(state.phase);
  return <section className="glass-card superpower-panel"><div className="eyebrow"><Zap size={16}/> ПРИВАТНИЙ ПРОТОКОЛ</div><h3>{player.flaw.superpower}</h3><p>{player.flaw.superpowerDescription}</p>
    {targeted&&!player.flaw.superpowerUsed&&<label>Ціль протоколу<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Оберіть співробітника</option>{targets.map(p=><option value={p.id} key={p.id}>{p.name} / {p.department}</option>)}</select></label>}
    {allowed&&!player.flaw.superpowerUsed&&<DockActions><button className="secondary-action" disabled={targeted&&!targets.some(p=>p.id===target)} onClick={()=>getSocket().emit('activate_superpower',{targetPlayerId:target||undefined})}>АКТИВУВАТИ СУПЕРСИЛУ</button></DockActions>}
    {player.flaw.superpowerUsed&&<p className="mt-4 text-xs text-gray-400">Протокол використано</p>}
    {player.wiretapActive&&<div className="wiretap-feed"><strong>ТАЄМНЕ ПРОСЛУХОВУВАННЯ</strong><p>Наміри ще не є голосами та можуть змінитися.</p>{state.votes.length===0&&Object.keys(state.voteIntents).length===0&&<p>Немає доступних сигналів.</p>}{state.votes.map(v=><p key={v.voterId}>{v.voterName} → {v.targetPlayerName} · голос подано</p>)}{Object.entries(state.voteIntents).map(([v,t])=><p key={v}>{state.players[v]?.name} → {state.players[t]?.name} · поточний намір</p>)}</div>}
  </section>;
}
