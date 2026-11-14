import { Hono } from 'hono';
import { z } from 'zod';
import { isValidTimeZone } from '../../core/stats/calendar.ts';
import { ok } from '../http.ts';
import type { Deps } from '../services/deps.ts';
import { SERVER_TZ, stats } from '../services/statsService.ts';
import { validate } from './validate.ts';

const statsQuery = z.object({
  tz: z.string().max(64).refine(isValidTimeZone, 'Unknown time zone').optional(),
});

export function statsRoutes(deps: Deps) {
  return new Hono().get('/', validate('query', statsQuery), (c) => ok(c, stats(deps, c.req.valid('query').tz ?? SERVER_TZ)));
}
