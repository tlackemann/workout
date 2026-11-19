import { useEffect, useRef } from 'react';
import type { StretchState } from '../../../core/stretch/state.ts';
import { chime, scheduleCountdown } from '../../audio/cues.ts';

/** 3-2-1 + go into every hold; a chime when a hold ends (move or switch) and when the session ends. */
export function useStretchCues(state: StretchState | null): void {
  const counting = state && !state.paused && state.endsAt !== null && state.phase === 'setup';
  const key = counting ? `${state.index}:${state.endsAt}` : null;

  useEffect(() => {
    if (!key || !state?.endsAt) return undefined;
    return scheduleCountdown(state.endsAt - Date.now());
    // Reschedule only when the countdown itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const prevPhase = useRef(state?.phase);
  useEffect(() => {
    const prev = prevPhase.current;
    if (prev === 'hold' && state?.phase !== 'hold') chime();
    prevPhase.current = state?.phase;
  }, [state?.phase, state?.index]);
}
