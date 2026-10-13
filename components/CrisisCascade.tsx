'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock, ShieldAlert } from 'lucide-react';
import { Player, Crisis, CascadeState } from '../lib/types';
import { crisisChoices } from '../lib/choices';
import { getSocket } from '../lib/socket';
import { DockActions } from './ActionDock';
export default function CrisisCascade({player,crisis,cascade,onSubmitDecision}:{
  player:Player; crisis:Crisis; cascade:CascadeState;
  onSubmitDecision:(optionId:string,text:string,isFlawed:boolean,isSabotage?:boolean)=>void;
}) {
  const [customText,setCustomText]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const step=player.level==='Керівник'?'head':player.level==='Тімлід'?'teamLead':'manager';
  const group=cascade.consensusGroups[step==='head'?'head':`${step}:${player.department}`];
  const decided=!!group?.votes[player.id]||!!group?.isResolved;
  const myTurn=cascade.currentStep===step;
  const config=crisis.steps[step];
  const options=crisisChoices(crisis,player);
  const selected=options.find(o=>o.id===selectedId&&!o.disabled);
  const hasCustom=!player.flaw&&config.allowsCustomInput&&customText.trim().length>=3;
  const confirm=()=>{
    if(decided||!myTurn||player.isEliminated)return;
    if(hasCustom)onSubmitDecision('custom_'+Date.now(),customText.trim(),false,false);
    else if(selected)onSubmitDecision(selected.id,selected.text,selected.type!=='constructive',selected.isSabotage);
  };
  const exhausted=options.find(o=>o.severity==='light'&&o.disabled);
  if(!player.isEliminated&&player.understoodCrisis!==crisis.id-1)return <motion.div initial={{opacity:0}} animate={{opacity:1}} className="crisis-reveal" role="dialog" aria-modal="true" aria-label="Кризовий протокол">
    <div className="eyebrow">КРИЗА {crisis.id} / ПРОТОКОЛ АКТИВОВАНО</div>
    <motion.h2 initial={{opacity:0,y:24}} animate={{opacity:1,y:0}}>{crisis.title}</motion.h2>
    <p>{crisis.ambiguousPrompt}</p>
    <div className="modal-confirm"><button className="primary-action" onClick={()=>getSocket().emit('understand_crisis')}>ЗРОЗУМІЛО / UNDERSTOOD</button></div>
  </motion.div>;
  return <div className="w-full max-w-xl mx-auto my-4 space-y-4">
    <section className="glass-card crisis-alert p-5 space-y-2">
      <div className="eyebrow"><AlertTriangle size={15}/>{crisis.title}</div>
      <p className="text-sm text-gray-200 leading-relaxed">{crisis.ambiguousPrompt}</p>
    </section>
    {player.level!=='Керівник'&&cascade.headDecision&&<section className="glass-card p-4 space-y-2">
      <div className="eyebrow">Директива керівника · {cascade.headDecision.playerName}</div>
      <p className="text-sm text-gray-300">{cascade.headDecision.noDirective||!cascade.headDecision.text?.trim()?'Керівник не надав жодних інструкцій. Ви дієте наосліп.':cascade.headDecision.text}</p>
    </section>}
    {player.level==='Менеджер'&&Object.values(cascade.teamLeadDecisions).length>0&&<section className="glass-card p-4 space-y-2">
      <div className="eyebrow">Вказівка тімліда</div>
      {Object.values(cascade.teamLeadDecisions).map((v,i)=><p key={i} className="text-sm text-gray-300">{v.playerName}: {v.text}</p>)}
    </section>}
    {player.alibi&&<section className="glass-card alibi-card p-5"><div className="eyebrow">ПРИВАТНЕ АЛІБІ / ЛИШЕ ДЛЯ ВАС</div><p className="text-sm mt-3 text-gray-200 leading-relaxed">{player.alibi}</p></section>}
    {exhausted&&(decided||!myTurn)&&<div className="decision-card exhausted-option" aria-label="Light — Варіант вичерпано"><span className="exhausted-badge">Exhausted (Light used)</span><span>{exhausted.text}</span></div>}
    <section className="glass-card decision-panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-3"><h4 className="cascade-prompt text-sm text-gray-200 font-semibold">{config.prompt}</h4><span className="text-[10px] text-gray-400">{player.level}</span></div>
      {decided?<div className="decision-status decision-locked" role="status"><CheckCircle size={22}/><p>{group?.isResolved?'Рішення зафіксовано. Очікуйте наступного етапу.':`Очікуємо решту команди: ${Object.keys(group?.votes||{}).length}/${group?.expectedVoterIds.length} рішень.`}</p>{group?.winningText&&<p className="text-gray-400">{group.winningText}</p>}</div>
      :!myTurn?<div className="decision-status"><Clock size={22}/><p>{cascade.currentStep==='head'?'Керівники ухвалюють рішення.':cascade.currentStep==='teamLead'?'Тімліди передають директиви.':'Очікуємо завершення каскаду.'}</p></div>
      :!player.isEliminated&&<>
        {player.flaw&&<p className="flaw-warning"><ShieldAlert size={17}/><span>Увага: через ваду «{player.flaw.name}» ваші варіанти обмежені!</span></p>}
        <div className="space-y-3">{options.map(o=><button key={o.id} type="button" disabled={o.disabled} aria-pressed={selectedId===o.id} aria-label={o.disabled?`${o.text} — Варіант вичерпано`:o.text} onClick={()=>{setSelectedId(o.id);setCustomText('');}}
          className={`decision-card ${o.disabled?'exhausted-option':o.severity==='hard'?'decision-hard':o.severity==='medium'?'decision-medium':''} ${selectedId===o.id?'is-selected':''}`}>
          {o.disabled?<span className="exhausted-badge">Exhausted (Light used)</span>:o.severity&&<span className="decision-severity">{o.severity}</span>}
          <span>{o.text}</span>
        </button>)}</div>
        {!player.flaw&&config.allowsCustomInput&&<form onSubmit={e=>{e.preventDefault();confirm();}} className="pt-3 space-y-2"><label className="block text-xs text-gray-400" htmlFor="custom-decision">Або запропонуйте власне рішення</label><input id="custom-decision" maxLength={1000} value={customText} onChange={e=>{setCustomText(e.target.value);setSelectedId(null);}} placeholder="Як би ви діяли?" className="w-full px-3 py-3 bg-black/30 border border-gray-700 rounded-lg text-sm"/></form>}
        <DockActions><button className={`primary-action ${selected?.severity==='hard'?'button-danger':''}`} disabled={!selected&&!hasCustom} onClick={confirm}>ПІДТВЕРДИТИ РІШЕННЯ</button></DockActions>
      </>}
    </section>
  </div>;
}
