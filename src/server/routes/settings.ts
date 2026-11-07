import { Hono } from 'hono';
import { z } from 'zod';
import { exercisePrefSchema, settingsSchema } from '../../core/settings.ts';
import { fail, ok } from '../http.ts';
import type { Deps } from '../services/deps.ts';
import { validate } from './validate.ts';

const prefParam = z.object({ id: z.string().min(1).max(64) });

export function settingsRoutes(deps: Deps) {
  return new Hono()
    .get('/settings', (c) => ok(c, deps.repos.settings.get()))
    .put('/settings', validate('json', settingsSchema), (c) => ok(c, deps.repos.settings.save(c.req.valid('json'), deps.now())))
    .get('/prefs', (c) => ok(c, deps.repos.prefs.all()))
    .put('/exercises/:id/prefs', validate('param', prefParam), validate('json', exercisePrefSchema), (c) => {
      const { id } = c.req.valid('param');
      if (!deps.library.has(id)) return fail(c, 404, 'Unknown exercise');
      return ok(c, deps.repos.prefs.set(id, c.req.valid('json'), deps.now()));
    })
    .get('/exercises/:id/history', validate('param', prefParam), (c) => {
      const { id } = c.req.valid('param');
      if (!deps.library.has(id)) return fail(c, 404, 'Unknown exercise');
      return ok(c, deps.repos.setLogs.history()[id] ?? []);
    });
}
