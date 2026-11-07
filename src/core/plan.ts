import type { Day, SessionLength } from './days.ts';
import type { SlotRole } from './generator/types.ts';
import type { TargetReason } from './progression/types.ts';

export type SetKind = 'warmup' | 'working';

export interface PlanSet {
  readonly kind: SetKind;
  readonly targetReps: number;
  readonly targetLoad: number;
  /** Rest after this set (includes station changeover after an exercise's last set). */
  readonly restSec: number;
}

export interface PlanItem {
  /** Stable id of this item within its session (survives swaps/inserts). */
  readonly position: number;
  readonly slotId: string;
  readonly slotLabel: string;
  readonly exerciseId: string;
  readonly role: SlotRole;
  readonly repMin: number;
  readonly repMax: number;
  readonly amrap: boolean;
  readonly sets: readonly PlanSet[];
  readonly workingSets: number;
  /** Anchor replaced by a fallback because its equipment is off / it is banned. */
  readonly substituted: boolean;
  readonly reason: TargetReason;
  readonly lastLoad: number | null;
}

export interface Plan {
  readonly day: Day;
  readonly length: SessionLength;
  readonly seed: number;
  readonly items: readonly PlanItem[];
  /** Slots skipped because nothing eligible exists. */
  readonly droppedSlots: readonly string[];
  /** Slots removed to fit the session-length time budget. */
  readonly trimmedSlots: readonly string[];
  readonly estimatedSec: number;
}
