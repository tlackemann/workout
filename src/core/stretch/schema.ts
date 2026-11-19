import { z } from 'zod';
import { EQUIPMENT_TAGS, type EquipmentTag } from '../equipment.ts';
import { MUSCLES } from '../muscles.ts';

/** Session order: dynamic warm-up, then foam rolling, then static stretches. */
export const STRETCH_BLOCKS = ['warm', 'roll', 'stretch'] as const;
export type StretchBlock = (typeof STRETCH_BLOCKS)[number];

/** Body position, used to order a block so getting up and down happens as little as possible. */
export const POSITIONS = ['standing', 'kneeling', 'seated', 'lying'] as const;
export type Position = (typeof POSITIONS)[number];

export const REGIONS = [
  'full-body',
  'shoulders',
  'chest',
  'lats',
  'back',
  'hip-flexors',
  'hamstrings',
  'glutes',
  'quads',
  'adductors',
  'calves',
  'neck',
] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  'full-body': 'Full body',
  shoulders: 'Shoulders',
  chest: 'Chest',
  lats: 'Lats',
  back: 'Back',
  'hip-flexors': 'Hip flexors',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  quads: 'Quads',
  adductors: 'Inner thighs',
  calves: 'Calves',
  neck: 'Neck',
};

const equipmentTag = z.enum(EQUIPMENT_TAGS as [EquipmentTag, ...EquipmentTag[]]);
const muscle = z.enum(MUSCLES);

export const stretchDefSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(36),
    freeDbId: z.string().min(1),
    block: z.enum(STRETCH_BLOCKS),
    region: z.enum(REGIONS),
    /** 'each' runs twice: first side, then a short switch, then the second side. */
    sides: z.enum(['both', 'each']),
    position: z.enum(POSITIONS),
    /** Warm-up and roll moves: seconds per side. Static stretches use the Settings hold time. */
    durationSec: z.number().int().min(10).max(120).optional(),
    requires: z.array(z.array(equipmentTag).min(1)),
    family: z.string().min(1),
    muscles: z.object({ primary: z.array(muscle).min(1), secondary: z.array(muscle) }),
    cues: z.array(z.string().min(1).max(40)).min(1).max(3),
  })
  .refine((d) => d.block === 'stretch' || d.durationSec !== undefined, 'Warm-up and roll moves need a durationSec');

export type StretchDef = z.infer<typeof stretchDefSchema>;

export const stretchLibrarySchema = z
  .array(stretchDefSchema)
  .refine((list) => new Set(list.map((s) => s.id)).size === list.length, 'Stretch ids must be unique');

export type StretchLibrary = ReadonlyMap<string, StretchDef>;

export function indexStretches(list: readonly StretchDef[]): StretchLibrary {
  return new Map(list.map((s) => [s.id, s]));
}
