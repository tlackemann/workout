import type { Plan, PlanItem, SetKind } from '../plan.ts';

export const SESSION_SCHEMA_VERSION = 1;
/** Seconds the log stays editable after the final set before the session finishes. */
export const FINAL_LOG_WINDOW_SEC = 20;
export { CATCH_UP_THRESHOLD_MS } from '../timing.ts';
export const ADD_REST_MS = 30_000;

export type Phase = 'intro' | 'work' | 'rest' | 'done';
export type Overlay = 'none' | 'menu' | 'swap' | 'confirmEnd';
export type Notice = 'welcome_back' | 'caught_up' | null;

export interface Cursor {
  readonly item: number;
  readonly set: number;
}

export interface SetRef {
  readonly position: number;
  readonly setIndex: number;
}

export interface SetLog extends SetRef {
  readonly exerciseId: string;
  readonly kind: SetKind;
  readonly reps: number;
  readonly load: number;
  readonly targetReps: number;
  readonly targetLoad: number;
  readonly repMin: number;
  readonly repMax: number;
  readonly plannedSets: number;
  readonly loggedAt: number;
}

export interface Draft {
  readonly cursor: Cursor;
  readonly reps: number;
  readonly load: number;
}

export interface SessionState {
  readonly schemaVersion: typeof SESSION_SCHEMA_VERSION;
  readonly rev: number;
  readonly sessionId: string;
  readonly plan: Plan;
  readonly getReadySec: number;
  readonly cursor: Cursor;
  readonly phase: Phase;
  readonly phaseStartedAt: number;
  readonly endsAt: number | null;
  readonly paused: { readonly at: number } | null;
  readonly overlay: Overlay;
  readonly notice: Notice;
  /** Load for the set in progress (adjustable with ◀▶). */
  readonly load: number;
  /** Pending log for the set just finished; editable during rest. */
  readonly draft: Draft | null;
  readonly logs: readonly SetLog[];
  readonly skipped: readonly SetRef[];
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly endedEarly: boolean;
}

export type MenuAction =
  | 'resume'
  | 'add30'
  | 'skipRest'
  | 'skipSet'
  | 'skipWarmups'
  | 'skipExercise'
  | 'swap'
  | 'end'
  | 'confirmEnd'
  | 'cancel';

export type SessionEvent =
  | { readonly type: 'TICK'; readonly now: number }
  | { readonly type: 'OK'; readonly now: number }
  | { readonly type: 'BACK'; readonly now: number }
  | { readonly type: 'ADJ_REPS'; readonly delta: number; readonly now: number }
  | { readonly type: 'SET_LOAD'; readonly load: number; readonly now: number }
  | { readonly type: 'MENU'; readonly action: MenuAction; readonly now: number }
  | { readonly type: 'SWAP_APPLY'; readonly item: PlanItem; readonly now: number }
  | { readonly type: 'RESTORE'; readonly now: number };
