import type { Plan, PlanItem } from '../plan.ts';
import { buildItem } from './buildItem.ts';
import { makeContext, type GenerateInput } from './generate.ts';
import { rankAlternatives } from './rank.ts';

const MAX_ALTERNATIVES = 5;

export interface AlternativesInput extends GenerateInput {
  readonly plan: Plan;
  readonly position: number;
}

/** Ranked swap options for one plan item, each with fresh progression targets. */
export function alternatives(input: AlternativesInput): PlanItem[] {
  const current = input.plan.items.find((i) => i.position === input.position);
  const slot = current && input.templates[input.day].slots.find((s) => s.id === current.slotId);
  if (!current || !slot) return [];
  const ctx = makeContext(input);
  const exclude = new Set(input.plan.items.map((i) => i.exerciseId));
  return rankAlternatives(ctx, slot, exclude)
    .slice(0, MAX_ALTERNATIVES)
    .map((ex) => buildItem(ctx, slot, ex, current.position, false))
    .filter((item) => !exclude.has(item.exerciseId));
}
