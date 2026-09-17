import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import * as db from '@/lib/db';
import {
  addNotificationResponseListener,
  hasNotificationPermission,
  requestNotificationPermission,
  syncNotifications,
} from '@/lib/notifications';

/**
 * Se monta una vez dentro del proveedor de BD: pide permisos si hace falta,
 * sincroniza los avisos programados, los resincroniza al volver a la app y
 * abre la tarea al pulsar una notificación.
 */
export function NotificationsManager() {
  const sqlite = useSQLiteContext();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await db.getSettings(sqlite);
        if (!cancelled && settings.remindersEnabled && !(await hasNotificationPermission())) {
          await requestNotificationPermission();
        }
        await syncNotifications(sqlite);
      } catch (e) {
        console.warn('Inicialización de notificaciones falló:', e);
      }
    })();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNotifications(sqlite);
    });

    let response: { remove: () => void } | undefined;
    addNotificationResponseListener((url) => {
      router.push(url as Href);
    }).then((sub) => {
      response = sub;
    });

    return () => {
      cancelled = true;
      appState.remove();
      response?.remove();
    };
  }, [sqlite, router]);

  return null;
}