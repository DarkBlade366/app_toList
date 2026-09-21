import type { Priority } from '@/lib/db';

/** XP ganada por completar una tarea según su prioridad. */
export const XP_BY_PRIORITY: Record<Priority, number> = {
  low: 5,
  medium: 10,
  high: 15,
};

/** Bonus al completar la última tarea pendiente del día. */
export const DAY_CLOSED_BONUS = 25;

/** XP que cuesta subir UNA unidad de nivel: 50, 75, 100, ... */
function xpForLevel(level: number): number {
  return 50 + (level - 1) * 25;
}

function cumulativeXpFor(level: number): number {
  let acc = 0;
  for (let l = 1; l <= level; l++) acc += xpForLevel(l);
  return acc;
}

export interface LevelInfo {
  level: number;
  current: number;
  next: number;
  progress: number;
}

/** Nivel actual y progreso dentro de él a partir del total de XP. */
export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (cumulativeXpFor(level + 1) <= xp) level++;
  const prev = level === 1 ? 0 : cumulativeXpFor(level - 1);
  const current = xp - prev;
  const next = level === 1 ? cumulativeXpFor(1) : cumulativeXpFor(level) - prev;
  return { level, current, next, progress: next === 0 ? 1 : Math.min(1, current / next) };
}

export interface Achievements {
  unlocked: string[];
  total: number;
}

interface AchieveRule {
  id: string;
  label: string;
  icon: string;
  check: (s: Stats) => boolean;
}

interface Stats {
  total: number;
  activeDays: number;
  streak: number;
  level: number;
}

const RULES: AchieveRule[] = [
  { id: 'first', label: 'Primera tarea completada', icon: 'sparkles-outline', check: (s) => s.total >= 1 },
  { id: 'c100', label: '100 tareas completadas', icon: 'ribbon-outline', check: (s) => s.total >= 100 },
  { id: 'c500', label: '500 tareas completadas', icon: 'trophy-outline', check: (s) => s.total >= 500 },
  { id: 's7', label: 'Racha de 7 días', icon: 'flame-outline', check: (s) => s.streak >= 7 },
  { id: 's30', label: 'Racha de 30 días', icon: 'flame-outline', check: (s) => s.streak >= 30 },
  { id: 'a14', label: 'Dos semanas activas', icon: 'calendar-outline', check: (s) => s.activeDays >= 14 },
  { id: 'a60', label: 'Dos meses activos', icon: 'calendar-outline', check: (s) => s.activeDays >= 60 },
  { id: 'l5', label: 'Alcanza el nivel 5', icon: 'star-outline', check: (s) => s.level >= 5 },
  { id: 'l10', label: 'Alcanza el nivel 10', icon: 'star-outline', check: (s) => s.level >= 10 },
];

/** Logros desbloqueados dadas las estadísticas actuales. */
export function achievements(stats: Stats): Achievements {
  const unlocked = RULES.filter((r) => r.check(stats)).map((r) => r.label);
  return { unlocked, total: RULES.length };
}