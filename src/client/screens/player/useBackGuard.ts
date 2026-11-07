import { useEffect, useRef } from 'react';
import { normalizeKey } from '../../input/keymap.ts';

/** A keydown Back and the history pop it may also cause count as one press. */
const DEDUPE_MS = 500;
/** Guard entries kept in reserve, so a pause + resume pair never reaches real history. */
const RESERVE = 2;

/**
 * Keeps guard history entries (same URL) above the player so the TV's Back button,
 * which arrives as a history pop, opens/closes the pause menu instead of leaving.
 * Entries are pushed when the player becomes ready and topped up on each keydown
 * (a user activation), never inside popstate, which Chrome would mark skippable.
 */
export function useBackGuard(onBack: () => void, enabled: boolean): void {
  const depth = useRef(0);
  const lastKeyBack = useRef(0);
  const callback = useRef(onBack);
  callback.current = onBack;

  useEffect(() => {
    if (!enabled) return undefined;
    const topUp = () => {
      while (depth.current < RESERVE) {
        window.history.pushState({ guard: true }, '', window.location.href);
        depth.current += 1;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (normalizeKey(e) === 'BACK') lastKeyBack.current = Date.now();
      topUp();
    };
    const onPop = () => {
      if (depth.current === 0) return;
      depth.current -= 1;
      if (Date.now() - lastKeyBack.current < DEDUPE_MS) return;
      callback.current();
    };
    topUp();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('popstate', onPop);
    };
  }, [enabled]);
}
