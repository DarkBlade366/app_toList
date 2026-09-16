import type { SQLiteDatabase } from 'expo-sqlite';

import { Priority, Recurrence, RemindType, Settings, Task, TaskCompletion, TaskStatus } from './schema';

export type {
  Priority,
  Recurrence,
  RemindType,
  Settings,
  Task,
  TaskCompletion,
  TaskStatus,
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
  SELECT id, title, notes, parent_id AS parentId,
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
     ORDER BY start_date IS NULL, start_date IS NOT NULL AND (recurrence != 'none' AND start_date > ''),
              COALESCE(start_date, '9999'), COALESCE(end_time, '99:99'), title COLLATE NOCASE`
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
    `INSERT INTO tasks (title, notes, parent_id, recurrence, recurrence_days,
                        monthly_day, start_date, end_date, start_time, end_time, priority, status,
                        remind_type, remind_before_minutes, remind_at_start, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export async function updateTask(db: SQLiteDatabase, id: number, data: TaskWrite) {
  await db.runAsync(
    `UPDATE tasks SET title = ?, notes = ?, recurrence = ?, recurrence_days = ?,
                      monthly_day = ?, start_date = ?, end_date = ?, start_time = ?, end_time = ?,
                      priority = ?, status = ?, remind_type = ?, remind_before_minutes = ?,
                      remind_at_start = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.title,
      data.notes,
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
 */
export async function toggleTaskCompletion(
  db: SQLiteDatabase,
  id: number,
  date: string
): Promise<boolean> {
  const task = await getTask(db, id);
  if (!task) return false;

  const existing = await db.getFirstAsync<{ task_id: number }>(
    'SELECT task_id FROM task_completions WHERE task_id = ? AND date = ?',
    id,
    date
  );

  if (existing) {
    await db.runAsync('DELETE FROM task_completions WHERE task_id = ? AND date = ?', id, date);
    await setTaskStatus(db, id, 'pending', null);
    return false;
  }

  await db.runAsync('INSERT INTO task_completions (task_id, date, created_at) VALUES (?, ?, ?)', [
    id,
    date,
    new Date().toISOString(),
  ]);
  await setTaskStatus(db, id, 'completed', new Date().toISOString());
  return true;
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