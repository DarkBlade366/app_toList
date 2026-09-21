import { Ionicons } from '@expo/vector-icons';
import { ReactElement, useEffect, useMemo } from 'react';
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
  hasChildren,
  childCount,
  expanded,
  onToggleExpand,
  onCheck,
  onPress,
  extraMeta,
  dragHandle,
  timeline,
  timeChip,
}: {
  task: Task;
  checked?: boolean;
  checkedColor?: string;
  overdue?: boolean;
  paused?: boolean;
  cancelled?: boolean;
  hasChildren?: boolean;
  childCount?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onCheck?: () => void;
  onPress?: () => void;
  extraMeta?: string;
  dragHandle?: ReactElement;
  /** Modo agenda: dibuja un punto sobre la línea del timeline. */
  timeline?: boolean;
  /** Chip mono con la hora (p. ej. "14:00"). */
  timeChip?: string;
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
    <View style={styles.row}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      {timeline ? <View style={[styles.timelineDot, { backgroundColor: accent }]} /> : null}
      {dragHandle ?? null}
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
        <View style={styles.metaRow}>
          {timeChip ? <ThemedText style={styles.timeChip}>{timeChip}</ThemedText> : null}
          <ThemedText style={styles.meta} numberOfLines={2}>
            {[extraMeta, taskMeta(task), overdue ? 'vencida' : null, paused ? 'en pausa' : null]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
      </Pressable>

      {hasChildren ? (
        <Pressable
          style={styles.expandBtn}
          onPress={onToggleExpand}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Contraer sub-tareas' : 'Expandir sub-tareas'}
          accessibilityState={{ expanded: !!expanded }}>
          <ThemedText style={styles.expandCount}>{childCount ?? ''}</ThemedText>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={Colors.tint}
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
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  accentBar: {
    position: 'absolute',
    left: 4,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  timelineDot: {
    position: 'absolute',
    left: 1,
    top: '50%',
    width: 9,
    height: 9,
    marginTop: -4.5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.5)',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expandCount: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.tint,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  body: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  timeChip: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.white,
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  title: { fontSize: 16, fontWeight: '600', color: Colors.text, lineHeight: 21 },
  meta: { fontSize: 12, color: Colors.muted, lineHeight: 16, flexShrink: 1 },
});