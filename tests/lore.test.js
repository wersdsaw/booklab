const {test}=require('node:test');
const assert=require('node:assert/strict');
const {generateSalaryAndLore}=require('../lib/lore');
const {createRoom,addPlayer,apply,view,LEVELS,DEPARTMENTS}=require('../server/game');
const {Store}=require('../server/store');
const host={isHost:true};
test('every role draws unused lore even with constant randomness and an exhausted catalog',()=>{
  const original=Math.random;Math.random=()=>0;
  try {
    for(const level of LEVELS){
      const used=[];
      for(let i=0;i<100;i++){
        const result=generateSalaryAndLore(level,used);
        assert.ok(!used.includes(result.lore.story));
        assert.equal(result.salary,result.lore.salary);
        assert.ok(result.lore.expenses&&result.lore.lifestyle);
        used.push(result.lore.story);
      }
    }
  } finally {Math.random=original;}
});
test('unused lore selection remains random',()=>{
  const original=Math.random;
  try {
    for(const level of LEVELS){
      Math.random=()=>0;const first=generateSalaryAndLore(level);
      Math.random=()=>.999;const last=generateSalaryAndLore(level);
      assert.notEqual(first.lore.story,last.lore.story);
    }
  } finally {Math.random=original;}
});
test('departed profiles stay reserved after restart and reset; history is private',()=>{
  const original=Math.random;Math.random=()=>0;const store=new Store(':memory:');
  try {
    const room=createRoom('lore-history');
    const first=addPlayer(room,{name:'First Manager',level:LEVELS[2],department:DEPARTMENTS[0]});
    apply(room,host,'kick_player',{playerId:first.id});store.save(room);
    const restored=store.loadAll()[room.roomCode];
    const second=addPlayer(restored,{name:'Second Manager',level:LEVELS[2],department:DEPARTMENTS[0]});
    assert.notEqual(second.lore.story,first.lore.story);
    const before=second.lore.story;apply(restored,host,'reset_room');
    assert.notEqual(second.lore.story,before);assert.notEqual(second.lore.story,first.lore.story);
    assert.equal(view(restored,{playerId:second.id}).usedLoreStories,undefined);
  } finally {Math.random=original;store.close();}
});
test('old duplicate lore is repaired for every role before starting',()=>{
  const room=createRoom('old-lore');
  for(const level of LEVELS)for(let i=0;i<2;i++)addPlayer(room,{name:`${level} ${i}`,level,department:DEPARTMENTS[i]});
  for(const level of LEVELS){const pair=Object.values(room.players).filter(p=>p.level===level);pair[1].lore={...pair[0].lore};pair[1].salary=pair[0].salary;}
  apply(room,host,'start_game');
  const players=Object.values(room.players);
  assert.equal(new Set(players.map(p=>p.lore.story)).size,players.length);
});
