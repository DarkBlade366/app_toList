import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { DragGrip, ReorderProvider, RowAnchor, flattenVisible } from '@/components/reorder';
import { Confetti } from '@/components/confetti';
import { DayCards } from '@/components/day-cards';
import { ProgressRing } from '@/components/progress-ring';
import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SubtaskGroup } from '@/components/subtask-group';
import { Colors, Radius, Shadow } from '@/constants/theme';
import * as db from '@/lib/db';
import { DAY_CLOSED_BONUS, levelInfo } from '@/lib/gamification';
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
  const [xp, setXp] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await db.resetRecurringDayStatuses(sqlite, todayISO()).catch(() => {});
        const [all, comps, xpVal] = await Promise.all([
          db.getTasks(sqlite),
          db.getCompletionsSetForDate(sqlite, date),
          db.getXp(sqlite),
        ]);
        if (!active) return;
        setTasks(all);
        setCompleted(comps);
        setXp(xpVal);
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
  const info = levelInfo(xp);

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
    const [all, comps, xpVal] = await Promise.all([
      db.getTasks(sqlite),
      db.getCompletionsSetForDate(sqlite, date),
      db.getXp(sqlite),
    ]);
    setTasks(all);
    setCompleted(comps);
    setXp(xpVal);

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
      rows={tab === 'general' ? rows : []}
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
            size={108}
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
            <View style={styles.xpBlock}>
              <View style={styles.xpRow}>
                <Ionicons name="star" size={13} color={Colors.warning} />
                <ThemedText style={styles.xpLabel}>
                  Nv {info.level} · {xp} XP
                </ThemedText>
                <ThemedText style={styles.xpMissing}>
                  faltan {info.remaining} XP
                </ThemedText>
              </View>
              <View style={styles.xpBar}>
                <View style={[styles.xpFill, { width: `${Math.round(info.progress * 100)}%` }]} />
              </View>
            </View>
          </View>
        </View>
        {showQuick && (
          <Pressable style={styles.focusFull} onPress={() => router.push('/focus')}>
            <Ionicons name="eye-outline" size={18} color={Colors.tint} />
            <ThemedText style={styles.focusLabel}>Enfocar la primera pendiente</ThemedText>
          </Pressable>
        )}
      </Card>

      <View style={styles.list}>
        {tab === 'day' ? (
          dayTasks.length === 0 ? (
            <Card>
              <EmptyState
                icon="sunny-outline"
                title="Sin tareas para este día"
                hint="Deja este día en blanco o añade una tarea para esta fecha."
                actionLabel="Añadir para este día"
                onAction={() =>
                  router.push({ pathname: '/task/new', params: { type: 'once', date } })
                }
              />
            </Card>
          ) : (
            <DayCards
              tasks={dayTasks}
              completed={completed}
              date={date}
              onToggle={toggle}
              onOpen={(id) => router.push(`/task/${id}`)}
            />
          )
        ) : shownTasks.length === 0 ? (
          <Card>
            <EmptyState
              icon="layers-outline"
              title="Sin tareas generales"
              hint="Una tarea general no está ligada a un día concreto y siempre vive en esta pestaña."
              actionLabel="Nueva tarea general"
              onAction={() => router.push({ pathname: '/task/new' })}
            />
          </Card>
        ) : (
          tree.map((t) => renderNode(t))
        )}
      </View>

      {showQuick && (
        <Pressable
          style={styles.fab}
          onPress={() =>
            router.push({
              pathname: '/task/new',
              params: { type: 'once', date: todayISO() },
            })
          }
          accessibilityLabel="Añadir tarea para hoy">
          <Ionicons name="add" size={30} color={Colors.white} />
        </Pressable>
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
  summary: { paddingVertical: 22 },
  summaryMain: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  summaryInfo: { flex: 1, gap: 9 },
  summaryHero: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  summaryDoneNum: { fontSize: 36, lineHeight: 40, fontWeight: '800', color: Colors.text },
  summaryTotal: { fontSize: 14, color: Colors.muted, flexShrink: 1 },
  ringPct: { fontSize: 24, fontWeight: '800', color: Colors.text },
  ringSub: { fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryOverdueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryOverdue: { fontSize: 13, color: Colors.danger, flexShrink: 1 },
  summaryClear: { fontSize: 13, color: Colors.success },
  xpBlock: { gap: 6 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  xpLabel: { fontSize: 13, fontWeight: '800', color: Colors.warning },
  xpMissing: { fontSize: 12, color: Colors.muted },
  xpBar: { height: 7, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  xpFill: { height: 7, borderRadius: 4, backgroundColor: Colors.warning },
  focusFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.45)',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderRadius: Radius.pill,
    paddingVertical: 11,
  },
  focusLabel: { fontSize: 14, fontWeight: '700', color: Colors.tint },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.glow,
  },
  list: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
});