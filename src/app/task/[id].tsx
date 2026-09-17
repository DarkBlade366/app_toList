import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ReactElement, useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ParentCtx, TaskForm } from '@/components/task-form';
import { TaskRow, taskMeta } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Field } from '@/components/ui/field';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Task } from '@/lib/schema';
import { groupTasksByParent, statusForDate, todayISO } from '@/lib/logic';
import { syncNotifications } from '@/lib/notifications';

export default function TaskModal() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);

  const [task, setTask] = useState<Task | null>(null);
  const [parentCtx, setParentCtx] = useState<ParentCtx | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const today = todayISO();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [t, all, comps] = await Promise.all([
          db.getTask(sqlite, taskId),
          db.getTasks(sqlite),
          db.getCompletionsSetForDate(sqlite, today),
        ]);
        if (!active) return;
        setTask(t);
        setTasks(all);
        setCompleted(comps);
        setEditing(false);
        if (t?.parentId != null) {
          const p = all.find((x) => x.id === t.parentId) ?? null;
          setParentCtx(p ? { id: p.id, title: p.title, startDate: p.startDate, endDate: p.endDate } : null);
        } else {
          setParentCtx(null);
        }
      })();
      return () => {
        active = false;
      };
    }, [sqlite, taskId, today])
  );

  if (!task) return null;

  const current = task;

  const children = tasks.filter((t) => t.parentId === current.id);
  const { childrenOf } = groupTasksByParent(tasks);
  const state = statusForDate(current, completed, today);

  async function refresh() {
    const [t, all, comps] = await Promise.all([
      db.getTask(sqlite, taskId),
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, today),
    ]);
    setTask(t);
    setTasks(all);
    setCompleted(comps);
  }

  async function toggleToday() {
    await db.toggleTaskCompletion(sqlite, current.id, today);
    void syncNotifications(sqlite);
    toast.show(state === 'completed' ? 'Deshecho' : '¡Bien hecho!', 'success');
    await refresh();
  }

  async function setStatus(status: db.TaskStatus, msg: string) {
    await db.setTaskStatus(sqlite, current.id, status);
    void syncNotifications(sqlite);
    toast.show(msg, 'info');
    await refresh();
  }

  function confirmDelete() {
    Alert.alert('Eliminar tarea', `¿Borrar "${current.title}"${children.length ? ' y sus sub-tareas' : ''}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await db.deleteTask(sqlite, current.id);
          void syncNotifications(sqlite);
          toast.show('Tarea eliminada', 'info');
          router.back();
        },
      },
    ]);
  }

  function confirmCancel() {
    const cancelAction = () => setStatus('cancelled', 'Tarea cancelada');
    if (current.status === 'cancelled') {
      setStatus('pending', 'Tarea reactivada');
      return;
    }
    Alert.alert('Cancelar tarea', `¿Cancelar "${current.title}"? Podrás reactivarla después desde este mismo menú.`, [
      { text: 'No', style: 'cancel' },
      { text: 'Cancelar tarea', style: 'destructive', onPress: cancelAction },
    ]);
  }

  function renderChild(t: Task, depth: number): ReactElement {
    const grand = childrenOf.get(t.id) ?? [];
    const showChildren = expanded.has(t.id);
    const childState = statusForDate(t, completed, today);
    return (
      <View key={t.id}>
        <TaskRow
          task={t}
          depth={depth}
          checked={childState === 'completed'}
          paused={childState === 'paused'}
          cancelled={childState === 'cancelled'}
          hasChildren={grand.length > 0}
          expanded={showChildren}
          onToggleExpand={() =>
            setExpanded((s) => {
              const next = new Set(s);
              if (next.has(t.id)) next.delete(t.id);
              else next.add(t.id);
              return next;
            })
          }
          onPress={() => router.push(`/task/${t.id}`)}
        />
        {showChildren && grand.map((c) => renderChild(c, depth + 1))}
      </View>
    );
  }

  if (editing) {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <View style={styles.head}>
          <Pressable onPress={() => setEditing(false)} hitSlop={10}>
            <Ionicons name="close" size={26} color={Colors.text} />
          </Pressable>
          <ThemedText style={styles.title}>Editar tarea</ThemedText>
          <View style={{ width: 26 }} />
        </View>
        <TaskForm
          key={`edit-${current.id}`}
          initial={current}
          initialStatus={current.status}
          parent={parentCtx}
          onSubmit={async (data) => {
            await db.updateTask(sqlite, current.id, data);
            void syncNotifications(sqlite);
            toast.show('Tarea actualizada', 'success');
            setEditing(false);
            await refresh();
            return true;
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
      <View style={styles.head}>
        <ThemedText style={styles.badge}>
          {current.priority === 'high' ? 'Alta' : current.priority === 'low' ? 'Baja' : 'Media'} prioridad
        </ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={Colors.text} />
        </Pressable>
      </View>

      <ThemedText style={styles.title}>{current.title}</ThemedText>
      {current.notes ? <ThemedText style={styles.notes}>{current.notes}</ThemedText> : null}

      <View style={styles.metaChips}>
        <View style={[styles.chip, { borderColor: Colors.border }]}>
          <ThemedText style={styles.chipText}>{taskMeta(current)}</ThemedText>
        </View>
        <View style={[styles.chip, { borderColor: Colors.border }]}>
          <Ionicons
            name={current.remindType === 'alarm' ? 'alarm' : current.remindType === 'notification' ? 'notifications' : 'notifications-off'}
            size={13}
            color={Colors.muted}
          />
          <ThemedText style={styles.chipText}>
            {current.remindType === 'alarm' ? 'Alarma' : current.remindType === 'notification' ? 'Notificación' : 'Sin aviso'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <ActionBtn icon="checkmark-circle" label="Completar" onPress={toggleToday} active={state === 'completed'} />
        <ActionBtn
          icon={current.status === 'paused' ? 'play' : 'pause'}
          label={current.status === 'paused' ? 'Reanudar' : 'Pausar'}
          onPress={() => setStatus(current.status === 'paused' ? 'pending' : 'paused', current.status === 'paused' ? 'Reanudada' : 'En pausa')}
        />
        <ActionBtn
          icon={current.status === 'cancelled' ? 'refresh' : 'close-circle'}
          label={current.status === 'cancelled' ? 'Reactivar' : 'Cancelar'}
          danger={current.status !== 'cancelled'}
          onPress={confirmCancel}
        />
        <ActionBtn
          icon="trash"
          label="Eliminar"
          danger
          onPress={confirmDelete}
        />
        <ActionBtn icon="pencil" label="Editar" onPress={() => setEditing(true)} />
      </View>

      {children.length > 0 && (
        <Field label={`Tareas dentro de esta (${children.length})`}>
          <View style={styles.children}>{children.map((c) => renderChild(c, 0))}</View>
        </Field>
      )}

      <Pressable
        style={[styles.sub, { backgroundColor: Colors.surface }]}
        onPress={() => router.push({ pathname: '/task/new', params: { parentId: String(current.id) } })}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.tint} />
        <ThemedText style={{ color: Colors.tint, fontWeight: '700' }}>Agregar tarea</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  active,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  const color = danger ? Colors.danger : active ? Colors.success : Colors.text;
  return (
    <Pressable style={[styles.action, { borderColor: color }]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={color} />
      <ThemedText style={{ color, fontWeight: '700', fontSize: 12 }}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.tint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, lineHeight: 30 },
  notes: { fontSize: 15, color: Colors.muted, marginTop: 8, lineHeight: 21 },
  metaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, color: Colors.muted, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  children: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  sub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
  },
});