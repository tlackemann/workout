export interface PlatePair {
  readonly weight: number;
  /** Number of matching pairs (one plate per side each). */
  readonly pairs: number;
}

/** Work in quarter-pounds so 1.25 / 2.5 lb plates stay integral. */
const UNITS_PER_LB = 4;
const toUnits = (lb: number) => Math.round(lb * UNITS_PER_LB);

interface Solution {
  readonly count: number;
  readonly plates: readonly number[];
}

/**
 * Bounded-knapsack DP over per-side weight. For every reachable per-side weight we keep
 * the solution with the fewest plates. Greedy fails with limited inventories, DP does not.
 */
function solveSides(inventory: readonly PlatePair[]): ReadonlyMap<number, Solution> {
  const plates = [...inventory]
    .filter((p) => p.weight > 0 && p.pairs > 0)
    .sort((a, b) => b.weight - a.weight)
    .flatMap((p) => Array.from({ length: p.pairs }, () => p.weight));

  let best = new Map<number, Solution>([[0, { count: 0, plates: [] }]]);
  for (const plate of plates) {
    const next = new Map(best);
    for (const [units, sol] of best) {
      const target = units + toUnits(plate);
      const candidate: Solution = { count: sol.count + 1, plates: [...sol.plates, plate] };
      const existing = next.get(target);
      if (!existing || candidate.count < existing.count) next.set(target, candidate);
    }
    best = next;
  }
  return best;
}

const cache = new WeakMap<readonly PlatePair[], ReadonlyMap<number, Solution>>();

function sides(inventory: readonly PlatePair[]): ReadonlyMap<number, Solution> {
  const hit = cache.get(inventory);
  if (hit) return hit;
  const solved = solveSides(inventory);
  cache.set(inventory, solved);
  return solved;
}

/** Plates to load on EACH side (heaviest first), or null if the total cannot be built. */
export function platesPerSide(total: number, bar: number, inventory: readonly PlatePair[]): number[] | null {
  const perSideUnits = (toUnits(total) - toUnits(bar)) / 2;
  if (!Number.isInteger(perSideUnits) || perSideUnits < 0) return null;
  const sol = sides(inventory).get(perSideUnits);
  return sol ? [...sol.plates].sort((a, b) => b - a) : null;
}

/** Every total weight buildable from the bar + inventory, ascending. */
export function loadableTotals(bar: number, inventory: readonly PlatePair[]): number[] {
  return [...sides(inventory).keys()].map((units) => bar + (units * 2) / UNITS_PER_LB).sort((a, b) => a - b);
}

/** Smallest loadable total >= target (clamped to the heaviest). */
export function nextLoadable(target: number, totals: readonly number[]): number {
  return totals.find((t) => t >= target - 1e-9) ?? totals.at(-1) ?? target;
}

/** Largest loadable total <= target (never below the lightest). */
export function roundDownLoadable(target: number, totals: readonly number[]): number {
  const below = totals.filter((t) => t <= target + 1e-9);
  return below.at(-1) ?? totals[0] ?? target;
}

/** Closest loadable total (the lighter one on a tie), clamped to the loadable range. */
export function nearestLoadable(target: number, totals: readonly number[]): number {
  const below = roundDownLoadable(target, totals);
  const above = nextLoadable(target, totals);
  return Math.abs(above - target) < Math.abs(target - below) - 1e-9 ? above : below;
}

/** Step up/down through loadable totals from the current value. */
export function stepLoadable(current: number, direction: 1 | -1, totals: readonly number[]): number {
  if (direction === 1) return totals.find((t) => t > current + 1e-9) ?? totals.at(-1) ?? current;
  return [...totals].reverse().find((t) => t < current - 1e-9) ?? totals[0] ?? current;
}
