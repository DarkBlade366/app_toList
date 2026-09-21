import type { Task } from '@/lib/schema';
import type { TaskType } from '@/lib/logic';
import { taskTypeOf } from '@/lib/logic';

/** Bonus al completar la última tarea pendiente del día. */
export const DAY_CLOSED_BONUS = 25;

/**
 * XP ganada por completar una tarea según su tipo.
 * Las generales dan con diferencia lo máximo: son proyectos que siempre están ahí.
 */
export const XP_BY_TYPE: Record<TaskType, number> = {
  general: 100,
  monthly: 50,
  weekly: 40,
  range: 30,
  daily: 20,
  once: 15,
};

/** XP que cuesta subir una unidad de nivel. Cada vez cuesta más: 60, 170, 312, 480, … */
export function xpForLevel(level: number): number {
  return Math.round(60 * Math.pow(level, 1.5));
}

/** Total de XP necesario para ENTRAR en un nivel concreto (nivel 1 = 0). */
function thresholdFor(level: number): number {
  let acc = 0;
  for (let l = 1; l < level; l++) acc += xpForLevel(l);
  return acc;
}

export interface LevelInfo {
  level: number;
  current: number;
  next: number;
  progress: number;
  remaining: number;
}

/** Nivel actual y progreso dentro de él a partir del total de XP. */
export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  while (xp >= thresholdFor(level + 1)) level++;
  const prev = thresholdFor(level);
  const current = xp - prev;
  const next = level === 1 ? xpForLevel(1) : thresholdFor(level + 1) - prev;
  return {
    level,
    current,
    next,
    progress: next === 0 ? 1 : Math.min(1, Math.max(0, current / next)),
    remaining: Math.max(0, next - current),
  };
}

/** Recompensa individual de una tarea según su tipo. */
export function xpRewardFor(t: Pick<Task, 'recurrence' | 'startDate' | 'endDate'>): number {
  return XP_BY_TYPE[taskTypeOf(t)] ?? XP_BY_TYPE.once;
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