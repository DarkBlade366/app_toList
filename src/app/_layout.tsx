import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';
import { DatabaseProvider } from '@/lib/db-provider';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <ThemeProvider
        value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: Colors.background } }}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: Colors.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </DatabaseProvider>
  );
}