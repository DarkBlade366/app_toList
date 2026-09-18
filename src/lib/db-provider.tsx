import { SQLiteProvider } from 'expo-sqlite';
import { PropsWithChildren } from 'react';

import { resetRecurringDayStatuses } from './db';
import { todayISO } from './logic';
import { DATABASE_NAME, migrateDbIfNeeded } from './schema';

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={async (db) => {
        await migrateDbIfNeeded(db);
        await resetRecurringDayStatuses(db, todayISO());
      }}>
      {children}
    </SQLiteProvider>
  );
}