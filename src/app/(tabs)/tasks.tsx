import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Task } from '@/lib/schema';
import { TASK_TYPE_DESCRIPTIONS, TASK_TYPE_LABELS, TASK_TYPE_ORDER, TaskType, taskTypeOf } from '@/lib/logic';

const TYPE_ICONS: Record<TaskType, ComponentProps<typeof Ionicons>['name']> = {
  general: 'layers-outline',
  once: 'calendar',
  range: 'calendar-outline',
  daily: 'sunny',
  weekly: 'repeat',
  monthly: 'calendar-number',
};

export default function TasksScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);

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

  const counts = new Map<TaskType, number>();
  for (const t of tasks) {
    const key = taskTypeOf(t);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const pendingRoots = new Set(
    tasks
      .filter((t) => t.parentId == null && t.status !== 'completed' && t.status !== 'cancelled')
      .map((t) => t.id)
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Tareas</ThemedText>
          <ThemedText style={styles.subtitle}>
            {pendingRoots.size} pendientes · {tasks.length} en total
          </ThemedText>
        </View>
        <Pressable style={styles.newBtn} onPress={() => router.push('/task/new')} hitSlop={8}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {TASK_TYPE_ORDER.map((type) => {
          const count = counts.get(type) ?? 0;
          return (
            <Pressable
              key={type}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              onPress={() => router.push(`/task-type/${type}`)}>
              <View style={styles.iconBox}>
                <Ionicons name={TYPE_ICONS[type]} size={20} color={Colors.tint} />
              </View>
              <View style={styles.rowBody}>
                <ThemedText style={styles.rowTitle}>{TASK_TYPE_LABELS[type]}</ThemedText>
                <ThemedText style={styles.rowDesc} numberOfLines={2}>
                  {TASK_TYPE_DESCRIPTIONS[type]}
                </ThemedText>
              </View>
              <View style={styles.countBox}>
                <ThemedText style={styles.countText}>{count}</ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  list: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  rowDesc: { fontSize: 12, color: Colors.muted, lineHeight: 16 },
  countBox: {
    minWidth: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countText: { fontSize: 14, fontWeight: '700', color: Colors.tint },
});