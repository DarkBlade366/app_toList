import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { ReactElement, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Task } from '@/lib/schema';
import { buildTree, groupTasksByParent, sortByPriority, statusForDate, todayISO } from '@/lib/logic';

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
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [query, setQuery] = useState('');
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

  const byId = new Map(tasks.map((t) => [t.id, t]));

  function applyFilter(t: Task): boolean {
    const state = statusForDate(t, completed, today);
    switch (filter) {
      case 'all':
        return true;
      case 'pending':
        return state === 'pending' || state === 'in_progress';
      case 'completed':
        return state === 'completed';
      case 'paused':
        return state === 'paused';
      case 'cancelled':
        return state === 'cancelled';
    }
  }

  const q = query.trim().toLowerCase();
  const visible = sortByPriority(
    tasks
      .filter(
        (t) =>
          q === '' ||
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? '').toLowerCase().includes(q)
      )
      .filter(applyFilter)
  );
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
    const parent = task.parentId != null ? byId.get(task.parentId) : undefined;
    const state = statusForDate(task, completed, today);
    const meta: string[] = [];
    if (parent) meta.push(`hija de "${parent.title}"`);
    if (children.length > 0) meta.push(`${children.length} tarea${children.length > 1 ? 's' : ''} dentro`);
    const extraMeta = meta.join(' · ') || undefined;

    return (
      <View key={task.id}>
        <TaskRow
          task={task}
          checked={state === 'completed'}
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

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por título o notas…"
            placeholderTextColor={Colors.muted}
            selectionColor={Colors.tint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query !== '' ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Limpiar búsqueda">
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon={
                filter === 'completed'
                  ? 'checkmark-done-outline'
                  : filter === 'cancelled'
                    ? 'close-circle-outline'
                    : 'file-tray-outline'
              }
              title={
                filter === 'all'
                  ? 'No hay tareas'
                  : `Nada con el estado "${STATUS_FILTERS.find((f) => f.key === filter)?.label.toLowerCase()}"`
              }
              hint="Cambia el filtro o crea una tarea desde el apartado Añadir."
            />
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
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
});