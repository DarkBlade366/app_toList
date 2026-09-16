import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Field } from '@/components/ui/field';
import { Colors } from '@/constants/theme';
import { RemindType } from '@/lib/schema';

const OPTIONS: { key: RemindType; label: string; color: string }[] = [
  { key: 'alarm', label: 'Alarma', color: Colors.alarm },
  { key: 'notification', label: 'Notificación', color: Colors.tint },
  { key: 'none', label: 'Ninguna', color: Colors.muted },
];

export function ReminderFields({
  type,
  beforeMinutes,
  atStart,
  hasDeadline,
  onChange,
}: {
  type: RemindType;
  beforeMinutes: number | null;
  atStart: boolean;
  hasDeadline: boolean;
  onChange: (patch: {
    remindType?: RemindType;
    remindBeforeMinutes?: number | null;
    remindAtStart?: boolean;
  }) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Field label="Recordatorio">
        <View style={styles.row}>
          {OPTIONS.map((opt) => {
            const active = type === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.chip,
                  { borderColor: active ? opt.color : Colors.border },
                  active && { backgroundColor: opt.color },
                ]}
                onPress={() => onChange({ remindType: opt.key })}>
                <ThemedText style={[styles.text, { color: active ? Colors.white : Colors.muted }]}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {type !== 'none' && hasDeadline && (
        <Field label="Avisar antes del fin (minutos)" hint="Ej.: 15 avisa 15 min antes de que se venza el tiempo.">
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="15"
            placeholderTextColor={Colors.muted}
            selectionColor={Colors.tint}
            value={beforeMinutes != null ? String(beforeMinutes) : ''}
            onChangeText={(t) => {
              const n = Number(t);
              onChange({ remindBeforeMinutes: Number.isFinite(n) && n > 0 ? n : null });
            }}
          />
        </Field>
      )}

      {type !== 'none' && (
        <View style={styles.switchRow}>
          <ThemedText style={{ color: Colors.text }}>Avisar cuando empiece</ThemedText>
          <Switch
            value={atStart}
            onValueChange={(v) => onChange({ remindAtStart: v })}
            trackColor={{ true: Colors.tint, false: Colors.border }}
            thumbColor={Colors.white}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  text: { fontSize: 13, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});