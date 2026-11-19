import type { StretchPlan } from './types.ts';

export const STRETCH_SCHEMA_VERSION = 1;
export const ADD_HOLD_MS = 15_000;

/** setup = "get into position" countdown; hold = the stretch itself. Both auto-advance. */
export type StretchPhase = 'setup' | 'hold' | 'done';
export type StretchOverlay = 'none' | 'menu' | 'confirmEnd';
export type StretchNotice = 'welcome_back' | 'caught_up' | null;
export type StretchMenuAction = 'resume' | 'add15' | 'skipStretch' | 'end' | 'confirmEnd' | 'cancel';

export interface StretchState {
  readonly schemaVersion: typeof STRETCH_SCHEMA_VERSION;
  readonly rev: number;
  readonly sessionId: string;
  readonly plan: StretchPlan;
  /** Current step index (equals steps.length once done). */
  readonly index: number;
  readonly phase: StretchPhase;
  readonly phaseStartedAt: number;
  readonly endsAt: number | null;
  readonly paused: { readonly at: number } | null;
  readonly overlay: StretchOverlay;
  readonly notice: StretchNotice;
  /** Step indices whose hold ran (or was ended early with OK). */
  readonly completed: readonly number[];
  readonly skipped: readonly number[];
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly endedEarly: boolean;
}

export type StretchEvent =
  | { readonly type: 'TICK'; readonly now: number }
  | { readonly type: 'OK'; readonly now: number }
  | { readonly type: 'BACK'; readonly now: number }
  | { readonly type: 'MENU'; readonly action: StretchMenuAction; readonly now: number }
  | { readonly type: 'RESTORE'; readonly now: number };
