import type { StretchState } from './state.ts';
import type { StretchStep } from './types.ts';

export { elapsedMs, phaseLengthMs, remainingMs } from '../timing.ts';

export function currentStep(state: StretchState): StretchStep | undefined {
  return state.plan.steps[state.index];
}

export function nextStep(state: StretchState): StretchStep | undefined {
  return state.plan.steps[state.index + 1];
}

export function isSecondSide(state: StretchState): boolean {
  return currentStep(state)?.side === 2;
}

/** Steps finished or skipped, 0..1. */
export function stretchProgress(state: StretchState): number {
  const total = state.plan.steps.length;
  return total === 0 ? 1 : (state.completed.length + state.skipped.length) / total;
}

/** Distinct stretches in the plan (a per-side stretch counts once). */
export function stretchCount(steps: readonly StretchStep[]): number {
  return steps.filter((s) => s.side !== 2).length;
}

/** 1-based number of the current stretch among `stretchCount` (both sides share a number). */
export function stretchNumber(state: StretchState): number {
  return stretchCount(state.plan.steps.slice(0, state.index + 1));
}

/** One preview / summary row: a stretch with its one or two steps. */
export interface StretchItem {
  readonly stretchId: string;
  readonly slotId: string;
  readonly holdSec: number;
  readonly perSide: boolean;
  /** Step indices (one, or one per side). */
  readonly indices: readonly number[];
}

/** Merge each per-side stretch's two steps into one row, in session order. */
export function stretchItems(steps: readonly StretchStep[]): StretchItem[] {
  return steps.reduce<StretchItem[]>((items, step) => {
    const last = items.at(-1);
    if (step.side === 2 && last?.stretchId === step.stretchId) {
      return [...items.slice(0, -1), { ...last, indices: [...last.indices, step.index] }];
    }
    return [...items, { stretchId: step.stretchId, slotId: step.slotId, holdSec: step.holdSec, perSide: step.side !== null, indices: [step.index] }];
  }, []);
}
