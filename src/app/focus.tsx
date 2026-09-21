import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti } from '@/components/confetti';
import { ProgressRing } from '@/components/progress-ring';
import { taskMeta } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Colors, PriorityAccent, Radius } from '@/constants/theme';
import * as db from '@/lib/db';
import { DAY_CLOSED_BONUS, xpRewardFor } from '@/lib/gamification';
import { formatTime, formatDateLong, statusForDate, todayISO } from '@/lib/logic';
import { Task } from '@/lib/schema';

const PRIORITY_WEIGHT: Record<Task['priority'], number> = { high: 3, medium: 2, low: 1 };

function timeValue(t: Task): number {
  if (t.endTime) return Number(t.endTime.replace(':', ''));
  if (t.startTime) return Number(t.startTime.replace(':', ''));
  return 9999;
}

function pendingQueue(all: Task[], comps: Set<string>, today: string): Task[] {
  const occurs = (t: Task) =>
    (t.recurrence !== 'none' || (t.startDate != null && t.startDate <= today && (t.endDate == null || t.endDate >= today)));

  const relevant = all.filter(
    (t) =>
      t.status !== 'cancelled' &&
      t.status !== 'paused' &&
      statusForDate(t, comps, today) !== 'completed' &&
      statusForDate(t, comps, today) !== 'cancelled' &&
      occurs(t)
  );

  return relevant.sort(
    (a, b) =>
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || timeValue(a) - timeValue(b)
  );
}

export default function FocusScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [queue, setQueue] = useState<Task[]>([]);
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const today = todayISO();

  const load = useCallback(async () => {
    const [all, comps] = await Promise.all([
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, today),
    ]);
    const merged = pendingQueue(all, comps, today);
    setQueue(merged);
    setIndex(0);
  }, [sqlite, today]);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, today),
    ]).then(([all, comps]) => {
      if (!active) return;
      const merged = pendingQueue(all, comps, today);
      setQueue(merged);
      setIndex(0);
    });
    return () => {
      active = false;
    };
  }, [sqlite, today]);

  const current = queue.length > 0 ? queue[Math.min(index, queue.length - 1)] : null;
  const queued = queue.length;

  async function complete() {
    if (!current) return;
    const done = await db.toggleTaskCompletion(sqlite, current.id, today);
    if (!done) {
      toast.show('Ya estaba hecha', 'info');
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBurst((b) => b + 1);
    if (queue.length === 1) {
      await db.earnXp(sqlite, DAY_CLOSED_BONUS, 'day_close');
      toast.show(`¡Día completo! +${DAY_CLOSED_BONUS} XP`, 'success');
    } else {
      toast.show(`+${xpRewardFor(current)} XP`, 'success');
    }
    setQueue((q) => q.filter((t) => t.id !== current.id));
  }

  function postpone() {
    void Haptics.selectionAsync();
    setIndex((i) => (i + 1) % Math.max(1, queue.length));
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Enfoque</ThemedText>
          <ThemedText style={styles.subtitle}>
            {queued > 0 ? 'Una cosa a la vez' : 'Sin pendientes'}
          </ThemedText>
        </View>
        <Pressable onPress={load} hitSlop={10} style={styles.back}>
          <Ionicons name="refresh" size={20} color={Colors.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {!current ? (
          <View style={styles.doneCard}>
            <ProgressRing progress={1} size={150} strokeWidth={12} color={Colors.success}>
              <Ionicons name="checkmark" size={52} color={Colors.success} />
            </ProgressRing>
            <ThemedText style={styles.doneTitle}>¡Día completo!</ThemedText>
            <ThemedText style={styles.doneHint}>
              No queda nada pendiente para hoy. Buen trabajo.
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.counterRow}>
              <ThemedText style={styles.counter}>
                {queued} pendiente{queued === 1 ? '' : 's'} · día {formatDateLong(today)}
              </ThemedText>
            </View>

            <View style={[styles.focusCard, { borderColor: PriorityAccent[current.priority] }]}>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: PriorityAccent[current.priority] },
                ]}>
                <ThemedText style={styles.priorityText}>
                  {current.priority === 'high'
                    ? 'PRIORIDAD ALTA'
                    : current.priority === 'medium'
                      ? 'PRIORIDAD MEDIA'
                      : 'PRIORIDAD BAJA'}
                </ThemedText>
              </View>

              <ThemedText style={styles.taskTitle} numberOfLines={4}>
                {current.title}
              </ThemedText>

              {current.notes ? (
                <ThemedText style={styles.notes} numberOfLines={6}>
                  {current.notes}
                </ThemedText>
              ) : null}

              <View style={styles.timeRow}>
                {current.endTime || current.startTime ? (
                  <View style={styles.timeChip}>
                    <Ionicons name="time-outline" size={15} color={Colors.tint} />
                    <ThemedText style={styles.timeText}>
                      {current.startTime && current.endTime
                        ? `${formatTime(current.startTime)} – ${formatTime(current.endTime)}`
                        : current.endTime
                          ? `antes de ${formatTime(current.endTime)}`
                          : `desde ${formatTime(current.startTime!)}`}
                    </ThemedText>
                  </View>
                ) : null}
                <ThemedText style={styles.taskMeta}>{taskMeta(current)}</ThemedText>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnPostpone]} onPress={postpone}>
                <Ionicons name="arrow-undo" size={18} color={Colors.textSecondary} />
                <ThemedText style={styles.btnPostponeLabel}>Posponer</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDone]}
                onPress={complete}
                accessibilityRole="button"
                accessibilityLabel={`Marcar como hecha: ${current.title}`}>
                <Ionicons name="checkmark" size={20} color={Colors.white} />
                <ThemedText style={styles.btnDoneLabel}>Hecho</ThemedText>
              </Pressable>
            </View>

            <Pressable
              style={styles.detailLink}
              onPress={() => router.push(`/task/${current.id}`)}>
              <ThemedText style={styles.detailLinkLabel}>Abrir detalles de la tarea</ThemedText>
              <Ionicons name="chevron-forward" size={16} color={Colors.tint} />
            </Pressable>
          </>
        )}
      </ScrollView>
      <Confetti burst={burst} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  back: { width: 34 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, alignItems: 'center' },
  counterRow: { alignSelf: 'stretch', marginBottom: 16 },
  counter: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  focusCard: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    padding: 26,
    gap: 16,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  priorityText: { fontSize: 12, fontWeight: '800', color: Colors.white, letterSpacing: 0.6 },
  taskTitle: { fontSize: 30, fontWeight: '800', color: Colors.text, lineHeight: 38 },
  notes: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  timeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  timeText: { fontSize: 14, fontWeight: '700', color: Colors.tint },
  taskMeta: { fontSize: 13, color: Colors.muted, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 22 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.md,
    paddingVertical: 16,
  },
  btnPostpone: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  btnPostponeLabel: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  btnDone: { backgroundColor: Colors.success },
  btnDoneLabel: { fontSize: 16, fontWeight: '800', color: Colors.white },
  detailLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 18, paddingVertical: 8 },
  detailLinkLabel: { fontSize: 13, fontWeight: '700', color: Colors.tint },
  doneCard: { alignItems: 'center', gap: 14, paddingTop: 60 },
  doneTitle: { fontSize: 26, fontWeight: '800', color: Colors.text },
  doneHint: { fontSize: 15, color: Colors.muted, textAlign: 'center', lineHeight: 22 },
});