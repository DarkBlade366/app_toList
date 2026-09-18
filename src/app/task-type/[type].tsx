import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { ComponentProps, ReactElement, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Task } from '@/lib/schema';
import {
  TASK_TYPE_LABELS,
  TaskType,
  buildTree,
  groupTasksByParent,
  statusForDate,
  taskTypeOf,
  todayISO,
} from '@/lib/logic';

type Filter = 'all' | 'todo' | 'done' | 'paused' | 'cancelled';

const TYPE_ICONS: Record<TaskType, ComponentProps<typeof Ionicons>['name']> = {
  general: 'layers-outline',
  once: 'calendar',
  range: 'calendar-outline',
  daily: 'sunny',
  weekly: 'repeat',
  monthly: 'calendar-number',
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'todo', label: 'Pendientes' },
  { key: 'done', label: 'Hechas' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'cancelled', label: 'Canceladas' },
];

export default function TaskTypeScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type: string }>();
  const taskType = (TASK_TYPE_LABELS[type as TaskType] ? type : 'general') as TaskType;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const today = todayISO();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await db.resetRecurringDayStatuses(sqlite, today).catch(() => {});
        const [list, comps] = await Promise.all([
          db.getTasks(sqlite),
          db.getCompletionsSetForDate(sqlite, today),
        ]);
        if (!active) return;
        setTasks(list);
        setCompleted(comps);
      })();
      return () => {
        active = false;
      };
    }, [sqlite, today])
  );

  function applyFilter(t: Task): boolean {
    const state = statusForDate(t, completed, today);
    switch (filter) {
      case 'all':
        return true;
      case 'todo':
        return state === 'pending' || state === 'in_progress';
      case 'done':
        return state === 'completed';
      case 'paused':
        return state === 'paused';
      case 'cancelled':
        return state === 'cancelled';
    }
  }

  const visible = tasks.filter((t) => taskTypeOf(t) === taskType).filter(applyFilter);
  const tree = buildTree(visible);
  const { childrenOf } = groupTasksByParent(visible);

  async function toggle(task: Task) {
    const wasDone = statusForDate(task, completed, today) === 'completed';
    const done = await db.toggleTaskCompletion(sqlite, task.id, today);
    void Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    if (!wasDone && done) toast.show('Completada', 'success');
    if (wasDone) toast.show('Completado deshecho', 'info');
    const [list, comps] = await Promise.all([
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, today),
    ]);
    setTasks(list);
    setCompleted(comps);
  }

  function renderNode(task: Task): ReactElement | null {
    const children = childrenOf.get(task.id) ?? [];
    const showChildren = expanded.has(task.id);
    const state = statusForDate(task, completed, today);
    const isDone = state === 'completed';
    return (
      <View key={task.id}>
        <TaskRow
          task={task}
          depth={0}
          checked={isDone}
          paused={state === 'paused'}
          cancelled={state === 'cancelled'}
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
    <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <ThemedText style={styles.title}>{TASK_TYPE_LABELS[taskType]}</ThemedText>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <FilterDropdown options={FILTERS} value={filter} onChange={setFilter} />

        {visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon={TYPE_ICONS[taskType]}
              title={`Sin ${TASK_TYPE_LABELS[taskType].toLowerCase()} aquí`}
              hint="Crea la primera o cambia el filtro para ver otras."
              actionLabel={`Nueva ${TASK_TYPE_LABELS[taskType]}`}
              onAction={() => router.push({ pathname: '/task/new', params: { type: taskType } })}
            />
          </View>
        ) : (
          <>
            <View style={styles.list}>{tree.map(renderNode)}</View>
            <Pressable
              style={styles.addBtn}
              onPress={() => router.push({ pathname: '/task/new', params: { type: taskType } })}>
              <Ionicons name="add" size={18} color={Colors.white} />
              <ThemedText style={styles.addText}>Nueva {TASK_TYPE_LABELS[taskType]}</ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  back: { width: 34 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  content: { paddingHorizontal: 16, gap: 14, paddingBottom: 32 },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.tint,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addText: { color: Colors.white, fontWeight: '700' },
  list: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
});