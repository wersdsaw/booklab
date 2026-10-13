// Run against an isolated running server; this creates a complete 15-player room.
const { io } = require('socket.io-client');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { crisisChoices } = require('../lib/choices');
const { CRISES_DATA } = require('../lib/crises');
const url = process.env.BUNKER_URL || 'http://localhost:3000';
const password = process.env.BUNKER_ADMIN_PASSWORD || 'bunker-local';
const clients = [];
async function connect() {
  const socket = io(url, { forceNew:true, reconnection:false });
  const c = { socket,state:null,session:null };
  clients.push(c);
  socket.on('state_update',s=>{c.state=s;});socket.on('session_joined',s=>{c.session=s;});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  return c;
}
async function command(c,event,payload={}) {
  return new Promise((resolve,reject)=>c.socket.timeout(5000).emit(event,payload,(error,result)=>{if(error)reject(error);else resolve(result);}));
}
async function good(c,event,payload={}) { const result=await command(c,event,payload);assert.equal(result.ok,true,result.error);await delay(15); }
async function until(predicate) { for(let i=0;i<100;i++){if(predicate())return;await delay(30);}throw new Error('State update timeout'); }
(async()=>{
  const host=await connect();
  assert.equal((await command(host,'join_room',{isHost:true,hostPassword:'wrong'})).ok,false);
  await good(host,'join_room',{isHost:true,hostPassword:password});
  const code=host.session.roomCode;
  const levels=['Керівник','Тімлід','Менеджер'],depts=['Форвард','Методист','Друга лінія','Ретеншн'];
  const players=[];
  for(let tier=0;tier<3;tier++)for(let j=0;j<[2,4,9][tier];j++){
    const c=await connect();await good(c,'join_room',{roomCode:code,player:{name:`Integration ${tier}-${j}`,level:levels[tier],department:depts[j%4]}});players.push(c);
  }
  const p=players[0];
  assert.equal((await command(p,'start_game')).ok,false);
  assert.equal((await command(p,'kick_player',{playerId:players[1].session.playerId})).ok,false);
  await good(host,'start_game');await good(host,'finish_intro');
  await until(()=>players.every(c=>c.state?.phase==='PROFILE_ACK'));
  for(const c of players){const others=Object.values(c.state.players).filter(p=>p.id!==c.session.playerId);assert.ok(others.every(p=>p.flaw===null));await good(c,'acknowledge_profile');}
  const originalSession=p.session;
  p.socket.disconnect();const replacement=await connect();await good(replacement,'join_room',originalSession);players[0]=replacement;
  assert.equal(replacement.session.playerId,originalSession.playerId);
  for(let round=0;round<5;round++){
    await good(host,'trigger_crisis',{crisisId:round+1});
    for(const tier of levels)for(const c of players.filter(c=>!host.state.players[c.session.playerId].isEliminated && host.state.players[c.session.playerId].level===tier)){
      await until(()=>c.state.phase==='CASCADE');await good(c,'understand_crisis');
      const me=c.state.players[c.session.playerId];const options=crisisChoices(CRISES_DATA[round],me);
      const opt=options.find(o=>o.id==='toxic_medium')||options[0];
      assert.equal((await command(c,'submit_head_decision',{playerId:'impersonated',optionId:opt.id})).ok,false);
      await good(c,`submit_${tier===levels[0]?'head':tier===levels[1]?'teamlead':'manager'}_decision`,{optionId:opt.id});
    }
    assert.equal(host.state.cascade.currentStep,'completed');await good(host,'advance_to_negotiation');
    while(host.state.tribune.index<host.state.tribune.queue.length)await good(host,'skip_speaker');
    const alive=players.filter(c=>!host.state.players[c.session.playerId].isEliminated);
    if(round===0){const before=host.state.timer.remainingSeconds;await good(alive[0],'submit_voting_ready_response',{ready:false,readyEpoch:0});assert.ok(host.state.timer.remainingSeconds>=before+59);assert.equal((await command(alive[1],'submit_voting_ready_response',{ready:false,readyEpoch:0})).ok,false);await good(host,'control_timer',{action:'skip'});}
    for(const c of alive)await good(c,'submit_voting_ready_response',{ready:true,readyEpoch:host.state.timer.readyEpoch});
    assert.equal(host.state.phase,'PURGE_VOTING');
    const target=Object.values(host.state.players).find(p=>!p.isEliminated&&!p.flaw);
    for(const c of alive){const t=c.session.playerId===target.id?Object.values(host.state.players).find(p=>!p.isEliminated&&p.id!==target.id):target;await good(c,'submit_purge_vote',{targetPlayerId:t.id,targetDepartment:t.department,reason:'Тестове обґрунтування'});}
    assert.equal(host.state.phase,'OPEN_DISCUSSION');
    assert.equal(host.state.eliminatedThisRound,null);
    await good(host,'control_timer',{action:'skip'});
    assert.equal(host.state.phase,'VOTE_RESULTS');
    const ghost=players.find(c=>c.session.playerId===target.id);
    await good(ghost,'send_ghost_message',{message:'PRIVATE_GHOST_PROBE'});
    await until(()=>host.state.logs.some(l=>l.message==='PRIVATE_GHOST_PROBE'));
    assert.ok(alive.filter(c=>c!==ghost).every(c=>!JSON.stringify(c.state).includes('PRIVATE_GHOST_PROBE')));
    await good(host,'next_crisis');
  }
  assert.equal(host.state.phase,'ENDGAME');assert.equal(host.state.isVictory,false);
  console.log('PASS: real Socket.io clients, host authorization, 15 players, private views, reconnect, five rounds, readiness epochs and ghosts.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>clients.forEach(c=>c.socket.disconnect()));
