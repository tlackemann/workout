import { useEffect, useReducer, useRef, useState } from 'react';
import { createStretchSession, reduceStretch } from '../../../core/stretch/reducer.ts';
import type { StretchEvent, StretchState } from '../../../core/stretch/state.ts';
import { api, ApiError, type StretchSessionDto } from '../../app/api.ts';
import { useNow } from '../../timer/useNow.ts';
import { clearLocalStretch, readLocalStretch, writeLocalStretch } from './storage.ts';

type Action = StretchEvent | { readonly type: 'LOAD'; readonly state: StretchState };

function reducer(state: StretchState | null, action: Action): StretchState | null {
  if (action.type === 'LOAD') return action.state;
  return state ? reduceStretch(state, action) : state;
}

export type StretchLoadStatus = 'loading' | 'ready' | 'gone' | 'error';
export type StretchSaveStatus = 'idle' | 'saving' | 'offline';

const RETRY_MS = 3000;

/**
 * Owns the stretch player: restores the local copy (or starts fresh), runs the reducer,
 * ticks deadlines, mirrors every revision to localStorage, and reports the outcome to the
 * server once the session is done, retrying while offline.
 */
export function useStretchSession(id: string, onFinished: (dto: StretchSessionDto) => void) {
  const [state, dispatch] = useReducer(reducer, null);
  const [status, setStatus] = useState<StretchLoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<StretchSaveStatus>('idle');
  const finished = useRef(onFinished);
  finished.current = onFinished;
  const now = useNow(250);

  useEffect(() => {
    let cancelled = false;
    api
      .stretch(id)
      .then((dto) => {
        if (cancelled) return;
        // Finished or abandoned (e.g. Back from the summary lands on the old play entry): leave for Home.
        if (dto.status !== 'active') return setStatus('gone');
        const local = readLocalStretch(id);
        dispatch({ type: 'LOAD', state: local ?? createStretchSession(id, dto.plan, Date.now()) });
        if (local && local.rev > 0) dispatch({ type: 'RESTORE', now: Date.now() });
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the stretch session');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (state) writeLocalStretch(state);
  }, [state]);

  const done = state?.phase === 'done';
  useEffect(() => {
    if (!done || !state) return undefined;
    let cancelled = false;
    let retry = 0;
    const outcome = { endedEarly: state.endedEarly, completed: state.completed, skipped: state.skipped, endedAt: state.endedAt ?? undefined };
    const send = () => {
      setSaveStatus('saving');
      api
        .finishStretch(id, outcome)
        .then((dto) => {
          if (cancelled) return;
          clearLocalStretch(id);
          finished.current(dto);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          // The server refused (e.g. finished elsewhere): retrying can't help.
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            clearLocalStretch(id);
            setStatus('gone');
            return;
          }
          setSaveStatus('offline');
          retry = window.setTimeout(send, RETRY_MS);
        });
    };
    send();
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
    // Report once, when the session reaches done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, id]);

  useEffect(() => {
    if (state && !state.paused && state.endsAt !== null && now >= state.endsAt) dispatch({ type: 'TICK', now });
  }, [now, state]);

  return { state, dispatch, status, error, saveStatus, now };
}
