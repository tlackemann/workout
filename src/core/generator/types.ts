import type { Day } from '../days.ts';
import type { Pattern } from '../library/schema.ts';

export type SlotRole = 'anchor' | 'accessory';
export type Priority = 1 | 2 | 3 | 4;

export interface Slot {
  readonly id: string;
  readonly label: string;
  readonly role: SlotRole;
  /** Ordered candidates. For anchors, the first is the default anchor. */
  readonly candidates: readonly string[];
  /** Anchors only: tried in order when no candidate is available. */
  readonly fallbacks?: readonly string[];
  /** Patterns to widen into when no candidate fits (small-pool relaxation). */
  readonly widen?: readonly Pattern[];
  readonly sets: number;
  readonly repMin: number;
  readonly repMax: number;
  readonly restSec: number;
  readonly priority: Priority;
  /** As many reps as possible: no progression target, just log what you got. */
  readonly amrap?: boolean;
}

export interface DayTemplate {
  readonly day: Day;
  readonly slots: readonly Slot[];
}

export type Templates = Readonly<Record<Day, DayTemplate>>;
