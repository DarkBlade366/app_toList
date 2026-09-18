import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

const TINT_ALPHA = 'rgba(34, 211, 238, 0.28)';
const TINT_BG = 'rgba(34, 211, 238, 0.05)';

/**
 * Envuelve las sub-tareas de una tarea en un grupo visual claramente delimitado:
 * panel con borde, cabecera con contador y un pie que marca el final del bloque.
 * Se anida a cualquier profundidad (los niveles internos omiten la cabecera).
 */
export function SubtaskGroup({
  children,
  count,
  depth = 0,
}: PropsWithChildren<{ count?: number; depth?: number }>) {
  return (
    <View style={[styles.group, depth > 0 && styles.groupNested]}>
      {depth === 0 && (
        <View style={styles.head}>
          <Ionicons name="git-branch-outline" size={14} color={Colors.tint} />
          <ThemedText style={styles.headLabel}>Sub-tareas de esta tarea</ThemedText>
          {count != null ? (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{count}</ThemedText>
            </View>
          ) : null}
        </View>
      )}
      {children}
      <View style={styles.foot}>
        <View style={styles.footLine} />
        <Ionicons name="return-down-back" size={12} color={Colors.muted} />
        <ThemedText style={styles.footText}>Aquí termina</ThemedText>
        <View style={styles.footLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginLeft: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TINT_ALPHA,
    backgroundColor: TINT_BG,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  groupNested: {
    marginLeft: 6,
    paddingVertical: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  headLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.tint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badge: {
    minWidth: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: Colors.tint },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  footLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: TINT_ALPHA },
  footText: { fontSize: 10, color: Colors.muted, fontWeight: '700' },
});