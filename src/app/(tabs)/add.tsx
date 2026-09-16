import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { ObjectiveForm } from '@/components/objective-form';
import { TaskForm } from '@/components/task-form';
import { useToast } from '@/components/toast';
import { Segmented } from '@/components/ui/segmented';
import { Card } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import * as db from '@/lib/db';

export default function AddScreen() {
  const sqlite = useSQLiteContext();
  const toast = useToast();
  const [mode, setMode] = useState<'task' | 'objective'>('task');
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
    <Screen scroll keyboard>
      <ScreenHeader title="Añadir" subtitle="Crea tareas, sub-tareas y objetivos" />

      <Segmented
        options={[
          { key: 'task', label: 'Tarea' },
          { key: 'objective', label: 'Objetivo' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <View style={{ height: 18 }} />

      {mode === 'task' ? (
        <Card>
          <TaskForm key={`task-${resetKey}`} onSubmit={saveTask} />
        </Card>
      ) : (
        <Card>
          <ObjectiveForm
            key={`obj-${resetKey}`}
            submitLabel="Guardar objetivo"
            onSubmit={async (data) => {
              try {
                await db.addObjective(sqlite, data);
                toast.show('Objetivo creado', 'success');
                setResetKey((k) => k + 1);
                return true;
              } catch {
                toast.show('No se pudo guardar', 'error');
                return false;
              }
            }}
          />
        </Card>
      )}
    </Screen>
  );
}