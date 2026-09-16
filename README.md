# Metas Claras

Aplicación móvil para gestionar las tareas del día a día, con tareas anidadas, alarmas y recordatorios. Permite organizar tareas puntuales o recurrentes (diarias, semanales, mensuales), con márgenes de tiempo ("antes de las 4 pm", "de tal día a tal día"), prioridad y estados (pendiente, en progreso, completada, cancelada, en pausa/espera).

## Visión rápida

- **Nombre:** Metas Claras
- **Stack:** Expo (SDK 57), React Native (0.86), TypeScript, expo-router
- **Base de datos local:** SQLite (expo-sqlite) — archivo: `metas.db`
- **Recordatorios:** expo-notifications (alarmas con sonido del sistema / notificaciones silenciosas)

## Estado del proyecto

- [x] Base: dependencias, config de la app, tema oscuro, tabs
- [x] Base de datos (tareas anidadas, recurrencias, recordatorios)
- [x] Formularios de alta/edición (asistente por tipo de tarea)
- [ ] Pantallas: Hoy, Tareas, detalle
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
  - `src/app/_layout.tsx`: Layout raíz (provider SQLite, tema oscuro, Stack + modales de tarea).
  - `src/app/(tabs)/`: Pestañas (Hoy, Tareas, Añadir, Ajustes).
- [src/components/](src/components/): UI reutilizable (`toast`, `task-form`, `task-row`, `ui/*`).
- [src/constants/theme.ts](src/constants/theme.ts): Paleta oscura unificada, tipografías, espaciados.
- [src/hooks/](src/hooks/): Hooks de tema y color scheme.
- [src/lib/](src/lib/): Lógica de datos y persistencia.
  - `src/lib/schema.ts`: Definición del esquema, tipos y migraciones (`PRAGMA user_version`).
  - `src/lib/db.ts`: API de alto nivel para tareas, completados y ajustes.
  - `src/lib/logic.ts`: Utilidades de fecha, recurrencias y estados efectivos por día.
  - `src/lib/db-provider.tsx`: Proveedor SQLite.
- [assets/images/](assets/images/): Ícono, splash, favicon, adaptive icons.
- [scripts/reset-project.js](scripts/reset-project.js): Script auxiliar de la plantilla (no usar).

## Creación de tareas (asistente por pasos)

Al crear una tarea lo primero que eliges es el **tipo**, y a partir de ahí aparecen únicamente las opciones pertinentes:

1. **Tipo de tarea**: Tarea general (sin fecha obligatoria) · Un día · De tal día a tal día · Diaria · Semanal · Mensual.
2. **Cuándo**: solo los campos del tipo elegido (día concreto, rango desde/hasta, días de la semana, día del mes) y margen de tiempo opcional ("de HH:MM a HH:MM").
3. **Detalles**: título, notas, prioridad y recordatorio.

## Tareas dentro de otra tarea

- No hay "objetivos" ni "sub-tareas": las tareas se anidan añadiendo **una nueva tarea dentro de una tarea existente** desde su pantalla de detalle (botón **Agregar tarea**), que abre el mismo asistente con la tarea padre ya fijada.
- Una **tarea general siempre es una tarea raíz**: nunca puede crearse dentro de otra (el tipo no se ofrece cuando hay padre).
- Validaciones: las tareas hijas no pueden terminar después que la tarea padre (`fin hija ≤ fin padre`) ni empezar antes (`inicio hija ≥ inicio padre`); en toda tarea el fin no puede ser anterior al inicio.

## Funcionalidades (hoja de ruta)

- Tareas con **hijos anidados** (cada una editable y eliminable).
- Recurrencia: un día / rango de fechas / diaria / semanal (días elegidos) / mensual (día del mes).
- **Acceso rápido en la pestaña principal**: botones para crear al momento una tarea **"para hoy"** o **"para mañana"** (tarea de un día con la fecha ya puesta).
- Margen de tiempo: "de HH:MM a HH:MM" (ej. antes de las 4pm).
- Estados: pendiente, en progreso, completada, cancelada, en pausa/espera.
- **Recordatorios por tarea**: Alarma (sonido) o Notificación (silenciosa).
  - Aviso de inicio, aviso previo al fin ("termina en X min") y aviso al vencer.
- Resumen diario programado con los pendientes del día.

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

- Los formularios admiten alta/edición de **tareas** mediante un asistente en pasos (ver "Creación de tareas").
- Componentes UI: `ui/segmented`, `ui/field`, `ui/text-field`, `ui/date-field` (con atajos Hoy/Mañana/+7), `ui/time-field` (steppers ±15 min), `task-form`, `task-row`, `toast`.

## Base de datos y migraciones

- La app usa `expo-sqlite` con archivo local `metas.db` (WAL, claves foráneas activas).
- Las migraciones son incrementales por `PRAGMA user_version` (ver [src/lib/schema.ts](src/lib/schema.ts)).
- Tablas: `tasks` (con `parent_id` para tareas anidadas en cascada), `task_completions` (historial por fecha, único por tarea+día) y `settings`.
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