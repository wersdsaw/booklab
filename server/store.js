const { DatabaseSync } = require('node:sqlite');
const { readFileSync, mkdirSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { ALL_FLAWS } = require('../lib/flaws');
const { createRoom } = require('./game');
const { privateAlibi } = require('../lib/choices');
const cleanChoice = text => typeof text === 'string' ? text.replace(/\s+Сценарій:.*$/u, '') : text;
const isNaturalAlibi = text => typeof text === 'string' && text.length <= 220 && (text.match(/[.!?](?:\s|$)/g) || []).length === 2 && !/[0-9%]|Сценарій:|в\.п\./u.test(text);
class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));
    // Additive migration: preserve existing rooms, credentials and private profiles.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const additions = {
        rooms: {budget:'REAL NOT NULL DEFAULT 100',budget_settled_round:'INTEGER NOT NULL DEFAULT -1',recovery_applied_round:'INTEGER NOT NULL DEFAULT -1'},
        players: {power_unlock_ack:'INTEGER NOT NULL DEFAULT 0',vote_suppressed:'INTEGER NOT NULL DEFAULT 0',ghost_vote:'INTEGER NOT NULL DEFAULT 0',immune:'INTEGER NOT NULL DEFAULT 0',wiretap:'INTEGER NOT NULL DEFAULT 0'},
        decisions: {budget_impact:'REAL NOT NULL DEFAULT 1',no_directive:'INTEGER NOT NULL DEFAULT 0'},
      };
      for (const [table, columns] of Object.entries(additions)) {
        const existing=new Set(this.db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name));
        for (const [name, definition] of Object.entries(columns)) if (!existing.has(name)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
      this.db.exec('PRAGMA user_version = 2; COMMIT');
    } catch(error) {this.db.exec('ROLLBACK');throw error;}

  }
  insert(table, values) {
    const keys = Object.keys(values);
    this.db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(values).map(v => v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
  }
  save(r) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      // Replacing entity rows is atomic; session credentials remain stable.
      const sessions = this.db.prepare('SELECT * FROM sessions WHERE room_code=?').all(r.roomCode);
      this.db.prepare('DELETE FROM rooms WHERE code=?').run(r.roomCode);
      const e = r.eliminatedThisRound;
      this.insert('rooms', { code:r.roomCode, phase:r.phase, crisis_index:r.currentCrisisIndex, game_started_at:r.gameStartedAt, revision:r.revision,
        budget:r.budget,budget_settled_round:r.budgetSettledRound,recovery_applied_round:r.recoveryAppliedRound,is_game_over:r.isGameOver, is_victory:r.isVictory, timer_total:r.timer.totalSeconds, timer_remaining:r.timer.remainingSeconds,
        timer_running:r.timer.isRunning, timer_deadline:r.timer.deadline, ready_open:r.timer.readyOpen, ready_epoch:r.timer.readyEpoch,
        speaker_index:r.tribune.index, cascade_step:r.cascade?.currentStep, is_split:r.cascade?.isSplit || false,
        eliminated_id:e?.playerId, eliminated_votes:e?.votesCount, eliminated_shield:e?.hadShield });
      for (const story of new Set([...(r.usedLoreStories || []), ...Object.values(r.players).map(p => p.lore.story)])) this.insert('lore_history', {room_code:r.roomCode,story});
      for (const p of Object.values(r.players)) {
        this.insert('players', { id:p.id, room_code:r.roomCode, name:p.name, level:p.level, department:p.department, salary:p.salary,
          lore_story:p.lore.story, lore_expenses:p.lore.expenses, lore_lifestyle:p.lore.lifestyle, acknowledged:p.isAcknowledged,
          eliminated:p.isEliminated, kicked:p.isKicked, shield:p.shieldActive, last_action:p.lastAction, has_voted:p.hasVoted,
          power_unlock_ack:!!p.powerUnlockAcknowledged,vote_suppressed:!!p.voteSuppressed,ghost_vote:!!p.canGhostVote,immune:!!p.immuneActive,wiretap:!!p.wiretapActive,light_burned:p.lightBurned, alibi:p.alibi, understood_crisis:p.understoodCrisis });
        if (p.flaw) this.insert('player_secrets', { player_id:p.id, flaw_id:p.flaw.id, power_used:p.flaw.superpowerUsed });
      }
      for (const s of sessions) this.insert('sessions', s);
      for (const g of Object.values(r.cascade?.consensusGroups || {})) {
        this.insert('consensus_groups', { room_code:r.roomCode, group_id:g.groupId, level:g.level, department:g.department,
          display_name:g.displayName, resolved:g.isResolved, winning_option:g.winningOptionId, winning_text:g.winningText,
          winning_flawed:g.winningIsFlawed, winning_sabotage:g.winningIsSabotage });
        for (const id of g.expectedVoterIds) this.insert('group_members', { room_code:r.roomCode, group_id:g.groupId, player_id:id });
        for (const v of Object.values(g.votes)) this.insert('decisions', { room_code:r.roomCode, group_id:g.groupId, player_id:v.playerId,
          option_id:v.optionId, text:v.text, flawed:v.isFlawed, sabotage:v.isSabotage,budget_impact:v.budgetImpact ?? 1,no_directive:!!v.noDirective, timestamp:v.timestamp });
      }
      for (const [d, v] of Object.entries(r.cascade?.directives || {})) this.insert('directive_assignments', { room_code:r.roomCode, department:d, head_player_id:v.playerId });
      r.tribune.queue.forEach((id, i) => this.insert('speaker_queue', { room_code:r.roomCode, position:i, player_id:id }));
      for (const [id, ready] of Object.entries(r.timer.votingReadyVotes)) this.insert('ready_responses', { room_code:r.roomCode, player_id:id, ready });
      for (const id of r.recoverySupport) this.insert('recovery_support',{room_code:r.roomCode,player_id:id});
      for (const [id,target] of Object.entries(r.voteIntents)) this.insert('vote_intents',{room_code:r.roomCode,voter_id:id,target_id:target});
      for (const v of r.votes) this.insert('purge_ballots', { room_code:r.roomCode, voter_id:v.voterId, target_id:v.targetPlayerId, reason:v.reason });
      for (const l of r.logs) this.insert('audit_entries', { id:l.id, room_code:r.roomCode, timestamp:l.timestamp, type:l.type, sender:l.sender, message:l.message, secret:!!l.secret, ghost:!!l.isGhostMessage });
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  loadAll() {
    const rooms = {};
    for (const row of this.db.prepare('SELECT * FROM rooms').all()) {
      const r = createRoom(row.code);
      r.usedLoreStories = this.db.prepare('SELECT story FROM lore_history WHERE room_code=?').all(row.code).map(row => row.story);
      const rows = table => this.db.prepare(`SELECT * FROM ${table} WHERE room_code=?`).all(row.code);
      Object.assign(r, { phase:row.phase, currentCrisisIndex:row.crisis_index, revision:row.revision, gameStartedAt:row.game_started_at,
        budget:row.budget,budgetSettledRound:row.budget_settled_round,recoveryAppliedRound:row.recovery_applied_round,recoverySupport:rows('recovery_support').map(v=>v.player_id),voteIntents:Object.fromEntries(rows('vote_intents').map(v=>[v.voter_id,v.target_id])),isGameOver:!!row.is_game_over, isVictory:!!row.is_victory,
        timer:{totalSeconds:row.timer_total, remainingSeconds:row.timer_remaining, isRunning:!!row.timer_running, deadline:row.timer_deadline,
          readyOpen:!!row.ready_open, readyEpoch:row.ready_epoch, votingReadyVotes:Object.fromEntries(rows('ready_responses').map(v => [v.player_id, !!v.ready]))},
        tribune:{ index:row.speaker_index, queue:rows('speaker_queue').sort((a,b) => a.position-b.position).map(v => v.player_id) } });
      for (const p of rows('players')) {
        const s = this.db.prepare('SELECT * FROM player_secrets WHERE player_id=?').get(p.id);
        r.players[p.id] = {id:p.id, name:p.name, level:p.level, department:p.department, salary:p.salary,
          lore:{salary:p.salary,story:p.lore_story,expenses:p.lore_expenses,lifestyle:p.lore_lifestyle},
          flaw:s ? {...ALL_FLAWS.find(f => f.id === s.flaw_id),superpowerUsed:!!s.power_used} : null,
          isAcknowledged:!!p.acknowledged,isEliminated:!!p.eliminated,isKicked:!!p.kicked,shieldActive:!!p.shield,
          powerUnlockAcknowledged:!!p.power_unlock_ack,voteSuppressed:!!p.vote_suppressed,canGhostVote:!!p.ghost_vote,immuneActive:!!p.immune,wiretapActive:!!p.wiretap,lastAction:cleanChoice(p.last_action),hasVoted:!!p.has_voted,lightBurned:!!p.light_burned,alibi:p.alibi,understoodCrisis:p.understood_crisis,online:false,socketId:''};
      }
      r.usedLoreStories = [...new Set([...r.usedLoreStories, ...Object.values(r.players).map(p => p.lore.story)])];
      if (row.cascade_step) {
        r.cascade = {crisisId:r.currentCrisisIndex+1,currentStep:row.cascade_step,isSplit:!!row.is_split,headDecision:null,teamLeadDecisions:{},managerDecisions:{},mutinyProposal:null,consensusGroups:{},directives:{}};
        for (const g of rows('consensus_groups')) {
          const votes = rows('decisions').filter(v => v.group_id === g.group_id).map(v => ({playerId:v.player_id,playerName:r.players[v.player_id].name,level:r.players[v.player_id].level,department:r.players[v.player_id].department,optionId:v.option_id,text:cleanChoice(v.text),isFlawed:!!v.flawed,isSabotage:!!v.sabotage,budgetImpact:v.budget_impact,noDirective:!!v.no_directive,timestamp:v.timestamp}));
          const group = {groupId:g.group_id,level:g.level,department:g.department,displayName:g.display_name,isResolved:!!g.resolved,winningOptionId:g.winning_option,winningText:cleanChoice(g.winning_text),winningIsFlawed:!!g.winning_flawed,winningIsSabotage:!!g.winning_sabotage,expectedVoterIds:rows('group_members').filter(m => m.group_id===g.group_id).map(m => m.player_id),votes:Object.fromEntries(votes.map(v => [v.playerId,v])),voteCounts:{},hasTie:false,tiedOptionIds:[]};
          votes.forEach(v => {group.voteCounts[v.optionId]=(group.voteCounts[v.optionId]||0)+1;});
          r.cascade.consensusGroups[g.group_id]=group;
          if (g.resolved) {
            const v = votes.find(v => v.optionId === g.winning_option);
            const decision = {...v,playerName:g.display_name,text:v?.noDirective ? '' : cleanChoice(g.winning_text),department:g.department,isFlawed:!!g.winning_flawed,isSabotage:!!g.winning_sabotage};
            if (g.group_id === 'head') r.cascade.headDecision=decision;
            else r.cascade[g.level==='Тімлід'?'teamLeadDecisions':'managerDecisions'][g.department]=decision;
          }
        }
        for (const d of rows('directive_assignments')) {const v=(r.cascade.isSplit ? r.cascade.consensusGroups.head?.votes[d.head_player_id] : r.cascade.headDecision) || r.cascade.headDecision;if(v)r.cascade.directives[d.department]={...v,text:v.noDirective?'':v.text};}
      }
      for (const p of Object.values(r.players)) if (p.flaw && p.alibi) {
        const vote=Object.values(r.cascade?.consensusGroups || {}).flatMap(g=>Object.values(g.votes)).find(v=>v.playerId===p.id);
        const severity=vote?.optionId.match(/^toxic_(light|medium|hard)(?:_|$)/)?.[1];
        // Preserve an already committed, concise defense from earlier catalog versions.
        if(severity && !isNaturalAlibi(p.alibi))p.alibi=privateAlibi(p,severity,r.currentCrisisIndex+1);
      }
      r.votes=rows('purge_ballots').map(v => ({voterId:v.voter_id,voterName:r.players[v.voter_id].name,targetPlayerId:v.target_id,targetPlayerName:r.players[v.target_id].name,targetDepartment:r.players[v.target_id].department,reason:v.reason}));
      r.logs=rows('audit_entries').map(l => ({id:l.id,timestamp:l.timestamp,type:l.type,sender:l.sender,message:l.message,secret:!!l.secret,isGhostMessage:!!l.ghost}));
      if(row.eliminated_id) r.eliminatedThisRound={playerId:row.eliminated_id,name:r.players[row.eliminated_id].name,votesCount:row.eliminated_votes,hadShield:!!row.eliminated_shield};
      rooms[r.roomCode]=r;
    }
    return rooms;
  }
  session(hash) { return this.db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(hash, Date.now()); }
  addSession(hash, roomCode, playerId, isHost) {
    this.insert('sessions', { token_hash:hash,room_code:roomCode,player_id:playerId,is_host:isHost,expires_at:Date.now()+7*86400000 });
  }
  revoke(roomCode, playerId) { this.db.prepare('DELETE FROM sessions WHERE room_code=? AND player_id=?').run(roomCode,playerId); }
  close() { this.db.close(); }
}
module.exports = { Store };
