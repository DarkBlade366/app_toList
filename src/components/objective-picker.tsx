import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Field } from '@/components/ui/field';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import { Objective } from '@/lib/schema';

export function ObjectivePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const sqlite = useSQLiteContext();
  const [objectives, setObjectives] = useState<Objective[]>([]);

  useFocusEffect(
    useCallback(() => {
      db.getObjectives(sqlite).then(setObjectives);
    }, [sqlite])
  );

  if (objectives.length === 0) return null;

  return (
    <Field label="Objetivo (opcional)">
      <View style={styles.chips}>
        <Pressable
          style={[styles.chip, value == null && styles.active]}
          onPress={() => onChange(null)}>
          <ThemedText style={[styles.text, value == null && { color: Colors.white }]}>Sin objetivo</ThemedText>
        </Pressable>
        {objectives.map((o) => {
          const active = value === o.id;
          return (
            <Pressable
              key={o.id}
              style={[styles.chip, active && { borderColor: o.color, backgroundColor: o.color }]}
              onPress={() => onChange(active ? null : o.id)}>
              <ThemedText style={[styles.text, active && { color: Colors.white }]}>{o.title}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  active: { borderColor: Colors.tint, backgroundColor: Colors.tint },
  text: { fontSize: 13, fontWeight: '600', color: Colors.muted },
});