PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS rooms (
 code TEXT PRIMARY KEY, phase TEXT NOT NULL, crisis_index INTEGER NOT NULL CHECK(crisis_index BETWEEN 0 AND 4),
 game_started_at INTEGER, revision INTEGER NOT NULL, is_game_over INTEGER NOT NULL, is_victory INTEGER NOT NULL,
 timer_total INTEGER NOT NULL, timer_remaining INTEGER NOT NULL, timer_running INTEGER NOT NULL,
 timer_deadline INTEGER, ready_open INTEGER NOT NULL, ready_epoch INTEGER NOT NULL, speaker_index INTEGER NOT NULL,
 cascade_step TEXT, is_split INTEGER NOT NULL DEFAULT 0,
 eliminated_id TEXT, eliminated_votes INTEGER, eliminated_shield INTEGER
);
CREATE TABLE IF NOT EXISTS players (
 id TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 name TEXT NOT NULL, level TEXT NOT NULL, department TEXT NOT NULL, salary INTEGER NOT NULL,
 lore_story TEXT NOT NULL, lore_expenses TEXT NOT NULL, lore_lifestyle TEXT NOT NULL,
 acknowledged INTEGER NOT NULL, eliminated INTEGER NOT NULL, kicked INTEGER NOT NULL, shield INTEGER NOT NULL,
 last_action TEXT, has_voted INTEGER NOT NULL, light_burned INTEGER NOT NULL, alibi TEXT, understood_crisis INTEGER
);
CREATE INDEX IF NOT EXISTS player_room ON players(room_code);
CREATE TABLE IF NOT EXISTS player_secrets (
 player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE, flaw_id TEXT NOT NULL, power_used INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 player_id TEXT, is_host INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS consensus_groups (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, group_id TEXT NOT NULL,
 level TEXT NOT NULL, department TEXT NOT NULL, display_name TEXT NOT NULL, resolved INTEGER NOT NULL,
 winning_option TEXT, winning_text TEXT, winning_flawed INTEGER NOT NULL, winning_sabotage INTEGER NOT NULL,
 PRIMARY KEY(room_code, group_id)
);
CREATE TABLE IF NOT EXISTS group_members (
 room_code TEXT NOT NULL, group_id TEXT NOT NULL, player_id TEXT NOT NULL,
 PRIMARY KEY(room_code, group_id, player_id),
 FOREIGN KEY(room_code, group_id) REFERENCES consensus_groups(room_code, group_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS decisions (
 room_code TEXT NOT NULL, group_id TEXT NOT NULL, player_id TEXT NOT NULL, option_id TEXT NOT NULL, text TEXT NOT NULL,
 flawed INTEGER NOT NULL, sabotage INTEGER NOT NULL, timestamp TEXT NOT NULL,
 PRIMARY KEY(room_code, group_id, player_id),
 FOREIGN KEY(room_code, group_id) REFERENCES consensus_groups(room_code, group_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS directive_assignments (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, department TEXT NOT NULL, head_player_id TEXT NOT NULL,
 PRIMARY KEY(room_code, department)
);
CREATE TABLE IF NOT EXISTS speaker_queue (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, position INTEGER NOT NULL, player_id TEXT NOT NULL,
 PRIMARY KEY(room_code, position)
);
CREATE TABLE IF NOT EXISTS ready_responses (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, player_id TEXT NOT NULL, ready INTEGER NOT NULL,
 PRIMARY KEY(room_code, player_id)
);
CREATE TABLE IF NOT EXISTS purge_ballots (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, voter_id TEXT NOT NULL,
 target_id TEXT NOT NULL, reason TEXT NOT NULL,
 PRIMARY KEY(room_code, voter_id)
);
CREATE TABLE IF NOT EXISTS audit_entries (
 id TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, timestamp TEXT NOT NULL,
 type TEXT NOT NULL, sender TEXT NOT NULL, message TEXT NOT NULL, secret INTEGER NOT NULL, ghost INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS vote_intents (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, voter_id TEXT NOT NULL, target_id TEXT NOT NULL,
 PRIMARY KEY(room_code, voter_id)
);

CREATE TABLE IF NOT EXISTS recovery_support (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, player_id TEXT NOT NULL,
 PRIMARY KEY(room_code, player_id)
);

CREATE TABLE IF NOT EXISTS lore_history (
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 story TEXT NOT NULL,
 PRIMARY KEY(room_code, story)
);
