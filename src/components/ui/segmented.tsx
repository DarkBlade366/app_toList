import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  color?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = value === opt.key;
        const accent = opt.color ?? Colors.tint;
        return (
          <Pressable
            key={opt.key}
            style={[
              styles.segment,
              { borderColor: active ? accent : Colors.border },
              active && { backgroundColor: accent },
            ]}
            onPress={() => onChange(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}>
            <ThemedText
              style={[styles.label, { color: active ? Colors.white : Colors.muted }]}>
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  label: { fontWeight: '700', fontSize: 14 },
});