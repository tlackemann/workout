import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/client.ts';
import { createRepositories } from './repositories/index.ts';
import { indexLibrary } from '../core/library/index.ts';
import { librarySchema } from '../core/library/schema.ts';
import { randomSeed } from '../core/prng.ts';
import { LIBRARY } from '../data/library.ts';
import { TEMPLATES } from '../data/templates.ts';

const config = loadConfig(process.env);
const library = indexLibrary(librarySchema.parse(LIBRARY));

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });
const handle = openDb(config.dbPath, config.migrationsDir);

const deps = {
  repos: createRepositories(handle.db),
  library,
  templates: TEMPLATES,
  now: () => Date.now(),
  newId: () => randomUUID(),
  newSeed: randomSeed,
};

const app = createApp(deps, {
  media: { bundled: config.mediaDir, overrides: config.overridesDir },
  rateLimit: { limit: config.rateLimitPerMin, windowMs: 60_000 },
  clientKey: (c) => getConnInfo(c).remote.address ?? 'unknown',
  log: (message, error) => console.error(`[gym-tv] ${message}`, error),
  staticDir: config.staticDir,
});

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.info(`[gym-tv] listening on http://${config.host}:${info.port} (db: ${config.dbPath})`);
});

function shutdown() {
  server.close(() => {
    handle.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
