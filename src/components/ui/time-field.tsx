import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { addMinutesToTime, isValidTime, minutesToTime } from '@/lib/logic';

export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (t: string | null) => void;
}) {
  const [text, setText] = useState(value ?? '');

  function step(delta: number) {
    const base = text && isValidTime(text) ? text : value ?? minutesToTime(12 * 60);
    const next = addMinutesToTime(base, delta);
    setText(next);
    onChange(next);
  }

  const showError = text.length > 0 && !isValidTime(text);

  function commitDeleted() {
    if (text === '') {
      onChange(null);
      return;
    }
    if (!isValidTime(text)) {
      const cleaned = text.replace(/[^0-9]/g, '').padStart(4, '0');
      const t = `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
      setText(isValidTime(t) ? t : '');
      onChange(isValidTime(t) ? t : null);
    }
  }

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={[styles.row, { borderColor: showError ? Colors.danger : Colors.border }]}>
        <Pressable style={styles.btn} onPress={() => step(-15)}>
          <Ionicons name="remove" size={20} color={Colors.muted} />
        </Pressable>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="HH:MM"
          placeholderTextColor={Colors.muted}
          selectionColor={Colors.tint}
          value={text}
          onBlur={commitDeleted}
          onChangeText={(t) => {
            setText(t);
            if (isValidTime(t)) onChange(t);
          }}
        />
        <Pressable style={styles.btn} onPress={() => step(15)}>
          <Ionicons name="add" size={20} color={Colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, flex: 1 },
  label: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  btn: { padding: 14 },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 16,
    color: Colors.text,
  },
});