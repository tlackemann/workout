import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EQUIPMENT, isEligible, RECOVERY_TAGS } from '../core/equipment.ts';
import { indexStretches, stretchLibrarySchema } from '../core/stretch/schema.ts';
import { LIBRARY } from './library.ts';
import { STRETCH_TEMPLATE } from './stretchTemplate.ts';
import { STRETCHES } from './stretches.ts';

const lib = indexStretches(STRETCHES);
const owned = new Set<string>(DEFAULT_EQUIPMENT);
const noRecoveryGear = new Set<string>(DEFAULT_EQUIPMENT.filter((t) => !RECOVERY_TAGS.includes(t)));
/** Need a partner, which a solo home gym doesn't have. */
const PARTNER_STRETCHES = ['Lying_Hamstring', 'Overhead_Lat', 'Adductor_Groin', 'Seated_Glute', 'Behind_Head_Chest_Stretch'];

describe('stretch library data', () => {
  it('passes schema validation', () => {
    const result = stretchLibrarySchema.safeParse(STRETCHES);
    expect(result.success, JSON.stringify(result.error?.issues?.slice(0, 3))).toBe(true);
  });

  it('shares no ids with the exercise library (media and prefs are looked up by id)', () => {
    const exerciseIds = new Set(LIBRARY.map((e) => e.id));
    expect(STRETCHES.map((s) => s.id).filter((id) => exerciseIds.has(id))).toEqual([]);
  });

  it('leaves out stretches that need a partner', () => {
    expect(STRETCHES.filter((s) => PARTNER_STRETCHES.includes(s.freeDbId))).toEqual([]);
  });

  it('puts every foam-roll move behind the foam roller toggle', () => {
    for (const s of STRETCHES.filter((d) => d.block === 'roll')) expect(s.requires, s.id).toEqual([['foam_roller']]);
  });
});

describe('stretch template', () => {
  it('only references library stretches of the slot’s block', () => {
    for (const slot of STRETCH_TEMPLATE) {
      for (const id of slot.candidates) {
        expect(lib.has(id), `${slot.id} → ${id}`).toBe(true);
        expect(lib.get(id)?.block, `${slot.id} → ${id}`).toBe(slot.block);
      }
    }
  });

  it('uses unique slot ids and pins only the relax pose', () => {
    const ids = STRETCH_TEMPLATE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(STRETCH_TEMPLATE.filter((s) => s.pin).map((s) => s.id)).toEqual(['relax']);
  });

  it('has an eligible candidate for every slot with the default equipment', () => {
    for (const slot of STRETCH_TEMPLATE) {
      const eligible = slot.candidates.filter((id) => isEligible(lib.get(id)!.requires, owned));
      expect(eligible.length, slot.id).toBeGreaterThan(0);
    }
  });

  it('still covers every non-roll slot with all recovery gear switched off', () => {
    for (const slot of STRETCH_TEMPLATE.filter((s) => s.block !== 'roll')) {
      const eligible = slot.candidates.filter((id) => isEligible(lib.get(id)!.requires, noRecoveryGear));
      expect(eligible.length, slot.id).toBeGreaterThan(0);
    }
  });

  it('uses every library stretch somewhere', () => {
    const used = new Set(STRETCH_TEMPLATE.flatMap((s) => s.candidates));
    expect(STRETCHES.map((s) => s.id).filter((id) => !used.has(id))).toEqual([]);
  });
});

describe('bundled stretch media', () => {
  it('has both frames for every stretch (run `npm run fetch-media` if this fails)', () => {
    const missing = STRETCHES.flatMap((s) =>
      ['0', '1'].filter((f) => !existsSync(`public/media/${s.freeDbId}/${f}.webp`)).map((f) => `${s.id}/${f}`),
    );
    expect(missing).toEqual([]);
  });
});
