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
    expect(resolved.stations['mx.leg_ext']).toEqual({ min: 10, max: 200, step: 10 });
  });

  it('drops retired equipment instead of resetting everything to defaults', () => {
    const plates = [{ weight: 45, pairs: 2 }];
    const stored = {
      ...DEFAULT_SETTINGS,
      plates,
      equipment: ['barbell', 'mx.leg_press', 'mx.leg_curl_lying', 'mx.leg_ext'],
      stations: { 'mx.leg_press': { min: 20, max: 300, step: 20 }, 'mx.leg_ext': { min: 15, max: 150, step: 15 } },
    };
    const resolved = resolveSettings(stored);
    expect(resolved.plates).toEqual(plates);
    expect(resolved.equipment).toEqual(['barbell', 'mx.leg_ext']);
    expect(resolved.stations['mx.leg_ext']).toEqual({ min: 15, max: 150, step: 15 });
    expect(resolved.stations).not.toHaveProperty('mx.leg_press');
  });

  it('falls back to defaults on garbage', () => {
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({ barWeight: -4 })).toEqual(DEFAULT_SETTINGS);
  });
});
