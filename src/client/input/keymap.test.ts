import { describe, expect, it } from 'vitest';
import { normalizeKey } from './keymap.ts';

describe('normalizeKey', () => {
  it.each([
    [{ keyCode: 37 }, 'LEFT'],
    [{ keyCode: 38 }, 'UP'],
    [{ keyCode: 39 }, 'RIGHT'],
    [{ keyCode: 40 }, 'DOWN'],
    [{ keyCode: 13 }, 'OK'],
    [{ keyCode: 10009 }, 'BACK'],
    [{ keyCode: 461 }, 'BACK'],
    [{ keyCode: 179 }, 'PLAYPAUSE'],
  ] as const)('maps keyCode %o → %s', (event, action) => {
    expect(normalizeKey(event)).toBe(action);
  });

  it('prefers keyCode over an "Unidentified" key', () => {
    expect(normalizeKey({ keyCode: 461, key: 'Unidentified' })).toBe('BACK');
  });

  it('falls back to the key name', () => {
    expect(normalizeKey({ keyCode: 0, key: 'Escape' })).toBe('BACK');
    expect(normalizeKey({ key: 'MediaPlayPause' })).toBe('PLAYPAUSE');
  });

  it('ignores unrelated keys', () => {
    expect(normalizeKey({ keyCode: 65, key: 'a' })).toBeNull();
  });
});
