import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { matchRoute, type Route } from './routes.ts';

interface RouterValue {
  readonly route: Route;
  readonly navigate: (to: string, options?: { readonly replace?: boolean }) => void;
  readonly back: () => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/**
 * Minimal History-API router. Every screen is a real URL so the TV's Back button
 * (delivered as a history pop, not a keydown) walks back through screens naturally.
 */
export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, options?: { readonly replace?: boolean }) => {
    if (options?.replace) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
    setPath(to);
  }, []);

  const back = useCallback(() => window.history.back(), []);

  const value = useMemo(() => ({ route: matchRoute(path), navigate, back }), [path, navigate, back]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>');
  return ctx;
}
