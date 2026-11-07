import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';
import { fail } from '../http.ts';

/** zod validation that answers in the standard envelope. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue?.path.join('.') || target;
      return fail(c, 400, `Invalid ${where}: ${issue?.message ?? 'bad input'}`);
    }
    return undefined;
  });
}
