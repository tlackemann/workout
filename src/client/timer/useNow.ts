import { useEffect, useState } from 'react';

/**
 * Wall-clock "now", refreshed on animation frames but at most every `intervalMs`.
 * Timers derive from deadlines, so a throttled or late frame never drifts the countdown.
 */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const loop = () => {
      const t = Date.now();
      if (t - last >= intervalMs) {
        last = t;
        setNow(t);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    // rAF pauses in hidden tabs; a slow interval keeps phases advancing anyway.
    const fallback = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(fallback);
    };
  }, [intervalMs]);

  return now;
}
