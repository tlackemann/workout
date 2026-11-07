import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, resolveSettings, settingsSchema } from './settings.ts';

describe('settings', () => {
  it('defaults are valid', () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });

  it('merges partial stored settings over defaults', () => {
    const resolved = resolveSettings({ barWeight: 35, audio: { volume: 0.2 } });
    expect(resolved.barWeight).toBe(35);
    expect(resolved.audio.volume).toBe(0.2);
    expect(resolved.audio.enabled).toBe(true);
    expect(resolved.stations['mx.leg_press']).toEqual({ min: 10, max: 200, step: 10 });
  });

  it('falls back to defaults on garbage', () => {
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({ barWeight: -4 })).toEqual(DEFAULT_SETTINGS);
  });
});
