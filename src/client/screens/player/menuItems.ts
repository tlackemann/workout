import { actionItemIndex } from '../../../core/session/cursor.ts';
import { currentSet } from '../../../core/session/selectors.ts';
import type { MenuAction, SessionState } from '../../../core/session/types.ts';

export interface MenuItem<A extends string = MenuAction> {
  readonly action: A;
  readonly label: string;
}

/** Pause-menu options for the current phase. Resume is always first (and focused). */
export function menuItems(state: SessionState): MenuItem[] {
  const phaseItems: MenuItem[] =
    state.phase === 'rest'
      ? [
          { action: 'add30', label: '+30 s rest' },
          { action: 'skipRest', label: 'Skip rest' },
        ]
      : [
          { action: 'skipSet', label: 'Skip this set' },
          ...(currentSet(state)?.kind === 'warmup' ? [{ action: 'skipWarmups' as const, label: 'Skip warm-ups' }] : []),
        ];
  // During the changeover rest these act on the exercise coming up next.
  const which = actionItemIndex(state) === state.cursor.item ? 'exercise' : 'next exercise';
  return [
    { action: 'resume', label: 'Resume' },
    ...phaseItems,
    { action: 'skipExercise', label: `Skip ${which}` },
    { action: 'swap', label: `Swap ${which}` },
    { action: 'end', label: 'End workout' },
  ];
}
