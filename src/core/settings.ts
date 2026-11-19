import { z } from 'zod';
import { DEFAULT_EQUIPMENT, EQUIPMENT_TAGS, isEquipmentTag, RECOVERY_TAGS, type EquipmentTag } from './equipment.ts';
import { SESSION_LENGTHS } from './days.ts';

const stationSchema = z
  .object({ min: z.number().min(0), max: z.number().positive(), step: z.number().positive() })
  .refine((s) => s.max > s.min, 'Station max must exceed min');

const anchorMap = z.record(z.string(), z.string());

export const STRETCH_HOLD = { min: 30, max: 60, step: 15 } as const;
export const STRETCH_SETUP = { min: 5, max: 20, step: 5 } as const;
const DEFAULT_STRETCH = { holdSec: 30, setupSec: 10 } as const;

const stepped = (range: { readonly min: number; readonly max: number; readonly step: number }) =>
  z
    .number()
    .int()
    .min(range.min)
    .max(range.max)
    .refine((n) => (n - range.min) % range.step === 0, `Must be in steps of ${range.step}`);

const stretchSchema = z.object({ holdSec: stepped(STRETCH_HOLD), setupSec: stepped(STRETCH_SETUP) });

export const settingsSchema = z.object({
  units: z.literal('lb'),
  equipment: z.array(z.enum(EQUIPMENT_TAGS as [EquipmentTag, ...EquipmentTag[]])),
  /** day → slotId → exerciseId (overrides the template's default anchor). */
  anchors: z.object({ push: anchorMap, pull: anchorMap, legs: anchorMap }),
  plates: z.array(z.object({ weight: z.number().positive(), pairs: z.number().int().min(0).max(20) })).max(12),
  barWeight: z.number().positive().max(100),
  ezBarWeight: z.number().positive().max(60),
  dumbbellStep: z.number().positive().max(20),
  /** Weight-stack profiles keyed by station equipment tag. */
  stations: z.record(z.string(), stationSchema),
  increments: z.object({ upper: z.number().positive(), lower: z.number().positive() }),
  changeoverSec: z.number().int().min(0).max(300),
  getReadySec: z.number().int().min(0).max(60),
  defaultLength: z.enum(SESSION_LENGTHS),
  audio: z.object({ enabled: z.boolean(), volume: z.number().min(0).max(1), keepAlive: z.boolean() }),
  /** Stretch day: static hold length and the "get into position" gap before each stretch. */
  stretch: stretchSchema.default({ ...DEFAULT_STRETCH }),
});

export type Settings = z.infer<typeof settingsSchema>;

const MX_STATIONS = [
  'mx.chest_press',
  'mx.shoulder_press',
  'mx.pec_fly',
  'mx.lat_pulldown',
  'mx.low_row',
  'mx.leg_ext',
  'mx.leg_curl_seated',
  'mx.ab_crunch',
] as const;

/** MX 4800 stacks are ~200 lb; real increments get set once in Settings. */
const DEFAULT_STATION = { min: 10, max: 200, step: 10 } as const;

export const DEFAULT_SETTINGS: Settings = {
  units: 'lb',
  equipment: [...DEFAULT_EQUIPMENT],
  anchors: { push: {}, pull: {}, legs: {} },
  plates: [
    { weight: 45, pairs: 4 },
    { weight: 35, pairs: 1 },
    { weight: 25, pairs: 2 },
    { weight: 10, pairs: 2 },
    { weight: 5, pairs: 2 },
    { weight: 2.5, pairs: 2 },
  ],
  barWeight: 45,
  ezBarWeight: 25,
  dumbbellStep: 5,
  stations: Object.fromEntries(MX_STATIONS.map((s) => [s, { ...DEFAULT_STATION }])),
  increments: { upper: 5, lower: 10 },
  changeoverSec: 30,
  getReadySec: 10,
  defaultLength: 'standard',
  audio: { enabled: true, volume: 0.8, keepAlive: false },
  stretch: { ...DEFAULT_STRETCH },
};

/** Equipment that was removed from the catalogue (e.g. a station Tom turned out not to own). */
function withoutRetiredEquipment(equipment: unknown): unknown {
  return Array.isArray(equipment) ? equipment.filter(isEquipmentTag) : equipment;
}

function withoutRetiredStations(stations: Settings['stations']): Settings['stations'] {
  return Object.fromEntries(Object.entries(stations).filter(([tag]) => isEquipmentTag(tag)));
}

/**
 * Merge stored (possibly older-shaped) settings over defaults, then validate.
 * Retired equipment tags are dropped first: one stale tag must not fail validation
 * and silently reset every other setting to its default.
 */
export function resolveSettings(stored: unknown): Settings {
  const partial = typeof stored === 'object' && stored !== null ? (stored as Partial<Settings>) : {};
  const merged = {
    ...DEFAULT_SETTINGS,
    ...partial,
    ...(partial.equipment === undefined ? {} : { equipment: withoutRetiredEquipment(partial.equipment) }),
    anchors: { ...DEFAULT_SETTINGS.anchors, ...partial.anchors },
    stations: withoutRetiredStations({ ...DEFAULT_SETTINGS.stations, ...partial.stations }),
    increments: { ...DEFAULT_SETTINGS.increments, ...partial.increments },
    audio: { ...DEFAULT_SETTINGS.audio, ...partial.audio },
    stretch: { ...DEFAULT_SETTINGS.stretch, ...partial.stretch },
  };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * One-time upgrade of stored settings. Settings saved before stretching existed have no
 * `stretch` block: switch the recovery gear on (Tom owns it all) and add the block, so this
 * never runs again and gear he later turns off stays off.
 */
export function migrateSettings(stored: unknown): { readonly value: unknown; readonly changed: boolean } {
  if (!isRecord(stored) || 'stretch' in stored) return { value: stored, changed: false };
  const equipment = Array.isArray(stored.equipment) ? stored.equipment : [...DEFAULT_EQUIPMENT];
  return {
    value: { ...stored, equipment: [...new Set([...equipment, ...RECOVERY_TAGS])], stretch: { ...DEFAULT_STRETCH } },
    changed: true,
  };
}

export interface ExercisePref {
  readonly favorite: boolean;
  readonly banned: boolean;
  readonly startLoad: number | null;
}

export type Prefs = Readonly<Record<string, ExercisePref>>;

export const exercisePrefSchema = z.object({
  favorite: z.boolean(),
  banned: z.boolean(),
  startLoad: z.number().nonnegative().nullable(),
});
