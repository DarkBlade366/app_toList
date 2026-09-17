import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ReactElement, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Task } from '@/lib/schema';
import {
  addDays,
  buildTree,
  formatDateLong,
  groupTasksByParent,
  isOverdue,
  sortByPriority,
  statusForDate,
  taskTypeOf,
  tasksForDate,
  todayISO,
} from '@/lib/logic';

type HoyTab = 'day' | 'general';

export default function TodayScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState<HoyTab>('day');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [all, comps] = await Promise.all([
          db.getTasks(sqlite),
          db.getCompletionsSetForDate(sqlite, date),
        ]);
        if (!active) return;
        setTasks(all);
        setCompleted(comps);
      })();
      return () => {
        active = false;
      };
    }, [sqlite, date])
  );

  const dayTasks = sortByPriority(
    tasksForDate(tasks, date).filter((t) => statusForDate(t, completed, date) !== 'cancelled')
  );

  const generalIds = new Set<number>();
  for (const t of tasks) {
    if (taskTypeOf(t) === 'general') generalIds.add(t.id);
  }
  // Incluye también los hijos de las tareas generales (a cualquier profundidad).
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (t.parentId != null && generalIds.has(t.parentId) && !generalIds.has(t.id)) {
        generalIds.add(t.id);
        changed = true;
      }
    }
  }
  const generalTasks = sortByPriority(
    tasks.filter((t) => generalIds.has(t.id) && statusForDate(t, completed, date) !== 'cancelled')
  );

  const shownTasks = tab === 'day' ? dayTasks : generalTasks;
  const showQuick = tab === 'day' && date === todayISO();
  const tree = buildTree(shownTasks);
  const { childrenOf } = groupTasksByParent(shownTasks);

  const doneCount = shownTasks.filter(
    (t) => statusForDate(t, completed, date) === 'completed'
  ).length;
  const overdueCount = shownTasks.filter(
    (t) => isOverdue(t, date, completed) && statusForDate(t, completed, date) !== 'completed'
  ).length;
  const isToday = date === todayISO();
  const ratio = shownTasks.length ? doneCount / shownTasks.length : 0;

  async function toggle(task: Task) {
    await db.toggleTaskCompletion(sqlite, task.id, date);
    const [all, comps] = await Promise.all([
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, date),
    ]);
    setTasks(all);
    setCompleted(comps);
  }

  function renderNode(task: Task): ReactElement | null {
    const children = childrenOf.get(task.id) ?? [];
    const state = statusForDate(task, completed, date);
    const isChecked = state === 'completed';
    const showChildren = expanded.has(task.id);
    return (
      <View key={task.id}>
        <TaskRow
          task={task}
          checked={isChecked}
          overdue={isOverdue(task, date, completed)}
          paused={state === 'paused'}
          cancelled={state === 'cancelled'}
          depth={0}
          hasChildren={children.length > 0}
          expanded={showChildren}
          onToggleExpand={() =>
            setExpanded((s) => {
              const next = new Set(s);
              if (next.has(task.id)) next.delete(task.id);
              else next.add(task.id);
              return next;
            })
          }
          onCheck={() => toggle(task)}
          onPress={() => router.push(`/task/${task.id}`)}
        />
        {showChildren && children.map(renderNode)}
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.navBtn} hitSlop={10} onPress={() => setDate(addDays(date, -1))}>
          <Ionicons name="chevron-back" size={22} color={Colors.tint} />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText style={styles.dateLabel}>
            {formatDateLong(date).replace(/^\w/, (c) => c.toUpperCase())}
          </ThemedText>
          {isToday ? (
            <ThemedText style={styles.todayBadge}>Hoy</ThemedText>
          ) : (
            <Pressable onPress={() => setDate(todayISO())}>
              <ThemedText style={styles.goToday}>Volver a hoy</ThemedText>
            </Pressable>
          )}
        </View>
        <Pressable style={styles.navBtn} hitSlop={10} onPress={() => setDate(addDays(date, 1))}>
          <Ionicons name="chevron-forward" size={22} color={Colors.tint} />
        </Pressable>
      </View>

      <Segmented
        options={[
          { key: 'day', label: 'Del día' },
          { key: 'general', label: 'Tareas generales' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryDone}>{doneCount}</ThemedText>
          <ThemedText style={styles.summaryTotal}>/ {shownTasks.length} tareas</ThemedText>
          <ThemedText style={styles.summaryPct}>({Math.round(ratio * 100)}%)</ThemedText>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
        </View>
        {overdueCount > 0 && (
          <ThemedText style={{ color: Colors.danger, fontSize: 13 }}>
            {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
          </ThemedText>
        )}
      </Card>

      {showQuick && (
        <View style={styles.quickCol}>
          <Pressable
            style={styles.quickBtn}
            onPress={() =>
              router.push({
                pathname: '/task/new',
                params: { type: 'once', date: todayISO() },
              })
            }>
            <Ionicons name="add-circle" size={20} color={Colors.tint} />
            <View style={styles.quickBody}>
              <ThemedText style={styles.quickLabel}>Añadir tarea para hoy</ThemedText>
              <ThemedText style={styles.quickHint}>
                Tarea de un día para {formatDateLong(todayISO())}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
          </Pressable>
          <Pressable
            style={styles.quickBtn}
            onPress={() =>
              router.push({
                pathname: '/task/new',
                params: { type: 'once', date: addDays(todayISO(), 1) },
              })
            }>
            <Ionicons name="add-circle" size={20} color={Colors.tint} />
            <View style={styles.quickBody}>
              <ThemedText style={styles.quickLabel}>Añadir tarea para mañana</ThemedText>
              <ThemedText style={styles.quickHint}>
                Tarea de un día para {formatDateLong(addDays(todayISO(), 1))}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
          </Pressable>
        </View>
      )}

      <View style={styles.list}>
        {shownTasks.length === 0 ? (
          <Card>
            <ThemedText style={{ color: Colors.muted, textAlign: 'center', padding: 16 }}>
              {tab === 'general'
                ? 'Sin tareas generales para este día. Crea una tarea general o pínchala a esta fecha desde su detalle.'
                : 'Sin tareas para este día.'}
            </ThemedText>
          </Card>
        ) : (
          tree.map(renderNode)
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: { padding: 6 },
  headerCenter: { alignItems: 'center', gap: 2 },
  dateLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  todayBadge: { fontSize: 11, color: Colors.tint, fontWeight: '700' },
  goToday: { fontSize: 11, color: Colors.tint, fontWeight: '700' },
  summary: { paddingVertical: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  summaryDone: { fontSize: 26, fontWeight: '800', color: Colors.tint },
  summaryTotal: { fontSize: 14, color: Colors.muted },
  summaryPct: { fontSize: 12, color: Colors.muted },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: Colors.tint },
  quickCol: { gap: 10 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  quickBody: { flex: 1 },
  quickLabel: { color: Colors.tint, fontSize: 14, fontWeight: '700' },
  quickHint: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  list: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
});