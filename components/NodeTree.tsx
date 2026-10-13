'use client';
import { useState } from 'react';
import { Player, GamePhase, CascadeState } from '../lib/types';
import { UserX, X } from 'lucide-react';
export default function NodeTree({players,phase,cascade,onSelectPlayer,onKickPlayer}:{players:Record<string,Player>;phase:GamePhase;cascade:CascadeState|null;onSelectPlayer?:(p:Player)=>void;onKickPlayer?:(id:string)=>void}) {
  const [selected,setSelected] = useState<string|null>(null);
  const all = Object.values(players).filter(p=>!p.isKicked);
  const levels = ['Керівник','Тімлід','Менеджер'];
  const graphWidth = Math.max(1200, ...levels.map(level => all.filter(p => p.level === level).length * 120 + 120));
  const positions:Record<string,{x:number;y:number}> = {};
  levels.forEach((level,tier)=>{const people=all.filter(p=>p.level===level);people.forEach((p,i)=>{positions[p.id]={x:60+(i+.5)*(graphWidth-120)/people.length,y:90+tier*160};});});
  const decision = (p:Player) => cascade?.consensusGroups[p.level==='Керівник'?'head':`${p.level==='Тімлід'?'teamLead':'manager'}:${p.department}`]?.votes[p.id];
  const color = (p:Player) => p.isEliminated?'#555e68':decision(p)?decision(p)?.isSabotage?'#cd716c':decision(p)?.isFlawed?'#c9aa6c':'#91bfa9':'#46505c';
  const links: {from:Player;to:Player}[]=[];
  all.filter(p=>p.level!=='Керівник').forEach(p=>{
    let parent:Player|undefined;
    if(p.level==='Тімлід') parent=all.find(h=>h.id===cascade?.directives?.[p.department]?.playerId)||all.filter(h=>h.level==='Керівник')[all.filter(t=>t.level==='Тімлід').indexOf(p)%2];
    else parent=all.find(t=>t.level==='Тімлід'&&t.department===p.department)||all.find(h=>h.id===cascade?.directives?.[p.department]?.playerId)||all.find(h=>h.level==='Керівник');
    if(parent)links.push({from:parent,to:p});
  });
  const person=selected?players[selected]:null;
  return <div>
    <div className="flex flex-wrap gap-4 text-[10px] font-mono mb-3"><span className="text-green-400">● Конструктивний шлях</span><span className="text-amber-200">● Ризиковий шлях</span><span className="text-red-300">● Hard / критичний</span><span className="text-gray-500">● Очікування / привид</span></div>
    {cascade?.isSplit&&<p className="text-xs text-amber-300 mb-3">РОЗКОЛ КОМПАНІЇ / дві директиви розподілено між відділами</p>}
    <div className="overflow-x-auto rounded-lg border border-gray-800 bg-black/30">
      <svg viewBox={`0 0 ${graphWidth} 510`} style={{minWidth:graphWidth > 1200 ? graphWidth : 850}} className="w-full" role="img" aria-label="Жива ієрархія компанії: керівники, тімліди, менеджери">
        <defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#ffffff10"/></pattern></defs><rect width={graphWidth} height="510" fill="url(#dots)"/>
        {levels.map((level,i)=><text key={level} x="18" y={36+i*160} fill="#687382" fontSize="11" fontFamily="monospace">0{i+1} / {level.toUpperCase()} · {all.filter(p=>p.level===level).length}</text>)}
        {links.map(({from,to})=>{const a=positions[from.id],b=positions[to.id];return <path key={to.id} d={`M ${a.x} ${a.y+26} C ${a.x} ${a.y+90}, ${b.x} ${b.y-90}, ${b.x} ${b.y-26}`} fill="none" stroke={color(from)} strokeWidth="2" opacity=".75"/>;})}
        {all.map(p=>{const {x,y}=positions[p.id];const c=color(p);const d=decision(p);return <g key={p.id} role="button" tabIndex={0} aria-label={`${p.name}, ${p.level}, ${p.department}`} style={{cursor:'pointer'}} onClick={()=>{setSelected(p.id);onSelectPlayer?.(p);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(p.id);}}}>
          <title>{p.name} · {p.department}{d?` · ${d.text}`:''}</title><rect x={x-53} y={y-26} width="106" height="57" rx="5" fill={p.isEliminated?'#11151a':'#121b20'} stroke={c}/><circle cx={x-40} cy={y-13} r="3" fill={p.online?'#69c58e':'#626975'}/><text x={x-32} y={y-9} fill={p.isEliminated?'#78818e':'#ecedf0'} fontSize="11" fontWeight="600">{p.name.slice(0,13)}</text><text x={x-42} y={y+9} fill="#8d98a7" fontSize="9">{p.department}</text><text x={x-42} y={y+23} fill={c} fontSize="8">{p.isEliminated?'ПРИВИД':d?'РІШЕННЯ ПРИЙНЯТО':phase==='LOBBY'?'У БУНКЕРІ':'ОЧІКУВАННЯ'}</text>
        </g>;})}
      </svg>
    </div>
    {person&&<div className="glass-card p-5 mt-4 space-y-3 text-sm"><div className="flex justify-between"><strong>{person.name} / {person.level}</strong><button aria-label="Закрити особову справу" onClick={()=>setSelected(null)}><X size={16}/></button></div><p className="text-gray-400">{person.department} · {person.online?'Онлайн':'Від’єднано'}</p>{person.flaw&&<p className="text-amber-200">ТАЄМНО: {person.flaw.name} · {person.lightBurned?'Light згорів':'Light доступний'}</p>}<p className="text-gray-300">{person.lastAction||person.lore.story}</p>{onKickPlayer&&<button className="flex gap-2 text-red-400 text-xs" onClick={()=>{onKickPlayer(person.id);setSelected(null);}}><UserX size={14}/> Від’єднати гравця</button>}</div>}
  </div>;
}
