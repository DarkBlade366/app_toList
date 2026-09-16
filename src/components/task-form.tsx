import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ObjectivePicker } from '@/components/objective-picker';
import { ParentPicker } from '@/components/parent-picker';
import { PrioritySelector } from '@/components/priority-selector';
import { RecurrenceFields, RecurrenceValue } from '@/components/recurrence-fields';
import { ReminderFields } from '@/components/reminder-fields';
import { Field } from '@/components/ui/field';
import { TextField } from '@/components/ui/text-field';
import { TimeField } from '@/components/ui/time-field';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Priority, RemindType, Task } from '@/lib/schema';
import { todayISO } from '@/lib/logic';

export interface TaskFormData {
  title: string;
  notes: string;
  parentId: number | null;
  objectiveId: number | null;
  priority: Priority;
  recurrence: RecurrenceValue;
  startTime: string | null;
  endTime: string | null;
  remindType: RemindType;
  remindBeforeMinutes: number | null;
  remindAtStart: boolean;
}

export function initialTaskFormData(initial?: Task | null): TaskFormData {
  return {
    title: initial?.title ?? '',
    notes: initial?.notes ?? '',
    parentId: initial?.parentId ?? null,
    objectiveId: initial?.objectiveId ?? null,
    priority: initial?.priority ?? 'medium',
    recurrence: {
      recurrence: initial?.recurrence ?? 'none',
      recurrenceDays: initial?.recurrenceDays ?? [],
      monthlyDay: initial?.monthlyDay ?? null,
      startDate: initial?.startDate ?? todayISO(),
      endDate: initial?.endDate ?? null,
    },
    startTime: initial?.startTime ?? null,
    endTime: initial?.endTime ?? null,
    remindType: initial?.remindType ?? 'none',
    remindBeforeMinutes: initial?.remindBeforeMinutes ?? 15,
    remindAtStart: initial?.remindAtStart ?? false,
  };
}

export function TaskForm({
  initial,
  excludeTaskId,
  onSubmit,
}: {
  initial?: Task | null;
  excludeTaskId?: number | null;
  onSubmit: (data: db.TaskWrite) => Promise<boolean>;
}) {
  const [form, setForm] = useState<TaskFormData>(() => initialTaskFormData(initial));
  const [titleError, setTitleError] = useState<string | null>(null);

  function set(patch: Partial<TaskFormData>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function validate(): boolean {
    if (!form.title.trim()) {
      setTitleError('Escribe un título');
      return false;
    }
    if (form.recurrence.recurrence !== 'none' && !form.recurrence.startDate) {
      setTitleError(null);
      return false;
    }
    setTitleError(null);
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return false;
    const r = form.recurrence;
    const ok = await onSubmit({
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      parentId: form.parentId,
      objectiveId: form.objectiveId,
      recurrence: r.recurrence,
      recurrenceDays: r.recurrence === 'weekly' ? r.recurrenceDays : null,
      monthlyDay: r.recurrence === 'monthly' ? r.monthlyDay : null,
      startDate: r.startDate,
      endDate: r.endDate,
      startTime: form.startTime,
      endTime: form.endTime,
      priority: form.priority,
      status: 'pending',
      remindType: form.remindType,
      remindBeforeMinutes: form.remindBeforeMinutes,
      remindAtStart: form.remindAtStart,
    });
    return ok;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.wrap}>
        <TextField
          label="Título"
          placeholder="Ej.: Comprar el super"
          value={form.title}
          onChangeText={(v) => {
            setTitleError(null);
            set({ title: v });
          }}
          error={titleError}
        />

        <TextField
          label="Notas (opcional)"
          placeholder="Detalles, enlaces, recordatorios..."
          value={form.notes}
          onChangeText={(v) => set({ notes: v })}
          multiline
          numberOfLines={3}
          style={styles.notes}
        />

        <ParentPicker value={form.parentId} excludeId={excludeTaskId} onChange={(id) => set({ parentId: id })} />
        <ObjectivePicker value={form.objectiveId} onChange={(id) => set({ objectiveId: id })} />

        <Field label="Prioridad">
          <PrioritySelector value={form.priority} onChange={(p) => set({ priority: p })} />
        </Field>

        <RecurrenceFields value={form.recurrence} onChange={(r) => set({ recurrence: r })} />

        <Field label="Horario / margen de tiempo (opcional)" hint="Define cuándo empieza y hasta cuándo hay tiempo ('antes de las 4pm').">
          <View style={styles.timeRow}>
            <TimeField
              label=""
              value={form.startTime}
              onChange={(t) => set({ startTime: t })}
            />
            <TimeField
              label=""
              value={form.endTime}
              onChange={(t) => set({ endTime: t })}
            />
          </View>
        </Field>

        <ReminderFields
          type={form.remindType}
          beforeMinutes={form.remindBeforeMinutes}
          atStart={form.remindAtStart}
          hasDeadline={form.endTime != null}
          onChange={(patch) => set(patch)}
        />

        <Pressable style={[styles.submit, { backgroundColor: Colors.tint }]} onPress={handleSubmit}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
          <ThemedText style={styles.submitText}>Guardar tarea</ThemedText>
        </Pressable>

        <View style={{ height: 16 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 18 },
  notes: { minHeight: 84, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 12 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  submitText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
});