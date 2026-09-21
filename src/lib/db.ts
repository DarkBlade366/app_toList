import type { SQLiteDatabase } from 'expo-sqlite';

import { xpRewardFor } from './gamification';
import { occursOnDate } from './logic';
import { Priority, Recurrence, RemindType, Settings, Task, TaskCompletion, TaskStatus, XpEntry } from './schema';

export type {
  Priority,
  Recurrence,
  RemindType,
  Settings,
  Task,
  TaskCompletion,
  TaskStatus,
  XpEntry,
} from './schema';

export interface TaskWrite {
  title: string;
  notes: string | null;
  parentId?: number | null;
  recurrence: Recurrence;
  recurrenceDays: number[] | null;
  monthlyDay: number | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  priority: Priority;
  status: TaskStatus;
  remindType: RemindType;
  remindBeforeMinutes: number | null;
  remindAtStart: boolean;
}

const TASK_SELECT = `
  SELECT id, title, notes, parent_id AS parentId, sort_order AS sortOrder,
         recurrence, recurrence_days AS recurrenceDays, monthly_day AS monthlyDay,
         start_date AS startDate, end_date AS endDate, start_time AS startTime, end_time AS endTime,
         priority, status, remind_type AS remindType, remind_before_minutes AS remindBeforeMinutes,
         remind_at_start AS remindAtStart, completed_at AS completedAt,
         created_at AS createdAt, updated_at AS updatedAt
  FROM tasks`;

interface RawTask extends Omit<Task, 'recurrenceDays' | 'remindAtStart'> {
  recurrenceDays: string | null;
  remindAtStart: number;
}

function mapTask(row: RawTask): Task {
  return {
    ...row,
    recurrenceDays: row.recurrenceDays ? (JSON.parse(row.recurrenceDays) as number[]) : null,
    remindAtStart: row.remindAtStart === 1,
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SETTING_KEYS: Record<keyof Settings, string> = {
  remindersEnabled: 'remindersEnabled',
  defaultRemindType: 'defaultRemindType',
  defaultRemindBeforeMinutes: 'defaultRemindBeforeMinutes',
  remindAtStartDefault: 'remindAtStartDefault',
  dailySummaryEnabled: 'dailySummaryEnabled',
  dailySummaryTime: 'dailySummaryTime',
};

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    remindersEnabled: (map.get(SETTING_KEYS.remindersEnabled) ?? '1') === '1',
    defaultRemindType: (map.get(SETTING_KEYS.defaultRemindType) ?? 'alarm') as RemindType,
    defaultRemindBeforeMinutes: Number(
      map.get(SETTING_KEYS.defaultRemindBeforeMinutes) ?? '15'
    ),
    remindAtStartDefault: (map.get(SETTING_KEYS.remindAtStartDefault) ?? '0') === '1',
    dailySummaryEnabled: (map.get(SETTING_KEYS.dailySummaryEnabled) ?? '1') === '1',
    dailySummaryTime: map.get(SETTING_KEYS.dailySummaryTime) ?? '07:00',
  };
}

export async function saveSettings(db: SQLiteDatabase, settings: Settings) {
  const values: [string, string][] = [
    [SETTING_KEYS.remindersEnabled, settings.remindersEnabled ? '1' : '0'],
    [SETTING_KEYS.defaultRemindType, settings.defaultRemindType],
    [SETTING_KEYS.defaultRemindBeforeMinutes, String(settings.defaultRemindBeforeMinutes)],
    [SETTING_KEYS.remindAtStartDefault, settings.remindAtStartDefault ? '1' : '0'],
    [SETTING_KEYS.dailySummaryEnabled, settings.dailySummaryEnabled ? '1' : '0'],
    [SETTING_KEYS.dailySummaryTime, settings.dailySummaryTime],
  ];
  for (const [key, value] of values) {
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function getTasks(db: SQLiteDatabase): Promise<Task[]> {
  const rows = await db.getAllAsync<RawTask>(
    `${TASK_SELECT}
     ORDER BY sort_order, title COLLATE NOCASE`
  );
  return rows.map(mapTask);
}

export async function getTask(db: SQLiteDatabase, id: number): Promise<Task | null> {
  const row = await db.getFirstAsync<RawTask>(`${TASK_SELECT} WHERE id = ?`, id);
  return row ? mapTask(row) : null;
}

export async function hasSubtasks(db: SQLiteDatabase, parentId: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM tasks WHERE parent_id = ?',
    parentId
  );
  return (row?.n ?? 0) > 0;
}

export async function addTask(db: SQLiteDatabase, data: TaskWrite): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO tasks (title, notes, parent_id, sort_order, recurrence, recurrence_days,
                        monthly_day, start_date, end_date, start_time, end_time, priority, status,
                        remind_type, remind_before_minutes, remind_at_start, created_at, updated_at)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.notes,
      data.parentId ?? null,
      data.recurrence,
      data.recurrenceDays ? JSON.stringify(data.recurrenceDays) : null,
      data.monthlyDay,
      data.startDate,
      data.endDate,
      data.startTime,
      data.endTime,
      data.priority,
      data.status,
      data.remindType,
      data.remindBeforeMinutes,
      data.remindAtStart ? 1 : 0,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

/**
 * Fija el orden manual (sort_order) de un grupo de tareas hermanas en el orden dado.
 * Se usa al soltar un arrastre: el grupo completo se reenumera 0..n.
 */
export async function setSiblingOrder(db: SQLiteDatabase, orderedIds: number[]) {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?', [
        i,
        now,
        orderedIds[i],
      ]);
    }
  });
}

