import { useEffect, useRef } from 'react';

/** Call `onIdle` once nobody has pressed a key for `ms` (finished screens drift back Home). */
export function useIdleReturn(onIdle: () => void, ms: number): void {
  const latest = useRef(onIdle);
  latest.current = onIdle;
  useEffect(() => {
    let timer = window.setTimeout(() => latest.current(), ms);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => latest.current(), ms);
    };
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', reset);
    };
  }, [ms]);
}
