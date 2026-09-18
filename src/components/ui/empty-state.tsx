import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export function EmptyState({
  icon = 'checkmark-done-outline',
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={34} color={Colors.tint} />
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {hint ? <ThemedText style={styles.hint}>{hint}</ThemedText> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.action} onPress={onAction}>
          <Ionicons name="add" size={18} color={Colors.white} />
          <ThemedText style={styles.actionText}>{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, paddingVertical: 26, paddingHorizontal: 12 },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  hint: { fontSize: 12, color: Colors.muted, textAlign: 'center', lineHeight: 17 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.tint,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  actionText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});