import type { Plan } from '../../core/plan.ts';
import { planSchema, sessionStateSchema } from '../../core/session/schema.ts';
import type { SessionState } from '../../core/session/types.ts';
import type { SessionRow } from '../repositories/sessionsRepo.ts';

export interface SessionDto {
  readonly id: string;
  readonly day: SessionRow['day'];
  readonly status: SessionRow['status'];
  readonly length: SessionRow['length'];
  readonly plan: Plan;
  readonly state: SessionState | null;
  readonly createdAt: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
}

export function parseState(json: string | null): SessionState | null {
  if (!json) return null;
  const parsed = sessionStateSchema.safeParse(JSON.parse(json));
  return parsed.success ? (parsed.data as SessionState) : null;
}

export function toDto(row: SessionRow): SessionDto {
  const state = parseState(row.stateJson);
  return {
    id: row.id,
    day: row.day,
    status: row.status,
    length: row.length,
    plan: state?.plan ?? (planSchema.parse(JSON.parse(row.planJson)) as Plan),
    state,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

/** Exercise ids a finished session actually used (post-swap plan if available). */
export function exerciseIdsOf(row: SessionRow): string[] {
  return toDto(row).plan.items.map((i) => i.exerciseId);
}
