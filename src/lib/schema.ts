import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'metas.db';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'paused';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type RemindType = 'alarm' | 'notification' | 'none';
export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  title: string;
  notes: string | null;
  parentId: number | null;
  sortOrder: number;
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
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  remindersEnabled: boolean;
  defaultRemindType: RemindType;
  defaultRemindBeforeMinutes: number;
  remindAtStartDefault: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
}

export interface TaskCompletion {
  taskId: number;
  date: string;
}

export interface XpEntry {
  id: number;
  xp: number;
  reason: string;
  taskId: number | null;
  earnedAt: string;
}

const SETTING_DEFAULTS: Record<keyof Settings, string> = {
  remindersEnabled: '1',
  defaultRemindType: 'alarm',
  defaultRemindBeforeMinutes: '15',
  remindAtStartDefault: '0',
  dailySummaryEnabled: '1',
  dailySummaryTime: '07:00',
};

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 5;
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = versionRow?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  parent_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL DEFAULT 'none',
  recurrence_days TEXT,
  monthly_day INTEGER,
  start_date TEXT,
  end_date TEXT,
  start_time TEXT,
  end_time TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  remind_type TEXT NOT NULL DEFAULT 'alarm',
  remind_before_minutes INTEGER,
  remind_at_start INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks (parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sort ON tasks (sort_order);

CREATE TABLE IF NOT EXISTS task_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  task_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  xp INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE (task_id, date),
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_completions_date ON task_completions (date);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  xp INTEGER NOT NULL,
  reason TEXT NOT NULL,
  task_id INTEGER,
  earned_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_xp_earned ON xp_log (earned_at);

INSERT OR IGNORE INTO settings (key, value) VALUES ${Object.entries(SETTING_DEFAULTS)
      .map(([k, v]) => `('${k}', '${v}')`)
      .join(', ')};
`);

    const initialized = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'initialized'"
    );
    if (initialized?.value !== '1') {
      await db.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('initialized', '1')");
    }
    currentDbVersion = 3;
  } else if (currentDbVersion === 1) {
    await db.execAsync(`
PRAGMA foreign_keys = OFF;
BEGIN;
CREATE TABLE tasks_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  parent_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL DEFAULT 'none',
  recurrence_days TEXT,
  monthly_day INTEGER,
  start_date TEXT,
  end_date TEXT,
  start_time TEXT,
  end_time TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  remind_type TEXT NOT NULL DEFAULT 'alarm',
  remind_before_minutes INTEGER,
  remind_at_start INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE
);
INSERT INTO tasks_v2 (id, title, notes, parent_id, recurrence, recurrence_days, monthly_day,
                      start_date, end_date, start_time, end_time, priority, status,
                      remind_type, remind_before_minutes, remind_at_start, completed_at,
                      created_at, updated_at)
  SELECT id, title, notes, parent_id, recurrence, recurrence_days, monthly_day,
         start_date, end_date, start_time, end_time, priority, status,
         remind_type, remind_before_minutes, remind_at_start, completed_at,
         created_at, updated_at
  FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_v2 RENAME TO tasks;
DROP TABLE IF EXISTS objectives;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks (parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sort ON tasks (sort_order);
COMMIT;
`);
    currentDbVersion = 3;
  } else if (currentDbVersion === 2) {
    await db.execAsync(`
ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_sort ON tasks (sort_order);
`);
    currentDbVersion = 3;
  } else if (currentDbVersion === 3) {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  xp INTEGER NOT NULL,
  reason TEXT NOT NULL,
  task_id INTEGER,
  earned_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_xp_earned ON xp_log (earned_at);
`);
    currentDbVersion = 4;
  } else if (currentDbVersion === 4) {
    await db.execAsync(`
ALTER TABLE task_completions ADD COLUMN xp INTEGER;
`);
    currentDbVersion = 5;
  }

  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}