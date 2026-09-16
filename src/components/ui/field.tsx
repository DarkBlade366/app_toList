import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { PropsWithChildren, ReactNode } from 'react';

export function Field({
  label,
  hint,
  children,
}: PropsWithChildren<{ label: string; hint?: ReactNode }>) {
  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {hint ? <ThemedText style={styles.hint}>{hint}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  hint: { fontSize: 12, color: Colors.muted },
});