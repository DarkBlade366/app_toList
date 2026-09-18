import type { Task } from './schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha local ISO (YYYY-MM-DD) de hoy, desplazada opcionalmente. */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setTime(d.getTime() + offsetDays * DAY_MS);
  return toISO(d);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToTime(t: string, minutes: number): string {
  const base = parseTimeToMinutes(t) ?? 0;
  return minutesToTime(((base + minutes) % (24 * 60) + 24 * 60) % (24 * 60));
}

/** getDay() de JS: 0 = domingo ... 6 = sábado. */
export function weekdayOf(iso: string): number {
  return fromISO(iso).getDay();
}

export function monthDayOf(iso: string): number {
  return fromISO(iso).getDate();
}

export function weekdayLabel(weekday: number): string {
  return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][weekday] ?? '';
}

export function formatDateLong(iso: string): string {
  const d = fromISO(iso);
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(iso: string): string {
  const d = fromISO(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', weekday: 'short' });
}

export function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDateDMY(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Convierte texto DD/MM/AAAA (o DD-MM-AAAA, DD.MM.AAAA) a ISO yYYY-MM-DD; null si no es válida. */
export function parseDateDMY(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return toISO(date);
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** ¿Ocurre la tarea en la fecha dada? (recurrencia + rango de fechas) */
export function occursOnDate(
  task: Pick<Task, 'startDate' | 'endDate' | 'recurrence' | 'recurrenceDays' | 'monthlyDay'>,
  iso: string
): boolean {
  if (task.startDate && iso < task.startDate) return false;
  if (task.endDate && iso > task.endDate) return false;
  switch (task.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      return task.recurrenceDays?.includes(weekdayOf(iso)) ?? false;
    case 'monthly': {
      if (task.monthlyDay == null) return true;
      return monthDayOf(iso) === task.monthlyDay;
    }
    default:
      return true;
  }
}

/** ¿Es una tarea recurrente (se repite varias fechas)? */
export function isRecurring(task: Pick<Task, 'recurrence'>): boolean {
  return task.recurrence !== 'none';
}

/**
 * Estado efectivo de una tarea para una fecha concreta, dado el set de
 * completados de ese día. Los estados globales (cancelada/pausada) mandan siempre.
 */
export function statusForDate(
  task: Pick<Task, 'id' | 'status' | 'recurrence'>,
  completedDates: ReadonlySet<string>,
  iso: string
): Task['status'] {
  if (task.status === 'cancelled' || task.status === 'paused') return task.status;
  if (completedDates.has(String(task.id))) return 'completed';
  if (isRecurring(task)) {
    return task.status === 'in_progress' ? 'in_progress' : 'pending';
  }
  return task.status;
}

/** ¿Está vencida la instancia de la tarea en la fecha dada (al momento de consultar)? */
export function isOverdue(
  task: Task,
  iso: string,
  completedDates: ReadonlySet<string>
): boolean {
  if (completedDates.has(String(task.id))) return false;
  if (task.status === 'cancelled' || task.status === 'paused') return false;
  const today = todayISO();
  if (iso < today) return true;
  if (iso === today && !isRecurring(task)) {
    if (task.endDate && task.startDate && task.startDate !== task.endDate && task.endDate < today) {
      return true;
    }
  }
  if (iso === today) {
    const end = parseTimeToMinutes(task.endTime);
    const now = parseTimeToMinutes(nowTime()) ?? 0;
    if (end != null && now > end) return true;
  }
  return false;
}

/** Minutos restantes hasta el fin de la instancia (null si no aplica). */
export function minutesToDeadline(task: Task, iso: string): number | null {
  if (iso !== todayISO() || isOverdue(task, iso, new Set())) return null;
  const end = parseTimeToMinutes(task.endTime);
  const now = parseTimeToMinutes(nowTime()) ?? 0;
  if (end == null) return null;
  return end - now;
}

/** Tareas que ocurren en una fecha, en orden por hora de fin (vencidas primero). */
export function tasksForDate(tasks: Task[], iso: string): Task[] {
  return tasks
    .filter((t) => occursOnDate(t, iso))
    .sort((a, b) => {
      const aEnd = parseTimeToMinutes(a.endTime) ?? 0;
      const bEnd = parseTimeToMinutes(b.endTime) ?? 0;
      return aEnd - bEnd;
    });
}

/**
 * Tareas a mostrar en la vista del día: las que ocurren esa fecha
 * (excluyendo las generales sin cita concreta) más todos sus ancestros,
 * para que al ver una sub-tarea del día salga la cadena de padres hasta la raíz.
 */
export function dayTreeTasks(tasks: Task[], iso: string): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const relevant = new Set<number>();
  const matching: number[] = [];
  for (const t of tasks) {
    if (occursOnDate(t, iso) && taskTypeOf(t) !== 'general') {
      matching.push(t.id);
      relevant.add(t.id);
    }
  }
  for (const id of matching) {
    let cur = byId.get(id);
    while (cur?.parentId != null) {
      relevant.add(cur.parentId);
      cur = byId.get(cur.parentId);
    }
  }
  return tasks.filter((t) => relevant.has(t.id));
}

/** Construye el árbol de sub-tareas a partir de una lista plana (solo raíces). */
export function buildTree<T extends { id: number; parentId: number | null }>(items: T[]): T[] {
  const byId = new Map<number, T>(items.map((t) => [t.id, t]));
  const roots: T[] = [];
  for (const item of items) {
    if (item.parentId == null || !byId.has(item.parentId)) {
      roots.push(item);
    }
  }
  return roots;
}

/** Todas las fechas de ocurrencia de una tarea recurrente dentro de un horizonte. */
export function occurrencesWithin(
  task: Task,
  from: string,
  days: number
): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(from, i);
    if (occursOnDate(task, iso)) out.push(iso);
  }
  return out;
}

export type TaskType = 'general' | 'once' | 'range' | 'daily' | 'weekly' | 'monthly';

export const TASK_TYPE_ORDER: TaskType[] = ['general', 'once', 'range', 'daily', 'weekly', 'monthly'];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  general: 'Tarea general',
  once: 'Un día',
  range: 'De tal día a tal día',
  daily: 'Diaria',
  weekly: 'Semanal',
  monthly: 'Mensual',
};

