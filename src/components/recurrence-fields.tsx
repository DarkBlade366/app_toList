import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { Colors } from '@/constants/theme';
import { Recurrence } from '@/lib/schema';
import { weekdayLabel } from '@/lib/logic';

export interface RecurrenceValue {
  recurrence: Recurrence;
  recurrenceDays: number[];
  monthlyDay: number | null;
  startDate: string | null;
  endDate: string | null;
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function RecurrenceFields({
  value,
  onChange,
}: {
  value: RecurrenceValue;
  onChange: (v: RecurrenceValue) => void;
}) {
  const [isRecurring, setIsRecurring] = useState(value.recurrence !== 'none');
  const [hasEndDate, setHasEndDate] = useState(value.endDate != null);

  function set<T extends Partial<RecurrenceValue>>(patch: T) {
    onChange({ ...value, ...patch });
  }

  function toggleDay(d: number) {
    const days = value.recurrenceDays ?? [];
    set({
      recurrenceDays: days.includes(d) ? days.filter((x) => x !== d) : [...days, d],
    });
  }

  return (
    <View style={styles.wrap}>
      <Field label="¿Se repite?">
        <Segmented
          options={[
            { key: 'one', label: 'Solo fechas' },
            { key: 'repeat', label: 'Recurrente' },
          ]}
          value={isRecurring ? 'repeat' : 'one'}
          onChange={(k) => {
            const rec = k === 'repeat';
            setIsRecurring(rec);
            if (rec && value.recurrence === 'none') {
              set({ recurrence: 'daily' });
            }
            if (!rec) {
              set({ recurrence: 'none', recurrenceDays: [], monthlyDay: null });
            }
          }}
        />
      </Field>

      {isRecurring ? (
        <>
          <Segmented
            options={[
              { key: 'daily', label: 'Diaria' },
              { key: 'weekly', label: 'Semanal' },
              { key: 'monthly', label: 'Mensual' },
            ]}
            value={value.recurrence}
            onChange={(r) => set({ recurrence: r, recurrenceDays: [], monthlyDay: null })}
          />

          {value.recurrence === 'weekly' && (
            <Field label="Días de la semana">
              <View style={styles.dayRow}>
                {WEEKDAY_ORDER.map((d) => {
                  const active = (value.recurrenceDays ?? []).includes(d);
                  return (
                    <Pressable
                      key={d}
                      style={[styles.day, !active && styles.dayOff]}
                      onPress={() => toggleDay(d)}>
                      <ThemedText
                        style={[styles.dayText, { color: active ? Colors.white : Colors.muted }]}>
                        {weekdayLabel(d).slice(0, 3)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
          )}

          {value.recurrence === 'monthly' && (
            <Field label="Día del mes">
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor={Colors.muted}
                selectionColor={Colors.tint}
                value={value.monthlyDay != null ? String(value.monthlyDay) : ''}
                onChangeText={(t) => {
                  const n = Number(t);
                  set({ monthlyDay: n >= 1 && n <= 31 ? n : null });
                }}
              />
            </Field>
          )}

          <DateField
            label="Empieza (desde)"
            value={value.startDate}
            onChange={(d) => set({ startDate: d })}
          />

          <View style={styles.switchRow}>
            <ThemedText style={{ color: Colors.text }}>Fecha de fin (opcional)</ThemedText>
            <Switch
              value={hasEndDate}
              onValueChange={(on) => {
                setHasEndDate(on);
                if (!on) set({ endDate: null });
              }}
              trackColor={{ true: Colors.tint, false: Colors.border }}
              thumbColor={Colors.white}
            />
          </View>
          {hasEndDate && (
            <DateField
              label="Hasta"
              value={value.endDate}
              hints={[7]}
              onChange={(d) => set({ endDate: d })}
            />
          )}
        </>
      ) : (
        <>
          <DateField
            label="Desde"
            value={value.startDate}
            onChange={(d) => set({ startDate: d })}
          />
          <View style={styles.switchRow}>
            <ThemedText style={{ color: Colors.text }}>Rango (hasta tal día)</ThemedText>
            <Switch
              value={hasEndDate}
              onValueChange={(on) => {
                setHasEndDate(on);
                if (!on) set({ endDate: null });
              }}
              trackColor={{ true: Colors.tint, false: Colors.border }}
              thumbColor={Colors.white}
            />
          </View>
          {hasEndDate && (
            <DateField
              label="Hasta"
              value={value.endDate}
              hints={[7]}
              onChange={(d) => set({ endDate: d })}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
  dayRow: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    aspectRatio: 1.4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.tint,
    backgroundColor: Colors.tint,
  },
  dayOff: { borderColor: Colors.border, backgroundColor: Colors.card },
  dayText: { fontSize: 12, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});