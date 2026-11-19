import { Hono } from 'hono';
import { z } from 'zod';
import { SESSION_LENGTHS } from '../../core/days.ts';
import { fail, ok } from '../http.ts';
import type { Deps } from '../services/deps.ts';
import * as svc from '../services/stretchService.ts';
import { toStretchDto } from '../services/stretchDto.ts';
import { validate } from './validate.ts';

const MAX_LIST = 100;
const DEFAULT_LIST = 20;
const MAX_STEPS = 80;

const lengthBody = z.object({ length: z.enum(SESSION_LENGTHS).optional() });
const idParam = z.object({ id: z.string().min(1).max(64) });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(MAX_LIST).optional() });
const stepIndices = z.array(z.number().int().min(0).max(MAX_STEPS)).max(MAX_STEPS);
const finishBody = z.object({
  endedEarly: z.boolean(),
  completed: stepIndices,
  skipped: stepIndices,
  endedAt: z.number().int().positive().optional(),
});

export function stretchRoutes(deps: Deps) {
  return new Hono()
    .get('/', validate('query', listQuery), (c) => ok(c, svc.list(deps, c.req.valid('query').limit ?? DEFAULT_LIST)))
    .post('/', validate('json', lengthBody), (c) => {
      const length = c.req.valid('json').length ?? deps.repos.settings.get().defaultLength;
      return ok(c, svc.createPlanned(deps, length), 201);
    })
    .get('/:id', validate('param', idParam), (c) => {
      const row = deps.repos.stretch.findById(c.req.valid('param').id);
      return row ? ok(c, toStretchDto(row)) : fail(c, 404, 'Stretch session not found');
    })
    .delete('/:id', validate('param', idParam), (c) => ok(c, svc.removeFinished(deps, c.req.valid('param').id)))
    .post('/:id/reroll', validate('param', idParam), validate('json', lengthBody), (c) =>
      ok(c, svc.reroll(deps, c.req.valid('param').id, c.req.valid('json').length)),
    )
    .post('/:id/start', validate('param', idParam), (c) => ok(c, svc.start(deps, c.req.valid('param').id)))
    .post('/:id/finish', validate('param', idParam), validate('json', finishBody), (c) =>
      ok(c, svc.finish(deps, c.req.valid('param').id, c.req.valid('json'))),
    );
}
