import { Crisis, Player, CrisisOption } from './types';
export function crisisChoices(crisis: Crisis, player: Player): CrisisOption[];
export function privateAlibi(player: Player, severity: NonNullable<CrisisOption['severity']>, crisisId: number): string;
