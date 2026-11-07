import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { settings } from '../db/schema.ts';
import { resolveSettings, type Settings } from '../../core/settings.ts';

const ROW_ID = 1;

export interface SettingsRepository {
  get(): Settings;
  save(value: Settings, now: number): Settings;
}

export function createSettingsRepo(db: Db): SettingsRepository {
  return {
    get() {
      const row = db.select().from(settings).where(eq(settings.id, ROW_ID)).get();
      return resolveSettings(row ? JSON.parse(row.json) : null);
    },
    save(value, now) {
      const json = JSON.stringify(value);
      db.insert(settings)
        .values({ id: ROW_ID, json, updatedAt: now })
        .onConflictDoUpdate({ target: settings.id, set: { json, updatedAt: now } })
        .run();
      return value;
    },
  };
}
