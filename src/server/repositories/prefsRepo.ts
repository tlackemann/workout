import type { Db } from '../db/client.ts';
import { exercisePrefs } from '../db/schema.ts';
import type { ExercisePref, Prefs } from '../../core/settings.ts';

export interface PrefsRepository {
  all(): Prefs;
  set(exerciseId: string, pref: ExercisePref, now: number): ExercisePref;
}

export function createPrefsRepo(db: Db): PrefsRepository {
  return {
    all() {
      const rows = db.select().from(exercisePrefs).all();
      return Object.fromEntries(
        rows.map((r) => [r.exerciseId, { favorite: r.favorite, banned: r.banned, startLoad: r.startLoad }]),
      );
    },
    set(exerciseId, pref, now) {
      const values = { favorite: pref.favorite, banned: pref.banned, startLoad: pref.startLoad, updatedAt: now };
      db.insert(exercisePrefs)
        .values({ exerciseId, ...values })
        .onConflictDoUpdate({ target: exercisePrefs.exerciseId, set: values })
        .run();
      return pref;
    },
  };
}
