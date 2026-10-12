export type HierarchyLevel = 'Керівник' | 'Тімлід' | 'Менеджер';

export type Department = 'Форвард' | 'Методист' | 'Друга лінія' | 'Ретеншн' | 'Над усіма';

export type FlawId = 
  | 'indifference'       // Байдужість до результатів
  | 'fear_of_conflict'   // Страх конфлікту
  | 'avoidance'          // Безвідповідальність
  | 'low_standards'      // Невимогливість
  | 'lack_of_trust';     // Недовіра

export interface SecretFlaw {
  id: FlawId;
  name: string;
  englishName: string;
  dysfunctionOrder: number;
  superpower: string;
  superpowerDescription: string;
  behaviorRestriction: string;
  superpowerUsed: boolean;
}

export interface LoreProfile {
  salary: number;
  story: string;
  expenses: string;
  lifestyle: string;
}

export interface Player {
  id: string;
  name: string;
  level: HierarchyLevel;
  department: Department;
  salary: number;
  lore: LoreProfile;
  flaw: SecretFlaw | null;
  isAcknowledged: boolean;
  isEliminated: boolean; // Ghost mode
  shieldActive: boolean; // canceled 1 vote
  socketId: string;
  online: boolean;
  lastAction: string | null;
  hasVoted: boolean;
}

export type GamePhase =
  | 'LOBBY'
  | 'INTRO_CINEMATIC'
  | 'PROFILE_ACK'
  | 'CRISIS_TRIGGER'
  | 'CASCADE'
  | 'NEGOTIATION_TIMER'
  | 'PURGE_VOTING'
  | 'VOTE_RESULTS'
  | 'ENDGAME';

export interface CrisisOption {
  id: string;
  text: string;
  type: 'constructive' | 'flawed' | 'custom' | 'sabotage';
  flawMatch?: FlawId;
  isSabotage?: boolean;
}

export interface CrisisStep {
  targetLevel: HierarchyLevel;
  prompt: string;
  options: CrisisOption[];
  allowsCustomInput: boolean;
}

export interface Crisis {
  id: number;
  title: string;
  ambiguousPrompt: string;
  consequenceText: string;
  steps: {
    head: CrisisStep;
    teamLead: CrisisStep;
    manager: CrisisStep;
  };
}

export interface RoleLimits {
  'Керівник': number; // e.g. 2
  'Тімлід': number;   // e.g. 4
  'Менеджер': number; // 0 = unlimited
}

export interface ConsensusVote {
  playerId: string;
  playerName: string;
  department: Department;
  level: HierarchyLevel;
  optionId: string;
  text: string;
  isFlawed: boolean;
  isSabotage?: boolean;
  timestamp: string;
}

export interface ConsensusGroup {
  groupId: string;                  // e.g. "head" or "teamLead:Форвард" or "manager:Форвард"
  level: HierarchyLevel;            // 'Керівник' | 'Тімлід' | 'Менеджер'
  department: Department | 'Всі';   // Department or 'Всі' for Head tier
  displayName: string;              // e.g. "Керівники", "Форвард (Тімліди)", "Форвард (Менеджери)"
  expectedVoterIds: string[];       // IDs of active players expected to vote
  votes: Record<string, ConsensusVote>; // playerId -> ConsensusVote
  isResolved: boolean;              // true once consensus is resolved
  winningOptionId: string | null;
  winningText: string | null;
  winningIsFlawed: boolean;
  winningIsSabotage?: boolean;
  voteCounts: Record<string, number>; // optionId -> count
  hasTie: boolean;
  tiedOptionIds: string[];
}

export interface CascadeState {
  crisisId: number;
  currentStep: 'head' | 'teamLead' | 'manager' | 'completed';
  headDecision: {
    playerId: string;
    playerName: string;
    optionId: string;
    text: string;
    isFlawed: boolean;
  } | null;
  teamLeadDecisions: Record<string, {
    playerId: string;
    playerName: string;
    optionId: string;
    text: string;
    isFlawed: boolean;
    department?: Department;
  }>;
  managerDecisions: Record<string, {
    playerId: string;
    playerName: string;
    optionId: string;
    text: string;
    isFlawed: boolean;
    department?: Department;
  }>;
  mutinyProposal: {
    initiatorName: string;
    initiatorId: string;
    department: Department;
    accepted: string[];
    rejected: string[];
  } | null;
  consensusGroups: Record<string, ConsensusGroup>;
}

export interface VotingRecord {
  voterId: string;
  voterName: string;
  targetDepartment: Department;
  targetPlayerId: string;
  targetPlayerName: string;
  reason: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  type: 'system' | 'crisis' | 'cascade' | 'sabotage' | 'vote' | 'ghost' | 'superpower';
  sender: string;
  message: string;
  details?: any;
  isGhostMessage?: boolean;
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  currentCrisisIndex: number; // 0 to 4
  roleLimits: RoleLimits;
  players: Record<string, Player>;
  cascade: CascadeState | null;
  timer: {
    totalSeconds: number;
    remainingSeconds: number;
    isRunning: boolean;
    votingReadyVotes: Record<string, boolean>; // playerId -> true(Так) / false(Ні)
  };
  votes: VotingRecord[];
  eliminatedThisRound: {
    playerId: string;
    name: string;
    votesCount: number;
    hadShield: boolean;
  } | null;
  logs: AuditLogEntry[];
  isGameOver: boolean;
  isVictory: boolean;
  gameStartedAt: number | null;
}
