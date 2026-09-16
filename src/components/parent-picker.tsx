import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ReactElement, useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Field } from '@/components/ui/field';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Task } from '@/lib/schema';
import { groupTasksByParent } from '@/lib/logic';

export function ParentPicker({
  value,
  excludeId,
  onChange,
}: {
  value: number | null;
  excludeId?: number | null;
  onChange: (id: number | null) => void;
}) {
  const sqlite = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      db.getTasks(sqlite).then((list) =>
        setTasks(list.filter((t) => t.parentId == null && t.id !== excludeId))
      );
    }, [sqlite, excludeId])
  );

  const selected = tasks.find((t) => t.id === value);

  function renderNode(task: Task, depth: number): ReactElement[] {
    const children = tasks.filter((t) => t.parentId === task.id);
    const items: ReactElement[] = [
      <Pressable
        key={task.id}
        style={[styles.option, { paddingLeft: 16 + depth * 18 }]}
        onPress={() => {
          onChange(task.id);
          setOpen(false);
        }}>
        <ThemedText style={[styles.optionText, value === task.id && { color: Colors.tint }]}>
          {task.title}
        </ThemedText>
      </Pressable>,
    ];
    for (const child of children) {
      items.push(...renderNode(child, depth + 1));
    }
    return items;
  }

  return (
    <Field label="Sub-tarea de (opcional)">
      <Pressable style={styles.pickerButton} onPress={() => setOpen(true)}>
        <Ionicons name="git-branch-outline" size={18} color={Colors.muted} />
        <ThemedText style={[styles.pickerText, !selected && { color: Colors.muted }]}>
          {selected ? selected.title : 'Ninguna (es una tarea principal)'}
        </ThemedText>
        <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle}>Elige la tarea padre</ThemedText>
            <Pressable onPress={() => setOpen(false)}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>
          <ScrollView>
            <Pressable style={styles.option} onPress={() => { onChange(null); setOpen(false); }}>
              <ThemedText style={[styles.optionText, value == null && { color: Colors.tint }]}>
                Ninguna (tarea principal)
              </ThemedText>
            </Pressable>
            {tasks.length === 0 ? (
              <ThemedText style={styles.empty}>No hay tareas principales aún.</ThemedText>
            ) : (
              groupTasksByParent(tasks).roots.map((t) => renderNode(t, 0))
            )}
          </ScrollView>
        </View>
      </Modal>
    </Field>
  );
}

const styles = StyleSheet.create({
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  pickerText: { flex: 1, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    maxHeight: '70%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionText: { fontSize: 15, fontWeight: '600' },
  empty: { padding: 20, color: Colors.muted },
});