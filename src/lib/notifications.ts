import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import {
  addDays,
  formatTime,
  minutesToTime,
  occursOnDate,
  parseTimeToMinutes,
  todayISO,
} from '@/lib/logic';
import type { Task } from '@/lib/schema';

export const ALARM_CHANNEL = 'tarea-alarmas';
export const NOTIFICATION_CHANNEL = 'tarea-aviso';
export const SUMMARY_CHANNEL = 'resumen-diario';

const LOOKAHEAD_DAYS = 90;

if (Platform.OS === 'android' || Platform.OS === 'ios') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const s = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return s.granted;
  } catch {
    return false;
  }
}

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
    name: 'Alarmas de tarea',
    description: 'Alarmas sonoras de las tareas',
    importance: Notifications.AndroidImportance.MAX,
    sound: null,
    enableVibrate: true,
    vibrationPattern: [0, 500, 400, 500, 400, 1000],
    lightColor: Colors.alarm,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: 'Recordatorios de tarea',
    description: 'Avisos de las tareas',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
    enableVibrate: true,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: Colors.tint,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync(SUMMARY_CHANNEL, {
    name: 'Resumen diario',
    description: 'Resumen de las tareas del día',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
    lightColor: Colors.textSecondary,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: true,
  });
}

function dateAt(iso: string, hm: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

async function scheduleTaskReminder(task: Task, iso: string, when: Date, isStart: boolean) {
  const time = isStart ? task.startTime : task.endTime;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: task.title,
      body: isStart ? `Empieza a las ${formatTime(time)}` : `Termina a las ${formatTime(time)}`,
      color: Colors.tint,
      data: { url: `/task/${task.id}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: task.remindType === 'alarm' ? ALARM_CHANNEL : NOTIFICATION_CHANNEL,
    },
  });
}

/**
 * Recalcula todos los avisos programados según las tareas guardadas y los
 * ajustes. Es idempotente: primero cancela todo y vuelve a programar.
 */
export async function syncNotifications(sqlite: SQLiteDatabase): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    await ensureChannels();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const settings = await db.getSettings(sqlite);
    const now = todayISO();

    if (settings.remindersEnabled) {
      const tasks = await db.getTasks(sqlite);
      const completions = await db.getCompletions(sqlite);
      const done = new Map<number, Set<string>>();
      for (const c of completions) {
        const set = done.get(c.taskId) ?? new Set<string>();
        set.add(c.date);
        done.set(c.taskId, set);
      }

      for (const task of tasks) {
        if (task.status === 'cancelled' || task.status === 'completed') continue;
        if (task.remindType === 'none') continue;
        const before = task.remindBeforeMinutes ?? settings.defaultRemindBeforeMinutes;
        const endMin = parseTimeToMinutes(task.endTime);

        for (let i = 0; i <= LOOKAHEAD_DAYS; i++) {
          const iso = addDays(now, i);
          if (task.startDate && iso < task.startDate) continue;
          if (task.endDate && iso > task.endDate) continue;
          if (!occursOnDate(task, iso)) continue;
          if (done.get(task.id)?.has(iso)) continue;

          if (task.remindAtStart && task.startTime) {
            const when = dateAt(iso, task.startTime);
            if (when.getTime() > Date.now()) {
              await scheduleTaskReminder(task, iso, when, true);
            }
          }
          if (task.endTime && before != null && before > 0 && endMin != null) {
            const when = dateAt(iso, minutesToTime(Math.max(0, endMin - before)));
            if (when.getTime() > Date.now()) {
              await scheduleTaskReminder(task, iso, when, false);
            }
          }
        }
      }
    }

    if (settings.dailySummaryEnabled) {
      const [hh, mm] = (settings.dailySummaryTime || '07:00').split(':').map(Number);
      const tasks = await db.getTasks(sqlite);
      const completions = await db.getCompletionsSetForDate(sqlite, now);
      let pending = 0;
      for (const t of tasks) {
        if (t.status === 'cancelled' || t.status === 'completed') continue;
        if (!occursOnDate(t, now)) continue;
        if (completions.has(String(t.id))) continue;
        pending++;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Resumen del día',
          body: pending === 0 ? 'Sin tareas pendientes para hoy.' : `Tienes ${pending} tarea${pending > 1 ? 's' : ''} pendiente${pending > 1 ? 's' : ''} para hoy.`,
          color: Colors.tint,
          data: { url: '/' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hh,
          minute: mm,
          channelId: SUMMARY_CHANNEL,
        },
      });
    }
  } catch (e) {
    console.warn('syncNotifications falló:', e);
  }
}