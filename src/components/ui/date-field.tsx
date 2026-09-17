import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { addDays, formatDateDMY, parseDateDMY, todayISO } from '@/lib/logic';

/** Inserta las barras de DD/MM/AAAA a partir de solo dígitos (no se pueden borrar). */
function maskDate(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '/' + d.slice(2, 4);
  if (d.length > 4) out += '/' + d.slice(4);
  return out;
}

export function DateField({
  label,
  value,
  onChange,
  hints = [0, 1, 7],
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  hints?: number[];
}) {
  const [text, setText] = useState(value ? formatDateDMY(value) : '');

  function pick(iso: string | null) {
    onChange(iso);
    setText(iso ? formatDateDMY(iso) : '');
  }

  function handleChange(raw: string) {
    const masked = maskDate(raw);
    setText(masked);
    const iso = parseDateDMY(masked);
    onChange(iso ?? null);
  }

  const chipLabels = (d: number) =>
    d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d === 7 ? '+7 días' : `+${d} días`;

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        placeholder="DD/MM/AAAA"
        placeholderTextColor={Colors.muted}
        selectionColor={Colors.tint}
        value={text}
        onChangeText={handleChange}
      />
      <View style={styles.chips}>
        {hints.map((d) => {
          const target = addDays(todayISO(), d);
          const active = value === target;
          return (
            <Pressable
              key={d}
              style={[styles.chip, active && { borderColor: Colors.tint }]}
              onPress={() => pick(target)}>
              <ThemedText style={[styles.chipText, active && { color: Colors.tint }]}>
                {chipLabels(d)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
});