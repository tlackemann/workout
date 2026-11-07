import { describe, expect, it } from 'vitest';
import { LIBRARY } from './library.ts';
import { TEMPLATES } from './templates.ts';
import { librarySchema } from '../core/library/schema.ts';
import { indexLibrary } from '../core/library/index.ts';
import { DEFAULT_EQUIPMENT, isEligible } from '../core/equipment.ts';
import { DAYS } from '../core/days.ts';

const lib = indexLibrary(LIBRARY);
const owned = new Set<string>(DEFAULT_EQUIPMENT);

describe('library data', () => {
  it('passes schema validation', () => {
    const result = librarySchema.safeParse(LIBRARY);
    expect(result.success, JSON.stringify(result.error?.issues?.slice(0, 3))).toBe(true);
  });

  it('progression chains reference real exercises that contain themselves', () => {
    for (const ex of LIBRARY) {
      if (!ex.progressionChain) continue;
      expect(ex.progressionChain).toContain(ex.id);
      for (const id of ex.progressionChain) expect(lib.has(id), id).toBe(true);
    }
  });
});

describe('templates', () => {
  for (const day of DAYS) {
    describe(day, () => {
      const template = TEMPLATES[day];

      it('only references library exercises', () => {
        for (const slot of template.slots) {
          for (const id of [...slot.candidates, ...(slot.fallbacks ?? [])]) {
            expect(lib.has(id), `${slot.id} → ${id}`).toBe(true);
          }
        }
      });

      it('has an eligible candidate for every slot with the default equipment', () => {
        for (const slot of template.slots) {
          const eligible = [...slot.candidates, ...(slot.fallbacks ?? [])].filter((id) =>
            isEligible(lib.get(id)!.requires, owned),
          );
          expect(eligible.length, slot.id).toBeGreaterThan(0);
        }
      });

      it('has two anchors that come first', () => {
        const roles = template.slots.map((s) => s.role);
        expect(roles.slice(0, 2)).toEqual(['anchor', 'anchor']);
        expect(roles.filter((r) => r === 'anchor')).toHaveLength(2);
      });

      it('uses unique slot ids', () => {
        const ids = template.slots.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  }
});

describe('bundled media', () => {
  it('has both frames for every library exercise (run `npm run fetch-media` if this fails)', async () => {
    const { existsSync } = await import('node:fs');
    const missing = LIBRARY.flatMap((ex) =>
      ['0', '1'].filter((f) => !existsSync(`public/media/${ex.freeDbId}/${f}.webp`)).map((f) => `${ex.id}/${f}`),
    );
    expect(missing).toEqual([]);
  });
});
