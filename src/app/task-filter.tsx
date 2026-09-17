import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ReactElement, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Task } from '@/lib/schema';
import { buildTree, groupTasksByParent, sortByPriority } from '@/lib/logic';

type StatusFilter = 'all' | 'pending' | 'completed' | 'paused' | 'cancelled';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todas las tareas' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'completed', label: 'Hechas' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'cancelled', label: 'Canceladas' },
];

export default function TaskFilterScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      db.getTasks(sqlite).then((list) => {
        if (active) setTasks(list);
      });
      return () => {
        active = false;
      };
    }, [sqlite])
  );

  const byId = new Map(tasks.map((t) => [t.id, t]));

  function applyFilter(t: Task): boolean {
    switch (filter) {
      case 'all':
        return true;
      case 'pending':
        return t.status === 'pending' || t.status === 'in_progress';
      case 'completed':
        return t.status === 'completed';
      case 'paused':
        return t.status === 'paused';
      case 'cancelled':
        return t.status === 'cancelled';
    }
  }

  const visible = sortByPriority(tasks.filter(applyFilter));
  const tree = buildTree(visible);
  const { childrenOf } = groupTasksByParent(visible);

  function renderNode(task: Task): ReactElement | null {
    const children = childrenOf.get(task.id) ?? [];
    const showChildren = expanded.has(task.id);
    const parent = task.parentId != null ? byId.get(task.parentId) : undefined;
    const meta: string[] = [];
    if (parent) meta.push(`hija de "${parent.title}"`);
    if (children.length > 0) meta.push(`${children.length} tarea${children.length > 1 ? 's' : ''} dentro`);
    const extraMeta = meta.join(' · ') || undefined;

    return (
      <View key={task.id}>
        <TaskRow
          task={task}
          checked={task.status === 'completed'}
          paused={task.status === 'paused'}
          cancelled={task.status === 'cancelled'}
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
          onPress={() => router.push(`/task/${task.id}`)}
          extraMeta={extraMeta}
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
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Filtro general</ThemedText>
          <ThemedText style={styles.subtitle}>
            Todas las tareas, de cualquier tipo, según su estado
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <FilterDropdown options={STATUS_FILTERS} value={filter} onChange={setFilter} />

        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={40} color={Colors.muted} />
            <ThemedText style={styles.emptyText}>
              No hay tareas {filter === 'all' ? '' : `con estado "${STATUS_FILTERS.find((f) => f.key === filter)?.label}"`}.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>{tree.map(renderNode)}</View>
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
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  back: { width: 34 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  content: { paddingHorizontal: 16, gap: 14, paddingBottom: 32 },
  list: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText: { color: Colors.muted, textAlign: 'center' },
});