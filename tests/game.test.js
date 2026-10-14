const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRoom, addPlayer, apply, view, optionsFor, LEVELS, DEPARTMENTS, active, tick } = require('../server/game');
const { Store } = require('../server/store');
const host = {isHost:true};
const actor = p => ({isHost:false,playerId:p.id});
function lobby() {
  const r=createRoom('test');
  LEVELS.forEach((level,i)=>{for(let j=0;j<[2,4,9][i];j++) addPlayer(r,{name:`Player ${i}-${j}`,level,department:DEPARTMENTS[j%4]});});
  return r;
}
function started() { const r=lobby();apply(r,host,'start_game');apply(r,host,'finish_intro');for(const p of active(r))apply(r,actor(p),'acknowledge_profile');return r; }
function cascade(r) {
  apply(r,host,'trigger_crisis',{crisisId:r.currentCrisisIndex+1});
  for(const level of LEVELS)for(const p of active(r).filter(p=>p.level===level)) {
    apply(r,actor(p),'understand_crisis');
    const option=optionsFor(r,p).find(o=>o.id==='toxic_medium')||optionsFor(r,p)[0];
    apply(r,actor(p),`submit_${level===LEVELS[0]?'head':level===LEVELS[1]?'teamlead':'manager'}_decision`,{optionId:option.id,text:'FORGED',isFlawed:false});
    assert.notEqual(p.lastAction,'FORGED');
  }
  assert.equal(r.cascade.currentStep,'completed');
}
function debate(r) {
  apply(r,host,'advance_to_negotiation');
  for(const id of r.tribune.queue)apply(r,{playerId:id},'pass_speaker');
  assert.equal(r.timer.readyOpen,true);
  for(const p of active(r))apply(r,actor(p),'submit_voting_ready_response',{ready:true,readyEpoch:r.timer.readyEpoch});
  assert.equal(r.phase,'PURGE_VOTING');
}
function purge(r,target) {
  const people=active(r);
  for(const p of people) { const t=p.id===target.id?people.find(q=>q.id!==target.id):target;apply(r,actor(p),'submit_purge_vote',{targetPlayerId:t.id,targetDepartment:t.department,reason:'Заблокував спільне рішення.'}); }
  assert.equal(r.phase,'OPEN_DISCUSSION');assert.equal(target.isEliminated,false);tick(r,r.timer.deadline+1);
  assert.equal(r.phase,'VOTE_RESULTS');assert.equal(target.isEliminated,true);
}
test('head capacity and 1/2/2 secret distribution; host commands and phase transitions guarded',()=>{
  const r=lobby();assert.throws(()=>addPlayer(r,{name:'extra',level:LEVELS[0],department:DEPARTMENTS[0]}));
  assert.throws(()=>apply(r,actor(active(r)[0]),'start_game'));
  assert.throws(()=>apply(r,host,'trigger_crisis',{crisisId:1}));
  apply(r,host,'start_game');
  assert.deepEqual(LEVELS.map(l=>active(r).filter(p=>p.level===l&&p.flaw).length),[1,2,2]);
});
test('profile privacy, ghost channel privacy, options authority, one-shot Light, persistent cinematic gate',()=>{
  const r=started(),p=active(r).find(p=>p.flaw),other=active(r).find(q=>q.id!==p.id);
  apply(r,host,'trigger_crisis',{crisisId:1});
  assert.throws(()=>apply(r,actor(active(r).find(p=>p.level===LEVELS[0])),'submit_head_decision',{optionId:'toxic_light'}));
  const v=view(r,actor(other));assert.equal(v.players[p.id].flaw,null);
  assert.ok(view(r,host).players[p.id].flaw);
  const head=active(r).find(p=>p.level===LEVELS[0]&&p.flaw);
  apply(r,actor(head),'understand_crisis');apply(r,actor(head),'submit_head_decision',{optionId:'toxic_light'});
  assert.equal(head.lightBurned,true);assert.ok(head.alibi);assert.ok(optionsFor(r,head).every(o=>o.type!=='constructive') && optionsFor(r,head).find(o=>o.id==='toxic_light').disabled);
  assert.throws(()=>apply(r,actor(head),'submit_head_decision',{optionId:'toxic_hard'}));
  head.isEliminated=true;apply(r,actor(head),'send_ghost_message',{message:'Host only'});
  assert.ok(!JSON.stringify(view(r,actor(other))).includes('Host only'));
  assert.ok(JSON.stringify(view(r,host)).includes('Host only'));
  assert.throws(()=>apply(r,actor(head),'activate_superpower'));
});
test('split sends two directors to exactly half of the TLs and survives durable restore',()=>{
  const r=started();apply(r,host,'trigger_crisis',{crisisId:1});
  const heads=active(r).filter(p=>p.level===LEVELS[0]);
  for(const p of heads) {apply(r,actor(p),'understand_crisis');apply(r,actor(p),'submit_head_decision',{optionId:optionsFor(r,p)[0].id});}
  assert.equal(r.cascade.isSplit,true);
  const assignments=Object.values(r.cascade.directives).reduce((a,v)=>(a[v.playerId]=(a[v.playerId]||0)+1,a),{});
  assert.deepEqual(Object.values(assignments).sort(),[2,2]);
  const store=new Store(':memory:');store.save(r);store.addSession('hash','test',heads[0].id,false);
  const restored=store.loadAll().test;assert.deepEqual(restored.cascade.directives,r.cascade.directives);
  assert.ok(store.session('hash'));store.save(restored);assert.ok(store.session('hash'));store.close();
});
test('readiness veto adds exactly 60 seconds, rejects repeats/stale responses, ghosts cannot act',()=>{
  const r=started();cascade(r);apply(r,host,'advance_to_negotiation');
  const [p,q]=active(r);assert.throws(()=>apply(r,actor(q),'pass_speaker'));
  apply(r,host,'control_timer',{action:'skip'});
  const before=r.timer.remainingSeconds;
  apply(r,actor(p),'submit_voting_ready_response',{ready:false,readyEpoch:0});
  assert.equal(r.timer.remainingSeconds,before+60);assert.equal(r.timer.readyOpen,false);
  assert.throws(()=>apply(r,actor(q),'submit_voting_ready_response',{ready:false,readyEpoch:0}));
  assert.throws(()=>apply(r,host,'force_start_voting'));
  p.isEliminated=true;assert.throws(()=>apply(r,actor(p),'submit_voting_ready_response',{ready:true,readyEpoch:1}));
  tick(r,r.timer.deadline+1);assert.equal(r.timer.readyOpen,true);assert.equal(r.timer.isRunning,false);
});
test('all five rounds fire exactly five people; clean company victory and ghosts read-only',()=>{
  const r=started();
  for(let round=0;round<5;round++){
    cascade(r);debate(r);const target=active(r).find(p=>p.flaw);purge(r,target);
    assert.throws(()=>apply(r,actor(target),'submit_purge_vote',{}));apply(r,host,'next_crisis');
  }
  assert.equal(r.phase,'ENDGAME');assert.equal(r.isVictory,true);assert.equal(active(r).length,10);
});
test('surviving flaw makes company lose after round five; powers gated until crisis three',()=>{
  const r=started(),p=active(r).find(p=>p.flaw);
  assert.throws(()=>apply(r,actor(p),'activate_superpower'));
  for(let round=0;round<5;round++){cascade(r);debate(r);purge(r,active(r).find(p=>!p.flaw));apply(r,host,'next_crisis');}
  assert.equal(r.isVictory,false);assert.equal(active(r).filter(p=>p.flaw).length,5);
});
test('SQLite restoration preserves burnout, speaker position, readiness, timer deadline, ballots and secrets',()=>{
  const r=started();cascade(r);apply(r,host,'advance_to_negotiation');apply(r,host,'skip_speaker');
  const store=new Store(':memory:');store.save(r);let restored=store.loadAll().test;
  assert.equal(restored.timer.deadline,r.timer.deadline);assert.deepEqual(restored.tribune,r.tribune);
  assert.deepEqual(Object.values(restored.players).filter(p=>p.flaw).map(p=>p.flaw),Object.values(r.players).filter(p=>p.flaw).map(p=>p.flaw));
  assert.ok(Object.values(restored.players).every(p=>!p.online));store.close();
});
module.exports={lobby,started,cascade,debate,purge};
test('mid-cascade kick removes missing voters, preserves spectators and advances empty tiers',()=>{
  const r=started();apply(r,host,'trigger_crisis',{crisisId:1});
  const heads=active(r).filter(p=>p.level===LEVELS[0]);
  apply(r,host,'kick_player',{playerId:heads[0].id});
  assert.equal(r.cascade.currentStep,'head');
  apply(r,host,'kick_player',{playerId:heads[1].id});
  assert.equal(r.cascade.currentStep,'teamLead');assert.ok(heads.every(p=>p.isKicked&&p.isEliminated));
  assert.throws(()=>apply(r,actor(heads[0]),'send_ghost_message',{message:'unauthorized'}));
});
test('kicking a purge target revokes affected ballots and lets their voters vote again',()=>{
  const r=started();cascade(r);debate(r);const [voter,target]=active(r);
  apply(r,actor(voter),'submit_purge_vote',{targetPlayerId:target.id,targetDepartment:target.department,reason:'Перевірка відкликання'});
  apply(r,host,'kick_player',{playerId:target.id});assert.equal(r.votes.length,0);assert.equal(voter.hasVoted,false);
  const newTarget=active(r).find(p=>p.id!==voter.id);apply(r,actor(voter),'submit_purge_vote',{targetPlayerId:newTarget.id,targetDepartment:newTarget.department,reason:'Нова дійсна ціль'});
  const store=new Store(':memory:');store.save(r);const restored=store.loadAll().test;assert.deepEqual(restored.votes,r.votes);assert.deepEqual(restored.timer.votingReadyVotes,r.timer.votingReadyVotes);store.close();
});
test('managers have no total or per-department cap and a large roster can start',()=>{
  const r=createRoom('unlimited');
  for(let i=0;i<100;i++)addPlayer(r,{name:`Manager ${i}`,level:LEVELS[2],department:DEPARTMENTS[0]});
  assert.equal(active(r).length,100);assert.equal(r.roleLimits[LEVELS[2]],0);
  apply(r,host,'start_game');assert.equal(r.phase,'INTRO_CINEMATIC');
  assert.equal(active(r).filter(p=>p.flaw).length,2);
});
test('one manager can start, skip absent tiers and finish without a self-vote',()=>{
  const r=createRoom('solo');assert.throws(()=>apply(r,host,'start_game'));
  const p=addPlayer(r,{name:'Solo Manager',level:LEVELS[2],department:DEPARTMENTS[0]});
  apply(r,host,'start_game');apply(r,host,'finish_intro');apply(r,actor(p),'acknowledge_profile');
  apply(r,host,'trigger_crisis',{crisisId:1});assert.equal(r.cascade.currentStep,'manager');
  apply(r,actor(p),'understand_crisis');apply(r,actor(p),'submit_manager_decision',{optionId:optionsFor(r,p)[0].id});
  apply(r,host,'advance_to_negotiation');apply(r,actor(p),'pass_speaker');
  apply(r,actor(p),'submit_voting_ready_response',{ready:true,readyEpoch:0});
  assert.equal(r.phase,'ENDGAME');assert.equal(r.isVictory,false);
});
test('head legends never repeat even when random selection always picks the first option',()=>{
  const originalRandom=Math.random;Math.random=()=>0;
  try {
    const r=createRoom('unique-heads');
    const first=addPlayer(r,{name:'Head One',level:LEVELS[0]});
    const second=addPlayer(r,{name:'Head Two',level:LEVELS[0]});
    assert.notEqual(first.lore.story,second.lore.story);
    assert.equal(first.salary,first.lore.salary);assert.equal(second.salary,second.lore.salary);
    apply(r,host,'kick_player',{playerId:first.id});
    const replacement=addPlayer(r,{name:'Head Replacement',level:LEVELS[0]});
    assert.notEqual(replacement.lore.story,second.lore.story);
    assert.notEqual(replacement.lore.story,first.lore.story);
  } finally {Math.random=originalRandom;}
});
test('starting a saved lobby repairs old duplicate head legends and preserves the first head profile',()=>{
  const r=lobby(),heads=active(r).filter(p=>p.level===LEVELS[0]);
  heads[1].salary=heads[0].salary;heads[1].lore={...heads[0].lore};
  const first={...heads[0].lore};
  const store=new Store(':memory:');store.save(r);const restored=store.loadAll()[r.roomCode];store.close();
  apply(restored,host,'start_game');
  const restoredHeads=active(restored).filter(p=>p.level===LEVELS[0]);
  assert.equal(new Set(restoredHeads.map(p=>p.lore.story)).size,2);
  assert.deepEqual(restoredHeads[0].lore,first);
  assert.equal(restoredHeads[1].salary,restoredHeads[1].lore.salary);
});
