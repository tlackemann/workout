import { z } from 'zod';
import { SESSION_LENGTHS, type SessionLength } from '../days.ts';
import type { StretchBlock } from './schema.ts';

export type StretchPriority = 1 | 2 | 3;

export interface StretchSlot {
  readonly id: string;
  readonly label: string;
  readonly block: StretchBlock;
  /** Quick keeps priority 1, Standard 1–2, Long everything. */
  readonly priority: StretchPriority;
  /** Ordered candidates (earlier ones are slightly preferred). */
  readonly candidates: readonly string[];
  /** Always the final stretch (the relax pose). */
  readonly pin?: 'last';
}

export interface StretchStep {
  /** Position in the session (0-based). */
  readonly index: number;
  readonly slotId: string;
  readonly stretchId: string;
  /** 1 or 2 for stretches done once per side; null when both sides go together. */
  readonly side: 1 | 2 | null;
  /** "Get into position" countdown before the hold. */
  readonly setupSec: number;
  readonly holdSec: number;
}

export interface StretchPlan {
  readonly length: SessionLength;
  readonly seed: number;
  readonly steps: readonly StretchStep[];
  /** Slots with nothing eligible (e.g. every roll when the foam roller is off). */
  readonly droppedSlots: readonly string[];
  readonly estimatedSec: number;
}

const int = z.number().int();

export const stretchStepSchema = z.object({
  index: int.min(0),
  slotId: z.string().min(1).max(64),
  stretchId: z.string().min(1).max(64),
  side: z.union([z.literal(1), z.literal(2), z.null()]),
  setupSec: int.min(0).max(120),
  holdSec: int.min(1).max(300),
});

export const stretchPlanSchema = z.object({
  length: z.enum(SESSION_LENGTHS),
  seed: int,
  steps: z.array(stretchStepSchema).max(80),
  droppedSlots: z.array(z.string()),
  estimatedSec: z.number().nonnegative(),
});
