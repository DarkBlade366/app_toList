import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrioritySelector } from '@/components/priority-selector';
import { ReminderFields } from '@/components/reminder-fields';
import { ThemedText } from '@/components/themed-text';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { TextField } from '@/components/ui/text-field';
import { TimeField } from '@/components/ui/time-field';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Priority, RemindType, Task, TaskStatus } from '@/lib/schema';
import { addDays, formatDateDMY, todayISO, weekdayLabel } from '@/lib/logic';

export type TaskType = 'general' | 'once' | 'range' | 'daily' | 'weekly' | 'monthly';

export interface TaskFormData {
  type: TaskType;
  title: string;
  notes: string;
  parentId: number | null;
  priority: Priority;
  recurrenceDays: number[];
  monthlyDay: number | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  remindType: RemindType;
  remindBeforeMinutes: number | null;
  remindAtStart: boolean;
}

export interface ParentCtx {
  id: number;
  title: string;
  startDate: string | null;
  endDate: string | null;
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TYPE_OPTIONS: {
  key: TaskType;
  label: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { key: 'general', label: 'Tarea general', description: 'Sin fecha obligatoria, puede tener una fecha límite.', icon: 'layers-outline' },
  { key: 'once', label: 'Un día', description: 'Para un día concreto, con margen de tiempo opcional.', icon: 'calendar' },
  { key: 'range', label: 'De tal día a tal día', description: 'Indicas el día de inicio y el día en que termina el periodo.', icon: 'calendar-outline' },
  { key: 'daily', label: 'Diaria', description: 'Se repite todos los días desde una fecha.', icon: 'sunny' },
  { key: 'weekly', label: 'Semanal', description: 'Se repite alguno de los días de la semana.', icon: 'repeat' },
  { key: 'monthly', label: 'Mensual', description: 'Se repite cada mes el mismo día.', icon: 'calendar-number' },
];

function typeFromTask(t: Task): TaskType {
  if (t.recurrence !== 'none') return t.recurrence;
  if (!t.startDate && !t.endDate) return 'general';
  if (!t.endDate || t.endDate === t.startDate) return 'once';
  return 'range';
}

function defaultType(parent: ParentCtx | null): TaskType {
  return parent ? 'once' : 'general';
}

export function initialTaskFormData(
  initial?: Task | null,
  parent?: ParentCtx | null,
  presetDate?: string | null,
  presetType?: TaskType | null,
  defaults?: { remindType: RemindType; remindBeforeMinutes: number; remindAtStart: boolean }
): TaskFormData {
  return {
    type: initial
      ? typeFromTask(initial)
      : presetType ?? (presetDate ? 'once' : defaultType(parent ?? null)),
    title: initial?.title ?? '',
    notes: initial?.notes ?? '',
    parentId: initial?.parentId ?? parent?.id ?? null,
    priority: initial?.priority ?? 'medium',
    recurrenceDays: initial?.recurrenceDays ?? [],
    monthlyDay: initial?.monthlyDay ?? null,
    startDate: initial?.startDate ?? presetDate ?? null,
    endDate: initial?.endDate ?? null,
    startTime: initial?.startTime ?? null,
    endTime: initial?.endTime ?? null,
    remindType: initial?.remindType ?? defaults?.remindType ?? 'none',
    remindBeforeMinutes: initial?.remindBeforeMinutes ?? defaults?.remindBeforeMinutes ?? 15,
    remindAtStart: initial?.remindAtStart ?? defaults?.remindAtStart ?? false,
  };
}

export function TaskForm({
  initial,
  initialStatus = 'pending',
  parent,
  presetDate,
  presetType,
  initialStep = 0,
  onSubmit,
  defaults,
}: {
  initial?: Task | null;
  initialStatus?: TaskStatus;
  parent?: ParentCtx | null;
  presetDate?: string | null;
  presetType?: TaskType | null;
  initialStep?: number;
  onSubmit: (data: db.TaskWrite) => Promise<boolean>;
  defaults?: { remindType: RemindType; remindBeforeMinutes: number; remindAtStart: boolean };
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<TaskFormData>(() =>
    initialTaskFormData(initial, parent, presetDate, presetType, defaults)
  );
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), 2));
  const [error, setError] = useState<string | null>(null);

  const isChild = parent != null;
  const options = isChild
    ? TYPE_OPTIONS.filter((o) => o.key !== 'general')
    : TYPE_OPTIONS;

  function set(patch: Partial<TaskFormData>) {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  }

  function switchType(t: TaskType) {
    if (t === form.type) return;
    setForm((f) => ({
      ...f,
      type: t,
      recurrenceDays: [],
      monthlyDay: null,
      startDate: null,
      endDate: null,
      startTime: null,
      endTime: null,
    }));
    setError(null);
  }

  const wantsEndDate =
    form.type === 'range' || (form.type !== 'general' && form.type !== 'once' && form.endDate != null);

  function validateSchedule(): string | null {
    if (form.type === 'range') {
      if (!form.startDate || !form.endDate) return 'Indica desde y hasta qué día.';
      if (form.endDate < form.startDate) return 'El día final debe ser igual o posterior al inicio.';
    } else if (form.type === 'once') {
      if (!form.startDate) return 'Elige el día.';
    } else if (form.type === 'weekly') {
      if (form.recurrenceDays.length === 0) return 'Elige al menos un día de la semana.';
      if (!form.startDate) return 'Indica desde qué fecha empieza.';
    } else if (form.type === 'monthly') {
      if (form.monthlyDay == null || form.monthlyDay < 1 || form.monthlyDay > 31) {
        return 'El día del mes debe estar entre 1 y 31.';
      }
      if (!form.startDate) return 'Indica desde qué fecha empieza.';
    } else if (form.type === 'daily') {
      if (!form.startDate) return 'Indica desde qué fecha empieza.';
    }
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      return 'El día final debe ser igual o posterior al inicio.';
    }
    if (form.startTime && form.endTime && form.endTime < form.startTime) {
      return 'La hora de fin no puede ser anterior a la de inicio.';
    }
    if (isChild) {
      const effectiveEnd = form.type === 'once' ? form.startDate : form.endDate;
      if (parent && parent.endDate && effectiveEnd && effectiveEnd > parent.endDate) {
        return `No puede terminar después de la tarea de origen (hasta ${formatDateDMY(parent.endDate)}).`;
      }
      if (parent && parent.startDate && form.startDate && form.startDate < parent.startDate) {
        return `No puede empezar antes que la tarea de origen (desde ${formatDateDMY(parent.startDate)}).`;
      }
    }
    return null;
  }

  function validateDetails(): string | null {
    if (!form.title.trim()) return 'Escribe un título.';
    return null;
  }

  function toWrite(): db.TaskWrite {
    return {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      parentId: form.parentId,
      recurrence: form.type === 'daily' ? 'daily' : form.type === 'weekly' ? 'weekly' : form.type === 'monthly' ? 'monthly' : 'none',
      recurrenceDays: form.type === 'weekly' ? form.recurrenceDays : null,
      monthlyDay: form.type === 'monthly' ? form.monthlyDay : null,
      startDate: form.type === 'general' ? null : form.startDate,
      endDate: form.type === 'once' ? form.startDate : form.endDate,
      startTime: form.type === 'general' ? null : form.startTime,
      endTime: form.type === 'general' ? null : form.endTime,
      priority: form.priority,
      status: initialStatus,
      remindType: form.remindType,
      remindBeforeMinutes: form.remindBeforeMinutes,
      remindAtStart: form.remindAtStart,
    };
  }

  async function handleNext() {
    if (step === 0) {
      setStep(1);
      setError(null);
      return;
    }
    if (step === 1) {
      const err = validateSchedule();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
      setError(null);
      return;
    }
    const err = validateDetails();
    if (err) {
      setError(err);
      return;
    }
    await onSubmit(toWrite());
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      keyboardShouldPersistTaps="handled">
      <View style={styles.wrap}>
        {isChild && parent ? (
          <View style={styles.parentBanner}>
            <Ionicons name="git-merge-outline" size={16} color={Colors.tint} />
            <ThemedText style={styles.parentBannerText}>
              Esta tarea se añade dentro de «{parent.title}». Una tarea general nunca puede formar parte de otra.
            </ThemedText>
          </View>
        ) : null}

        {step === 0 && (
          <View style={styles.step}>
            <StepTitle title="Tipo de tarea" subtitle="Elige qué tipo quieres crear." />
            <View style={styles.typeList}>
              {options.map((opt) => {
                const active = form.type === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.typeCard, active && { borderColor: Colors.tint }]}
                    onPress={() => switchType(opt.key)}>
                    <Ionicons
                      name={opt.icon}
                      size={22}
                      color={active ? Colors.tint : Colors.muted}
                    />
                    <View style={styles.typeText}>
                      <ThemedText style={[styles.typeLabel, active && { color: Colors.tint }]}>
                        {opt.label}
                      </ThemedText>
                      <ThemedText style={styles.typeDesc}>{opt.description}</ThemedText>
                    </View>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? Colors.tint : Colors.muted}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 1 && <ScheduleStep form={form} parent={parent} set={set} wantsEndDate={wantsEndDate} />}

        {step === 2 && (
          <View style={styles.step}>
            <StepTitle title="Detalles" subtitle="Casi listo." allowBack={step > 0} onBack={() => setStep(1)} />
            <TextField
              label="Título"
              placeholder={form.type === 'general' ? 'Ej.: Estudiar la certificación' : '¿Qué tienes que hacer?'}
              value={form.title}
              onChangeText={(v) => set({ title: v })}
            />
            <TextField
              label="Notas (opcional)"
              placeholder="Detalles, enlaces..."
              value={form.notes}
              onChangeText={(v) => set({ notes: v })}
              multiline
              numberOfLines={3}
              style={styles.notes}
            />
            <Field label="Prioridad">
              <PrioritySelector value={form.priority} onChange={(p) => set({ priority: p })} />
            </Field>
            <ReminderFields
              type={form.remindType}
              beforeMinutes={form.remindBeforeMinutes}
              atStart={form.remindAtStart}
              hasDeadline={form.endTime != null}
              onChange={(patch) => set(patch)}
            />
          </View>
        )}

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => { setStep(step - 1); setError(null); }}>
              <Ionicons name="arrow-back" size={18} color={Colors.muted} />
              <ThemedText style={{ color: Colors.muted, fontWeight: '700' }}>Atrás</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.btn} />
          )}
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleNext}>
            <ThemedText style={styles.btnPrimaryText}>
              {step === 2 ? 'Guardar tarea' : 'Siguiente'}
            </ThemedText>
            <Ionicons name={step === 2 ? 'checkmark' : 'arrow-forward'} size={18} color={Colors.white} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function StepTitle({
  title,
  subtitle,
  allowBack,
  onBack,
}: {
  title: string;
  subtitle?: string;
  allowBack?: boolean;
  onBack?: () => void;
}) {
  return (
    <View style={styles.stepHead}>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.stepTitle}>{title}</ThemedText>
        {subtitle ? <ThemedText style={styles.stepSubtitle}>{subtitle}</ThemedText> : null}
      </View>
    </View>
  );
}

