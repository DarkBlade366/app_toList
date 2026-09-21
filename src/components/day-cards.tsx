import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { taskMeta } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Colors, PriorityAccent, Radius, Shadow } from '@/constants/theme';
import { formatTime, isOverdue, occursOnDate, statusForDate } from '@/lib/logic';
import { Task } from '@/lib/schema';

/**
 * Carrusel de cartas para la pestaña Hoy. Una carta por página (swipe lateral).
 * Si una tarea tiene sub-tareas que ocurren ese día, tocar la carta la abre:
 * las sub-tareas pasan a ser las cartas y así sucesivamente (drill-down).
 */
export function DayCards({
  tasks,
  completed,
  date,
  onToggle,
  onOpen,
}: {
  tasks: Task[];
  completed: Set<string>;
  date: string;
  onToggle: (task: Task) => void;
  onOpen: (id: number) => void;
}) {
  const { width } = useWindowDimensions();
  const [stack, setStack] = useState<number[]>([]);
  const [pageIndex, setPageIndex] = useState(0);

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

  const top = stack.length > 0 ? stack[stack.length - 1] : null;
  const cardKeys = top == null
    ? roots
    : (childrenOf.get(top) ?? []).filter((c) => occursOnDate(c, date));
  const titleOf = (id: number) => tasks.find((t) => t.id === id)?.title ?? '';

  const cardWidth = width - 40;
  const cardPad = cardWidth - 44;

  function drill(task: Task) {
    const kids = (childrenOf.get(task.id) ?? []).filter((c) => occursOnDate(c, date));
    if (kids.length === 0) {
      onOpen(task.id);
      return;
    }
    setPageIndex(0);
    setStack((s) => [...s, task.id]);
  }

  function goBack() {
    setPageIndex(0);
    setStack((s) => s.slice(0, -1));
  }

  return (
    <View>
      {stack.length > 0 ? (
        <View style={styles.crumbRow}>
          <Pressable onPress={goBack} hitSlop={10} style={styles.crumb}>
            <Ionicons name="arrow-back" size={16} color={Colors.tint} />
            <ThemedText style={styles.crumbLabel}>Atrás</ThemedText>
          </Pressable>
          <ThemedText style={styles.crumbTitle} numberOfLines={1}>
            Sub-tareas de “{titleOf(top!)}”
          </ThemedText>
        </View>
      ) : (
        <View style={styles.crumbRow}>
          <ThemedText style={styles.crumbSolo}>
            {cardKeys.length} tarea{cardKeys.length === 1 ? '' : 's'} del día
          </ThemedText>
        </View>
      )}

      <FlatList
        data={cardKeys}
        key={`${stack.length}-${top ?? 'root'}-${cardKeys.map((k) => k.id).join(',')}`}
        keyExtractor={(t) => String(t.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 16));
          setPageIndex(Math.max(0, Math.min(i, cardKeys.length - 1)));
        }}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <TaskCardView
              task={item}
              completed={completed}
              date={date}
              width={cardPad}
              onToggle={() => onToggle(item)}
              kidsCount={(childrenOf.get(item.id) ?? []).filter((c) => occursOnDate(c, date)).length}
              onOpenCard={() => drill(item)}
              onDetails={() => onOpen(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.emptyWrap, { width: cardWidth }]}>
            <ThemedText style={styles.emptyText}>
              Sin sub-tareas para este día. Desliza para volver.
            </ThemedText>
          </View>
        }
      />

      {cardKeys.length > 1 ? (
        <View style={styles.dots}>
          {cardKeys.map((t, i) => (
            <View key={t.id} style={[styles.dot, i === pageIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TaskCardView({
  task,
  completed,
  date,
  width,
  onToggle,
  kidsCount,
  onOpenCard,
  onDetails,
}: {
  task: Task;
  completed: Set<string>;
  date: string;
  width: number;
  onToggle: () => void;
  kidsCount: number;
  onOpenCard: () => void;
  onDetails: () => void;
}) {
  const state = statusForDate(task, completed, date);
  const checked = state === 'completed';
  const overdue = isOverdue(task, date, completed) && !checked;
  const accent = overdue ? Colors.danger : PriorityAccent[task.priority];

  return (
    <Pressable
      style={[
        styles.card,
        { width },
        { borderColor: checked ? 'rgba(52, 211, 153, 0.6)' : accent },
      ]}
      onPress={onOpenCard}>
      <View style={styles.cardTop}>
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

      <View style={styles.spacer} />

      <View style={styles.cardBottom}>
        {kidsCount > 0 ? (
          <Pressable style={styles.kidsBtn} onPress={onOpenCard} hitSlop={6}>
            <Ionicons name="git-branch-outline" size={16} color={Colors.tint} />
            <ThemedText style={styles.kidsLabel}>
              {kidsCount} sub-tarea{kidsCount === 1 ? '' : 's'}
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable style={styles.kidsBtn} onPress={onDetails} hitSlop={6}>
            <Ionicons name="open-outline" size={16} color={Colors.muted} />
            <ThemedText style={styles.kidsLabel}>Detalles</ThemedText>
          </Pressable>
        )}

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
  carousel: { gap: 16 },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crumbLabel: { fontSize: 13, fontWeight: '700', color: Colors.tint },
  crumbTitle: { flex: 1, fontSize: 13, color: Colors.muted },
  crumbSolo: { fontSize: 13, fontWeight: '700', color: Colors.muted },
  card: {
    height: 340,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    padding: 22,
    gap: 12,
    ...Shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  priorityBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  priorityText: { fontSize: 12, fontWeight: '800', color: Colors.white, letterSpacing: 0.6 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 13, fontWeight: '700', color: Colors.tint },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, lineHeight: 30 },
  titleDone: { color: Colors.success, textDecorationLine: 'line-through' },
  notes: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  meta: { fontSize: 12, color: Colors.muted, lineHeight: 16 },
  spacer: { flex: 1 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kidsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kidsLabel: { fontSize: 14, fontWeight: '700', color: Colors.tint },
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