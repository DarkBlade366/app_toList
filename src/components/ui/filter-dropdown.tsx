import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export interface FilterOption<T extends string> {
  key: T;
  label: string;
}

export function FilterDropdown<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.bar} onPress={() => setOpen((o) => !o)}>
        <ThemedText style={styles.barText}>{current.label}</ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
      </Pressable>
      {open && (
        <View style={styles.drop}>
          {options.map((opt, i) => {
            const active = opt.key === value;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.opt,
                  i < options.length - 1 && styles.optBorder,
                  active && styles.optActive,
                ]}
                onPress={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={active ? Colors.tint : Colors.muted}
                />
                <ThemedText
                  style={[
                    styles.optText,
                    active && { color: Colors.tint, fontWeight: '800' },
                  ]}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  barText: { fontSize: 15, fontWeight: '700', color: Colors.tint },
  drop: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  optActive: { backgroundColor: Colors.surface },
  optText: { fontSize: 14, color: Colors.text },
});