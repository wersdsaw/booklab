'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, LockKeyhole, Radio, Shield } from 'lucide-react';
import { useRoom } from '../lib/useRoom';
import { getSocket } from '../lib/socket';
import { Department, HierarchyLevel, RoleLimits } from '../lib/types';
import PlayerTerminal from '../components/PlayerTerminal';
import CinematicIntro from '../components/CinematicIntro';
import EndgameScreen from '../components/EndgameScreen';
const LEVELS:HierarchyLevel[] = ['Керівник','Тімлід','Менеджер'];
const DEPTS:Department[] = ['Форвард','Методист','Друга лінія','Ретеншн'];
export default function Home() {
  const {state,session,error,connected,send,leave,setError} = useRoom();
  const [code,setCode] = useState(''); const [name,setName] = useState('');
  const [level,setLevel] = useState<HierarchyLevel>('Менеджер'); const [department,setDepartment] = useState<Department>('Форвард');
  const [room,setRoom] = useState<{roomCode:string;roleLimits:RoleLimits;roleCounts:Record<string,number>;seats:{level:string;department:string}[]}|null>(null);
  const [pending,setPending] = useState(false);
  useEffect(() => {
    const socket = getSocket();
    const checked = (result:any) => {setPending(false);if (result.exists) {setRoom(result);setError('');}else setError(result.error);};
    const live = (result:any) => {setRoom(prev => prev?.roomCode === result.roomCode ? (result.exists ? result : null) : prev);if(!result.exists)setError(result.error);};
    socket.on('room_check_result',checked);socket.on('lobby_update',live); return () => {socket.off('room_check_result',checked);socket.off('lobby_update',live);};
  },[setError]);
  useEffect(() => {if(error || state) setPending(false);},[error,state]);
  const player = state && session?.playerId ? state.players[session.playerId] : null;
  const connection = <div className={`connection-status ${connected?'':'offline'}`} role="status"><span/> {connected?'ЗАХИЩЕНЕ З’ЄДНАННЯ':'ВІДНОВЛЮЄМО З’ЄДНАННЯ…'}</div>;
  if(state && player) return <>{connection}{error && <button className="error-toast" onClick={()=>setError('')}>{error}</button>}{state.phase==='INTRO_CINEMATIC'?<CinematicIntro isHost={false} onFinish={()=>{}}/>:state.phase==='ENDGAME'?<><EndgameScreen budget={state.budget} isVictory={state.isVictory} isHost={false} onRestart={leave}/><div className="endgame-personal">{player.flaw && !player.isEliminated ? 'Ви вижили з таємною вадою. Ваша особиста перемога.' : player.flaw ? 'Вас звільнили. Таємну місію провалено.' : state.isVictory ? 'Команда впоралась із кризою.' : state.budget < 10 ? 'Компанія втратила фінансову стійкість.' : 'Принаймні одна таємна вада залишилась у компанії.'}</div></>:<PlayerTerminal player={player} gameState={state}
    onAcknowledge={()=>send('acknowledge_profile')}
    onSubmitCascadeDecision={(optionId,text)=>send(`submit_${levelFor(player.level)}_decision`,{optionId,text})}
    onRespondToMutiny={()=>{}} onVoteReady={ready=>send('submit_voting_ready_response',{ready,readyEpoch:state.timer.readyEpoch})}
    onSubmitVote={(targetDepartment,targetPlayerId,reason)=>send('submit_purge_vote',{targetDepartment,targetPlayerId,reason})}
    onActivateSuperpower={()=>send('activate_superpower')} onSendGhostMessage={message=>send('send_ghost_message',{message})} onLeaveRoom={leave}/>}</>;
  const full = (l:HierarchyLevel) => !!room && room.roleLimits[l] > 0 && (room.roleCounts[l] || 0)>=room.roleLimits[l];
  const deptFull = (d:Department) => !!room && level === 'Тімлід' && room.seats.some(s=>s.level===level && s.department===d);
  return <main className="entry-shell">
    <nav className="entry-nav"><a href="/" className="wordmark"><Shield size={20}/> BUNKER<span>/ CORP.</span></a><span className="nav-classification">INTERNAL ACCESS ONLY</span></nav>
    <div className="entry-grid">
      <motion.section initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} className="entry-story">
        <div className="eyebrow"><span/> ПРОТОКОЛ ВИЖИВАННЯ / 001</div>
        <h1>Компанія<br/>на межі.<br/><em>Кому довіряти?</em></h1>
      </motion.section>
      <motion.section initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:0.15}} className="access-panel">
        <div className="panel-topline"><span>ТЕРМІНАЛ ДОСТУПУ</span><LockKeyhole size={15}/></div>
        <div className="access-content"><div className="access-step">{room?'02 / ОСОБОВА СПРАВА':'01 / ІДЕНТИФІКАЦІЯ'}</div><h2>{room?'Займіть своє місце.':'Увійти до бункеру.'}</h2><p className="panel-description">{room?`Кімната ${room.roomCode} • оберіть доступну роль.`:'Отримайте код кімнати у ведучого, щоб приєднатися до симуляції.'}</p>
          <form onSubmit={e=>{e.preventDefault();setError('');setPending(true);if(room)send('join_room',{roomCode:room.roomCode,player:{name,level,department:level==='Керівник'?'Над усіма':department}});else send('check_room',{roomCode:code.trim().toLowerCase()});}} className="access-form">
            {!room?<label>КОД КІМНАТИ<input value={code} onChange={e=>setCode(e.target.value)} placeholder="bunker-a1b2c3d4" required maxLength={32} autoComplete="off" spellCheck={false}/></label>:<>
              <label>ІМ’Я ТА ПРІЗВИЩЕ<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={60} placeholder="Як до вас звертатись?" required autoComplete="name"/></label>
              <label>ВАША РОЛЬ<select value={level} onChange={e=>setLevel(e.target.value as HierarchyLevel)}>{LEVELS.map(l=><option key={l} value={l} disabled={full(l)}>{l}{room.roleLimits[l] > 0 ? ` · ${room.roleCounts[l]||0}/${room.roleLimits[l]}` : ''}</option>)}</select></label>
              {level!=='Керівник'&&<label>ДЕПАРТАМЕНТ<select value={department} onChange={e=>setDepartment(e.target.value as Department)}>{DEPTS.map(d=><option key={d} disabled={deptFull(d)}>{d}</option>)}</select></label>}
            </>}
            {error&&<p role="alert" className="form-error">{error}</p>}
            <button className="primary-action" disabled={!connected||pending||(!!room&&(full(level)||(level!=='Керівник'&&deptFull(department))))}>{pending?'ПЕРЕВІРКА…':room?'ПРИЄДНАТИСЯ':'ПРОДОВЖИТИ'}<ArrowRight size={18}/></button>
          </form>
          {room&&<button className="back-link" onClick={()=>{setRoom(null);setPending(false);}}>← Інша кімната / оновити місця</button>}
        </div>
        <div className="panel-bottomline"><Radio size={13}/> {connected?'СИСТЕМА ОНЛАЙН':'ПІДКЛЮЧЕННЯ…'}<span>v.2.0</span></div>
      </motion.section>
    </div>
    <footer className="entry-footer"><span>CORPORATE BUNKER</span><span>УСІ РІШЕННЯ МАЮТЬ НАСЛІДКИ.</span></footer>
  </main>;
}
function levelFor(level:HierarchyLevel) {return level==='Керівник'?'head':level==='Тімлід'?'teamlead':'manager';}
