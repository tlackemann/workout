import { useEffect, useRef } from 'react';
import { upNext } from '../../../core/session/selectors.ts';
import type { SessionState } from '../../../core/session/types.ts';
import { chime, scheduleCountdown } from '../../audio/cues.ts';

/** 3-2-1 + go before every work set; a chime when rest starts and when the workout ends. */
export function useCueAudio(state: SessionState | null): void {
  const counting =
    state && !state.paused && state.endsAt !== null && (state.phase === 'intro' || (state.phase === 'rest' && upNext(state) !== null));
  const key = counting ? `${state.phase}:${state.endsAt}` : null;

  useEffect(() => {
    if (!key || !state?.endsAt) return undefined;
    return scheduleCountdown(state.endsAt - Date.now());
    // Reschedule only when the countdown itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const prevPhase = useRef(state?.phase);
  useEffect(() => {
    const prev = prevPhase.current;
    if (state?.phase === 'rest' && prev === 'work') chime();
    if (state?.phase === 'done' && prev && prev !== 'done') chime();
    prevPhase.current = state?.phase;
  }, [state?.phase]);
}