function ScheduleStep({
  form,
  parent,
  set,
  wantsEndDate,
}: {
  form: TaskFormData;
  parent?: ParentCtx | null;
  set: (patch: Partial<TaskFormData>) => void;
  wantsEndDate: boolean;
}) {
  return (
    <View style={styles.step}>
      <StepTitle title="Cuándo" subtitle="Define las fechas y el margen de tiempo." allowBack />

      {form.type === 'general' ? (
        <Field label="Fecha límite (opcional) / sin fecha límite">
          <ToggleSet
            on={form.endDate != null}
            onLabel="Con fecha límite"
            offLabel="Sin fecha límite"
            onEnable={() => set({ endDate: todayISO() })}
            onDisable={() => set({ endDate: null })}
          />
          {form.endDate != null ? (
            <DateField label="" value={form.endDate} onChange={(d) => set({ endDate: d })} hints={[0, 1, 7]} />
          ) : null}
        </Field>
      ) : null}

      {form.type === 'once' ? (
        <DateField label="Día" value={form.startDate} onChange={(d) => set({ startDate: d })} hints={[0, 1, 7]} />
      ) : null}

      {form.type === 'range' ? (
        <>
          <DateField label="Desde" value={form.startDate} onChange={(d) => set({ startDate: d })} hints={[0, 1, 7]} />
          <DateField label="Hasta" value={form.endDate} onChange={(d) => set({ endDate: d })} hints={[1, 7, 30]} />
        </>
      ) : null}

      {form.type === 'daily' ? (
        <>
          <DateField label="Empieza (desde)" value={form.startDate} onChange={(d) => set({ startDate: d })} hints={[0, 1, 7]} />
          <ToggleSet
            on={form.endDate != null}
            onLabel="Con fecha de fin"
            offLabel="Se repite indefinidamente"
            onEnable={() => set({ endDate: addDays(startOf(form), 30) })}
            onDisable={() => set({ endDate: null })}
          />
          {form.endDate != null ? (
            <DateField label="Hasta" value={form.endDate} onChange={(d) => set({ endDate: d })} hints={[7, 30]} />
          ) : null}
        </>
      ) : null}

      {form.type === 'weekly' ? (
        <>
          <Field label="Días de la semana">
            <View style={styles.dayRow}>
              {WEEKDAY_ORDER.map((d) => {
                const active = form.recurrenceDays.includes(d);
                return (
                  <Pressable
                    key={d}
                    style={[styles.day, !active && styles.dayOff]}
                    onPress={() =>
                      set({
                        recurrenceDays: active
                          ? form.recurrenceDays.filter((x) => x !== d)
                          : [...form.recurrenceDays, d],
                      })
                    }>
                    <ThemedText style={[styles.dayText, { color: active ? Colors.white : Colors.muted }]}>
                      {weekdayLabel(d).slice(0, 3)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Field>
          <DateField label="Empieza (desde)" value={form.startDate} onChange={(d) => set({ startDate: d })} hints={[0, 1, 7]} />
          <ToggleSet
            on={form.endDate != null}
            onLabel="Con fecha de fin"
            offLabel="Se repite indefinidamente"
            onEnable={() => set({ endDate: addDays(startOf(form), 90) })}
            onDisable={() => set({ endDate: null })}
          />
          {form.endDate != null ? (
            <DateField label="Hasta" value={form.endDate} onChange={(d) => set({ endDate: d })} hints={[7, 30]} />
          ) : null}
        </>
      ) : null}

      {form.type === 'monthly' ? (
        <>
          <Field label="Día del mes">
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="15"
              placeholderTextColor={Colors.muted}
              selectionColor={Colors.tint}
              value={form.monthlyDay != null ? String(form.monthlyDay) : ''}
              onChangeText={(t) => {
                const n = Number(t);
                set({ monthlyDay: n >= 1 && n <= 31 ? n : null });
              }}
            />
          </Field>
          <DateField label="Empieza (desde)" value={form.startDate} onChange={(d) => set({ startDate: d })} hints={[0, 1, 7]} />
          <ToggleSet
            on={form.endDate != null}
            onLabel="Con fecha de fin"
            offLabel="Se repite indefinidamente"
            onEnable={() => set({ endDate: addDays(startOf(form), 365) })}
            onDisable={() => set({ endDate: null })}
          />
          {form.endDate != null ? (
            <DateField label="Hasta" value={form.endDate} onChange={(d) => set({ endDate: d })} hints={[7, 30]} />
          ) : null}
        </>
      ) : null}

      {form.type !== 'general' && (
        <Field
          label="Horario / margen de tiempo (opcional)"
          hint="Define cuándo empieza y hasta cuándo hay tiempo ('antes de las 4pm').">
          <View style={styles.timeRow}>
            <TimeField label="" value={form.startTime} onChange={(t) => set({ startTime: t })} />
            <TimeField label="" value={form.endTime} onChange={(t) => set({ endTime: t })} />
          </View>
        </Field>
      )}
    </View>
  );
}

function ToggleSet({
  on,
  onLabel,
  offLabel,
  onEnable,
  onDisable,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onEnable: () => void;
  onDisable: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Pressable style={[styles.toggle, on && styles.toggleOn]} onPress={onEnable}>
        <ThemedText style={[styles.toggleText, on && { color: Colors.tint }]}>{onLabel}</ThemedText>
      </Pressable>
      <Pressable style={[styles.toggle, !on && styles.toggleOn]} onPress={onDisable}>
        <ThemedText style={[styles.toggleText, !on && { color: Colors.tint }]}>{offLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

function startOf(form: TaskFormData): string {
  return form.startDate ?? todayISO();
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 18 },
  notes: { minHeight: 84, textAlignVertical: 'top' },
  parentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.tint,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
  },
  parentBannerText: { flex: 1, color: Colors.text, fontSize: 13, lineHeight: 18 },
  step: { gap: 16 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  stepSubtitle: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  typeList: { gap: 10 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  typeText: { flex: 1, gap: 2 },
  typeLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  typeDesc: { fontSize: 12, color: Colors.muted, lineHeight: 16 },
  error: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnGhost: { backgroundColor: Colors.surface },
  btnPrimary: { backgroundColor: Colors.tint, borderColor: Colors.tint },
  btnPrimaryText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
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
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
  timeRow: { flexDirection: 'row', gap: 12 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  toggleOn: { borderColor: Colors.tint },
  toggleText: { fontSize: 13, fontWeight: '700', color: Colors.muted },
});