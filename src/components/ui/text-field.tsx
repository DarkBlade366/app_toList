import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export function TextField({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View style={styles.wrap}>
      {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}
      <TextInput
        style={[styles.input, error != null && { borderColor: Colors.danger }]}
        placeholderTextColor={Colors.muted}
        selectionColor={Colors.tint}
        {...props}
      />
      {error != null ? (
        <ThemedText style={[styles.error, { color: Colors.danger }]}>{error}</ThemedText>
      ) : null}
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
  error: { fontSize: 12, color: Colors.danger },
});