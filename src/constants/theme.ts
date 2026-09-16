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