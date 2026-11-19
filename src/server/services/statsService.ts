import { buildStats, type StatsDto } from '../../core/stats/index.ts';
import type { Deps } from './deps.ts';

/** The server's own zone: the fallback when a client can't say where it is. */
export const SERVER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function stats(deps: Deps, tz: string): StatsDto {
  // One snapshot: sessions and sets read together can't disagree mid-save.
  const { sessions, sets, stretches } = deps.repos.transaction((repos) => ({
    sessions: repos.sessions.finishedFacts(),
    sets: repos.setLogs.finishedWorkingSets(),
    stretches: repos.stretch.finishedEndTimes(),
  }));
  return buildStats({ sessions, sets, stretches, library: deps.library, now: deps.now(), tz });
}