export const TASK_TYPE_DESCRIPTIONS: Record<TaskType, string> = {
  general: 'Sin fecha obligatoria, puede tener una fecha límite.',
  once: 'Para un día concreto, con margen de tiempo opcional.',
  range: 'Indicas el día de inicio y el día en que termina el periodo.',
  daily: 'Se repite todos los días desde una fecha.',
  weekly: 'Se repite alguno de los días de la semana.',
  monthly: 'Se repite cada mes el mismo día.',
};

export function taskTypeOf(t: Pick<Task, 'recurrence' | 'startDate' | 'endDate'>): TaskType {
  if (t.recurrence !== 'none') return t.recurrence;
  if (!t.startDate && !t.endDate) return 'general';
  if (!t.endDate || t.endDate === t.startDate) return 'once';
  return 'range';
}

const PRIORITY_RANK: Record<Task['priority'], number> = { high: 3, medium: 2, low: 1 };

/** Ordena tareas por prioridad (de mayor a menor) y luego por urgencia. */
export function sortByPriority<T extends Pick<Task, 'priority' | 'endTime'>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (pr !== 0) return pr;
    return (parseTimeToMinutes(a.endTime) ?? 0) - (parseTimeToMinutes(b.endTime) ?? 0);
  });
}

export function groupTasksByParent(tasks: Task[]): { roots: Task[]; childrenOf: Map<number, Task[]> } {
  const childrenOf = new Map<number, Task[]>();
  const roots: Task[] = [];
  for (const t of tasks) {
    if (t.parentId == null) {
      roots.push(t);
    } else {
      const list = childrenOf.get(t.parentId) ?? [];
      list.push(t);
      childrenOf.set(t.parentId, list);
    }
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return { roots, childrenOf };
}