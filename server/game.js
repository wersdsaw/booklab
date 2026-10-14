const { randomUUID, randomInt } = require('node:crypto');
const { ALL_FLAWS } = require('../lib/flaws');
const { CRISES_DATA } = require('../lib/crises');
const { privateAlibi } = require('../lib/choices');
const { generateSalaryAndLore } = require('../lib/lore');
const LEVELS = ['Керівник', 'Тімлід', 'Менеджер'];
const DEPARTMENTS = ['Форвард', 'Методист', 'Друга лінія', 'Ретеншн'];
const LIMITS = { 'Керівник': 2, 'Тімлід': 4, 'Менеджер': 0 };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const active = room => Object.values(room.players).filter(p => !p.isEliminated && !p.isKicked);
const voters = room => Object.values(room.players).filter(p => !p.isKicked && !p.voteSuppressed && (!p.isEliminated || p.canGhostVote));
const allBallotsIn = room => voters(room).every(p => p.hasVoted);
const shuffle = values => { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const groupId = p => p.level === LEVELS[0] ? 'head' : `${p.level === LEVELS[1] ? 'teamLead' : 'manager'}:${p.department}`;
const stepFor = p => ['head', 'teamLead', 'manager'][LEVELS.indexOf(p.level)];
function log(room, type, sender, message, secret = false, isGhostMessage = false) {
  room.logs.push({ id: randomUUID(), timestamp: new Date().toISOString(), type, sender, message, secret, isGhostMessage });
  room.logs = room.logs.slice(-300);
}
function createRoom(roomCode) {
  return { roomCode, usedLoreStories: [], phase: 'LOBBY', currentCrisisIndex: 0, roleLimits: { ...LIMITS }, players: {}, cascade: null, budget: 100, budgetSettledRound: -1, voteIntents: {}, recoverySupport: [], recoveryAppliedRound: -1,
    timer: { totalSeconds: 420, remainingSeconds: 420, isRunning: false, deadline: null, votingReadyVotes: {}, readyOpen: false, readyEpoch: 0 },
    tribune: { queue: [], index: 0 }, votes: [], eliminatedThisRound: null, logs: [], isGameOver: false,
    isVictory: false, gameStartedAt: null, revision: 0 };
}
function addPlayer(room, input) {
  assert(room.phase === 'LOBBY', 'Гра вже почалася.');
  assert(LEVELS.includes(input.level), 'Невідома роль.');
  const department = input.level === LEVELS[0] ? 'Над усіма' : input.department;
  assert(department === 'Над усіма' || DEPARTMENTS.includes(department), 'Невідомий відділ.');
  assert(input.level === LEVELS[0] || department !== 'Над усіма', 'Оберіть відділ.');
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '';
  assert(name.length >= 2, 'Введіть ім’я (2–60 символів).');
  const people = Object.values(room.players).filter(p => !p.isKicked);
  const limit = LIMITS[input.level];
  assert(limit === 0 || people.filter(p => p.level === input.level).length < limit, 'Ліміт ролі вичерпано.');
  if (input.level === LEVELS[1]) assert(!people.some(p => p.level === LEVELS[1] && p.department === department), 'У цьому відділі вже є тімлід.');
  room.usedLoreStories = [...new Set([...(room.usedLoreStories || []), ...Object.values(room.players).map(p => p.lore.story)])];
  const { salary, lore } = generateSalaryAndLore(input.level, room.usedLoreStories);
  room.usedLoreStories.push(lore.story);
  const player = { id: randomUUID(), name, level: input.level, department, salary, lore, flaw: null,
    isAcknowledged: false, isEliminated: false, isKicked: false, shieldActive: false, socketId: '', online: true,
    lastAction: null, hasVoted: false, powerUnlockAcknowledged:false, voteSuppressed:false, canGhostVote:false, immuneActive:false, wiretapActive:false, lightBurned: false, alibi: null, understoodCrisis: null };
  room.players[player.id] = player;
  return player;
}
function optionsFor(room, player) { return require('../lib/choices').crisisChoices(CRISES_DATA[room.currentCrisisIndex], player); }
function initStep(room, step) {
  room.cascade.currentStep = step;
  const people = active(room).filter(p => stepFor(p) === step);
  for (const p of people) {
    const id = groupId(p);
    const group = room.cascade.consensusGroups[id] ||= { groupId: id, level: p.level, department: step === 'head' ? 'Всі' : p.department,
      displayName: step === 'head' ? 'Керівники' : `${p.department} (${p.level})`, expectedVoterIds: [], votes: {}, isResolved: false,
      winningOptionId: null, winningText: null, winningIsFlawed: false, winningIsSabotage: false, voteCounts: {}, hasTie: false, tiedOptionIds: [] };
    group.expectedVoterIds.push(p.id);
  }
  if (!people.length) advanceCascade(room);
}
function advanceCascade(room) {
  const step = room.cascade.currentStep;
  if (step === 'head') initStep(room, 'teamLead');
  else if (step === 'teamLead') initStep(room, 'manager');
  else { room.cascade.currentStep = 'completed'; settleBudget(room); }
}
function resolve(room, group) {
  if (group.isResolved || !group.expectedVoterIds.every(id => group.votes[id])) return;
  const votes = Object.values(group.votes);
  if (!votes.length) { group.isResolved = true; return; }
  group.voteCounts = {};
  for (const vote of votes) group.voteCounts[vote.optionId] = (group.voteCounts[vote.optionId] || 0) + 1;
  const max = Math.max(...Object.values(group.voteCounts));
  const top = Object.keys(group.voteCounts).filter(id => group.voteCounts[id] === max);
  group.tiedOptionIds = top.length > 1 ? top : [];
  const winningId = top[randomInt(top.length)];
  const winner = votes.find(v => v.optionId === winningId);
  Object.assign(group, { isResolved: true, winningOptionId: winner.optionId, winningText: winner.text,
    winningIsFlawed: winner.isFlawed, winningIsSabotage: winner.isSabotage });
  const decision = { ...winner, text: winner.noDirective ? '' : winner.text, playerName: group.displayName, department: group.department };
  if (group.groupId === 'head') {
    room.cascade.headDecision = decision;
    const tls = shuffle(active(room).filter(p => p.level === LEVELS[1]));
    if (votes.length === 2 && votes[0].optionId !== votes[1].optionId) {
      room.cascade.isSplit = true;
      tls.forEach((p, i) => { const directive = votes[i < Math.ceil(tls.length / 2) ? 0 : 1]; room.cascade.directives[p.department] = { ...directive, text: directive.noDirective ? '' : directive.text }; });
      log(room, 'cascade', 'SYSTEM', 'Розкол керівництва: відділи отримали різні директиви.');
    } else tls.forEach(p => { room.cascade.directives[p.department] = decision; });
    // A department whose TL was fired still receives the head directive.
    DEPARTMENTS.forEach(d => { room.cascade.directives[d] ||= decision; });
  } else if (group.level === LEVELS[1]) room.cascade.teamLeadDecisions[group.department] = decision;
  else room.cascade.managerDecisions[group.department] = decision;
}
function settleCascade(room) {
  if (!room.cascade || room.cascade.currentStep === 'completed') return;
  const groups = Object.values(room.cascade.consensusGroups).filter(g => g.level === LEVELS[['head','teamLead','manager'].indexOf(room.cascade.currentStep)]);
  groups.forEach(g => resolve(room, g));
  if (groups.every(g => g.isResolved)) advanceCascade(room);
}
function settleBudget(room) {
  if (room.budgetSettledRound === room.currentCrisisIndex) return;
  const decisions = Object.values(room.cascade.consensusGroups).flatMap(g => Object.values(g.votes));
  let change = -6;
  for (const level of LEVELS) {
    const votes = decisions.filter(v => v.level === level);
    if (votes.length) change += votes.reduce((sum, v) => sum + (v.budgetImpact ?? (v.isFlawed ? -2 : 1)), 0) / votes.length;
  }
  room.budget = Math.max(0, Math.min(100, Math.round((room.budget + change) * 100) / 100));
  room.budgetSettledRound = room.currentCrisisIndex;
  log(room, 'system', 'FINANCE', `Підсумок кризи: бюджет ${room.budget}%. Зміна ${change.toFixed(2)} в.п.`);
}
function openDiscussion(room) {
  room.phase = 'OPEN_DISCUSSION';
  room.timer = {totalSeconds:120,remainingSeconds:120,isRunning:true,deadline:Date.now()+120000,votingReadyVotes:{},readyOpen:false,readyEpoch:room.timer.readyEpoch};
  log(room, 'system', 'SYSTEM', 'Загальне обговорення: 2 хвилини до оголошення результату. Бюлетені закрито.');
}
function startVoting(room) {
  assert(room.phase === 'NEGOTIATION_TIMER' && room.timer.readyOpen, 'Дочекайтеся перевірки готовності.');
  assert(active(room).every(p => room.timer.votingReadyVotes[p.id] === true), 'Усі активні гравці мають погодитися.');
  room.timer.isRunning = false; room.timer.deadline = null;
  if (active(room).length <= 1) { finishGame(room); return; }
  room.phase = 'PURGE_VOTING';
  room.timer = {totalSeconds:420,remainingSeconds:420,isRunning:true,deadline:Date.now()+420000,votingReadyVotes:{},readyOpen:false,readyEpoch:room.timer.readyEpoch};
  if (allBallotsIn(room)) openDiscussion(room);
}
function finishGame(room) {
  room.phase = 'ENDGAME'; room.isGameOver = true;
  const survivors = active(room);
  room.isVictory = survivors.length > 0 && room.budget >= 10 && !survivors.some(p => p.flaw);
}
function tally(room) {
  const counts = {};
  for (const vote of room.votes) {
    if (!voters(room).some(p => p.id === vote.voterId)) continue;
    const target = room.players[vote.targetPlayerId];
    if (target && !target.isEliminated && !target.isKicked) counts[target.id] = (counts[target.id] || 0) + 1;
  }
  const shields = new Set();
  for (const p of active(room)) if (p.shieldActive) { shields.add(p.id); counts[p.id] = Math.max(0, (counts[p.id] || 0) - 1); p.shieldActive = false; }
  let eligible = active(room).filter(p => !p.immuneActive && (counts[p.id] || 0) > 0);
  // With no effective votes, resolve by lot among nonimmune living employees.
  if (!eligible.length) eligible = active(room).filter(p => !p.immuneActive);
  if (!eligible.length) { finishGame(room); return; }
  eligible.forEach(p => { counts[p.id] ||= 0; });
  const max = Math.max(...eligible.map(p => counts[p.id]));
  const tied = eligible.filter(p => counts[p.id] === max);
  const fired = tied[randomInt(tied.length)];
  fired.isEliminated = true;
  room.eliminatedThisRound = { playerId: fired.id, name: fired.name, votesCount: max, hadShield: shields.has(fired.id) };
  room.phase = 'VOTE_RESULTS'; room.timer.isRunning=false; room.timer.deadline=null;
  log(room, 'vote', 'SYSTEM', `${fired.name} звільнено (${max} голосів).${tied.length > 1 ? ' Нічию вирішено жеребом.' : ''}`);
}
function tick(room, now = Date.now()) {
  if (!room.timer.isRunning) return false;
  const seconds = Math.max(0, Math.ceil((room.timer.deadline - now) / 1000));
  if (seconds === room.timer.remainingSeconds) return false;
  room.timer.remainingSeconds = seconds;
  if (seconds === 0) {
    room.timer.isRunning = false; room.timer.deadline = null;
    if (room.phase === 'PURGE_VOTING') openDiscussion(room);
    else if (room.phase === 'OPEN_DISCUSSION') tally(room);
    else room.timer.readyOpen = true;
  }
  return true;
}
function apply(room, actor, event, payload = {}) {
  const host = actor.isHost;
  const p = room.players[actor.playerId];
  const hostOnly = ['start_game','finish_intro','trigger_crisis','advance_to_negotiation','control_timer','force_start_voting','force_tally_votes','next_crisis','reset_room','kick_player','skip_speaker'];
  if (hostOnly.includes(event)) assert(host, 'Лише ведучий може виконати цю дію.');
  else assert(p && !p.isKicked, 'Сесію не знайдено.');
  const playing = () => assert(p && !p.isEliminated, 'Привиди можуть лише спостерігати.');
  const phase = expected => assert(room.phase === expected, 'Дія недоступна в поточній фазі.');
  switch (event) {
    case 'start_game': {
      phase('LOBBY');
      assert(active(room).length > 0, 'Дочекайтеся приєднання хоча б одного гравця.');
      // Repair duplicate legends in rooms saved by older server versions.
      const seenStories = new Set();
      room.usedLoreStories = [...new Set([...(room.usedLoreStories || []), ...Object.values(room.players).map(p => p.lore.story)])];
      for (const player of active(room)) {
        if (seenStories.has(player.lore.story)) {
          Object.assign(player, generateSalaryAndLore(player.level, room.usedLoreStories));
          room.usedLoreStories.push(player.lore.story);
        }
        seenStories.add(player.lore.story);
      }
      let n = 0;
      const flaws = shuffle(ALL_FLAWS);
      LEVELS.forEach((level, i) => shuffle(active(room).filter(p => p.level === level)).slice(0, [1,2,2][i]).forEach(p => {
        p.flaw = { ...flaws[n++], superpowerUsed: false }; p.isAcknowledged = false;
      }));
      room.phase = 'INTRO_CINEMATIC'; room.gameStartedAt = Date.now();
      log(room, 'system', 'SYSTEM', 'Протокол виживання активовано. Особові справи підготовлено.'); break;
    }
    case 'finish_intro': phase('INTRO_CINEMATIC'); room.phase = 'PROFILE_ACK'; break;
    case 'acknowledge_profile':
      phase('PROFILE_ACK'); playing(); p.isAcknowledged = true;
      if (active(room).every(p => p.isAcknowledged)) room.phase = 'CRISIS_TRIGGER'; break;
    case 'trigger_crisis':
      phase('CRISIS_TRIGGER'); assert(payload.crisisId === room.currentCrisisIndex + 1, 'Кризи проходять послідовно.');
      room.phase = 'CASCADE'; room.cascade = { crisisId: payload.crisisId, currentStep: 'head', headDecision: null,
        teamLeadDecisions: {}, managerDecisions: {}, mutinyProposal: null, consensusGroups: {}, directives: {}, isSplit: false };
      active(room).forEach(p => { p.lastAction = null; p.alibi = null; p.understoodCrisis = null; p.hasVoted = false; });
      initStep(room, 'head'); log(room, 'crisis', 'SYSTEM', CRISES_DATA[room.currentCrisisIndex].title); break;
    case 'acknowledge_superpower_unlock':
      playing(); assert(p.flaw && room.currentCrisisIndex >= 2 && ['CASCADE','NEGOTIATION_TIMER','PURGE_VOTING','OPEN_DISCUSSION'].includes(room.phase), 'Протокол ще заблоковано.');
      p.powerUnlockAcknowledged=true; break;
    case 'understand_crisis': phase('CASCADE'); playing(); p.understoodCrisis = room.currentCrisisIndex; break;
    case 'submit_head_decision': case 'submit_teamlead_decision': case 'submit_manager_decision': {
      phase('CASCADE'); playing();
      assert(p.understoodCrisis === room.currentCrisisIndex, 'Спочатку прочитайте кризу.');
      assert(room.cascade.currentStep === stepFor(p), 'Зараз голосує інша ланка.');
      const group = room.cascade.consensusGroups[groupId(p)];
      assert(group && !group.votes[p.id] && !group.isResolved, 'Рішення вже зафіксовано.');
      let option = optionsFor(room, p).find(o => o.id === payload.optionId);
      if (!option && !p.flaw && typeof payload.optionId === 'string' && payload.optionId.startsWith('custom_')) {
        assert(typeof payload.text === 'string' && payload.text.trim().length >= 3 && payload.text.length <= 1000, 'Введіть рішення (3–1000 символів).');
        option = { id: `custom_${p.id}`, text: payload.text.trim(), type: 'constructive' };
      }
      assert(option && !option.disabled, 'Варіант недоступний або вже вичерпаний.');
      const toxic = !!p.flaw;
      group.votes[p.id] = { playerId: p.id, playerName: p.name, level: p.level, department: p.department, optionId: toxic ? `${option.id}_${p.flaw.id}` : option.id,
        text: option.text, isFlawed: toxic, isSabotage: option.type === 'sabotage', noDirective:!!option.noDirective, budgetImpact:option.budgetImpact ?? 1, timestamp: new Date().toISOString() };
      p.lastAction = option.text;
      if (toxic) {
        if (option.severity === 'light') p.lightBurned = true;
        p.alibi = privateAlibi(p, option.severity, CRISES_DATA[room.currentCrisisIndex].id);
      }
      log(room, toxic ? 'sabotage' : 'cascade', p.name, option.text, true); settleCascade(room); break;
    }
    case 'advance_to_negotiation':
      phase('CASCADE'); assert(room.cascade.currentStep === 'completed', 'Усі ланки мають завершити рішення.');
      room.phase = 'NEGOTIATION_TIMER';
      room.tribune = { queue: LEVELS.flatMap(l => active(room).filter(p => p.level === l).map(p => p.id)), index: 0 };
      room.timer = { totalSeconds: 420, remainingSeconds: 420, isRunning: true, deadline: Date.now() + 420000, votingReadyVotes: {}, readyOpen: false, readyEpoch: 0 }; break;
    case 'pass_speaker': case 'skip_speaker':
      phase('NEGOTIATION_TIMER');
      if (!host) { playing(); assert(room.tribune.queue[room.tribune.index] === p.id, 'Зараз говорить інший гравець.'); }
      if (room.tribune.index < room.tribune.queue.length) room.tribune.index++;
      if (room.tribune.index === room.tribune.queue.length) room.timer.readyOpen = true; break;
    case 'control_timer': {
      assert(['NEGOTIATION_TIMER','PURGE_VOTING','OPEN_DISCUSSION'].includes(room.phase), 'Таймер недоступний.'); const phaseBefore=room.phase; tick(room);
      if (room.phase !== phaseBefore) break;
      if (payload.action === 'pause') { room.timer.isRunning = false; room.timer.deadline = null; }
      else if (payload.action === 'start') { room.timer.isRunning = true; room.timer.deadline = Date.now() + room.timer.remainingSeconds * 1000; }
      else if (payload.action === 'add') { const s = Number(payload.seconds); assert(Number.isInteger(s) && s > 0 && s <= 600, 'Некоректний час.'); room.timer.remainingSeconds += s; room.timer.totalSeconds += s; if (room.timer.isRunning) room.timer.deadline += s * 1000; }
      else if (payload.action === 'skip') {
        if (room.phase === 'PURGE_VOTING') openDiscussion(room);
        else if (room.phase === 'OPEN_DISCUSSION') tally(room);
        else {room.timer.remainingSeconds=0;room.timer.isRunning=false;room.timer.deadline=null;room.timer.readyOpen=true;}
      }
      else throw new Error('Невідома дія таймера.'); break;
    }
    case 'submit_voting_ready_response':
      phase('NEGOTIATION_TIMER'); playing(); assert(room.timer.readyOpen && typeof payload.ready === 'boolean', 'Перевірка готовності ще не почалася.');
      assert(payload.readyEpoch === room.timer.readyEpoch, 'Перевірка готовності вже змінилася.');
      assert(!(p.id in room.timer.votingReadyVotes), 'Відповідь вже зафіксовано.');
      room.timer.votingReadyVotes[p.id] = payload.ready;
      if (!payload.ready) {
        tick(room); room.timer.remainingSeconds += 60; room.timer.totalSeconds += 60;
        room.timer.deadline = Date.now() + room.timer.remainingSeconds * 1000; room.timer.isRunning = true;
        room.timer.readyOpen = false; room.timer.readyEpoch++; room.timer.votingReadyVotes = {};
        log(room, 'system', 'SYSTEM', 'Команда попросила ще хвилину. До таймера додано рівно +1:00.');
      } else if (active(room).every(p => room.timer.votingReadyVotes[p.id] === true)) startVoting(room); break;
    case 'force_start_voting': startVoting(room); break;
    case 'support_budget_recovery': {
      phase('NEGOTIATION_TIMER'); playing(); assert(!p.flaw, 'План відновлення доступний конструктивним гравцям.');
      assert(room.recoveryAppliedRound !== room.currentCrisisIndex && !room.recoverySupport.includes(p.id), 'Підтримку вже враховано.');
      room.recoverySupport.push(p.id);
      const quorum=Math.min(3,active(room).filter(p=>!p.flaw).length);
      if (room.recoverySupport.length >= quorum) {room.budget=Math.min(100,room.budget+4);room.recoveryAppliedRound=room.currentCrisisIndex;log(room,'system','FINANCE','Командний план відновлення додав +4 в.п. до бюджету.');}
      break;
    }
    case 'set_vote_intent': {
      phase('PURGE_VOTING'); assert(voters(room).some(q => q.id === p.id) && !p.hasVoted, 'Голосування для вас недоступне.');
      if (payload.targetPlayerId == null) {delete room.voteIntents[p.id];break;}
      const target=room.players[payload.targetPlayerId];
      assert(target && !target.isEliminated && !target.isKicked && target.id !== p.id, 'Недоступна ціль.');
      room.voteIntents[p.id]=target.id; break;
    }
    case 'submit_purge_vote': {
      phase('PURGE_VOTING'); assert(voters(room).some(q => q.id === p.id), 'Право голосу недоступне у цьому раунді.'); assert(!p.hasVoted, 'Голос вже зафіксовано.');
      const target = room.players[payload.targetPlayerId];
      assert(target && !target.isEliminated && !target.isKicked && target.id !== p.id && target.department === payload.targetDepartment, 'Недоступна ціль голосування.');
      assert(typeof payload.reason === 'string' && payload.reason.trim().length >= 3 && payload.reason.length <= 1000, 'Поясніть причину (3–1000 символів).');
      room.votes.push({ voterId: p.id, voterName: p.name, targetDepartment: target.department, targetPlayerId: target.id, targetPlayerName: target.name, reason: payload.reason.trim() });
      p.hasVoted = true; delete room.voteIntents[p.id]; if (allBallotsIn(room)) openDiscussion(room); break;
    }
    case 'force_tally_votes': phase('PURGE_VOTING'); assert(allBallotsIn(room), 'Не всі доступні голоси подано.'); openDiscussion(room); break;
    case 'next_crisis':
      phase('VOTE_RESULTS');
      if (room.currentCrisisIndex === 4 || active(room).length <= 1) { finishGame(room); }
      else { room.currentCrisisIndex++; room.phase = 'CRISIS_TRIGGER'; room.votes = []; room.eliminatedThisRound = null; room.cascade = null; room.voteIntents={}; room.recoverySupport=[]; Object.values(room.players).forEach(p => { p.hasVoted=false; p.voteSuppressed=false; p.canGhostVote=false; p.immuneActive=false; p.shieldActive=false; p.wiretapActive=false; }); } break;
    case 'activate_superpower': {
      playing(); assert(p.flaw && !p.flaw.superpowerUsed && p.powerUnlockAcknowledged && room.currentCrisisIndex >= 2 && ['CASCADE','NEGOTIATION_TIMER','PURGE_VOTING'].includes(room.phase), 'Суперсила недоступна або вже використана.');
      const power=p.flaw.powerId, target=room.players[payload.targetPlayerId];
      if (power === 'team_shield') p.shieldActive=true;
      else if (power === 'golden_parachute') {p.immuneActive=true;room.budget=Math.max(0,room.budget-15);}
      else if (power === 'wiretap') p.wiretapActive=true;
      else if (power === 'blackmail') {
        assert(target && !target.isEliminated && !target.isKicked && target.id!==p.id && !target.voteSuppressed, 'Оберіть іншого живого гравця.');
        target.voteSuppressed=true; room.votes=room.votes.filter(v=>v.voterId!==target.id); delete room.voteIntents[target.id];
      } else if (power === 'talent_pool') {
        assert(target && target.isEliminated && !target.isKicked && !target.canGhostVote, 'Оберіть привида.');
        target.canGhostVote=true; target.hasVoted=false;
      } else throw new Error('Невідомий протокол.');
      p.flaw.superpowerUsed=true;
      log(room,'superpower',p.name,`${p.flaw.superpower}${target ? ': '+target.name : ''}`,true);
      if (power==='golden_parachute') log(room,'system','FINANCE',`Антикризовий резерв зменшився: бюджет ${room.budget}%.`);
      if (room.phase==='PURGE_VOTING' && allBallotsIn(room)) openDiscussion(room);
      break;
    }
    case 'send_ghost_message':
      assert(p.isEliminated, 'Канал доступний лише привидам.');
      assert(typeof payload.message === 'string' && payload.message.trim().length > 0 && payload.message.length <= 1000, 'Повідомлення: 1–1000 символів.');
      log(room, 'ghost', p.name, payload.message.trim(), true, true); break;
    case 'kick_player': {
      const target = room.players[payload.playerId]; assert(target && !target.isKicked, 'Гравця не знайдено.');
      if (room.phase === 'LOBBY') delete room.players[target.id];
      else { target.isKicked = true; target.isEliminated = true; target.online = false; }
      if (room.phase === 'PURGE_VOTING') {
        for (const vote of room.votes) if (vote.targetPlayerId === target.id && room.players[vote.voterId]) room.players[vote.voterId].hasVoted = false;
        room.votes = room.votes.filter(v => v.voterId !== target.id && v.targetPlayerId !== target.id);
      }
      if (room.cascade) {
        Object.values(room.cascade.consensusGroups).forEach(g => { if (!g.isResolved) { g.expectedVoterIds = g.expectedVoterIds.filter(id => id !== target.id); delete g.votes[target.id]; } });
        if (room.phase === 'CASCADE') settleCascade(room);
      }
      room.tribune.queue = room.tribune.queue.filter((id, index) => id !== target.id || index < room.tribune.index);
      if (room.phase === 'PROFILE_ACK' && active(room).every(p => p.isAcknowledged)) room.phase = 'CRISIS_TRIGGER';
      if (room.phase === 'PURGE_VOTING' && active(room).length && allBallotsIn(room)) openDiscussion(room);
      log(room, 'system', 'HOST', `${target.name} від’єднано.`); break;
    }
    case 'reset_room': {
      const fresh = createRoom(room.roomCode);
      fresh.players = room.players;
      fresh.usedLoreStories = [...new Set([...(room.usedLoreStories || []), ...Object.values(room.players).map(p => p.lore.story)])];
      for (const player of Object.values(fresh.players).filter(p => !p.isKicked)) {
        Object.assign(player, generateSalaryAndLore(player.level, fresh.usedLoreStories));
        fresh.usedLoreStories.push(player.lore.story);
      }
      Object.values(fresh.players).forEach(p => { p.flaw = null; p.isAcknowledged = false; p.isEliminated = !!p.isKicked; p.hasVoted = false; p.lastAction = null; p.lightBurned = false; p.alibi = null; p.shieldActive = false; p.understoodCrisis = null; p.powerUnlockAcknowledged=false;p.voteSuppressed=false;p.canGhostVote=false;p.immuneActive=false;p.wiretapActive=false; });
      Object.assign(room, fresh); break;
    }
    default: throw new Error('Невідома команда.');
  }
  room.revision++;
}
function view(room, actor) {
  const state = structuredClone(room);
  delete state.usedLoreStories;
  if (actor.isHost) return state;
  for (const p of Object.values(state.players)) {
    delete p.socketId;
    if (p.id !== actor.playerId) { p.flaw = null; p.alibi = null; p.lightBurned = false; p.lastAction = null; p.shieldActive = false; p.powerUnlockAcknowledged=false;p.voteSuppressed=false;p.canGhostVote=false;p.immuneActive=false;p.wiretapActive=false; p.lore = { salary: p.salary, story: '', expenses: '', lifestyle: '' }; }
  }
  state.logs = state.logs.filter(l => !l.secret && !l.isGhostMessage);
  const viewer=room.players[actor.playerId];
  state.recoverySupport=state.recoverySupport.filter(id=>id===actor.playerId);
  if (!viewer?.wiretapActive) {state.votes=state.votes.filter(v=>v.voterId===actor.playerId);state.voteIntents={};}
  if (viewer?.flaw && !viewer.powerUnlockAcknowledged) {const f=state.players[actor.playerId].flaw;f.superpower='';f.superpowerDescription='';f.powerId='';}
  if (state.cascade) {
    const redact = v => { if (v) { v.isFlawed = false; v.isSabotage = false; v.optionId = 'sealed'; delete v.budgetImpact; } return v; };
    redact(state.cascade.headDecision);
    Object.values(state.cascade.teamLeadDecisions).forEach(redact); Object.values(state.cascade.managerDecisions).forEach(redact);
    Object.values(state.cascade.directives).forEach(redact);
    for (const g of Object.values(state.cascade.consensusGroups)) {
      g.winningIsFlawed = false; g.winningIsSabotage = false; g.winningOptionId = g.isResolved ? 'sealed' : null; g.voteCounts = {}; g.tiedOptionIds = [];
      Object.values(g.votes).forEach(v => { if (v.playerId !== actor.playerId) { redact(v); if (room.phase === 'CASCADE') v.text = ''; } else { v.isFlawed = false; v.isSabotage = false; } });
    }
    const me = room.players[actor.playerId];
    if (me && !me.isEliminated && me.level !== LEVELS[0]) {
      state.cascade.headDecision = state.cascade.directives[me.department] || state.cascade.headDecision;
      state.cascade.directives = Object.fromEntries(Object.entries(state.cascade.directives).filter(([d]) => d === me.department));
      state.cascade.teamLeadDecisions = Object.fromEntries(Object.entries(state.cascade.teamLeadDecisions).filter(([d]) => d === me.department));
    }
  }
  return state;
}
module.exports = { createRoom, addPlayer, apply, view, tick, optionsFor, LEVELS, DEPARTMENTS, LIMITS, assert, active, voters };
