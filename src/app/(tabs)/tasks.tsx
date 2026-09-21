import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TaskCardView } from '@/components/day-cards';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/toast';
import { Colors, Radius } from '@/constants/theme';
import * as db from '@/lib/db';
import {
  addDays,
  completionDateFor,
  formatDateShort,
  fromISO,
  isOverdue,
  occursOnDate,
  statusForDate,
  toISO,
  todayISO,
} from '@/lib/logic';
import { Task } from '@/lib/schema';

type StateFilter = 'all' | 'todo' | 'done';

const PRIORITY_RANK: Record<Task['priority'], number> = { high: 3, medium: 2, low: 1 };

function mondayOf(iso: string): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

function sundayOf(iso: string): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 7) % 7) + 6);
  return toISO(d);
}

function monthBounds(iso: string): { from: string; to: string } {
  const d = fromISO(iso);
  const y = d.getFullYear();
  const m = d.getMonth();
  return { from: toISO(new Date(y, m, 1)), to: toISO(new Date(y, m + 1, 0)) };
}

export default function TasksScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const toast = useToast();

  const today = todayISO();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [compsByDate, setCompsByDate] = useState<Map<string, Set<string>>>(new Map());
  const [stateFilter, setStateFilter] = useState<StateFilter>('todo');
  const [from, setFrom] = useState<string | null>(today);
  const [to, setTo] = useState<string | null>(today);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [list, comps] = await Promise.all([
          db.getTasks(sqlite),
          db.getCompletions(sqlite),
        ]);
        const byDate = new Map<string, Set<string>>();
        for (const c of comps) {
          const set = byDate.get(c.date) ?? new Set<string>();
          set.add(String(c.taskId));
          byDate.set(c.date, set);
        }
        if (!active) return;
        setTasks(list);
        setCompsByDate(byDate);
      })();
      return () => {
        active = false;
      };
    }, [sqlite])
  );

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const childrenOf = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of tasks) {
      if (t.parentId == null) continue;
      const arr = map.get(t.parentId) ?? [];
      arr.push(t);
      map.set(t.parentId, arr);
    }
    return map;
  }, [tasks]);

  const emptyComps = useMemo(() => new Set<string>(), []);

  const relevant = useMemo(() => {
    const set = new Set<number>();
    if (from == null || to == null) {
      for (const t of tasks) set.add(t.id);
    } else {
      let d = from;
      let guard = 0;
      while (d <= to && guard < 370) {
        for (const t of tasks) if (occursOnDate(t, d)) set.add(t.id);
        d = addDays(d, 1);
        guard++;
      }
      for (const id of [...set]) {
        let cur = byId.get(id);
        while (cur?.parentId != null) {
          set.add(cur.parentId);
          cur = byId.get(cur.parentId);
        }
      }
    }
    return set;
  }, [tasks, byId, from, to]);

  const stateOf = (t: Task): Task['status'] => {
    const date = completionDateFor(t, today);
    return statusForDate(t, compsByDate.get(date) ?? emptyComps, date);
  };

  const rootCards = useMemo(() => {
    return tasks
      .filter((t) => t.parentId == null && relevant.has(t.id))
      .filter((t) => {
        const state = stateOf(t);
        if (stateFilter === 'done') return state === 'completed';
        if (stateFilter === 'all') return true;
        return state !== 'completed' && state !== 'cancelled' && state !== 'paused';
      })
      .sort((a, b) => {
        const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        return pr !== 0 ? pr : a.title.localeCompare(b.title);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, relevant, stateFilter]);

  const rangeLabel =
    from && to
      ? from === to
        ? formatDateShort(from)
        : `del ${formatDateShort(from)} al ${formatDateShort(to)}`
      : 'Todo el tiempo';

  async function toggle(task: Task) {
    const date = completionDateFor(task, today);
    const wasDone = statusForDate(task, compsByDate.get(date) ?? emptyComps, date) === 'completed';
    const done = await db.toggleTaskCompletion(sqlite, task.id, date);
    void Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    const [list, comps] = await Promise.all([
      db.getTasks(sqlite),
      db.getCompletions(sqlite),
    ]);
    const byDate = new Map<string, Set<string>>();
    for (const c of comps) {
      const set = byDate.get(c.date) ?? new Set<string>();
      set.add(String(c.taskId));
      byDate.set(c.date, set);
    }
    setTasks(list);
    setCompsByDate(byDate);
    if (!wasDone && done) toast.show('Completada', 'success');
    if (wasDone) toast.show('Completado deshecho', 'info');
  }

  function nudgeFrom(delta: number) {
    const base = from ?? today;
    const next = addDays(base, delta);
    setFrom(next);
    if (to != null && next > to) setTo(next);
  }

  function nudgeTo(delta: number) {
    const base = to ?? today;
    const next = addDays(base, delta);
    setTo(next);
    if (from != null && next < from) setFrom(next);
  }

  function setRange(fromIso: string | null, toIso: string | null) {
    setFrom(fromIso);
    setTo(toIso);
  }

  const quickChips: { key: string; label: string; apply: () => void }[] = [
    {
      key: 'hoy',
      label: 'Hoy',
      apply: () => setRange(today, today),
    },
    {
      key: 'manana',
      label: 'Mañana',
      apply: () => setRange(addDays(today, 1), addDays(today, 1)),
    },
    {
      key: 'semana',
      label: 'Esta semana',
      apply: () => setRange(mondayOf(today), sundayOf(today)),
    },
    {
      key: 'mes',
      label: 'Este mes',
      apply: () => setRange(monthBounds(today).from, monthBounds(today).to),
    },
    {
      key: 'todo',
      label: 'Todo',
      apply: () => setRange(null, null),
    },
  ];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Tareas</ThemedText>
          <ThemedText style={styles.subtitle}>
            {rootCards.length} tarea raíz · {rangeLabel}
          </ThemedText>
        </View>
        <Pressable
          style={styles.historyBtn}
          onPress={() => router.push('/history')}
          hitSlop={8}
          accessibilityLabel="Historial y resumen de todas las tareas">
          <Ionicons name="stats-chart" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.filters}>
        <View style={styles.filterSection}>
          <ThemedText style={styles.filterLabel}>Estado</ThemedText>
          <Segmented<StateFilter>
            options={[
              { key: 'todo', label: 'Sin hacer' },
              { key: 'done', label: 'Hechas' },
              { key: 'all', label: 'Todas' },
            ]}
            value={stateFilter}
            onChange={setStateFilter}
          />
        </View>

        <View style={styles.filterSection}>
          <ThemedText style={styles.filterLabel}>Margen de fecha</ThemedText>
          <View style={styles.quickRow}>
            {quickChips.map((chip) => (
              <Pressable
                key={chip.key}
                style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.6 }]}
                onPress={chip.apply}>
                <ThemedText style={styles.quickChipText}>{chip.label}</ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={styles.boundsRow}>
            <View style={styles.bound}>
              <ThemedText style={styles.boundLabel}>Desde</ThemedText>
              <View style={styles.boundControl}>
                <Pressable onPress={() => nudgeFrom(-1)} hitSlop={8} style={styles.stepBtn}>
                  <Ionicons name="chevron-back" size={18} color={Colors.tint} />
                </Pressable>
                <Pressable style={styles.boundDate} onPress={() => setFrom(today)} hitSlop={6}>
                  <ThemedText style={styles.boundDateText} numberOfLines={1}>
                    {from ? formatDateShort(from) : 'Todo'}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => nudgeFrom(1)} hitSlop={8} style={styles.stepBtn}>
                  <Ionicons name="chevron-forward" size={18} color={Colors.tint} />
                </Pressable>
              </View>
            </View>
            <View style={styles.bound}>
              <ThemedText style={styles.boundLabel}>Hasta</ThemedText>
              <View style={styles.boundControl}>
                <Pressable onPress={() => nudgeTo(-1)} hitSlop={8} style={styles.stepBtn}>
                  <Ionicons name="chevron-back" size={18} color={Colors.tint} />
                </Pressable>
                <Pressable style={styles.boundDate} onPress={() => setTo(today)} hitSlop={6}>
                  <ThemedText style={styles.boundDateText} numberOfLines={1}>
                    {to ? formatDateShort(to) : 'Todo'}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => nudgeTo(1)} hitSlop={8} style={styles.stepBtn}>
                  <Ionicons name="chevron-forward" size={18} color={Colors.tint} />
                </Pressable>
              </View>
            </View>
          </View>
          {from && to && from !== to ? (
            <ThemedText style={styles.rangeHint}>
              Mostrando tareas entre el {formatDateShort(from)} y el {formatDateShort(to)}.
            </ThemedText>
          ) : null}
        </View>
      </View>

      {rootCards.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyState
            icon="card-outline"
            title="Sin tareas raíz"
            hint="Ninguna tarea de este tipo o fecha coincide con los filtros."
          />
        </View>
      ) : (
        <View style={styles.cards}>
          {rootCards.map((root) => {
            const date = completionDateFor(root, today);
            const comps = compsByDate.get(date) ?? emptyComps;
            const kids = (childrenOf.get(root.id) ?? []).filter((c) => relevant.has(c.id));
            return (
              <TaskCardView
                key={root.id}
                task={root}
                checked={statusForDate(root, comps, date) === 'completed'}
                overdue={isOverdue(root, date, comps)}
                subtasks={kids.map((c) => ({
                  id: c.id,
                  title: c.title,
                  priority: c.priority,
                  checked: statusForDate(c, compsByDate.get(completionDateFor(c, today)) ?? emptyComps, completionDateFor(c, today)) === 'completed',
                }))}
                onToggle={() => toggle(root)}
                onOpen={() =>
                  router.push({
                    pathname: '/task-group/[id]',
                    params: {
                      id: String(root.id),
                      date,
                      from: from ?? undefined,
                      to: to ?? undefined,
                    },
                  })
                }
                onDetails={() => router.push(`/task/${root.id}`)}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 30, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: Colors.muted },
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: { gap: 16 },
  filterSection: { gap: 8 },
  filterLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  quickChipText: { fontSize: 13, fontWeight: '700', color: Colors.tint },
  boundsRow: { flexDirection: 'row', gap: 12 },
  bound: { flex: 1, gap: 6 },
  boundLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted },
  boundControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepBtn: { padding: 4 },
  boundDate: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  boundDateText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  rangeHint: { fontSize: 12, color: Colors.muted },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cards: { gap: 18 },
});