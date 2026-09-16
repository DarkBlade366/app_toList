import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { TaskForm } from '@/components/task-form';
import { useToast } from '@/components/toast';
import { Card } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import * as db from '@/lib/db';

export default function AddScreen() {
  const sqlite = useSQLiteContext();
  const toast = useToast();
  const [resetKey, setResetKey] = useState(0);

  async function saveTask(data: db.TaskWrite): Promise<boolean> {
    try {
      await db.addTask(sqlite, data);
      toast.show('Tarea añadida', 'success');
      setResetKey((k) => k + 1);
      return true;
    } catch (e) {
      toast.show((e as Error).message ?? 'No se pudo guardar', 'error');
      return false;
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Añadir" subtitle="Crea una tarea paso a paso" />
      <Card style={{ flex: 1 }}>
        <TaskForm key={`task-${resetKey}`} onSubmit={saveTask} />
      </Card>
    </Screen>
  );
}