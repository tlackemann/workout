import { isSecondSide } from '../../../core/stretch/selectors.ts';
import type { StretchMenuAction, StretchNotice, StretchState } from '../../../core/stretch/state.ts';
import type { MenuItem } from '../player/menuItems.ts';

/** Pause-menu options. Resume is always first (and focused). */
export function stretchMenuItems(state: StretchState): MenuItem<StretchMenuAction>[] {
  return [
    { action: 'resume', label: 'Resume' },
    { action: 'add15', label: state.phase === 'hold' ? '+15 s more' : '+15 s to get ready' },
    { action: 'skipStretch', label: isSecondSide(state) ? 'Skip this side' : 'Skip this stretch' },
    { action: 'end', label: 'End session' },
  ];
}

const NOTICES: Record<Exclude<StretchNotice, null>, string> = {
  welcome_back: 'Welcome back. Your stretch session is paused.',
  caught_up: 'Paused while you were away.',
};

export function stretchNotice(notice: StretchNotice): string | null {
  return notice ? NOTICES[notice] : null;
}

export const STRETCH_END_COPY = {
  title: 'End this stretch session?',
  body: 'Stretches you held are kept in History.',
  endLabel: 'End session',
} as const;
