import { join } from 'node:path';

export const FREE_DB_RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
export const FRAMES = ['0', '1'] as const;

export interface FrameJob {
  readonly freeDbId: string;
  readonly frame: (typeof FRAMES)[number];
  readonly url: string;
  readonly outPath: string;
}

/** One download per unique free-exercise-db id and frame (several exercises can share images). */
export function frameJobs(library: readonly { readonly freeDbId: string }[], outDir: string): FrameJob[] {
  const ids = [...new Set(library.map((e) => e.freeDbId))].sort();
  return ids.flatMap((freeDbId) =>
    FRAMES.map((frame) => ({
      freeDbId,
      frame,
      url: `${FREE_DB_RAW}/${encodeURIComponent(freeDbId)}/${frame}.jpg`,
      outPath: join(outDir, freeDbId, `${frame}.webp`),
    })),
  );
}
