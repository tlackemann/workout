import { describe, expect, it } from 'vitest';
import { RECOVERY_TAGS } from './equipment.ts';
import { DEFAULT_SETTINGS, migrateSettings, resolveSettings, settingsSchema } from './settings.ts';

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

  it('defaults stretching to 30 s holds and 10 s to get into position, with the recovery gear on', () => {
    expect(DEFAULT_SETTINGS.stretch).toEqual({ holdSec: 30, setupSec: 10 });
    for (const tag of RECOVERY_TAGS) expect(DEFAULT_SETTINGS.equipment).toContain(tag);
  });

  it('accepts settings without a stretch block (a TV still running the old bundle)', () => {
    const { stretch: _omit, ...old } = DEFAULT_SETTINGS;
    const parsed = settingsSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.stretch).toEqual({ holdSec: 30, setupSec: 10 });
  });

  it('rejects hold and setup times off the allowed steps', () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, stretch: { holdSec: 40, setupSec: 10 } }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, stretch: { holdSec: 30, setupSec: 25 } }).success).toBe(false);
  });

  it('merges a partial stretch block over the defaults', () => {
    expect(resolveSettings({ stretch: { holdSec: 60 } }).stretch).toEqual({ holdSec: 60, setupSec: 10 });
  });
});

describe('migrateSettings', () => {
  const { stretch: _omit, ...preStretch } = { ...DEFAULT_SETTINGS, equipment: ['barbell', 'rack', 'foam_roller'] };

  it('switches the recovery gear on once for settings saved before stretching existed', () => {
    const migrated = migrateSettings(preStretch);
    expect(migrated.changed).toBe(true);
    const equipment = (migrated.value as { equipment: string[] }).equipment;
    expect(equipment.slice(0, 3)).toEqual(['barbell', 'rack', 'foam_roller']);
    for (const tag of RECOVERY_TAGS) expect(equipment.filter((t) => t === tag)).toHaveLength(1);
    expect(resolveSettings(migrated.value).stretch).toEqual(DEFAULT_SETTINGS.stretch);
  });

  it('leaves settings alone once they have a stretch block (gear turned off stays off)', () => {
    const current = { ...DEFAULT_SETTINGS, equipment: ['barbell'] };
    expect(migrateSettings(current)).toEqual({ value: current, changed: false });
    expect(migrateSettings(migrateSettings(preStretch).value).changed).toBe(false);
  });

  it('ignores missing or garbage settings (defaults already include the gear)', () => {
    expect(migrateSettings(null).changed).toBe(false);
    expect(migrateSettings('nope').changed).toBe(false);
  });
});
