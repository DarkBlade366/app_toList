import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TaskCardView } from '@/components/day-cards';
import { SubtaskGroup } from '@/components/subtask-group';
import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Colors, Radius } from '@/constants/theme';
import * as db from '@/lib/db';
import { formatDateLong, formatDateShort, statusForDate } from '@/lib/logic';
import { Task } from '@/lib/schema';

export default function TaskGroupScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const { id, date, from, to } = useLocalSearchParams<{
    id: string;
    date: string;
    from?: string;
    to?: string;
  }>();
  const rootId = Number(id);
  const ctxDate = date ?? new Date().toISOString().slice(0, 10);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [list, comps] = await Promise.all([
          db.getTasks(sqlite),
          db.getCompletionsSetForDate(sqlite, ctxDate),
        ]);
        if (!active) return;
        setTasks(list);
        setCompleted(comps);
      })();
      return () => {
        active = false;
      };
    }, [sqlite, ctxDate])
  );

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

  const root = tasks.find((t) => t.id === rootId);
  const directKids = root ? childrenOf.get(root.id) ?? [] : [];

  const rangeLabel =
    from && to && from !== to
      ? `del ${formatDateShort(from)} al ${formatDateShort(to)}`
      : formatDateLong(ctxDate);

  async function toggle(t: Task) {
    const done = await db.toggleTaskCompletion(sqlite, t.id, ctxDate);
    const [list, comps] = await Promise.all([
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, ctxDate),
    ]);
    setTasks(list);
    setCompleted(comps);
    void Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
  }

  function renderNode(task: Task): ReactElement {
    const children = childrenOf.get(task.id) ?? [];
    const showChildren = expanded.has(task.id);
    const state = statusForDate(task, completed, ctxDate);
    return (
      <View key={task.id}>
        <TaskRow
          task={task}
          checked={state === 'completed'}
          paused={state === 'paused'}
          cancelled={state === 'cancelled'}
          hasChildren={children.length > 0}
          childCount={children.length}
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
        {showChildren && (
          <SubtaskGroup count={children.length} depth={0}>
            {children.map((c) => renderNode(c))}
          </SubtaskGroup>
        )}
      </View>
    );
  }

  if (!root) {
    return (
      <Screen>
        <ThemedText style={styles.notFound}>Tarea no encontrada</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title} numberOfLines={2}>
            {root.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>{rangeLabel}</ThemedText>
        </View>
      </View>

      <TaskCardView
        task={root}
        checked={statusForDate(root, completed, ctxDate) === 'completed'}
        overdue={false}
        subtasks={directKids.map((c) => ({
          id: c.id,
          title: c.title,
          priority: c.priority,
          checked: statusForDate(c, completed, ctxDate) === 'completed',
        }))}
        onToggle={() => toggle(root)}
        onOpen={() => router.push(`/task/${root.id}`)}
        onDetails={() => router.push(`/task/${root.id}`)}
      />

      <View style={styles.list}>
        {renderNode(root)}
        {directKids.length === 0 ? (
          <View style={styles.emptyPad}>
            <ThemedText style={styles.emptyText}>
              Esta tarea no tiene sub-tareas. Abre los detalles para editarla.
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: Colors.muted },
  list: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  emptyPad: { padding: 18 },
  emptyText: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 18 },
  notFound: { fontSize: 16, color: Colors.muted },
});