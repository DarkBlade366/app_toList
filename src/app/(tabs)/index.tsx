import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { DragGrip, ReorderProvider, RowAnchor, flattenVisible } from '@/components/reorder';
import { Confetti } from '@/components/confetti';
import { ProgressRing } from '@/components/progress-ring';
import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SubtaskGroup } from '@/components/subtask-group';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { DAY_CLOSED_BONUS } from '@/lib/gamification';
import { Task } from '@/lib/schema';
import {
  addDays,
  buildTree,
  dayTreeTasks,
  formatDateLong,
  formatTime,
  fromISO,
  groupTasksByParent,
  isOverdue,
  overdueFirst,
  statusForDate,
  taskTypeOf,
  toISO,
  todayISO,
  weekdayLabel,
  weekdayOf,
} from '@/lib/logic';

type HoyTab = 'day' | 'general';

const DAY_CLOSED_REASON = 'day_close';

export default function TodayScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState<HoyTab>('day');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [burst, setBurst] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await db.resetRecurringDayStatuses(sqlite, todayISO()).catch(() => {});
        const [all, comps] = await Promise.all([
          db.getTasks(sqlite),
          db.getCompletionsSetForDate(sqlite, date),
        ]);
        if (!active) return;
        setTasks(all);
        setCompleted(comps);
      })();
      return () => {
        active = false;
      };
    }, [sqlite, date])
  );

  const dayTasks = overdueFirst(
    dayTreeTasks(tasks, date).filter((t) => statusForDate(t, completed, date) !== 'cancelled'),
    date,
    completed
  );

  const generalIds = new Set<number>();
  for (const t of tasks) {
    if (taskTypeOf(t) === 'general') generalIds.add(t.id);
  }
  // Incluye también los hijos de las tareas generales (a cualquier profundidad).
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (t.parentId != null && generalIds.has(t.parentId) && !generalIds.has(t.id)) {
        generalIds.add(t.id);
        changed = true;
      }
    }
  }
  const generalTasks = overdueFirst(
    tasks.filter((t) => generalIds.has(t.id) && statusForDate(t, completed, date) !== 'cancelled'),
    date,
    completed
  );

  const shownTasks = tab === 'day' ? dayTasks : generalTasks;
  const showQuick = tab === 'day' && date === todayISO();
  const tree = buildTree(shownTasks);
  const { childrenOf } = groupTasksByParent(shownTasks);

  const doneCount = shownTasks.filter(
    (t) => statusForDate(t, completed, date) === 'completed'
  ).length;
  const overdueCount = shownTasks.filter(
    (t) => isOverdue(t, date, completed) && statusForDate(t, completed, date) !== 'completed'
  ).length;
  const isToday = date === todayISO();
  const ratio = shownTasks.length ? doneCount / shownTasks.length : 0;

  const longDate = formatDateLong(date);
  const comma = longDate.indexOf(',');
  const weekdayName = comma > 0 ? longDate.slice(0, comma) : 'Hoy';
  const dayPart = comma > 0 ? longDate.slice(comma + 2) : longDate;

  const startOfWeek = fromISO(date);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return { iso: toISO(d), num: d.getDate(), dow: weekdayLabel(weekdayOf(toISO(d))).slice(0, 3) };
  });

  async function toggle(task: Task) {
    const wasDone = statusForDate(task, completed, date) === 'completed';
    const done = await db.toggleTaskCompletion(sqlite, task.id, date);
    void Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    const [all, comps] = await Promise.all([
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, date),
    ]);
    setTasks(all);
    setCompleted(comps);

    if (done && !wasDone) {
      const left = dayTreeTasks(all, date).filter(
        (t) =>
          statusForDate(t, comps, date) !== 'completed' &&
          statusForDate(t, comps, date) !== 'cancelled'
      ).length;
      if (left === 0) {
        setBurst((b) => b + 1);
        if (isToday) {
          await db.earnXp(sqlite, DAY_CLOSED_BONUS, DAY_CLOSED_REASON);
          toast.show(`¡Día completo! +${DAY_CLOSED_BONUS} XP`, 'success');
        } else {
          toast.show('¡Día completo!', 'success');
        }
      } else {
        toast.show('Completada', 'success');
      }
    } else if (wasDone) {
      toast.show('Completado deshecho', 'info');
    }
  }

  function renderNode(task: Task, depth = 0, ghost = false): ReactElement | null {
    const children = childrenOf.get(task.id) ?? [];
    const state = statusForDate(task, completed, date);
    const isChecked = state === 'completed';
    const showChildren = expanded.has(task.id);
    const timelineMode = tab === 'day';
    const timeChip =
      timelineMode && (task.endTime || task.startTime)
        ? formatTime(task.endTime ?? task.startTime!)
        : undefined;
    const body = (
      <>
        <TaskRow
          task={task}
          checked={isChecked}
          overdue={isOverdue(task, date, completed)}
          paused={state === 'paused'}
          cancelled={state === 'cancelled'}
          hasChildren={children.length > 0}
          childCount={children.length}
          expanded={showChildren}
          timeline={timelineMode}
          timeChip={timeChip}
          onToggleExpand={() =>
            setExpanded((s) => {
              const next = new Set(s);
              if (next.has(task.id)) next.delete(task.id);
              else next.add(task.id);
              return next;
            })
          }
          onCheck={() => toggle(task)}
          onPress={ghost ? undefined : () => router.push(`/task/${task.id}`)}
          dragHandle={ghost ? undefined : <DragGrip id={task.id} />}
        />
        {showChildren && (
          <SubtaskGroup count={children.length} depth={depth}>
            {children.map((c) => renderNode(c, depth + 1, ghost))}
          </SubtaskGroup>
        )}
      </>
    );
    if (ghost) return <View key={task.id}>{body}</View>;
    return (
      <RowAnchor key={task.id} id={task.id}>
        {body}
      </RowAnchor>
    );
  }

  const [dragActive, setDragActive] = useState(false);

  const fullGroup = useMemo(() => groupTasksByParent(tasks), [tasks]);
  const rootIds = useMemo(
    () => tasks.filter((t) => t.parentId == null).map((t) => t.id),
    [tasks]
  );

  async function handleReorder(movingId: number, orderedIds: number[]) {
    await db.setSiblingOrder(sqlite, orderedIds);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const [all, comps] = await Promise.all([
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, date),
    ]);
    setTasks(all);
    setCompleted(comps);
  }

  const rows = useMemo(
    () => flattenVisible(tree, expanded, childrenOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tree, expanded]
  );

  return (
    <>
    <ReorderProvider
      rows={rows}
      siblingsOf={(id) => {
        const t = tasks.find((x) => x.id === id);
        if (!t) return [];
        return t.parentId == null
          ? rootIds
          : (fullGroup.childrenOf.get(t.parentId) ?? []).map((c) => c.id);
      }}
      onReorder={handleReorder}
      renderGhost={(tid) => {
        const t = shownTasks.find((x) => x.id === tid);
        return t ? renderNode(t, 0, true) : null;
      }}
      onDragStateChange={setDragActive}>
      <Screen scroll
        scrollEnabled={!dragActive}>
      <View style={styles.header}>
        <Pressable style={styles.navBtn} hitSlop={10} onPress={() => setDate(addDays(date, -1))}>
          <Ionicons name="chevron-back" size={22} color={Colors.tint} />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText style={styles.dateWeekday}>{weekdayName.toUpperCase()}</ThemedText>
          <ThemedText style={styles.dateLabel}>{dayPart}</ThemedText>
          {isToday ? (
            <ThemedText style={styles.todayBadge}>Hoy</ThemedText>
          ) : (
            <Pressable onPress={() => setDate(todayISO())}>
              <ThemedText style={styles.goToday}>Volver a hoy</ThemedText>
            </Pressable>
          )}
        </View>
        <Pressable style={styles.navBtn} hitSlop={10} onPress={() => setDate(addDays(date, 1))}>
          <Ionicons name="chevron-forward" size={22} color={Colors.tint} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {weekDates.map((d) => {
          const isSel = d.iso === date;
          const isTod = d.iso === todayISO();
          return (
            <Pressable
              key={d.iso}
              style={[styles.weekPill, isSel && styles.weekPillSel]}
              onPress={() => setDate(d.iso)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}>
              <ThemedText style={[styles.weekDow, isSel && { color: Colors.white }]}>
                {d.dow}
              </ThemedText>
              <ThemedText
                style={[
                  styles.weekDay,
                  isTod && !isSel && { color: Colors.tint, fontWeight: '800' },
                  isSel && { color: Colors.white },
                ]}>
                {d.num}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <Segmented
        options={[
          { key: 'day', label: 'Del día' },
          { key: 'general', label: 'Tareas generales' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <Card style={styles.summary}>
        <View style={styles.summaryMain}>
          <ProgressRing
            progress={ratio}
            size={104}
            strokeWidth={10}
            color={ratio >= 1 && shownTasks.length > 0 ? Colors.success : Colors.tint}>
            <ThemedText style={styles.ringPct}>{Math.round(ratio * 100)}%</ThemedText>
            <ThemedText style={styles.ringSub}>{isToday ? 'hoy' : 'ese día'}</ThemedText>
          </ProgressRing>
          <View style={styles.summaryInfo}>
            <View style={styles.summaryHero}>
              <ThemedText style={styles.summaryDoneNum}>{doneCount}</ThemedText>
              <ThemedText style={styles.summaryTotal}>
                de {shownTasks.length} tarea{shownTasks.length === 1 ? '' : 's'} hechas
              </ThemedText>
            </View>
            {overdueCount > 0 ? (
              <View style={styles.summaryOverdueRow}>
                <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                <ThemedText style={styles.summaryOverdue}>
                  {overdueCount} vencida{overdueCount > 1 ? 's' : ''} sin hacer
                </ThemedText>
              </View>
            ) : shownTasks.length > 0 ? (
              <View style={styles.summaryOverdueRow}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <ThemedText style={styles.summaryClear}>Todo al día</ThemedText>
              </View>
            ) : null}
            {showQuick && (
              <Pressable style={styles.focusBtn} onPress={() => router.push('/focus')}>
                <Ionicons name="eye-outline" size={16} color={Colors.tint} />
                <ThemedText style={styles.focusLabel}>Enfocar la primera pendiente</ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </Card>

      <View style={styles.list}>
        {tab === 'day' ? <View pointerEvents="none" style={styles.timelineLine} /> : null}
        {shownTasks.length === 0 ? (
          <Card>
            <EmptyState
              icon={tab === 'general' ? 'layers-outline' : 'sunny-outline'}
              title={tab === 'general' ? 'Sin tareas generales' : 'Sin tareas para este día'}
              hint={
                tab === 'general'
                  ? 'Una tarea general no está ligada a un día concreto y siempre vive en esta pestaña.'
                  : 'Deja este día en blanco o añade una tarea para esta fecha.'
              }
              actionLabel={tab === 'general' ? 'Nueva tarea general' : 'Añadir para este día'}
              onAction={() =>
                tab === 'general'
                  ? router.push({ pathname: '/task/new' })
                  : router.push({ pathname: '/task/new', params: { type: 'once', date } })
              }
            />
          </Card>
        ) : (
          tree.map((t) => renderNode(t))
        )}
      </View>

      {showQuick && (
        <View style={styles.quickCol}>
          <Pressable
            style={styles.quickBtn}
            onPress={() =>
              router.push({
                pathname: '/task/new',
                params: { type: 'once', date: todayISO() },
              })
            }>
            <Ionicons name="add-circle" size={20} color={Colors.tint} />
            <View style={styles.quickBody}>
              <ThemedText style={styles.quickLabel}>Añadir tarea para hoy</ThemedText>
              <ThemedText style={styles.quickHint}>
                Tarea de un día para {formatDateLong(todayISO())}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
          </Pressable>
          <Pressable
            style={styles.quickBtn}
            onPress={() =>
              router.push({
                pathname: '/task/new',
                params: { type: 'once', date: addDays(todayISO(), 1) },
              })
            }>
            <Ionicons name="add-circle" size={20} color={Colors.tint} />
            <View style={styles.quickBody}>
              <ThemedText style={styles.quickLabel}>Añadir tarea para mañana</ThemedText>
              <ThemedText style={styles.quickHint}>
                Tarea de un día para {formatDateLong(addDays(todayISO(), 1))}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
          </Pressable>
        </View>
      )}
    </Screen>
    </ReorderProvider>
      <Confetti burst={burst} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: { padding: 6 },
  headerCenter: { alignItems: 'center', gap: 2 },
  dateWeekday: { fontSize: 12, fontWeight: '800', color: Colors.tint, letterSpacing: 1.4 },
  dateLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  todayBadge: { fontSize: 11, color: Colors.tint, fontWeight: '700' },
  goToday: { fontSize: 11, color: Colors.tint, fontWeight: '700' },
  weekRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 6,
  },
  weekPill: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 10,
  },
  weekPillSel: { backgroundColor: Colors.tint },
  weekDow: { fontSize: 11, color: Colors.muted, fontWeight: '700' },
  weekDay: { fontSize: 15, fontWeight: '600', color: Colors.text },
  summary: { paddingVertical: 6 },
  summaryMain: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  summaryInfo: { flex: 1, gap: 10 },
  summaryHero: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  summaryDoneNum: { fontSize: 40, fontWeight: '800', color: Colors.text },
  summaryTotal: { fontSize: 14, color: Colors.muted },
  ringPct: { fontSize: 22, fontWeight: '800', color: Colors.text },
  ringSub: { fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryOverdueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryOverdue: { fontSize: 13, color: Colors.danger, flexShrink: 1 },
  summaryClear: { fontSize: 13, color: Colors.success },
  focusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  focusLabel: { fontSize: 13, fontWeight: '700', color: Colors.tint },
  timelineLine: {
    position: 'absolute',
    left: 16.5,
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(138, 148, 166, 0.25)',
  },
  quickCol: { gap: 10, marginTop: 4 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  quickBody: { flex: 1 },
  quickLabel: { color: Colors.tint, fontSize: 14, fontWeight: '700' },
  quickHint: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  list: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
});