import { z } from 'zod';
import { stretchPlanSchema, type StretchPlan } from '../../core/stretch/types.ts';
import type { StretchRow } from '../repositories/stretchRepo.ts';

export interface StretchSessionDto {
  readonly id: string;
  readonly status: StretchRow['status'];
  readonly length: StretchRow['length'];
  readonly plan: StretchPlan;
  /** Step indices held to the end (or moved on with OK). Empty until the session ends. */
  readonly completed: readonly number[];
  readonly skipped: readonly number[];
  readonly createdAt: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
}

const indices = z.array(z.number().int().min(0));

function parseIndices(json: string): number[] {
  const parsed = indices.safeParse(JSON.parse(json));
  return parsed.success ? parsed.data : [];
}

export function toStretchDto(row: StretchRow): StretchSessionDto {
  return {
    id: row.id,
    status: row.status,
    length: row.length,
    plan: stretchPlanSchema.parse(JSON.parse(row.planJson)) as StretchPlan,
    completed: parseIndices(row.completedJson),
    skipped: parseIndices(row.skippedJson),
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

/** Distinct stretch ids a session used, for the recency penalty. */
export function stretchIdsOf(row: StretchRow): string[] {
  return [...new Set(toStretchDto(row).plan.steps.map((s) => s.stretchId))];
}
