import type { Db } from '../db/client.ts';
import { createPrefsRepo, type PrefsRepository } from './prefsRepo.ts';
import { createSessionsRepo, type SessionsRepository } from './sessionsRepo.ts';
import { createSetLogsRepo, type SetLogsRepository } from './setLogsRepo.ts';
import { createSettingsRepo, type SettingsRepository } from './settingsRepo.ts';
import { createStretchRepo, type StretchRepository } from './stretchRepo.ts';

export interface Repositories {
  readonly settings: SettingsRepository;
  readonly prefs: PrefsRepository;
  readonly sessions: SessionsRepository;
  readonly setLogs: SetLogsRepository;
  readonly stretch: StretchRepository;
  /** Run several repository calls atomically. */
  transaction<T>(fn: (repos: Repositories) => T): T;
}

export function createRepositories(db: Db): Repositories {
  return {
    settings: createSettingsRepo(db),
    prefs: createPrefsRepo(db),
    sessions: createSessionsRepo(db),
    setLogs: createSetLogsRepo(db),
    stretch: createStretchRepo(db),
    // Drizzle's transaction handle exposes the same query API as the db it came from.
    transaction: (fn) => db.transaction((tx) => fn(createRepositories(tx as unknown as Db))),
  };
}
