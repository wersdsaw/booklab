const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { io } = require('socket.io-client');
const assert = require('node:assert/strict');
const { crisisChoices } = require('../lib/choices');
const { CRISES_DATA } = require('../lib/crises');
const port=Number(process.env.RESTART_TEST_PORT || 3101), url=`http://127.0.0.1:${port}`;
const password=randomBytes(24).toString('base64url');
const database=join(mkdtempSync(join(tmpdir(),'bunker-restart-')),'game.sqlite');
let server;const clients=[];
async function start() {
  server=spawn(process.execPath,['server.js'],{cwd:join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',PORT:String(port),HOSTNAME:'127.0.0.1',ADMIN_PASSWORD:password,DATABASE_PATH:database},stdio:['ignore','pipe','pipe']});
  let log='';server.stdout.on('data',v=>{log+=v;});server.stderr.on('data',v=>{log+=v;});
  for(let i=0;i<100;i++){if(log.includes('Corporate Bunker:'))return;if(server.exitCode!==null)throw Error(log);await delay(100);}throw Error('Server failed to start: '+log);
}
async function stop(){if(!server||server.exitCode!==null)return;const closed=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await closed;}
async function connect(payload){
 const c={socket:io(url,{forceNew:true,reconnection:false}),state:null,session:null};clients.push(c);
 c.socket.on('state_update',s=>{c.state=s;});c.socket.on('session_joined',s=>{c.session=s;});
 await new Promise((resolve,reject)=>{c.socket.once('connect',resolve);c.socket.once('connect_error',reject);});
 await command(c,'join_room',payload);return c;
}
async function command(c,event,payload={}){const result=await new Promise((resolve,reject)=>c.socket.timeout(5000).emit(event,payload,(e,r)=>e?reject(e):resolve(r)));assert.equal(result.ok,true,result.error);await delay(10);}
(async()=>{
 await start();let host=await connect({isHost:true,hostPassword:password});const players=[];
 const levels=['Керівник','Тімлід','Менеджер'],departments=['Форвард','Методист','Друга лінія','Ретеншн'];
 for(let tier=0;tier<3;tier++)for(let j=0;j<[2,4,9][tier];j++)players.push(await connect({roomCode:host.session.roomCode,player:{name:`Restart ${tier}-${j}`,level:levels[tier],department:departments[j%4]}}));
 await command(host,'start_game');await command(host,'finish_intro');for(const p of players)await command(p,'acknowledge_profile');await command(host,'trigger_crisis',{crisisId:1});
 const flawedHead=players.find(c=>c.state.players[c.session.playerId].level===levels[0]&&c.state.players[c.session.playerId].flaw);
 await command(flawedHead,'understand_crisis');await command(flawedHead,'submit_head_decision',{optionId:'toxic_light'});
 const hostSession=host.session,playerSession=flawedHead.session,playerBefore=flawedHead.state.players[playerSession.playerId];
 clients.forEach(c=>c.socket.disconnect());await stop();await start();
 host=await connect(hostSession);const player=await connect(playerSession),restored=player.state.players[playerSession.playerId];
 assert.equal(host.state.phase,'CASCADE');assert.equal(host.state.currentCrisisIndex,0);assert.equal(restored.lightBurned,true);assert.equal(restored.alibi,playerBefore.alibi);assert.equal(restored.lastAction,playerBefore.lastAction);assert.equal(restored.understoodCrisis,0);assert.equal(restored.flaw.id,playerBefore.flaw.id);
 assert.ok(crisisChoices(CRISES_DATA[0],restored).find(o=>o.id==='toxic_light').disabled);
 assert.ok(Object.values(player.state.players).filter(p=>p.id!==restored.id).every(p=>p.flaw===null));
 console.log('PASS: process restart restores host/player credentials, private flaw, burned Light, alibi, acknowledged crisis and committed action from disk.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{clients.forEach(c=>c.socket.disconnect());await stop();});
