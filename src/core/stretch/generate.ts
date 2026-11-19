import type { SessionLength } from '../days.ts';
import { isEligible } from '../equipment.ts';
import { RECENCY_PENALTY } from '../generator/rank.ts';
import { createRng, shuffled } from '../prng.ts';
import type { Settings } from '../settings.ts';
import { POSITIONS, STRETCH_BLOCKS, type StretchDef, type StretchLibrary } from './schema.ts';
import type { StretchPlan, StretchPriority, StretchSlot, StretchStep } from './types.ts';

/** "Switch sides" gap between the two sides of a per-side stretch. */
export const SWITCH_SEC = 5;

export const STRETCH_MAX_PRIORITY: Readonly<Record<SessionLength, StretchPriority>> = { quick: 1, standard: 2, long: 3 };

/** How many past stretch sessions count as "recent" (one recency penalty step each). */
export const STRETCH_RECENT_SESSIONS = RECENCY_PENALTY.length;

/** Earlier candidates in a slot are slightly preferred, the same weighting as accessories. */
const ORDER_WEIGHT = 0.3;
/** Mixed into the seed so the ordering shuffle doesn't disturb the picks. */
const ORDER_SALT = 0x2f6b1c3d;

export interface StretchGenerateInput {
  readonly length: SessionLength;
  readonly seed: number;
  readonly settings: Pick<Settings, 'equipment' | 'stretch'>;
  /** Stretch ids of the most recent finished stretch sessions, newest first. */
  readonly recent: readonly (readonly string[])[];
  readonly library: StretchLibrary;
  readonly template: readonly StretchSlot[];
}

interface Picked {
  readonly slot: StretchSlot;
  readonly def: StretchDef;
}

/** Stretch id → sessions ago it was last used (the most recent use wins). */
function recencyOf(recent: StretchGenerateInput['recent']): ReadonlyMap<string, number> {
  const entries = recent
    .slice(0, STRETCH_RECENT_SESSIONS)
    .flatMap((ids, ago) => ids.map((id) => [id, ago] as const))
    .reverse();
  return new Map(entries);
}

function pickAll(input: StretchGenerateInput, rng: () => number): { picks: readonly Picked[]; dropped: readonly string[] } {
  const available = new Set<string>(input.settings.equipment);
  const recency = recencyOf(input.recent);
  const slots = input.template.filter((s) => s.priority <= STRETCH_MAX_PRIORITY[input.length]);

  return slots.reduce<{ picks: readonly Picked[]; dropped: readonly string[] }>(
    (acc, slot) => {
      const usedIds = new Set(acc.picks.map((p) => p.def.id));
      const usedFamilies = new Set(acc.picks.map((p) => p.def.family));
      const total = slot.candidates.length;
      const scored = slot.candidates.flatMap((id, i) => {
        const def = input.library.get(id);
        if (!def || usedIds.has(id) || usedFamilies.has(def.family) || !isEligible(def.requires, available)) return [];
        const ago = recency.get(id);
        const penalty = ago === undefined ? 0 : (RECENCY_PENALTY[ago] ?? 0);
        return [{ def, score: rng() + ((total - i) / total) * ORDER_WEIGHT - penalty }];
      });
      const best = scored.reduce<(typeof scored)[number] | null>((top, c) => (!top || c.score > top.score ? c : top), null);
      return best ? { ...acc, picks: [...acc.picks, { slot, def: best.def }] } : { ...acc, dropped: [...acc.dropped, slot.id] };
    },
    { picks: [], dropped: [] },
  );
}

/**
 * Warm-up → roll → stretch. Inside a block, standing → kneeling → seated → lying (so you
 * get down to the floor once), shuffled within each position. Pinned slots (relax) go last.
 */
function arrange(picks: readonly Picked[], rng: () => number): Picked[] {
  const free = picks.filter((p) => p.slot.pin !== 'last');
  const ordered = STRETCH_BLOCKS.flatMap((block) =>
    POSITIONS.flatMap((position) => shuffled(free.filter((p) => p.def.block === block && p.def.position === position), rng)),
  );
  return [...ordered, ...picks.filter((p) => p.slot.pin === 'last')];
}

type UnindexedStep = Omit<StretchStep, 'index'>;

function toSteps(picks: readonly Picked[], stretch: Settings['stretch']): StretchStep[] {
  return picks
    .flatMap(({ slot, def }): UnindexedStep[] => {
      const holdSec = def.block === 'stretch' ? stretch.holdSec : (def.durationSec ?? stretch.holdSec);
      const base = { slotId: slot.id, stretchId: def.id, holdSec };
      return def.sides === 'each'
        ? [
            { ...base, side: 1, setupSec: stretch.setupSec },
            { ...base, side: 2, setupSec: SWITCH_SEC },
          ]
        : [{ ...base, side: null, setupSec: stretch.setupSec }];
    })
    .map((step, index) => ({ index, ...step }));
}

export function stretchSeconds(steps: readonly StretchStep[]): number {
  return steps.reduce((sum, s) => sum + s.setupSec + s.holdSec, 0);
}

export function generateStretch(input: StretchGenerateInput): StretchPlan {
  const { picks, dropped } = pickAll(input, createRng(input.seed));
  const steps = toSteps(arrange(picks, createRng((input.seed ^ ORDER_SALT) >>> 0)), input.settings.stretch);
  return { length: input.length, seed: input.seed, steps, droppedSlots: dropped, estimatedSec: stretchSeconds(steps) };
}
