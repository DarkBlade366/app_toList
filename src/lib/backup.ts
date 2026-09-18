import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Settings, Task, TaskCompletion } from '@/lib/schema';

export interface BackupPayload {
  app: string;
  version: number;
  exportedAt: string;
  tasks: Task[];
  completions: TaskCompletion[];
  settings: Settings;
}

export async function exportBackup(
  tasks: Task[],
  completions: TaskCompletion[],
  settings: Settings
): Promise<{ ok: boolean; uri?: string; error?: string }> {
  try {
    const dir = new Directory(Paths.document, 'backups');
    if (!dir.exists) dir.create({ intermediates: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = new File(dir, `metas-claras-${stamp}.json`);
    if (!file.exists) file.create({ intermediates: true });

    const payload: BackupPayload = {
      app: 'Metas Claras',
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      completions,
      settings,
    };
    file.write(JSON.stringify(payload, null, 2), { encoding: 'utf8' });

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: true, uri: file.uri };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Backup de Metas Claras',
      UTI: 'public.json',
    });
    return { ok: true, uri: file.uri };
  } catch (e) {
    console.warn('exportBackup falló:', e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}