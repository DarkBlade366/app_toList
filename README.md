# Metas Claras

Aplicación móvil para gestionar las tareas del día a día, objetivos generales y sub-tareas, con alarmas y recordatorios. Permite organizar tareas puntuales o recurrentes (diarias, semanales, mensuales), con márgenes de tiempo ("antes de las 4 pm", "de tal fecha a tal fecha"), prioridad y estados (pendiente, en progreso, completada, cancelada, en pausa/espera).

## Visión rápida

- **Nombre:** Metas Claras
- **Stack:** Expo (SDK 57), React Native (0.86), TypeScript, expo-router
- **Base de datos local:** SQLite (expo-sqlite) — archivo: `metas.db`
- **Recordatorios:** expo-notifications (alarmas con sonido del sistema / notificaciones silenciosas)

## Estado del proyecto

- [x] Base: dependencias, config de la app, tema oscuro, tabs
- [x] Base de datos (objetivos, tareas anidadas, recurrencias, recordatorios)
- [ ] Formularios de alta/edición
- [ ] Pantallas: Hoy, Tareas, Objetivos, detalle
- [ ] Alarmas y notificaciones por tarea + resumen diario
- [ ] Ajustes, pulido final y build APK

## Requisitos

- Node.js (v18+)
- npm
- Aplicación **Expo Go** instalada en el celular (Play Store / App Store)
- NO hace falta Android Studio ni Xcode para probar la app en el celular

## Instalación y ejecución

```bash
npm install
npm start
# si el celular no está en la misma red Wi-Fi:
npx expo start --tunnel
```

Escanea el QR con **Expo Go**. Extra: `npm run android`, `npm run ios` o `npm run web`.

## Scripts útiles

- `start`: `expo start`
- `lint`: `expo lint` (ESLint con `eslint-config-expo`)
- `android` / `ios` / `web`: emulador/simulador (opcional)
- ⚠️ `reset-project` borraría las pantallas y formularios propios. No lo uses.

## Estructura del proyecto

- [src/app/](src/app/): Rutas de expo-router.
  - `src/app/_layout.tsx`: Layout raíz (provider SQLite, tema oscuro, Stack).
  - `src/app/(tabs)/`: Pestañas (Hoy, Tareas, Añadir, Objetivos, Ajustes).
- [src/components/](src/components/): UI reutilizable (themed-text/view, `ui/card`, `ui/screen`).
- [src/constants/theme.ts](src/constants/theme.ts): Paleta oscura unificada, tipografías, espaciados.
- [src/hooks/](src/hooks/): Hooks de tema y color scheme.
- [src/lib/](src/lib/): Lógica de datos y persistencia.
  - `src/lib/schema.ts`: Definición del esquema, tipos y migraciones (`PRAGMA user_version`).
  - `src/lib/db.ts`: API de alto nivel para objetivos, tareas, completados y ajustes.
  - `src/lib/logic.ts`: Utilidades de fecha, recurrencias y estados efectivos por día.
  - `src/lib/db-provider.tsx`: Proveedor SQLite.
- [assets/images/](assets/images/): Ícono, splash, favicon, adaptive icons.
- [scripts/reset-project.js](scripts/reset-project.js): Script auxiliar de la plantilla (no usar).

## Funcionalidades (hoja de ruta)

- Tareas con **sub-tareas anidadas** (cada una editable y eliminable).
- Recurrencia: puntual / diaria / semanal (días elegidos) / mensual.
- Márgenes de tiempo: fecha única, rango de fechas, "antes de las HH:MM".
- Estados: pendiente, en progreso, completada, cancelada, en pausa/espera.
- **Recordatorios por tarea**: Alarma (sonido) o Notificación (silenciosa).
  - Aviso de inicio, aviso previo al fin ("termina en X min") y aviso al vencer.
- Resumen diario programado con los pendientes del día.
- Objetivos con barra de progreso (sub-tareas completadas / total).

## Dependencias destacadas

- `expo` (~57), `expo-router` (~57)
- `expo-sqlite` — persistencia local
- `expo-notifications` — alarmas y recordatorios (locales; sin push remoto)
- `@expo/vector-icons` — íconos
- `expo-haptics` — respuesta háptica
- `react` 19.2, `react-native` 0.86

## Linting y Tipado

- TypeScript estricto (`tsconfig.json` extiende `expo/tsconfig.base`).
- `npm run lint` para ESLint.

## Base de datos y migraciones

- La app usa `expo-sqlite` con archivo local `metas.db` (WAL, claves foráneas activas).
- Las migraciones son incrementales por `PRAGMA user_version` (ver [src/lib/schema.ts](src/lib/schema.ts)).
- Tablas: `objectives`, `tasks` (con `parent_id` para sub-tareas en cascada y `objective_id`), `task_completions` (historial por fecha, único por tarea+día) y `settings`.
- Campos clave de `tasks`: `recurrence` (none/daily/weekly/monthly), `recurrence_days` (semanal), `monthly_day`, `start_date`/`end_date`, `start_time`/`end_time` (margen horario), `priority`, `status`, `remind_type`, `remind_before_minutes`, `remind_at_start`.
- Las tareas recurrentes se "reinician" solas: si completaste la de ayer y hoy no tienes completado, aparece como pendiente de nuevo.

## Instalar la app en el celular (APK)

Compilar como `.apk` instalable con **EAS cloud build** de Expo:

```bash
npx eas-cli login
npx eas build --platform android --profile preview
```

Se genera un enlace de descarga del `.apk` para instalar en el celular (sin depender de Expo Go).

## Notas de mantenimiento

- `app.json` contiene el esquema (`scheme: metasclaras`) y plugins: expo-router, expo-sqlite, expo-notifications, expo-splash-screen.
- Los permisos en `app.json` incluyen `SCHEDULE_EXACT_ALARM` (Android 12+) para que las alarmas disparen a tiempo.
- Las notificaciones locales funcionan en **Expo Go** en Android/iOS; el sonido custom exigiría un build de desarrollo.

## Contribuir

- Abrir issues para bugs o mejoras.
- Hacer PRs con descripciones claras y, si afectan la base de datos, explicar las migraciones.