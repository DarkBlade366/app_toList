import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ReactElement, useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Segmented } from '@/components/ui/segmented';
import { Screen } from '@/components/ui/screen';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Task } from '@/lib/schema';
import { buildTree, groupTasksByParent, isRecurring, todayISO } from '@/lib/logic';

type Filter = 'all' | 'todo' | 'done' | 'archived';

export default function TasksScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
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

  const today = todayISO();

  function applyFilter(t: Task): boolean {
    if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
    switch (filter) {
      case 'all':
        return true;
      case 'todo':
        return t.status === 'pending' || t.status === 'in_progress';
      case 'done':
        return t.status === 'completed';
      case 'archived':
        return t.status === 'paused' || t.status === 'cancelled';
    }
  }

  const visible = tasks.filter(applyFilter);
  const tree = buildTree(visible);
  const { childrenOf } = groupTasksByParent(visible);

  async function toggle(task: Task) {
    await db.toggleTaskCompletion(sqlite, task.id, today);
    setTasks(await db.getTasks(sqlite));
  }

  function renderNode(task: Task, depth: number): ReactElement | null {
    const children = childrenOf.get(task.id) ?? [];
    const showChildren = expanded.has(task.id);
    const isDone = task.status === 'completed';
    return (
      <View key={task.id}>
        <TaskRow
          task={task}
          depth={depth}
          checked={isDone}
          paused={task.status === 'paused'}
          cancelled={task.status === 'cancelled'}
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
          onCheck={() => (isRecurring(task) ? toggle(task) : undefined)}
          onPress={() => router.push(`/task/${task.id}`)}
        />
        {showChildren && children.map((c) => renderNode(c, depth + 1))}
      </View>
    );
  }

  return (
    <Screen>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>Tareas</ThemedText>
            <ThemedText style={styles.subtitle}>
              {buildTree(tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.parentId == null)).length} pendientes
            </ThemedText>
          </View>
          <Pressable
            style={styles.newBtn}
            onPress={() => router.push('/task/new')}
            hitSlop={8}>
            <Ionicons name="add" size={24} color={Colors.white} />
          </Pressable>
        </View>

        <Segmented
          options={[
            { key: 'all', label: 'Todas' },
            { key: 'todo', label: 'Pendientes' },
            { key: 'done', label: 'Hechas' },
            { key: 'archived', label: 'Pausadas' },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {(query || tasks.length > 0) && (
          <SearchBar value={query} onChange={setQuery} />
        )}

        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={40} color={Colors.muted} />
            <ThemedText style={{ color: Colors.muted, textAlign: 'center' }}>
              {query ? 'Sin resultados' : 'Aún no hay tareas. Pulsa + para añadir una.'}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>{tree.map((t) => renderNode(t, 0))}</View>
        )}
      </Screen>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={16} color={Colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.searchInput}
        placeholder="Buscar tarea..."
        placeholderTextColor={Colors.muted}
        selectionColor={Colors.tint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 30, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: Colors.muted },
  newBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  list: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
});