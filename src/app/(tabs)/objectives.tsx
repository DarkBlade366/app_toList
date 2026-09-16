import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';

export default function ObjectivesScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title="Objetivos" subtitle="Metas generales a alcanzar" />
      <Card>
        <ThemedText style={{ color: '#8A94A6' }}>Lista de objetivos próximamente.</ThemedText>
      </Card>
    </Screen>
  );
}