import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { TextField } from '@/components/ui/text-field';
import { Colors } from '@/constants/theme';

const PALETTE = ['#22D3EE', '#34D399', '#A78BFA', '#FBBF24', '#FB7185', '#38BDF8', '#F472B6', '#94A3B8'];

export interface ObjectiveFormData {
  title: string;
  description: string;
  color: string;
  startDate: string | null;
  dueDate: string | null;
}

export function initialObjectiveFormData(initial?: {
  title?: string;
  description?: string | null;
  color?: string;
  startDate?: string | null;
  dueDate?: string | null;
}): ObjectiveFormData {
  return {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    color: initial?.color ?? PALETTE[0],
    startDate: initial?.startDate ?? null,
    dueDate: initial?.dueDate ?? null,
  };
}

export function ObjectiveForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: { title?: string; description?: string | null; color?: string; startDate?: string | null; dueDate?: string | null };
  submitLabel: string;
  onSubmit: (data: ObjectiveFormData) => boolean | Promise<boolean>;
}) {
  const [form, setForm] = useState(initialObjectiveFormData(initial));
  const [error, setError] = useState<string | null>(null);

  function set(patch: Partial<ObjectiveFormData>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      setError('Escribe un título');
      return;
    }
    setError(null);
    const ok = await onSubmit(form);
    if (ok) setForm(initialObjectiveFormData());
  }

  return (
    <View style={styles.wrap}>
      <TextField
        label="Título del objetivo"
        placeholder="Ej.: Terminar la carrera 🏁"
        value={form.title}
        onChangeText={(v) => {
          setError(null);
          set({ title: v });
        }}
        error={error}
      />
      <TextField
        label="Descripción (opcional)"
        placeholder="Qué quieres conseguir y por qué..."
        value={form.description}
        onChangeText={(v) => set({ description: v })}
        multiline
        numberOfLines={3}
        style={styles.notes}
      />
      <Field label="Color">
        <View style={styles.colors}>
          {PALETTE.map((c) => {
            const active = form.color === c;
            return (
              <Pressable
                key={c}
                onPress={() => set({ color: c })}
                style={[styles.colorDot, { backgroundColor: c }, active && styles.colorActive]}>
                {active ? <ThemedText style={styles.check}>✓</ThemedText> : null}
              </Pressable>
            );
          })}
        </View>
      </Field>
      <DateField label="Empieza (opcional)" value={form.startDate} onChange={(d) => set({ startDate: d })} hints={[0, 1, 7]} />
      <DateField label="Fecha límite (opcional)" value={form.dueDate} onChange={(d) => set({ dueDate: d })} hints={[7, 30]} />

      <Pressable style={[styles.submit, { backgroundColor: form.color }]} onPress={handleSubmit}>
        <ThemedText style={styles.submitText}>{submitLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  notes: { minHeight: 84, textAlignVertical: 'top' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorActive: { borderWidth: 3, borderColor: Colors.white },
  check: { color: Colors.white, fontWeight: '900', fontSize: 18 },
  submit: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
});