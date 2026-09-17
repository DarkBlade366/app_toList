import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ParentCtx, TaskForm } from '@/components/task-form';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { TaskType } from '@/lib/logic';

export default function NewTaskModal() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const toast = useToast();
  const { parentId, date, type } = useLocalSearchParams<{
    parentId?: string;
    date?: string;
    type?: string;
  }>();
  const parent = parentId ? Number(parentId) : null;
  const presetType =
    type === 'general' || type === 'once' || type === 'range' || type === 'daily' ||
    type === 'weekly' || type === 'monthly'
      ? (type as TaskType)
      : null;

  const [parentCtx, setParentCtx] = useState<ParentCtx | null>(null);

  useEffect(() => {
    if (parent == null) return;
    let active = true;
    db.getTask(sqlite, parent).then((t) => {
      if (!active || !t) return;
      setParentCtx({ id: t.id, title: t.title, startDate: t.startDate, endDate: t.endDate });
    });
    return () => {
      active = false;
    };
  }, [sqlite, parent]);

  return (
    <View style={styles.flex}>
      <View style={styles.head}>
        <ThemedText style={styles.badge}>
          {parent != null ? 'Agregar tarea a otra' : 'Nueva tarea'}
        </ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={Colors.text} />
        </Pressable>
      </View>
      <TaskForm
        parent={parentCtx}
        presetDate={date ?? null}
        presetType={presetType}
        onSubmit={async (data) => {
          await db.addTask(sqlite, { ...data, parentId: parentCtx?.id ?? data.parentId ?? null });
          toast.show('Tarea añadida', 'success');
          router.back();
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background, padding: 20 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.tint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});