import { describe, expect, it } from 'vitest';
import { DEFAULT_EQUIPMENT, EQUIPMENT_TAGS, isEligible } from './equipment.ts';

describe('isEligible', () => {
  const have = new Set(['barbell', 'bench.flat', 'ez_bar']);

  it('requires every AND group to be satisfied', () => {
    expect(isEligible([['barbell'], ['bench.flat']], have)).toBe(true);
    expect(isEligible([['barbell'], ['preacher_pad']], have)).toBe(false);
  });

  it('accepts any tag inside an OR group', () => {
    expect(isEligible([['dumbbells', 'ez_bar']], have)).toBe(true);
    expect(isEligible([['dumbbells', 'pullup_bar']], have)).toBe(false);
  });

  it('treats an empty requirement list as bodyweight (always eligible)', () => {
    expect(isEligible([], new Set())).toBe(true);
  });
});

describe('equipment catalogue', () => {
  it('defaults exclude the not-yet-owned items', () => {
    expect(DEFAULT_EQUIPMENT).not.toContain('dumbbells');
    expect(DEFAULT_EQUIPMENT).not.toContain('pullup_bar');
    expect(DEFAULT_EQUIPMENT).not.toContain('dip_bars');
    expect(DEFAULT_EQUIPMENT).toContain('mx.lat_pulldown');
  });

  it('only defaults to known tags', () => {
    for (const tag of DEFAULT_EQUIPMENT) expect(EQUIPMENT_TAGS).toContain(tag);
  });
});
