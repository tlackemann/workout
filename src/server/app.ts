import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { HttpError, fail, ok } from './http.ts';
import { rateLimit, requireJson } from './middleware.ts';
import { mediaRoutes, type MediaDirs } from './routes/media.ts';
import { sessionRoutes } from './routes/sessions.ts';
import { settingsRoutes } from './routes/settings.ts';
import type { Deps } from './services/deps.ts';

export interface AppOptions {
  readonly media: MediaDirs;
  readonly rateLimit?: { readonly limit: number; readonly windowMs: number };
  readonly clientKey?: (c: Parameters<Parameters<Hono['use']>[1]>[0]) => string;
  readonly log?: (message: string, error: unknown) => void;
  /** Built SPA to serve (production). Every non-API path falls back to index.html. */
  readonly staticDir?: string | null;
}

const DEFAULT_RATE = { limit: 1200, windowMs: 60_000 };

export function createApp(deps: Deps, options: AppOptions) {
  const rate = options.rateLimit ?? DEFAULT_RATE;
  const api = new Hono()
    .use(rateLimit(rate.limit, rate.windowMs, options.clientKey ?? (() => 'local')))
    .use(requireJson)
    .get('/health', (c) => ok(c, { status: 'ok', time: deps.now() }))
    .route('/sessions', sessionRoutes(deps))
    .route('/media', mediaRoutes(deps, options.media))
    .route('/', settingsRoutes(deps));

  const app = new Hono()
    .route('/api', api)
    // Unknown API paths must 404 as JSON, never fall through to the SPA shell.
    .all('/api/*', (c) => fail(c, 404, 'Not found'));

  if (options.staticDir) {
    app.use('/*', serveStatic({ root: options.staticDir }));
    app.get('*', serveStatic({ path: join(options.staticDir, 'index.html') }));
  }

  return app
    .notFound((c) => fail(c, 404, 'Not found'))
    .onError((err, c) => {
      if (err instanceof HttpError) return fail(c, err.status, err.message);
      options.log?.(`Unhandled error on ${c.req.method} ${c.req.path}`, err);
      return fail(c, 500, 'Something went wrong on the server');
    });
}

export type App = ReturnType<typeof createApp>;
