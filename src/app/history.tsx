import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { TaskCompletion } from '@/lib/schema';
import { addDays, fromISO, todayISO, toISO, weekdayLabel } from '@/lib/logic';

const WEEKS = 14;
const ALPHA1 = 'rgba(52, 211, 153, 0.22)';
const ALPHA2 = 'rgba(52, 211, 153, 0.45)';
const ALPHA3 = 'rgba(52, 211, 153, 0.7)';

function countColor(count: number): string {
  if (count <= 0) return Colors.border;
  if (count === 1) return ALPHA1;
  if (count <= 3) return ALPHA2;
  if (count <= 6) return ALPHA3;
  return Colors.success;
}

export default function HistoryScreen() {
  const sqlite = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      db.getCompletions(sqlite).then((list) => {
        if (active) setCompletions(list);
      });
      return () => {
        active = false;
      };
    }, [sqlite])
  );

  const byDay = new Map<string, number>();
  for (const c of completions) {
    byDay.set(c.date, (byDay.get(c.date) ?? 0) + 1);
  }

  const today = todayISO();
  let streak = 0;
  let cursor = byDay.has(today) ? today : addDays(today, -1);
  while (byDay.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const weeks: { iso: string; count: number }[][] = [];
  const weekEnd = fromISO(today);
  const mondayIndex = (weekEnd.getDay() + 6) % 7;
  weekEnd.setDate(weekEnd.getDate() - mondayIndex);
  weekEnd.setDate(weekEnd.getDate() - 7 * (WEEKS - 1));
  for (let w = 0; w < WEEKS; w++) {
    const col: { iso: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const start = new Date(weekEnd);
      start.setDate(weekEnd.getDate() + d);
      const iso = toISO(start);
      col.push({ iso, count: byDay.get(iso) ?? 0 });
    }
    weeks.push(col);
    weekEnd.setDate(weekEnd.getDate() + 7);
  }

  const firstDate = byDay.size ? [...byDay.keys()].sort()[0] : null;
  const lastDate = byDay.size ? [...byDay.keys()].sort().reverse()[0] : null;

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Historial</ThemedText>
          <ThemedText style={styles.subtitle}>Tus rachas y completados</ThemedText>
        </View>
      </View>

      {completions.length === 0 ? (
        <Card>
          <EmptyState
            icon="calendar-outline"
            title="Todavía no has completado nada"
            hint="Marca tareas como hechas desde Hoy o las listas y aquí verás tu racha."
          />
        </Card>
      ) : (
        <>
          <View style={styles.statsRow}>
            <Stat label="Racha actual" value={streak > 0 ? `${streak} día${streak > 1 ? 's' : ''}` : '—'} accent={streak > 0} flame />
            <Stat label="Completadas" value={String(completions.length)} accent />
            <Stat label="Días activos" value={String(byDay.size)} accent={byDay.size > 0} />
          </View>

          <Card>
            <ThemedText style={styles.cardTitle}>Actividad</ThemedText>
            <View style={styles.grid}>
              <View style={styles.weekdayCol}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <View key={d} style={styles.cell}>
                    {d === 1 || d === 3 || d === 5 ? (
                      <ThemedText style={styles.weekdayLabel}>{weekdayLabel(d).slice(0, 2)}</ThemedText>
                    ) : null}
                  </View>
                ))}
              </View>
              <View style={styles.weeksCol}>
                {weeks.map((col, wi) => (
                  <View key={wi} style={styles.week}>
                    {col.map((cell) => (
                      <View
                        key={cell.iso}
                        style={[
                          styles.cellBox,
                          { backgroundColor: countColor(cell.count) },
                          cell.iso === today && styles.cellToday,
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.legend}>
              <ThemedText style={styles.legendText}>Menos</ThemedText>
              {[Colors.border, ALPHA1, ALPHA2, ALPHA3, Colors.success].map((c) => (
                <View key={c} style={[styles.cellBox, { backgroundColor: c }]} />
              ))}
              <ThemedText style={styles.legendText}>Más</ThemedText>
            </View>
          </Card>

          <Card>
            <ThemedText style={styles.cardTitle}>Resumen</ThemedText>
            <ThemedText style={styles.resumeText}>
              {firstDate && lastDate
                ? `Desde ${firstDate.replaceAll('-', '/')} hasta ${lastDate.replaceAll('-', '/')}.`
                : ''}{' '}
              {streak > 0
                ? `Llevas ${streak} día${streak > 1 ? 's' : ''} seguidos completando.`
                : 'Completa algo hoy para arrancar una racha. ¡Tú puedes!'}
            </ThemedText>
          </Card>
        </>
      )}
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
  flame,
}: {
  label: string;
  value: string;
  accent?: boolean;
  flame?: boolean;
}) {
  return (
    <View style={[styles.stat, accent && { borderColor: 'rgba(52, 211, 153, 0.5)' }]}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      {flame && accent ? <Ionicons name="flame" size={16} color={Colors.warning} /> : null}
      <ThemedText style={[styles.statValue, accent && { color: Colors.success }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  back: { width: 34 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  stat: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 14,
    gap: 4,
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  grid: { flexDirection: 'row', gap: 6 },
  weekdayCol: { gap: 3 },
  weeksCol: { flexDirection: 'row', gap: 3 },
  week: { gap: 3 },
  cell: { width: 24, height: 18, justifyContent: 'center' },
  cellBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  cellToday: { borderWidth: 1.5, borderColor: Colors.tint },
  weekdayLabel: { fontSize: 9, color: Colors.muted },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  legendText: { fontSize: 11, color: Colors.muted },
  resumeText: { fontSize: 13, color: Colors.muted, lineHeight: 19 },
});