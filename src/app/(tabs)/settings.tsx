import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { TimeField } from '@/components/ui/time-field';
import { Colors } from '@/constants/theme';
import * as db from '@/lib/db';
import {
  hasNotificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  syncNotifications,
} from '@/lib/notifications';
import { RemindType, Settings } from '@/lib/schema';

const REMIND_OPTIONS: { key: RemindType; label: string; color: string }[] = [
  { key: 'alarm', label: 'Alarma', color: Colors.alarm },
  { key: 'notification', label: 'Notificación', color: Colors.tint },
  { key: 'none', label: 'Ninguna', color: Colors.muted },
];

function Row({
  label,
  hint,
  icon,
  value,
  onToggle,
  children,
}: {
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  value?: boolean;
  onToggle?: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        {hint ? <ThemedText style={styles.rowHint}>{hint}</ThemedText> : null}
      </View>
      {children ??
        (onToggle ? (
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ true: Colors.tint, false: Colors.border }}
            thumbColor={Colors.white}
          />
        ) : icon ? (
          <Ionicons name={icon} size={20} color={Colors.muted} />
        ) : null)}
    </View>
  );
}

export default function SettingsScreen() {
  const sqlite = useSQLiteContext();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied'>('denied');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const s = await db.getSettings(sqlite);
        const granted = await hasNotificationPermission();
        if (!active) return;
        setSettings(s);
        setPermission(granted ? 'granted' : 'denied');
      })();
      return () => {
        active = false;
      };
    }, [sqlite])
  );

  if (!settings) return <Screen scroll />;

  function patch(p: Partial<Settings>) {
    const next = { ...settings, ...p } as Settings;
    setSettings(next);
    void db.saveSettings(sqlite, next);
    void syncNotifications(sqlite);
  }

  async function onAskPermission() {
    await requestNotificationPermission();
    setPermission((await hasNotificationPermission()) ? 'granted' : 'denied');
    await syncNotifications(sqlite);
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Ajustes" subtitle="Notificaciones y preferencias" />

      <Card>
        {!notificationsSupported() && (
          <Field label="Disponibilidad">
            <View style={styles.permissionRow}>
              <Ionicons name="construct" size={20} color={Colors.warning} />
              <ThemedText style={styles.permissionText}>
                Estás en Expo Go (Android), donde las notificaciones no están disponibles. Al
                instalar la versión final (APK) se activarán solas.
              </ThemedText>
            </View>
          </Field>
        )}

        <Field label="Recordatorios y alarmas">
          <Row
            label="Avisos activados"
            hint="Programa avisos de las tareas (al inicio y antes del fin)."
            value={settings.remindersEnabled}
            onToggle={(v) => patch({ remindersEnabled: v })}
          />
        </Field>

        <Field label="Permiso de notificaciones">
          <View style={styles.permissionRow}>
            <Ionicons
              name={permission === 'granted' ? 'checkmark-circle' : 'warning'}
              size={20}
              color={permission === 'granted' ? Colors.success : Colors.warning}
            />
            <ThemedText style={styles.permissionText}>
              {permission === 'granted' ? 'Permiso concedido' : 'Permiso denegado u omitido'}
            </ThemedText>
            {permission !== 'granted' && (
              <Pressable style={styles.smallBtn} onPress={onAskPermission}>
                <ThemedText style={styles.smallBtnText}>Solicitar</ThemedText>
              </Pressable>
            )}
          </View>
        </Field>

        <Row
          label="Alarmas por encima del silencio"
          hint="Las tareas con 'Alarma' intentan sonar aunque el teléfono esté en silencio o No molestar (según fabricante)."
          icon="notifications-off-outline"
        />
      </Card>

      <Card>
        <Field label="Recordatorio por defecto">
          <View style={styles.chips}>
            {REMIND_OPTIONS.map((opt) => {
              const active = settings.defaultRemindType === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.chip,
                    { borderColor: active ? opt.color : Colors.border },
                    active && { backgroundColor: opt.color },
                  ]}
                  onPress={() => patch({ defaultRemindType: opt.key })}>
                  <ThemedText
                    style={[styles.chipText, { color: active ? Colors.white : Colors.muted }]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Minutos de margen antes del fin" hint="Cuánto antes avisar; se puede cambiar en cada tarea.">
          <View style={styles.inline}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="15"
              placeholderTextColor={Colors.muted}
              selectionColor={Colors.tint}
              value={String(settings.defaultRemindBeforeMinutes)}
              onChangeText={(t) => {
                const n = Number(t);
                if (Number.isFinite(n) && n >= 0) {
                  patch({ defaultRemindBeforeMinutes: Math.round(n) });
                }
              }}
            />
            <ThemedText style={styles.minText}>min</ThemedText>
          </View>
        </Field>

        <Row
          label="Avisar al empezar por defecto"
          hint="Las tareas nuevas avisarán cuando empiece su horario."
          value={settings.remindAtStartDefault}
          onToggle={(v) => patch({ remindAtStartDefault: v })}
        />
      </Card>

      <Card>
        <Field label="Resumen diario">
          <Row
            label="Resumen de cada mañana"
            hint="Un aviso con las tareas pendientes del día."
            value={settings.dailySummaryEnabled}
            onToggle={(v) => patch({ dailySummaryEnabled: v })}
          />
        </Field>

        {settings.dailySummaryEnabled && (
          <Field label="Hora del resumen">
            <TimeField
              label=""
              value={settings.dailySummaryTime}
              onChange={(t) => {
                if (t) patch({ dailySummaryTime: t });
              }}
            />
          </Field>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowHint: { fontSize: 12, color: Colors.muted, lineHeight: 16 },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  permissionText: { flex: 1, fontSize: 14, color: Colors.text },
  smallBtn: {
    borderWidth: 1,
    borderColor: Colors.tint,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  smallBtnText: { color: Colors.tint, fontWeight: '700', fontSize: 13 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
  },
  minText: { color: Colors.muted, fontWeight: '600' },
});