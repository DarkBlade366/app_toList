import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ColorValue } from 'react-native';

import { Colors } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Ionicons name={name} size={size * 0.92} color={color} />;
}

function FocusedTabIcon({
  on,
  off,
  color,
  size,
  focused,
}: {
  on: IconName;
  off: IconName;
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  return <TabIcon name={focused ? on : off} color={color} size={size} />;
}

function tabIcon(on: IconName, off: IconName) {
  const Icon = (props: { color: ColorValue; size: number; focused: boolean }) => (
    <FocusedTabIcon on={on} off={off} {...props} />
  );
  Icon.displayName = 'TabIcon';
  return Icon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tint,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopWidth: 0,
          elevation: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: tabIcon('today', 'today-outline'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tareas',
          tabBarIcon: tabIcon('list', 'list-outline'),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Añadir',
          tabBarIcon: tabIcon('add-circle', 'add-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="objectives"
        options={{
          title: 'Objetivos',
          tabBarIcon: tabIcon('flag', 'flag-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: tabIcon('settings', 'settings-outline'),
        }}
      />
    </Tabs>
  );
}