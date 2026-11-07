import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { reduce } from '../../../core/session/reducer.ts';
import type { SessionEvent, SessionState } from '../../../core/session/types.ts';
import { api, ApiError, type SessionDto } from '../../app/api.ts';
import { useNow } from '../../timer/useNow.ts';
import { clearLocal, pickNewest, readLocal, writeLocal } from './storage.ts';

type Action =
  | SessionEvent
  | { readonly type: 'LOAD'; readonly state: SessionState }
  /** Same content, higher revision: makes a local state win over the server's copy. */
  | { readonly type: 'REBASE'; readonly rev: number };

function playerReducer(state: SessionState | null, action: Action): SessionState | null {
  if (action.type === 'LOAD') return action.state;
  if (!state) return state;
  if (action.type === 'REBASE') return action.rev > state.rev ? { ...state, rev: action.rev } : state;
  return reduce(state, action);
}

export type LoadStatus = 'loading' | 'ready' | 'gone' | 'error';
export type SaveStatus = 'saved' | 'saving' | 'offline';

const SAVE_DEBOUNCE_MS = 400;
const RETRY_MS = 3000;

/**
 * Owns the player state: loads (server vs local copy, newest wins), runs the reducer,
 * ticks deadlines, and persists every revision: localStorage immediately, the server
 * debounced and strictly one request at a time (highest revision wins on conflict).
 */
export function usePlayerSession(id: string, onFinished: () => void) {
  const [state, dispatch] = useReducer(playerReducer, null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const latest = useRef(state);
  latest.current = state;
  /** Highest revision the server is known to hold. */
  const savedRev = useRef(-1);
  const inFlight = useRef(false);
  const retry = useRef(0);
  const finished = useRef(onFinished);
  finished.current = onFinished;
  const now = useNow(250);

  useEffect(() => {
    let cancelled = false;
    api
      .session(id)
      .then((dto: SessionDto) => {
        if (cancelled) return;
        if (dto.status !== 'active' || !dto.state) {
          setStatus('gone');
          return;
        }
        const chosen = pickNewest(dto.state, readLocal(id));
        savedRev.current = dto.state.rev;
        dispatch({ type: 'LOAD', state: chosen });
        if (chosen.phase === 'done') dispatch({ type: 'REBASE', rev: savedRev.current + 1 });
        else if (chosen.rev > 0) dispatch({ type: 'RESTORE', now: Date.now() });
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the workout');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** 409 handling. Returns false if the error wasn't a conflict. */
  const resolveConflict = useCallback((err: unknown): boolean => {
    if (!(err instanceof ApiError) || err.status !== 409) return false;
    const dto = err.data as SessionDto | null;
    if (dto && dto.status !== 'active') {
      // Finished or abandoned elsewhere: stop writing.
      if (dto.status === 'completed' || dto.status === 'ended_early') finished.current();
      else setStatus('gone');
      return true;
    }
    const server = dto?.state;
    const local = latest.current;
    if (server && local) {
      savedRev.current = Math.max(savedRev.current, server.rev);
      if (server.rev > local.rev) dispatch({ type: 'LOAD', state: server });
      else if (server.rev === local.rev) dispatch({ type: 'REBASE', rev: server.rev + 1 });
    }
    setSaveStatus('saved');
    return true;
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(retry.current);
    const s = latest.current;
    if (!s || s.rev <= savedRev.current || inFlight.current) return;
    inFlight.current = true;
    setSaveStatus('saving');
    let again = false;
    try {
      await api.saveState(id, s);
      savedRev.current = Math.max(savedRev.current, s.rev);
      setSaveStatus('saved');
      if (s.phase === 'done') {
        clearLocal(id);
        finished.current();
        return;
      }
      again = true;
    } catch (err) {
      if (resolveConflict(err)) again = true;
      else {
        setSaveStatus('offline');
        retry.current = window.setTimeout(() => void flush(), RETRY_MS);
      }
    } finally {
      inFlight.current = false;
    }
    // Revisions made while this request was in flight go out next.
    if (again && latest.current && latest.current.rev > savedRev.current) void flush();
  }, [id, resolveConflict]);

  useEffect(() => {
    if (!state) return undefined;
    writeLocal(state);
    if (state.rev <= savedRev.current) return undefined;
    const timer = window.setTimeout(() => void flush(), state.phase === 'done' ? 0 : SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // Persist once per revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.rev, flush]);

  useEffect(() => () => window.clearTimeout(retry.current), []);

  useEffect(() => {
    if (state && !state.paused && state.endsAt !== null && now >= state.endsAt) dispatch({ type: 'TICK', now });
  }, [now, state]);

  return { state, dispatch, status, error, saveStatus, now };
}
