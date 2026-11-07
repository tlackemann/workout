/**
 * Downloads the start/end frames for every curated exercise from free-exercise-db and
 * normalises them into public/media/<freeDbId>/{0,1}.webp (committed to the repo, so
 * builds are reproducible and the TV never talks to GitHub).
 *
 *   npm run fetch-media            # fetch missing frames
 *   npm run fetch-media -- --force # re-fetch everything
 */
import { mkdir, access, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { LIBRARY } from '../src/data/library.ts';
import { frameJobs, type FrameJob } from './media.ts';

const OUT_DIR = 'public/media';
/** Source photos are 3:2 (850×567), so a 3:2 canvas fits them exactly. */
const WIDTH = 900;
const HEIGHT = 600;
/** Letterbox colour for the odd non-3:2 photo; matches the UI's dark surface. */
const LETTERBOX = '#15171a';
const QUALITY = 78;
const CONCURRENCY = 6;
const MAX_BYTES = 5 * 1024 * 1024;

const force = process.argv.includes('--force');

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'gym-tv-media-fetch' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`Unexpected content-type "${type}" for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error(`Image too large (${buf.byteLength} bytes): ${url}`);
  return buf;
}

/** Same canvas for both frames so the start/end crossfade doesn't jump. */
async function normalise(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 25_000_000 })
    .resize(WIDTH, HEIGHT, { fit: 'contain', background: LETTERBOX })
    .flatten({ background: LETTERBOX })
    .webp({ quality: QUALITY })
    .toBuffer();
}

async function run(job: FrameJob): Promise<'skipped' | 'fetched'> {
  if (!force && (await exists(job.outPath))) return 'skipped';
  const image = await normalise(await download(job.url));
  await mkdir(dirname(job.outPath), { recursive: true });
  await writeFile(job.outPath, image);
  return 'fetched';
}

async function main() {
  const jobs = frameJobs(LIBRARY, OUT_DIR);
  const failures: string[] = [];
  let fetched = 0;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(run));
    results.forEach((r, j) => {
      if (r.status === 'rejected') failures.push(`${batch[j]?.freeDbId}/${batch[j]?.frame}: ${String(r.reason)}`);
      else if (r.value === 'fetched') fetched++;
    });
  }
  console.info(`fetch-media: ${fetched} fetched, ${jobs.length - fetched - failures.length} already present`);
  if (failures.length > 0) {
    console.error(`fetch-media: ${failures.length} failed\n${failures.join('\n')}`);
    process.exit(1);
  }
}

await main();
