import { SESSION_SCHEMA_VERSION, type SessionState } from '../../../core/session/types.ts';

const key = (id: string) => `gymtv:session:${id}`;

/** localStorage mirror of the player state. Every access is guarded: TV WebViews can refuse storage. */
export function readLocal(id: string): SessionState | null {
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    return parsed.schemaVersion === SESSION_SCHEMA_VERSION && parsed.sessionId === id ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocal(state: SessionState): void {
  try {
    window.localStorage.setItem(key(state.sessionId), JSON.stringify(state));
  } catch {
    // Storage full or blocked: the server copy is the source of truth anyway.
  }
}

export function clearLocal(id: string): void {
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    // ignore
  }
}

/** Whichever copy has the higher revision wins. */
export function pickNewest(server: SessionState, local: SessionState | null): SessionState {
  return local && local.rev > server.rev ? local : server;
}
