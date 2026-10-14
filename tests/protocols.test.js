const {test} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtempSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const {createRoom,addPlayer,apply,view,optionsFor,active,voters,LEVELS,DEPARTMENTS,tick} = require('../server/game');
const {Store} = require('../server/store');
const {ALL_FLAWS} = require('../lib/flaws');
const {crisisChoices,privateAlibi} = require('../lib/choices');
const {CRISES_DATA} = require('../lib/crises');
const host={isHost:true}, actor=p=>({playerId:p.id});
function fixture(round=2) {
  const r=createRoom('protocols');
  LEVELS.forEach((level,t)=>{for(let i=0;i<[2,4,9][t];i++)addPlayer(r,{name:`Person ${t}-${i}`,level,department:DEPARTMENTS[i%4]});});
  apply(r,host,'start_game');apply(r,host,'finish_intro');for(const p of active(r))apply(r,actor(p),'acknowledge_profile');
  r.currentCrisisIndex=round;apply(r,host,'trigger_crisis',{crisisId:round+1});return r;
}
function complete(r,severity='medium') {
  for(const level of LEVELS)for(const p of active(r).filter(p=>p.level===level)){
    apply(r,actor(p),'understand_crisis');const o=optionsFor(r,p).find(o=>o.severity===severity)||optionsFor(r,p)[0];
    apply(r,actor(p),`submit_${level===LEVELS[0]?'head':level===LEVELS[1]?'teamlead':'manager'}_decision`,{optionId:o.id});
  }
}
function startBallots(r){apply(r,host,'advance_to_negotiation');apply(r,host,'control_timer',{action:'skip'});for(const p of active(r))apply(r,actor(p),'submit_voting_ready_response',{ready:true,readyEpoch:r.timer.readyEpoch});}
function voting(r){complete(r);startBallots(r);}
function powerPlayer(r,id){const p=active(r).find(p=>p.flaw?.powerId===id);assert.ok(p);apply(r,actor(p),'acknowledge_superpower_unlock');return p;}
function vote(r,p,target){apply(r,actor(p),'submit_purge_vote',{targetPlayerId:target.id,targetDepartment:target.department,reason:'Конкретний провал у кризі'});}
test('45 authored options and concise two-sentence alibis omit scenario metadata',()=>{
  const texts=new Set(),alibis=new Set();
  for(const level of LEVELS)for(const flaw of ALL_FLAWS){const p={name:'Tester',level,department:DEPARTMENTS[0],flaw};const options=crisisChoices(CRISES_DATA[0],p);assert.equal(options.length,3);
    for(const option of options){
      assert.ok(!texts.has(option.text));texts.add(option.text);
      const alibi=privateAlibi(p,option.severity);
      const sentences=alibi.split(/(?<=[.!?])\s+/u);
      assert.equal(sentences.length,2);
      assert.equal((alibi.match(/[.!?](?:\s|$)/g)||[]).length,2);
      assert.ok(alibi.length<=220);
      for(const sentence of sentences)assert.ok(sentence.split(/\s+/u).length<=20);
      const metadataPlayer={...p,name:'${scenario.title} 0.50%',department:'Бюджет = -3 / 15'};
      assert.equal(privateAlibi(metadataPlayer,option.severity),alibi);
      assert.ok(!alibi.includes(CRISES_DATA[0].title));
      assert.ok(!/[0-9%]|Сценарій:|в\.п\./.test(alibi));
      assert.ok(!option.text.includes('Сценарій:'));alibis.add(alibi);
    }
  }
  assert.equal(texts.size,45);assert.equal(alibis.size,45);
});
test('exhausted Light remains visible but server rejects it in later crises',()=>{
  const r=fixture(),p=active(r).find(p=>p.level===LEVELS[0]&&p.flaw);p.lightBurned=true;
  const options=optionsFor(r,p);assert.equal(options.length,3);assert.equal(options[0].disabled,true);
  apply(r,actor(p),'understand_crisis');assert.throws(()=>apply(r,actor(p),'submit_head_decision',{optionId:'toxic_light'}));
});
test('protocol descriptions stay secret until the cinematic acknowledgment, and unlock persists',()=>{
  const r=fixture(1),p=active(r).find(p=>p.flaw);assert.equal(view(r,actor(p)).players[p.id].flaw.superpowerDescription,'');
  assert.throws(()=>apply(r,actor(p),'acknowledge_superpower_unlock'));assert.throws(()=>apply(r,actor(p),'activate_superpower'));
  r.currentCrisisIndex=2;apply(r,actor(p),'acknowledge_superpower_unlock');assert.ok(view(r,actor(p)).players[p.id].flaw.superpowerDescription);
  const store=new Store(':memory:');store.save(r);const restored=store.loadAll().protocols;store.close();assert.equal(restored.players[p.id].powerUnlockAcknowledged,true);
});
test('wiretap sees live intents and ballots while other participants cannot',()=>{
  const r=fixture();voting(r);const spy=powerPlayer(r,'wiretap'),[p,target]=active(r).filter(p=>p.id!==spy.id);
  apply(r,actor(p),'set_vote_intent',{targetPlayerId:target.id});assert.deepEqual(view(r,actor(spy)).voteIntents,{});
  apply(r,actor(spy),'activate_superpower');assert.equal(view(r,actor(spy)).voteIntents[p.id],target.id);
  assert.deepEqual(view(r,actor(target)).voteIntents,{});apply(r,actor(p),'set_vote_intent',{targetPlayerId:null});assert.deepEqual(view(r,actor(spy)).voteIntents,{});vote(r,p,target);assert.ok(view(r,actor(spy)).votes.some(v=>v.voterId===p.id));assert.equal(view(r,actor(target)).votes.length,0);
  assert.throws(()=>apply(r,actor(spy),'activate_superpower'));
});
test('blackmail anonymously revokes an existing ballot and removes the target from voter requirements',()=>{
  const r=fixture();voting(r);const blackmailer=powerPlayer(r,'blackmail');const [p,target]=active(r).filter(p=>p.id!==blackmailer.id);
  vote(r,p,target);apply(r,actor(blackmailer),'activate_superpower',{targetPlayerId:p.id});assert.equal(r.votes.length,0);assert.ok(!voters(r).includes(p));
  const snapshot=view(r,actor(p));assert.equal(snapshot.players[p.id].voteSuppressed,true);assert.ok(!snapshot.logs.some(l=>l.type==='superpower'));
  assert.throws(()=>vote(r,p,target));assert.equal(view(r,actor(target)).players[p.id].voteSuppressed,false);
});
test('talent pool gives only the selected ghost one ballot and never resurrects them',()=>{
  const r=fixture();complete(r);const clean=active(r).filter(p=>!p.flaw);clean[0].isEliminated=true;clean[1].isEliminated=true;
  startBallots(r);const caster=powerPlayer(r,'talent_pool');apply(r,actor(caster),'activate_superpower',{targetPlayerId:clean[0].id});
  assert.equal(clean[0].isEliminated,true);assert.ok(voters(r).includes(clean[0]));assert.ok(!voters(r).includes(clean[1]));
  const target=active(r).find(p=>p.id!==caster.id);vote(r,clean[0],target);assert.throws(()=>vote(r,clean[0],target));assert.throws(()=>vote(r,clean[1],target));
});
test('golden parachute grants total immunity at a 15-point budget cost; shield removes just one vote',()=>{
  const r=fixture();voting(r);const immune=powerPlayer(r,'golden_parachute'),shield=powerPlayer(r,'team_shield'),before=r.budget;
  apply(r,actor(immune),'activate_superpower');apply(r,actor(shield),'activate_superpower');assert.equal(r.budget,before-15);
  const people=voters(r);for(const p of people)vote(r,p,p.id===immune.id?shield:immune);
  assert.equal(r.phase,'OPEN_DISCUSSION');assert.equal(immune.isEliminated,false);assert.equal(r.eliminatedThisRound,null);tick(r,r.timer.deadline+1);
  assert.equal(immune.isEliminated,false);assert.equal(r.phase,'VOTE_RESULTS');assert.notEqual(r.eliminatedThisRound.playerId,immune.id);
  const s=fixture();voting(s);const defender=powerPlayer(s,'team_shield');apply(s,actor(defender),'activate_superpower');
  const population=voters(s);for(const p of population)vote(s,p,p.id===defender.id?population.find(q=>q.id!==defender.id):defender);
  tick(s,s.timer.deadline+1);assert.equal(s.eliminatedThisRound.playerId,defender.id);assert.equal(s.eliminatedThisRound.votesCount,population.length-2);
});
test('voting expiry opens exactly two minutes of discussion; results stay hidden and late ballots reject',()=>{
  const r=fixture();voting(r);const target=active(r)[0];vote(r,active(r)[1],target);const deadline=r.timer.deadline;
  tick(r,deadline+1);assert.equal(r.phase,'OPEN_DISCUSSION');assert.equal(r.timer.remainingSeconds,120);assert.equal(r.eliminatedThisRound,null);
  assert.throws(()=>vote(r,active(r)[2],target));tick(r,r.timer.deadline-1);assert.equal(r.phase,'OPEN_DISCUSSION');tick(r,r.timer.deadline+1);assert.equal(r.phase,'VOTE_RESULTS');
});
test('worst-case five crises and one parachute retain 10% budget; participant count does not multiply losses',()=>{
  const r=fixture(0);for(const p of active(r))p.flaw={...ALL_FLAWS[0],superpowerUsed:false};
  for(let round=0;round<5;round++){
    complete(r,'hard');if(round===2){const p=active(r)[0];apply(r,actor(p),'acknowledge_superpower_unlock');apply(r,actor(p),'activate_superpower');}
    apply(r,host,'advance_to_negotiation');apply(r,host,'control_timer',{action:'skip'});for(const p of active(r))apply(r,actor(p),'submit_voting_ready_response',{ready:true,readyEpoch:r.timer.readyEpoch});
    const target=active(r).find(p=>p.level===LEVELS[2]&&!p.immuneActive);for(const p of voters(r)){vote(r,p,p.id===target.id?active(r).find(q=>q.id!==p.id):target);}
    tick(r,r.timer.deadline+1);apply(r,host,'next_crisis');if(round<4)apply(r,host,'trigger_crisis',{crisisId:round+2});
  }
  assert.equal(r.budget,10);assert.equal(r.phase,'ENDGAME');assert.equal(r.isVictory,false);
});
test('constructive recovery restores +4 once per round and private supporters are not leaked',()=>{
  const r=fixture();complete(r);apply(r,host,'advance_to_negotiation');const before=r.budget,clean=active(r).filter(p=>!p.flaw);
  for(const p of clean.slice(0,3))apply(r,actor(p),'support_budget_recovery');assert.equal(r.budget,before+4);
  assert.throws(()=>apply(r,actor(clean[3]),'support_budget_recovery'));assert.deepEqual(view(r,actor(clean[0])).recoverySupport,[clean[0].id]);
});
test('silent head directives are atmospheric and survive storage without blank quotes',()=>{
  const r=fixture();const heads=active(r).filter(p=>p.level===LEVELS[0]);heads[0].flaw={...ALL_FLAWS.find(f=>f.id==='avoidance')};heads[1].flaw=null;
  for(const p of heads){apply(r,actor(p),'understand_crisis');apply(r,actor(p),'submit_head_decision',{optionId:optionsFor(r,p)[0].id});}
  const silent=Object.values(r.cascade.directives).find(v=>v.playerId===heads[0].id);assert.equal(silent.noDirective,true);assert.equal(silent.text,'');
  const store=new Store(':memory:');store.save(r);const restored=store.loadAll().protocols;store.close();assert.ok(Object.values(restored.cascade.directives).some(v=>v.noDirective&&v.text===''));
});
test('additive schema migration retains existing sessions and can be reopened safely',()=>{
  const path=join(mkdtempSync(join(tmpdir(),'bunker-migration-')),'db.sqlite');let store=new Store(path);const r=fixture();store.save(r);store.addSession('token','protocols',active(r)[0].id,false);store.close();
  const db=new DatabaseSync(path);for(const c of ['budget','budget_settled_round','recovery_applied_round'])db.exec(`ALTER TABLE rooms DROP COLUMN ${c}`);for(const c of ['power_unlock_ack','vote_suppressed','ghost_vote','immune','wiretap'])db.exec(`ALTER TABLE players DROP COLUMN ${c}`);db.close();
  store=new Store(path);assert.ok(store.session('token'));assert.equal(store.loadAll().protocols.budget,100);store.close();store=new Store(path);assert.equal(store.loadAll().protocols.phase,'CASCADE');store.close();
});
test('round-specific effects, intentions, recovery and open-discussion deadline persist without revealing private protocols',()=>{
  const r=fixture();complete(r);apply(r,host,'advance_to_negotiation');const clean=active(r).filter(p=>!p.flaw);
  for(const p of clean.slice(0,3))apply(r,actor(p),'support_budget_recovery');
  clean[0].isEliminated=true;apply(r,host,'control_timer',{action:'skip'});for(const p of active(r))apply(r,actor(p),'submit_voting_ready_response',{ready:true,readyEpoch:0});
  const spy=powerPlayer(r,'wiretap'),blackmailer=powerPlayer(r,'blackmail'),immune=powerPlayer(r,'golden_parachute'),seance=powerPlayer(r,'talent_pool');
  apply(r,actor(spy),'activate_superpower');apply(r,actor(blackmailer),'activate_superpower',{targetPlayerId:clean[1].id});apply(r,actor(immune),'activate_superpower');apply(r,actor(seance),'activate_superpower',{targetPlayerId:clean[0].id});
  apply(r,actor(clean[2]),'set_vote_intent',{targetPlayerId:immune.id});
  const store=new Store(':memory:');store.save(r);let saved=store.loadAll().protocols;
  assert.equal(saved.budget,r.budget);assert.deepEqual([...saved.recoverySupport].sort(),[...r.recoverySupport].sort());assert.equal(saved.voteIntents[clean[2].id],immune.id);
  assert.equal(saved.players[spy.id].wiretapActive,true);assert.equal(saved.players[immune.id].immuneActive,true);assert.equal(saved.players[clean[1].id].voteSuppressed,true);assert.equal(saved.players[clean[0].id].canGhostVote,true);
  assert.equal(view(saved,actor(clean[2])).players[spy.id].wiretapActive,false);
  tick(saved,saved.timer.deadline+1);assert.equal(saved.phase,'OPEN_DISCUSSION');store.save(saved);saved=store.loadAll().protocols;assert.equal(saved.phase,'OPEN_DISCUSSION');assert.equal(saved.eliminatedThisRound,null);tick(saved,saved.timer.deadline+1);assert.equal(saved.phase,'VOTE_RESULTS');store.close();
  apply(saved,host,'next_crisis');assert.ok(Object.values(saved.players).every(p=>!p.voteSuppressed&&!p.canGhostVote&&!p.wiretapActive&&!p.immuneActive));assert.equal(saved.players[spy.id].flaw.superpowerUsed,true);
});
test('budget stabilization scales by tier rather than employee count and low-budget clean finale requires at least 10%',()=>{
  const budgets=[];
  for(const count of [10,100]) {
    const r=createRoom('scale');for(let i=0;i<count;i++){const p=addPlayer(r,{name:`Manager ${i}`,level:LEVELS[2],department:DEPARTMENTS[0]});p.flaw={...ALL_FLAWS[0]};}
    r.phase='CRISIS_TRIGGER';apply(r,host,'trigger_crisis',{crisisId:1});complete(r,'hard');budgets.push(r.budget);
  }
  assert.deepEqual(budgets,[91,91]);
  for(const [budget,expected] of [[10,true],[9.99,false]]){const r=fixture(4);r.phase='VOTE_RESULTS';r.budget=budget;for(const p of active(r))p.flaw=null;apply(r,host,'next_crisis');assert.equal(r.isVictory,expected);}
});
test('host can pause, extend, restore and resume the two-minute stage before elimination',()=>{
  const r=fixture();voting(r);assert.equal(r.timer.totalSeconds,420);
  assert.throws(()=>apply(r,actor(active(r)[0]),'control_timer',{action:'pause'}));
  apply(r,host,'control_timer',{action:'pause'});
  const remaining=r.timer.remainingSeconds;
  tick(r,Date.now()+600000);assert.equal(r.phase,'PURGE_VOTING');assert.equal(r.timer.remainingSeconds,remaining);
  apply(r,host,'control_timer',{action:'add',seconds:30});assert.equal(r.timer.remainingSeconds,remaining+30);
  apply(r,host,'control_timer',{action:'start'});tick(r,r.timer.deadline+1);
  assert.equal(r.phase,'OPEN_DISCUSSION');assert.equal(r.timer.remainingSeconds,120);assert.equal(r.eliminatedThisRound,null);
  apply(r,host,'control_timer',{action:'pause'});apply(r,host,'control_timer',{action:'add',seconds:60});
  const store=new Store(':memory:');store.save(r);const restored=store.loadAll()[r.roomCode];store.close();
  assert.equal(restored.timer.isRunning,false);assert.equal(restored.timer.remainingSeconds,180);
  tick(restored,Date.now()+600000);assert.equal(restored.phase,'OPEN_DISCUSSION');assert.equal(restored.eliminatedThisRound,null);
  apply(restored,host,'control_timer',{action:'start'});tick(restored,restored.timer.deadline+1);
  assert.equal(restored.phase,'VOTE_RESULTS');assert.ok(restored.eliminatedThisRound);
});
