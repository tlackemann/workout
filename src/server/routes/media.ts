import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { z } from 'zod';
import { fail } from '../http.ts';
import type { Deps } from '../services/deps.ts';
import { validate } from './validate.ts';

export interface MediaDirs {
  /** Bundled frames: <bundled>/<freeDbId>/<frame>.webp */
  readonly bundled: string;
  /** User photos: <overrides>/<exerciseId>/<frame>.(webp|jpg|jpeg|png) */
  readonly overrides: string;
}

const TYPES: Readonly<Record<string, string>> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const OVERRIDE_EXTS = ['webp', 'jpg', 'jpeg', 'png'] as const;
const CACHE = 'public, max-age=3600';

const params = z.object({ id: z.string().regex(/^[a-z0-9-]+$/).max(64), frame: z.enum(['0', '1']) });

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** First existing file: user override first, then the bundled frame. */
export async function resolveFrame(dirs: MediaDirs, exerciseId: string, freeDbId: string, frame: string) {
  for (const ext of OVERRIDE_EXTS) {
    const path = join(dirs.overrides, exerciseId, `${frame}.${ext}`);
    if (await exists(path)) return { path, type: TYPES[ext]!, override: true };
  }
  const bundled = join(dirs.bundled, freeDbId, `${frame}.webp`);
  return (await exists(bundled)) ? { path: bundled, type: TYPES.webp!, override: false } : null;
}

export function mediaRoutes(deps: Deps, dirs: MediaDirs) {
  return new Hono().get('/:id/:frame', validate('param', params), async (c) => {
    const { id, frame } = c.req.valid('param');
    // Exercise and stretch ids never collide (checked by the data tests).
    const subject = deps.library.get(id) ?? deps.stretchLibrary.get(id);
    if (!subject) return fail(c, 404, 'Unknown exercise');
    const found = await resolveFrame(dirs, id, subject.freeDbId, frame);
    if (!found) return fail(c, 404, 'No image for this exercise');
    const body = await readFile(found.path);
    return c.body(body, 200, { 'Content-Type': found.type, 'Cache-Control': CACHE });
  });
}
