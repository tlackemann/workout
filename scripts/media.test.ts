import { describe, expect, it } from 'vitest';
import { frameJobs } from './media.ts';
import { LIBRARY } from '../src/data/library.ts';
import { STRETCHES } from '../src/data/stretches.ts';

describe('frameJobs', () => {
  it('creates two jobs per unique free-exercise-db id', () => {
    const jobs = frameJobs(LIBRARY, 'out');
    const unique = new Set(LIBRARY.map((e) => e.freeDbId));
    expect(jobs).toHaveLength(unique.size * 2);
    expect(jobs[0]?.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/main\/exercises\/.+\/0\.jpg$/);
    expect(jobs[0]?.outPath).toMatch(/^out\/.+\/0\.webp$/);
  });

  it('shares one download between entries that use the same photos', () => {
    const jobs = frameJobs([...LIBRARY, ...STRETCHES, ...STRETCHES], 'out');
    const unique = new Set([...LIBRARY, ...STRETCHES].map((e) => e.freeDbId));
    expect(jobs).toHaveLength(unique.size * 2);
  });
});
