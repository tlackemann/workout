import type { MiddlewareHandler } from 'hono';
import { fail } from './http.ts';

interface Window {
  readonly start: number;
  readonly count: number;
}

/** Fixed-window per-client rate limit. Generous: one TV + one phone on a LAN. */
export function rateLimit(limit: number, windowMs: number, clientKey: (c: Parameters<MiddlewareHandler>[0]) => string): MiddlewareHandler {
  const windows = new Map<string, Window>();
  return async (c, next) => {
    const key = clientKey(c);
    const now = Date.now();
    const current = windows.get(key);
    const window = !current || now - current.start >= windowMs ? { start: now, count: 0 } : current;
    if (window.count >= limit) return fail(c, 429, 'Too many requests, slow down');
    windows.set(key, { ...window, count: window.count + 1 });
    await next();
  };
}

/** Mutating API calls must be JSON: forces a CORS preflight for cross-site requests (CSRF guard). */
export const requireJson: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const type = c.req.header('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) return fail(c, 415, 'Expected application/json');
  return next();
};
