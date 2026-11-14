import { Hono } from 'hono';
import { z } from 'zod';
import { DAYS, SESSION_LENGTHS } from '../../core/days.ts';
import { sessionStateSchema } from '../../core/session/schema.ts';
import type { SessionState } from '../../core/session/types.ts';
import { fail, ok } from '../http.ts';
import type { Deps } from '../services/deps.ts';
import * as svc from '../services/sessionService.ts';
import { toDto } from '../services/sessionDto.ts';
import { validate } from './validate.ts';

const MAX_LIST = 100;
const DEFAULT_LIST = 20;

const createBody = z.object({ day: z.enum(DAYS), length: z.enum(SESSION_LENGTHS).optional() });
const rerollBody = z.object({ length: z.enum(SESSION_LENGTHS).optional() });
const swapBody = z.object({ exerciseId: z.string().min(1).max(64) });
const stateBody = z.object({ state: sessionStateSchema });
const positionParam = z.object({ id: z.string().min(1).max(64), position: z.coerce.number().int().min(0) });
const idParam = z.object({ id: z.string().min(1).max(64) });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(MAX_LIST).optional() });

export function sessionRoutes(deps: Deps) {
  return new Hono()
    .get('/home', (c) => ok(c, svc.home(deps)))
    .get('/', validate('query', listQuery), (c) => {
      const limit = c.req.valid('query').limit ?? DEFAULT_LIST;
      return ok(c, deps.repos.sessions.list(limit).map(toDto));
    })
    .post('/', validate('json', createBody), (c) => {
      const { day, length } = c.req.valid('json');
      return ok(c, svc.createPlanned(deps, day, length ?? deps.repos.settings.get().defaultLength), 201);
    })
    .get('/:id', validate('param', idParam), (c) => {
      const row = deps.repos.sessions.findById(c.req.valid('param').id);
      return row ? ok(c, toDto(row)) : fail(c, 404, 'Session not found');
    })
    .delete('/:id', validate('param', idParam), (c) => ok(c, svc.removeFinished(deps, c.req.valid('param').id)))
    .post('/:id/reroll', validate('param', idParam), validate('json', rerollBody), (c) =>
      ok(c, svc.reroll(deps, c.req.valid('param').id, c.req.valid('json').length)),
    )
    .get('/:id/items/:position/alternatives', validate('param', positionParam), (c) => {
      const { id, position } = c.req.valid('param');
      return ok(c, svc.alternativesFor(deps, id, position));
    })
    .put('/:id/items/:position', validate('param', positionParam), validate('json', swapBody), (c) => {
      const { id, position } = c.req.valid('param');
      return ok(c, svc.swapPlanned(deps, id, position, c.req.valid('json').exerciseId));
    })
    .post('/:id/start', validate('param', idParam), (c) => ok(c, svc.start(deps, c.req.valid('param').id)))
    .put('/:id/state', validate('param', idParam), validate('json', stateBody), (c) => {
      const result = svc.saveState(deps, c.req.valid('param').id, c.req.valid('json').state as SessionState);
      if (result.kind === 'stale') return fail(c, 409, 'Stale session revision', result.session);
      if (result.kind === 'inactive') return fail(c, 409, 'Session is not active', result.session);
      return ok(c, result.session);
    })
    .get('/:id/summary', validate('param', idParam), (c) => ok(c, svc.summaryFor(deps, c.req.valid('param').id)));
}
