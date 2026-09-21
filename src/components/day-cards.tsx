import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { taskMeta } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Colors, PriorityAccent, Radius, Shadow } from '@/constants/theme';
import {
  formatTime,
  isOverdue,
  occursOnDate,
  statusForDate,
  TASK_TYPE_LABELS,
  taskTypeOf,
} from '@/lib/logic';
import { Priority, Task } from '@/lib/schema';

export interface SubtaskCardItem {
  id: number;
  title: string;
  priority: Priority;
  checked: boolean;
}

/**
 * Carrusel de cartas para la pestaña Hoy. Cada carta ocupa EL ANCHO COMPLETO
 * del teléfono: deslizar a los lados cambia de carta (como pasar de vista).
 * Tocar una carta abre la pantalla de esa tarea raíz con sus sub-tareas.
 */
export function DayCards({
  tasks,
  completed,
  date,
  onToggle,
  onOpen,
  onDetails,
}: {
  tasks: Task[];
  completed: Set<string>;
  date: string;
  onToggle: (task: Task) => void;
  onOpen: (id: number) => void;
  onDetails: (id: number) => void;
}) {
  const { width } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);

  // Página a ancho completo: sin márgenes laterales ni asomar la carta vecina.
  const STEP = width;

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

  const roots = useMemo(() => tasks.filter((t) => t.parentId == null), [tasks]);

  function cardSubtasks(task: Task): SubtaskCardItem[] {
    return (childrenOf.get(task.id) ?? [])
      .filter((c) => occursOnDate(c, date))
      .map((c) => ({
        id: c.id,
        title: c.title,
        priority: c.priority,
        checked: statusForDate(c, completed, date) === 'completed',
      }));
  }

  return (
    <View>
      <View style={styles.crumbRow}>
        <ThemedText style={styles.crumbSolo}>
          {roots.length} tarea{roots.length === 1 ? '' : 's'} raíz del día
        </ThemedText>
      </View>

      <FlatList
        data={roots}
        key={`page-${date}-${roots.map((r) => r.id).join(',')}`}
        keyExtractor={(t) => String(t.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STEP}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / STEP);
          setPageIndex(Math.max(0, Math.min(i, roots.length - 1)));
        }}
        renderItem={({ item }) => (
          <View style={{ width: STEP }}>
            <TaskCardView
              task={item}
              checked={statusForDate(item, completed, date) === 'completed'}
              overdue={isOverdue(item, date, completed)}
              subtasks={cardSubtasks(item)}
              onToggle={() => onToggle(item)}
              onOpen={() => onOpen(item.id)}
              onDetails={() => onDetails(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyWrap, { width: STEP }]}>
            <ThemedText style={styles.emptyText}>Sin tareas raíz para este día.</ThemedText>
          </View>
        }
      />

      {roots.length > 1 ? (
        <View style={styles.dots}>
          {roots.map((t, i) => (
            <View key={t.id} style={[styles.dot, i === pageIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function TaskCardView({
  task,
  checked,
  overdue,
  subtasks,
  onToggle,
  onOpen,
  onDetails,
}: {
  task: Task;
  checked: boolean;
  overdue: boolean;
  subtasks?: SubtaskCardItem[];
  onToggle: () => void;
  onOpen: () => void;
  onDetails?: () => void;
}) {
  const accent = overdue && !checked ? Colors.danger : PriorityAccent[task.priority];
  const typeLabel = TASK_TYPE_LABELS[taskTypeOf(task)];

  return (
    <Pressable
      style={[styles.card, { borderColor: checked ? 'rgba(52, 211, 153, 0.6)' : accent }]}
      onPress={onOpen}>
      <View style={styles.cardTop}>
        <View style={styles.badges}>
          <View style={[styles.priorityBadge, { backgroundColor: accent }]}>
            <ThemedText style={styles.priorityText}>
              {checked
                ? 'HECHA'
                : overdue
                  ? 'VENCIDA'
                  : task.priority === 'high'
                    ? 'ALTA'
                    : task.priority === 'medium'
                      ? 'MEDIA'
                      : 'BAJA'}
            </ThemedText>
          </View>
          <View style={styles.typeChip}>
            <ThemedText style={styles.typeText}>{typeLabel}</ThemedText>
          </View>
        </View>
        {task.startTime || task.endTime ? (
          <View style={styles.timeChip}>
            <Ionicons name="time-outline" size={14} color={Colors.tint} />
            <ThemedText style={styles.timeText}>
              {task.startTime && task.endTime
                ? `${formatTime(task.startTime)} – ${formatTime(task.endTime)}`
                : task.endTime
                  ? `antes de ${formatTime(task.endTime)}`
                  : `desde ${formatTime(task.startTime!)}`}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText
        style={[styles.title, checked && styles.titleDone]}
        numberOfLines={3}>
        {task.title}
      </ThemedText>

      {task.notes ? (
        <ThemedText style={styles.notes} numberOfLines={3}>
          {task.notes}
        </ThemedText>
      ) : null}

      <ThemedText style={styles.meta} numberOfLines={2}>
        {taskMeta(task)}
      </ThemedText>

      {subtasks && subtasks.length > 0 ? (
        <View style={styles.subList}>
          {subtasks.map((s) => (
            <View key={s.id} style={styles.subRow}>
              <View
                style={[styles.subBar, { backgroundColor: PriorityAccent[s.priority] }]}
              />
              <ThemedText
                style={[styles.subTitle, s.checked && styles.subDone]}
                numberOfLines={1}>
                {s.title}
              </ThemedText>
              {s.checked ? (
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.spacer} />

      <View style={styles.cardBottom}>
        <Pressable style={styles.kidsBtn} onPress={onOpen} hitSlop={6}>
          <Ionicons name="git-branch-outline" size={16} color={Colors.tint} />
          <ThemedText style={styles.kidsLabel}>
            {(subtasks?.length ?? 0) > 0
              ? `${subtasks!.length} sub-tarea${subtasks!.length === 1 ? '' : 's'}`
              : 'Abrir tarea'}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.kidsBtn} onPress={onDetails} hitSlop={6}>
          <Ionicons name="open-outline" size={16} color={Colors.muted} />
          <ThemedText style={styles.kidsDetails}>Detalles</ThemedText>
        </Pressable>

        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={checked ? `Desmarcar ${task.title}` : `Completar ${task.title}`}
          style={[
            styles.check,
            {
              borderColor: checked ? Colors.success : accent,
              backgroundColor: checked ? Colors.success : 'transparent',
            },
          ]}>
          <Ionicons
            name="checkmark"
            size={24}
            color={checked ? Colors.white : accent}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carousel: { paddingHorizontal: 0 },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  crumbSolo: { fontSize: 13, fontWeight: '700', color: Colors.muted },
  card: {
    minHeight: 340,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    padding: 22,
    gap: 12,
    ...Shadow.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  priorityBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  priorityText: { fontSize: 12, fontWeight: '800', color: Colors.white, letterSpacing: 0.6 },
  typeChip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.4)',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
  typeText: { fontSize: 12, fontWeight: '800', color: Colors.tint },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 13, fontWeight: '700', color: Colors.tint },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, lineHeight: 30 },
  titleDone: { color: Colors.success, textDecorationLine: 'line-through' },
  notes: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  meta: { fontSize: 12, color: Colors.muted, lineHeight: 16 },
  subList: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingRight: 12,
    paddingLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  subBar: { position: 'absolute', left: 6, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  subTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  subDone: { color: Colors.success, textDecorationLine: 'line-through' },
  spacer: { flex: 1 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kidsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kidsLabel: { fontSize: 14, fontWeight: '700', color: Colors.tint },
  kidsDetails: { fontSize: 14, fontWeight: '600', color: Colors.muted },
  check: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.tint },
  emptyWrap: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 14, color: Colors.muted, textAlign: 'center' },
});