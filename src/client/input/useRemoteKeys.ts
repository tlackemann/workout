import { useEffect, useRef } from 'react';
import { normalizeKey, type RemoteAction } from './keymap.ts';

export interface RemoteKeyInfo {
  readonly repeat: boolean;
}

export type RemoteHandler = (action: RemoteAction, info: RemoteKeyInfo) => void;

/**
 * One window-level listener for remote keys. Calls preventDefault on every mapped key so
 * the WebView never scrolls, moves native focus, or synthesises a click on OK.
 */
export function useRemoteKeys(handler: RemoteHandler, enabled = true): void {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      const action = normalizeKey(e);
      if (!action) return;
      e.preventDefault();
      latest.current(action, { repeat: e.repeat });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
