import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';

export default function TasksScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title="Tareas" subtitle="Todas tus tareas y sub-tareas" />
      <Card>
        <ThemedText style={{ color: '#8A94A6' }}>Lista de tareas próximamente.</ThemedText>
      </Card>
    </Screen>
  );
}