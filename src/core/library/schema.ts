import { z } from 'zod';
import { EQUIPMENT_TAGS, type EquipmentTag } from '../equipment.ts';
import { MUSCLES } from '../muscles.ts';

export const PATTERNS = [
  'horizontal_push',
  'incline_push',
  'vertical_push',
  'chest_fly',
  'lateral_raise',
  'triceps',
  'horizontal_pull',
  'vertical_pull',
  'rear_delt',
  'biceps',
  'shrug',
  'squat',
  'hinge',
  'lunge',
  'quad_iso',
  'ham_curl',
  'glute',
  'calf',
  'core',
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const LOAD_TYPES = ['barbell', 'ez_bar', 'stack', 'dumbbell', 'bodyweight'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

const equipmentTag = z.enum(EQUIPMENT_TAGS as [EquipmentTag, ...EquipmentTag[]]);
const muscle = z.enum(MUSCLES);

const loadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('barbell'), lower: z.boolean() }),
  z.object({ type: z.literal('ez_bar') }),
  z.object({ type: z.literal('dumbbell') }),
  z.object({ type: z.literal('bodyweight') }),
  z.object({ type: z.literal('stack'), station: equipmentTag }),
]);

export const exerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(36),
  freeDbId: z.string().min(1),
  requires: z.array(z.array(equipmentTag).min(1)),
  family: z.string().min(1),
  pattern: z.enum(PATTERNS),
  muscles: z.object({ primary: z.array(muscle).min(1), secondary: z.array(muscle) }),
  cues: z.array(z.string().min(1).max(40)).min(1).max(3),
  tempo: z.object({ down: z.number().positive(), up: z.number().positive() }),
  load: loadSchema,
  startLoad: z.number().nonnegative(),
  /** Bodyweight progressions: ordered easiest → hardest, including this exercise. */
  progressionChain: z.array(z.string()).optional(),
});

export type ExerciseDef = z.infer<typeof exerciseSchema>;
export type LoadSpec = ExerciseDef['load'];

export const librarySchema = z
  .array(exerciseSchema)
  .refine((list) => new Set(list.map((e) => e.id)).size === list.length, 'Exercise ids must be unique');
