import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';

export default function AddScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title="Añadir" subtitle="Crea tareas, sub-tareas y objetivos" />
      <Card>
        <ThemedText style={{ color: '#8A94A6' }}>Formulario de creación próximamente.</ThemedText>
      </Card>
    </Screen>
  );
}