export async function updateTask(db: SQLiteDatabase, id: number, data: TaskWrite) {
  await db.runAsync(
    `UPDATE tasks SET title = ?, notes = ?, parent_id = ?, recurrence = ?, recurrence_days = ?,
                      monthly_day = ?, start_date = ?, end_date = ?, start_time = ?, end_time = ?,
                      priority = ?, status = ?, remind_type = ?, remind_before_minutes = ?,
                      remind_at_start = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.title,
      data.notes,
      data.parentId ?? null,
      data.recurrence,
      data.recurrenceDays ? JSON.stringify(data.recurrenceDays) : null,
      data.monthlyDay,
      data.startDate,
      data.endDate,
      data.startTime,
      data.endTime,
      data.priority,
      data.status,
      data.remindType,
      data.remindBeforeMinutes,
      data.remindAtStart ? 1 : 0,
      new Date().toISOString(),
      id,
    ]
  );
}

export async function setTaskStatus(
  db: SQLiteDatabase,
  id: number,
  status: TaskStatus,
  completedAt?: string | null
) {
  await db.runAsync('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    new Date().toISOString(),
    id,
  ]);
  if (completedAt !== undefined) {
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE id = ?', [completedAt, id]);
  }
}

export async function updateTaskParent(db: SQLiteDatabase, id: number, parentId: number | null) {
  await db.runAsync('UPDATE tasks SET parent_id = ?, updated_at = ? WHERE id = ?', [
    parentId,
    new Date().toISOString(),
    id,
  ]);
}

export async function deleteTask(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

/**
 * Marca la tarea como completada en una fecha (una sola ocurrencia) o la desmarca.
 * Para recurrentes, registra el completado del día; para puntuales, marca/desmarca globalmente.
 *
 * Reglas de cascada:
 *  - Completar un padre completa también toda su rama (hijos, nietos, …) ese día.
 *  - Si al completar quedan completados TODOS los hijos de un padre, ese padre se
 *    completa automáticamente, y esto se propaga hacia arriba en la cadena.
 *  - Desmarcar cualquier tarea desmarca toda su propia rama y también a todos sus
 *    ancestros (hasta la raíz), revirtiendo lo completado en bloque.
 */
/**
 * Revierte todos los completados de una fecha concreta (tarea + rama + ancestros),
 * dejando en 'pending' lo que estaba 'completed' y devolviendo exactamente la XP
 * que se ganó ese día (usa la cantidad guardada en el completado, no recalcula).
 */
async function removeCompletionsForDate(
  db: SQLiteDatabase,
  id: number,
  subtree: number[],
  all: Task[],
  byId: Map<number, Task>,
  date: string,
  now: string
) {
  const task = byId.get(id);
  if (!task) return;

  const remove = [id, ...subtree];
  const ancestors: number[] = [];
  let cur = task.parentId;
  while (cur != null) {
    ancestors.push(cur);
    cur = all.find((t) => t.id === cur)?.parentId ?? null;
  }
  const maybe = [...new Set([...remove, ...ancestors])];

  const rows = await db.getAllAsync<{ task_id: number; xp: number | null }>(
    `SELECT task_id, xp FROM task_completions
     WHERE task_id IN (${maybe.map(() => '?').join(',')}) AND date = ?`,
    [...maybe, date]
  );
  const affected = rows.map((r) => r.task_id);

  await db.runAsync(
    `DELETE FROM task_completions
     WHERE task_id IN (${maybe.map(() => '?').join(',')}) AND date = ?`,
    [...maybe, date]
  );

  if (affected.length > 0) {
    await db.runAsync(
      `UPDATE tasks
       SET status = CASE WHEN status = 'completed' THEN 'pending' ELSE status END,
           completed_at = NULL, updated_at = ?
       WHERE id IN (${affected.map(() => '?').join(',')})`,
      [now, ...affected]
    );
    // Reversa exacta de XP: por cada completado se devuelve exactamente la
    // cantidad que se ganó ese día (no se recalcula).
    for (const r of rows) {
      const t = byId.get(r.task_id);
      const gained = r.xp ?? (t ? xpRewardFor(t) : 0);
      if (gained <= 0) continue;
      await db.runAsync(
        'INSERT INTO xp_log (xp, reason, task_id, earned_at) VALUES (?, ?, ?, ?)',
        [-gained, 'undo', r.task_id, now]
      );
    }
  }
}

export async function toggleTaskCompletion(
  db: SQLiteDatabase,
  id: number,
  date: string
): Promise<boolean> {
  const task = await getTask(db, id);
  if (!task) return false;

  const now = new Date().toISOString();
  const all = await getTasks(db);
  const byId = new Map(all.map((t) => [t.id, t]));

  const subtree: number[] = [];
  const queue = [id];
  while (queue.length > 0) {
    const pid = queue.pop()!;
    for (const t of all) {
      if (t.parentId === pid) {
        subtree.push(t.id);
        queue.push(t.id);
      }
    }
  }

  const existing = await db.getFirstAsync<{ task_id: number }>(
    'SELECT task_id FROM task_completions WHERE task_id = ? AND date = ?',
    id,
    date
  );

  // Si se desmarca algo que está 'completed' pero no tiene completado en ESTA
  // fecha (p. ej. una general hecha ayer que hoy vuelve a salir como hecha en el
  // listado), se revierten sus completados reales en vez de registrar uno nuevo.
  // Antes ese caso caía en la rama de marcar y sumaba XP al desmarcar.
  let undoTargets: string[] | null = existing ? [date] : null;
  if (!existing && task.status === 'completed' && task.recurrence === 'none') {
    const rows = await db.getAllAsync<{ date: string }>(
      `SELECT DISTINCT date FROM task_completions
       WHERE task_id IN (${[id, ...subtree].map(() => '?').join(',')})`,
      [id, ...subtree]
    );
    if (rows.length > 0) undoTargets = rows.map((r) => r.date);
  }

  await db.withTransactionAsync(async () => {
    if (undoTargets) {
      for (const d of undoTargets) {
        await removeCompletionsForDate(db, id, subtree, all, byId, d, now);
      }
    } else {
      const ids = [id];
      for (const tid of subtree) {
        const child = all.find((t) => t.id === tid);
        if (!child || !occursOnDate(child, date)) continue;
        if (child.status === 'cancelled' || child.status === 'paused') continue;
        ids.push(tid);
      }

      const completedForDate = new Set(
        (
          await db.getAllAsync<TaskCompletion>(
            'SELECT task_id AS taskId, date FROM task_completions WHERE date = ?',
            date
          )
        ).map((r) => String(r.taskId))
      );

      // Guarda también cuánto vale la tarea ese día para poder revertirlo igual.
      for (const tid of ids) {
        const t = byId.get(tid);
        if (!t) continue;
        await db.runAsync(
          'INSERT OR IGNORE INTO task_completions (task_id, date, created_at, xp) VALUES (?, ?, ?, ?)',
          [tid, date, now, xpRewardFor(t)]
        );
      }
      await db.runAsync(
        `UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ?
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        [now, now, ...ids]
      );

      // XP solo para las que hoy aún no estaban hechas (evita doble recompensa).
      for (const tid of ids) {
        if (completedForDate.has(String(tid))) continue;
        const t = byId.get(tid);
        if (!t) continue;
        const gained = xpRewardFor(t);
        completedForDate.add(String(tid));
        await db.runAsync(
          'INSERT INTO xp_log (xp, reason, task_id, earned_at) VALUES (?, ?, ?, ?)',
          [gained, 'task', tid, now]
        );
      }

      // Propaga hacia arriba: si con este completado TODOS los hijos que ocurren
      // ese día quedan hechos, el padre también se completa (y así en cadena).
      let upId = task.parentId;
      let guard = 0;
      while (upId != null && guard++ < 50) {
        const par = byId.get(upId);
        if (!par) break;
        // Un padre en pausa o cancelado no debe saltar a 'completed' por cascada.
        if (par.status === 'cancelled' || par.status === 'paused') break;
        const kids = all.filter(
          (c) =>
            c.parentId === upId &&
            occursOnDate(c, date) &&
            c.status !== 'cancelled' &&
            c.status !== 'paused'
        );
        if (kids.length === 0) break;
        const allDone = kids.every((c) => completedForDate.has(String(c.id)));
        if (!allDone || !occursOnDate(par, date)) break;
        const newlyAdded = !completedForDate.has(String(par.id));
        const gained = xpRewardFor(par);
        await db.runAsync(
          'INSERT OR IGNORE INTO task_completions (task_id, date, created_at, xp) VALUES (?, ?, ?, ?)',
          [par.id, date, now, gained]
        );
        await db.runAsync(
          "UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
          [now, now, par.id]
        );
        if (newlyAdded) {
          await db.runAsync(
            'INSERT INTO xp_log (xp, reason, task_id, earned_at) VALUES (?, ?, ?, ?)',
            [gained, 'task', par.id, now]
          );
        }
        completedForDate.add(String(par.id));
        upId = par.parentId;
      }
    }
  });

  // true si se marcó hecha; false si se desmarcó (o se revirtió un completado previo).
  return !undoTargets;
}

