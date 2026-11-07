/** Equipment tags the library's `requires` lists refer to. Grouped for the Settings screen. */
export const EQUIPMENT_CATALOGUE = [
  { group: 'Free weights', tag: 'barbell', label: 'Olympic barbell + plates' },
  { group: 'Free weights', tag: 'rack', label: 'Squat / bench rack' },
  { group: 'Free weights', tag: 'bench.flat', label: 'Flat bench' },
  { group: 'Free weights', tag: 'bench.incline', label: 'Incline bench' },
  { group: 'Free weights', tag: 'ez_bar', label: 'EZ curl bar' },
  { group: 'Free weights', tag: 'preacher_pad', label: 'Preacher curl pad' },
  { group: 'Free weights', tag: 'pushup_handles', label: 'Push-up handles' },
  { group: 'MX 4800', tag: 'mx.chest_press', label: 'Chest press' },
  { group: 'MX 4800', tag: 'mx.shoulder_press', label: 'Shoulder press' },
  { group: 'MX 4800', tag: 'mx.pec_fly', label: 'Pec fly / rear delt' },
  { group: 'MX 4800', tag: 'mx.lat_pulldown', label: 'Lat pulldown (high pulley)' },
  { group: 'MX 4800', tag: 'mx.low_row', label: 'Low row (low pulley)' },
  { group: 'MX 4800', tag: 'mx.leg_press', label: 'Leg press' },
  { group: 'MX 4800', tag: 'mx.leg_ext', label: 'Leg extension' },
  { group: 'MX 4800', tag: 'mx.leg_curl_seated', label: 'Leg curl (seated)' },
  { group: 'MX 4800', tag: 'mx.leg_curl_lying', label: 'Leg curl (lying)' },
  { group: 'MX 4800', tag: 'mx.ab_crunch', label: 'Ab crunch' },
  { group: 'Cable attachments', tag: 'cable.straight_bar', label: 'Straight / lat bar' },
  { group: 'Cable attachments', tag: 'cable.rope', label: 'Rope' },
  { group: 'Cable attachments', tag: 'cable.vbar', label: 'V-bar' },
  { group: 'Later', tag: 'dumbbells', label: 'Dumbbells' },
  { group: 'Later', tag: 'pullup_bar', label: 'Pull-up bar' },
  { group: 'Later', tag: 'dip_bars', label: 'Dip bars' },
] as const;

export type EquipmentTag = (typeof EQUIPMENT_CATALOGUE)[number]['tag'];

export const EQUIPMENT_TAGS: readonly EquipmentTag[] = EQUIPMENT_CATALOGUE.map((e) => e.tag);

const NOT_OWNED_YET: readonly EquipmentTag[] = [
  'dumbbells',
  'pullup_bar',
  'dip_bars',
  'mx.leg_curl_lying',
  'cable.rope',
  'cable.vbar',
];

export const DEFAULT_EQUIPMENT: readonly EquipmentTag[] = EQUIPMENT_TAGS.filter((t) => !NOT_OWNED_YET.includes(t));

/** `requires` is AND-of-ORs: every inner group needs at least one available tag. */
export type Requirement = readonly (readonly EquipmentTag[])[];

export function isEligible(requires: Requirement, available: ReadonlySet<string>): boolean {
  return requires.every((group) => group.some((tag) => available.has(tag)));
}
