import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

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
  expanded?: boolean;
  onToggleExpand?: () => void;
  onCheck?: () => void;
  onPress?: () => void;
  extraMeta?: string;
}) {
  const accent = overdue && !checked ? Colors.danger : PRIORITY_COLORS[task.priority];
  const muted = checked || cancelled;

  return (
    <View style={[styles.row, { paddingLeft: 12 + depth * 22 }]}>
      {hasChildren && <View style={[styles.childBar, { backgroundColor: accent }]} />}
      <Pressable
        onPress={onCheck}
        disabled={!onCheck}
        hitSlop={10}
        style={[
          styles.check,
          {
            borderColor: checked ? checkedColor : accent,
            backgroundColor: checked ? checkedColor : 'transparent',
          },
        ]}>
        {checked ? (
          <Ionicons name="checkmark" size={15} color={Colors.white} />
        ) : cancelled ? (
          <Ionicons name="close" size={15} color={Colors.muted} />
        ) : null}
      </Pressable>

      <Pressable style={styles.body} onPress={onPress} disabled={!onPress}>
        <ThemedText
          style={[
            styles.title,
            muted && { color: Colors.muted, textDecorationLine: muted ? 'line-through' : undefined },
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
        <Pressable onPress={onToggleExpand} hitSlop={10}>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={Colors.muted}
          />
        </Pressable>
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