import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ToastProvider } from '@/components/toast';
import { Colors } from '@/constants/theme';
import { DatabaseProvider } from '@/lib/db-provider';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <ToastProvider>
        <ThemeProvider
          value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: Colors.background } }}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: Colors.background } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="task/new" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="task/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="task-type/[type]" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </ToastProvider>
    </DatabaseProvider>
  );
}