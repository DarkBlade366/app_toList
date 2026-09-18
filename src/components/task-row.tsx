import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { Priority, Task } from '@/lib/schema';
import { formatTime, isRecurring, weekdayLabel } from '@/lib/logic';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: Colors.success,
  medium: Colors.warning,
  high: Colors.danger,
};

export function taskMeta(task: Task): string {
  const parts: string[] = [];
  if (task.startTime || task.endTime) {
    parts.push(
      task.startTime && task.endTime
        ? `${formatTime(task.startTime)}–${formatTime(task.endTime)}`
        : task.endTime
          ? `antes de ${formatTime(task.endTime)}`
          : `desde ${formatTime(task.startTime)}`
    );
  }
  if (isRecurring(task)) {
    const days = (task.recurrenceDays ?? []).map(weekdayLabel).join(' · ');
    parts.push(
      task.recurrence === 'daily'
        ? 'diaria'
        : task.recurrence === 'weekly'
          ? `semanal (${days})`
          : task.monthlyDay != null
            ? `mensual (día ${task.monthlyDay})`
            : 'mensual'
    );
  }
  return parts.join(' · ');
}

export function TaskRow({
  task,
  checked,
  checkedColor = Colors.success,
  overdue,
  paused,
  cancelled,
  depth = 0,
  hasChildren,
  childCount,
  expanded,
  onToggleExpand,
  onCheck,
  onPress,
  extraMeta,
}: {
  task: Task;
  checked?: boolean;
  checkedColor?: string;
  overdue?: boolean;
  paused?: boolean;
  cancelled?: boolean;
  depth?: number;
  hasChildren?: boolean;
  childCount?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onCheck?: () => void;
  onPress?: () => void;
  extraMeta?: string;
}) {
  const accent = overdue && !checked ? Colors.danger : PRIORITY_COLORS[task.priority];
  const muted = checked || cancelled;

  const scale = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    if (checked) {
      scale.setValue(0.6);
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start();
    } else {
      scale.setValue(1);
    }
  }, [checked, scale]);

  return (
    <View style={[styles.row, { paddingLeft: 12 + depth * 16 }]}>
      {hasChildren && <View style={[styles.childBar, { backgroundColor: accent }]} />}
      <Pressable
        onPress={onCheck}
        disabled={!onCheck}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!checked }}
        accessibilityLabel={checked ? `Desmarcar ${task.title}` : `Completar ${task.title}`}
        style={[
          styles.check,
          {
            borderColor: checked ? checkedColor : accent,
            backgroundColor: checked ? checkedColor : 'transparent',
          },
        ]}>
        {checked ? (
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="checkmark" size={15} color={Colors.white} />
          </Animated.View>
        ) : cancelled ? (
          <Ionicons name="close" size={15} color={Colors.muted} />
        ) : null}
      </Pressable>

      <Pressable style={styles.body} onPress={onPress} disabled={!onPress}>
        <ThemedText
          style={[
            styles.title,
            checked && { color: Colors.success, textDecorationLine: 'line-through' },
            cancelled && { color: Colors.muted, textDecorationLine: 'line-through' },
            paused && !muted && { color: Colors.warning },
          ]}
          numberOfLines={2}>
          {task.title}
        </ThemedText>
        <ThemedText style={styles.meta} numberOfLines={2}>
          {[extraMeta, taskMeta(task), overdue ? 'vencida' : null, paused ? 'en pausa' : null]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      </Pressable>

      {hasChildren ? (
        <View style={styles.expandWrap}>
          {childCount != null && childCount > 0 ? (
            <View style={styles.countChip}>
              <ThemedText style={styles.countChipText}>{childCount}</ThemedText>
            </View>
          ) : null}
          <Pressable onPress={onToggleExpand} hitSlop={10} accessibilityLabel={expanded ? 'Contraer sub-tareas' : 'Expandir sub-tareas'}>
            <Ionicons
              name={expanded ? 'chevron-down-circle' : 'chevron-forward-circle'}
              size={22}
              color={expanded ? Colors.tint : Colors.muted}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingRight: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  childBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  expandWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countChip: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    paddingHorizontal: 5,
  },
  countChipText: { fontSize: 11, fontWeight: '800', color: Colors.tint },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  meta: { fontSize: 12, color: Colors.muted, lineHeight: 16 },
});