export async function getCompletionsForDate(db: SQLiteDatabase, date: string): Promise<string[]> {
  const rows = await db.getAllAsync<TaskCompletion>(
    'SELECT task_id AS taskId, date FROM task_completions WHERE date = ?',
    date
  );
  return rows.map((r) => String(r.taskId));
}

export async function getCompletionsSetForDate(db: SQLiteDatabase, date: string): Promise<Set<string>> {
  const list = await getCompletionsForDate(db, date);
  return new Set(list);
}

export async function getCompletions(db: SQLiteDatabase): Promise<TaskCompletion[]> {
  return db.getAllAsync<TaskCompletion>(
    'SELECT task_id AS taskId, date FROM task_completions ORDER BY date'
  );
}

// ---------------------------------------------------------------------------
// Gamificación (XP)
// ---------------------------------------------------------------------------

export async function getXp(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ xp: number }>(
    'SELECT MAX(0, COALESCE(SUM(xp), 0)) AS xp FROM xp_log'
  );
  return row?.xp ?? 0;
}

export async function earnXp(
  db: SQLiteDatabase,
  xp: number,
  reason: string,
  taskId: number | null = null
): Promise<void> {
  await db.runAsync(
    'INSERT INTO xp_log (xp, reason, task_id, earned_at) VALUES (?, ?, ?, ?)',
    [xp, reason, taskId, new Date().toISOString()]
  );
}

