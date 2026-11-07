import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json<ApiResponse<T>>({ success: true, data, error: null }, status);
}

export function fail<T = null>(c: Context, status: ContentfulStatusCode, error: string, data: T | null = null) {
  return c.json<ApiResponse<T>>({ success: false, data, error }, status);
}

export class HttpError extends Error {
  readonly status: ContentfulStatusCode;
  constructor(status: ContentfulStatusCode, message: string) {
    super(message);
    this.status = status;
  }
}
