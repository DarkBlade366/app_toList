/**
 * Tema de "Metas Claras". La app es oscura por diseño: tanto "light" como "dark"
 * comparten la misma paleta para evitar variaciones.
 * La paleta también se expone a nivel raíz para uso directo: Colors.tint, Colors.muted, ...
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  background: '#0B0F17',
  card: '#141B26',
  surface: '#1C2432',
  border: '#263046',
  text: '#E6EAF0',
  textSecondary: '#8A94A6',
  muted: '#8A94A6',
  icon: '#8A94A6',
  backgroundElement: '#1C2432',
  backgroundSelected: '#2A3448',
  tint: '#22D3EE',
  success: '#34D399',
  danger: '#F87171',
  warning: '#FBBF24',
  alarm: '#FB7185',
  onAccent: '#06121F',
  white: '#FFFFFF',
  tabIconDefault: '#5A6474',
  tabIconSelected: '#22D3EE',
} as const;

export const Colors = {
  light: palette,
  dark: palette,
  ...palette,
};

export type ThemeColor = keyof typeof palette;

/** Acentos por prioridad (consistente con task-row.tsx). */
export const PriorityAccent = {
  low: palette.success,
  medium: palette.warning,
  high: palette.danger,
} as const;

/** Radios de esquina consistentes a lo largo de la app. */
export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Sombras suaves para la estética "Things 3". */
export const Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  glow: {
    shadowColor: palette.tint,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;