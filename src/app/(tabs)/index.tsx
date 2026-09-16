import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';

export default function HomeScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title="Hoy" subtitle="Resumen de tus tareas del día" />
      <Card>
        <ThemedText style={{ color: '#8A94A6' }}>Aquí aparecerán las tareas y objetivos del día.</ThemedText>
      </Card>
    </Screen>
  );
}