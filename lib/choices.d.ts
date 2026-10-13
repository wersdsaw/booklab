import { Crisis, Player, CrisisOption } from './types';
export function crisisChoices(crisis: Crisis, player: Player): CrisisOption[];
export function privateAlibi(crisis: Crisis, player: Player, option: CrisisOption, contribution: number): string;
