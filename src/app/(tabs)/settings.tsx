import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';

export default function SettingsScreen() {
  return (
    <Screen scroll>
      <ScreenHeader title="Ajustes" subtitle="Notificaciones y preferencias" />
      <Card>
        <ThemedText style={{ color: '#8A94A6' }}>Ajustes próximamente.</ThemedText>
      </Card>
    </Screen>
  );
}