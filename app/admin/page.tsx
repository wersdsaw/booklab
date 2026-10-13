'use client';
import ActionDock from '../../components/ActionDock';
import { useState } from 'react';
import { Shield, ArrowRight, LogOut } from 'lucide-react';
import { useRoom } from '../../lib/useRoom';
import HostDashboard from '../../components/HostDashboard';
import CinematicIntro from '../../components/CinematicIntro';
import EndgameScreen from '../../components/EndgameScreen';
import Tribune from '../../components/Tribune';
export default function Admin() {
  const {state,error,connected,send,leave,setError} = useRoom(true);
  const [password,setPassword] = useState('');
  const [code,setCode] = useState('');
  if(!state) return <main className="entry-shell admin-entry"><a className="wordmark" href="/"><Shield size={20}/> BUNKER<span>/ COMMAND</span></a><section className="access-panel"><div className="panel-topline">ДОСТУП ВЕДУЧОГО<Shield size={16}/></div><div className="access-content"><div className="access-step">HOST / AUTHORIZATION</div><h2>Командний центр.</h2><p className="panel-description">Створіть кімнату та керуйте перебігом симуляції.</p><form className="access-form" onSubmit={e=>{e.preventDefault();send('join_room',{isHost:true,hostPassword:password,roomCode:code});setPassword('');}}><label>ПАРОЛЬ ВЕДУЧОГО<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><label>КОД НОВОЇ КІМНАТИ (НЕОБОВ’ЯЗКОВО)<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Автоматичний захищений код" maxLength={32}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary-action" disabled={!connected}>СТВОРИТИ КІМНАТУ<ArrowRight size={18}/></button></form><p className="panel-description mt-5">Сесія ведучого відновлюється після оновлення цієї вкладки.</p></div></section></main>;
  return <><div className={`command-ribbon ${connected?'':'offline'}`}><span>HOST / {state.roomCode} · {connected?'ONLINE':'ВІДНОВЛЕННЯ…'}</span><button onClick={leave}><LogOut size={14}/> Вийти</button></div>{error&&<button role="alert" className="error-toast" onClick={()=>setError('')}>{error}</button>}
    {state.phase==='INTRO_CINEMATIC'?<CinematicIntro isHost onFinish={()=>send('finish_intro')}/>:state.phase==='ENDGAME'?<EndgameScreen budget={state.budget} isVictory={state.isVictory} isHost onRestart={()=>send('reset_room')}/>:<ActionDock state={state}>
      {state.phase==='NEGOTIATION_TIMER'&&<Tribune state={state} isHost onPass={()=>send('skip_speaker')}/>}
      <HostDashboard gameState={state} onStartGame={()=>send('start_game')} onFinishIntro={()=>send('finish_intro')}
      onTriggerCrisis={crisisId=>send('trigger_crisis',{crisisId})} onAdvanceToNegotiation={()=>send('advance_to_negotiation')}
      onControlTimer={(action,seconds)=>send('control_timer',{action,seconds})} onForceStartVoting={()=>send('force_start_voting')}
      onForceTallyVotes={()=>send('force_tally_votes')} onNextCrisis={()=>send('next_crisis')} onKickPlayer={playerId=>send('kick_player',{playerId})}/>
    </ActionDock>}</>;
}
