import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { settings } from '../db/schema.ts';
import { migrateSettings, resolveSettings, type Settings } from '../../core/settings.ts';

const ROW_ID = 1;

export interface SettingsRepository {
  get(): Settings;
  save(value: Settings, now: number): Settings;
  /** Apply one-time upgrades to the stored row (run at boot). True if it was rewritten. */
  migrate(now: number): boolean;
}

export function createSettingsRepo(db: Db): SettingsRepository {
  const stored = (): unknown => {
    const row = db.select().from(settings).where(eq(settings.id, ROW_ID)).get();
    return row ? JSON.parse(row.json) : null;
  };
  const save = (value: Settings, now: number): Settings => {
    const json = JSON.stringify(value);
    db.insert(settings)
      .values({ id: ROW_ID, json, updatedAt: now })
      .onConflictDoUpdate({ target: settings.id, set: { json, updatedAt: now } })
      .run();
    return value;
  };
  return {
    get: () => resolveSettings(stored()),
    save,
    migrate(now) {
      const { value, changed } = migrateSettings(stored());
      if (changed) save(resolveSettings(value), now);
      return changed;
    },
  };
}
