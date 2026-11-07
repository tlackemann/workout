import { useEffect, useRef } from 'react';

/**
 * Gives an overlay (sheet, picker) its own history entry so the TV's Back button,
 * which arrives as a history pop, closes the overlay instead of leaving the screen.
 * Open overlays only in response to a key press (Chrome skips entries pushed without
 * user activation).
 */
export function useOverlayHistory(open: boolean, onBackClose: () => void): void {
  const pushed = useRef(false);
  const ignoreNextPop = useRef(false);
  const close = useRef(onBackClose);
  close.current = onBackClose;

  useEffect(() => {
    if (open && !pushed.current) {
      window.history.pushState({ overlay: true }, '', window.location.href);
      pushed.current = true;
    } else if (!open && pushed.current) {
      pushed.current = false;
      ignoreNextPop.current = true;
      window.history.back();
    }
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      if (ignoreNextPop.current) {
        ignoreNextPop.current = false;
        return;
      }
      if (pushed.current) {
        pushed.current = false;
        close.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
