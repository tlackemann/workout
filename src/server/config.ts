import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().default('0.0.0.0'),
  DB_PATH: z.string().min(1).default('./data-dev/workout.db'),
  MIGRATIONS_DIR: z.string().min(1).default('./drizzle'),
  /** Built SPA (vite build). Served only when set / in production. */
  STATIC_DIR: z.string().optional(),
  MEDIA_DIR: z.string().min(1).optional(),
  OVERRIDES_DIR: z.string().min(1).default('./data-dev/media-overrides'),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().min(10).default(1200),
});

export interface Config {
  readonly production: boolean;
  readonly port: number;
  readonly host: string;
  readonly dbPath: string;
  readonly migrationsDir: string;
  readonly staticDir: string | null;
  readonly mediaDir: string;
  readonly overridesDir: string;
  readonly rateLimitPerMin: number;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid environment: ${issue?.path.join('.')} ${issue?.message}`);
  }
  const e = parsed.data;
  const production = e.NODE_ENV === 'production';
  const staticDir = e.STATIC_DIR ?? (production ? './dist' : null);
  return {
    production,
    port: e.PORT,
    host: e.HOST,
    dbPath: e.DB_PATH,
    migrationsDir: e.MIGRATIONS_DIR,
    staticDir,
    // vite copies public/ into dist/, so production reads bundled frames from the build.
    mediaDir: e.MEDIA_DIR ?? (staticDir ? `${staticDir}/media` : './public/media'),
    overridesDir: e.OVERRIDES_DIR,
    rateLimitPerMin: e.RATE_LIMIT_PER_MIN,
  };
}