export async function getXpLog(db: SQLiteDatabase): Promise<XpEntry[]> {
  return db.getAllAsync<XpEntry>(
    'SELECT id, xp, reason, task_id AS taskId, earned_at AS earnedAt FROM xp_log ORDER BY earned_at DESC'
  );
}

/**
 * Reinicia el estado "completed" de tareas recurrentes que completaste en un día
 * anterior y hoy no tienen completado registrado.
 */
export async function resetRecurringDayStatuses(db: SQLiteDatabase, today: string) {
  await db.runAsync(
    `UPDATE tasks SET status = 'pending', completed_at = NULL, updated_at = ?
     WHERE recurrence IN ('daily', 'weekly', 'monthly')
       AND status = 'completed'
       AND NOT EXISTS (
         SELECT 1 FROM task_completions tc
         WHERE tc.task_id = tasks.id AND tc.date = ?
       )
       AND (completed_at IS NULL OR substr(completed_at, 1, 10) < ?)`,
    [new Date().toISOString(), today, today]
  );
}

export async function clearCompletions(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM task_completions');
  await db.runAsync(
    `UPDATE tasks SET status = CASE WHEN status = 'completed' THEN 'pending' ELSE status END,
       completed_at = NULL, updated_at = ?`,
    [new Date().toISOString()]
  );
}

export async function deleteAllTasks(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.runAsync('DELETE FROM tasks');
}