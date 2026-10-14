const {test}=require('node:test');
const assert=require('node:assert/strict');
const {join}=require('node:path');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadComponent}=require('./render-component');
const {createRoom,addPlayer,apply,active,LEVELS,DEPARTMENTS}=require('../server/game');
const {ALL_FLAWS}=require('../lib/flaws');
const {CRISES_DATA}=require('../lib/crises');
const {Store}=require('../server/store');
const CrisisCascade=loadComponent(join(__dirname,'../components/CrisisCascade.tsx')).default;
const {default:ActionDock,DockActions}=loadComponent(join(__dirname,'../components/ActionDock.tsx'));
test('exhausted Light stays readable with a compact badge and no strikethrough',()=>{
  const room=createRoom('ui');const p=addPlayer(room,{name:'UI Manager',level:LEVELS[2],department:DEPARTMENTS[0]});
  p.flaw={...ALL_FLAWS[0]};p.lightBurned=true;p.understoodCrisis=0;
  const cascade={currentStep:'manager',consensusGroups:{},teamLeadDecisions:{},managerDecisions:{},headDecision:null};
  const html=renderToStaticMarkup(React.createElement(CrisisCascade,{player:p,crisis:CRISES_DATA[0],cascade,onSubmitDecision(){}}));
  assert.ok(html.includes('exhausted-option'));assert.ok(html.includes('Exhausted (Light used)'));
  assert.ok(!html.includes('line-through'));assert.ok(!html.includes('Сценарій:'));
  assert.ok(html.includes('ПІДТВЕРДИТИ РІШЕННЯ'));
});
test('round controls remain in the document without a bottom overlay',()=>{
  const state=createRoom('layout');state.phase='NEGOTIATION_TIMER';state.timer.remainingSeconds=65;
  const html=renderToStaticMarkup(React.createElement(ActionDock,{state},React.createElement('section',null,
    React.createElement('p',null,'Round content'),React.createElement(DockActions,null,React.createElement('button',null,'Confirm')))));
  assert.ok(html.includes('inline-actions'));assert.ok(html.includes('Confirm'));
  assert.ok(!html.includes('role="timer"'));assert.ok(!html.includes('round-timer-bar'));assert.ok(!html.includes('has-round-timer'));
  assert.ok(!html.includes('<footer'));assert.ok(!html.includes('action-dock'));assert.ok(html.indexOf('Round content')<html.indexOf('Confirm'));
});
test('stored robotic alibis are upgraded to two natural sentences on room restoration',()=>{
  const room=createRoom('legacy-alibi');const p=addPlayer(room,{name:'Legacy Head',level:LEVELS[0]});
  apply(room,{isHost:true},'start_game');apply(room,{isHost:true},'finish_intro');apply(room,{playerId:p.id},'acknowledge_profile');apply(room,{isHost:true},'trigger_crisis',{crisisId:1});
  apply(room,{playerId:p.id},'understand_crisis');apply(room,{playerId:p.id},'submit_head_decision',{optionId:'toxic_light'});
  p.alibi='Старий сценарій з довгим поясненням. Бюджет: 0.50 в.п. Технічні подробиці.';
  p.lastAction+=' Сценарій: ДОВГА НАЗВА КРИЗИ.';
  const store=new Store(':memory:');store.save(room);const restored=store.loadAll()[room.roomCode];store.close();
  const result=restored.players[p.id];assert.equal((result.alibi.match(/[.!?](?:\s|$)/g)||[]).length,2);
  assert.ok(!result.alibi.includes('0.50'));assert.ok(!result.lastAction.includes('Сценарій:'));
});
test('host timer controls are available for voting and the discussion before elimination',()=>{
  const HostTimerControls=loadComponent(join(__dirname,'../components/HostTimerControls.tsx')).default;
  for(const phase of ['NEGOTIATION_TIMER','PURGE_VOTING','OPEN_DISCUSSION']){
    const state=createRoom('timer-controls');state.phase=phase;state.timer.remainingSeconds=120;state.timer.isRunning=true;
    let html=renderToStaticMarkup(React.createElement(HostTimerControls,{state,onControl(){}}));
    for(const label of ['02:00','Призупинити','+30 с','+1 хв'])assert.ok(html.includes(label));
    if(phase==='OPEN_DISCUSSION')assert.ok(html.includes('Оголосити результат'));
    state.timer.isRunning=false;
    html=renderToStaticMarkup(React.createElement(HostTimerControls,{state,onControl(){}}));
    assert.ok(html.includes('Продовжити'));
  }
});
