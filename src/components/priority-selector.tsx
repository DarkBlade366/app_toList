import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { Priority } from '@/lib/schema';

const LABELS: Record<Priority, string> = { low: 'Baja', medium: 'Media', high: 'Alta' };
const COLORS: Record<Priority, string> = { low: Colors.success, medium: Colors.warning, high: Colors.danger };

export function PrioritySelector({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  return (
    <View style={styles.row}>
      {(['low', 'medium', 'high'] as Priority[]).map((p) => {
        const active = value === p;
        return (
          <Pressable
            key={p}
            style={[
              styles.chip,
              { borderColor: active ? COLORS[p] : Colors.border },
              active && { backgroundColor: COLORS[p] },
            ]}
            onPress={() => onChange(p)}>
            <ThemedText style={[styles.text, { color: active ? Colors.white : Colors.muted }]}>
              {LABELS[p]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  text: { fontSize: 14, fontWeight: '700' },
});