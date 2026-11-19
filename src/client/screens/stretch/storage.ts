import { STRETCH_SCHEMA_VERSION, type StretchState } from '../../../core/stretch/state.ts';

const key = (id: string) => `gymtv:stretch:${id}`;

/**
 * localStorage copy of the stretch player (the only live copy: the server only hears
 * the outcome). Every access is guarded: TV WebViews can refuse storage.
 */
export function readLocalStretch(id: string): StretchState | null {
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StretchState;
    return parsed.schemaVersion === STRETCH_SCHEMA_VERSION && parsed.sessionId === id ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalStretch(state: StretchState): void {
  try {
    window.localStorage.setItem(key(state.sessionId), JSON.stringify(state));
  } catch {
    // Storage full or blocked: a reload restarts the session from the top, nothing worse.
  }
}

export function clearLocalStretch(id: string): void {
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    // ignore
  }
}
