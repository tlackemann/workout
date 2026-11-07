export const MUSCLES = [
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'triceps',
  'biceps',
  'forearms',
  'lats',
  'upper-back',
  'traps',
  'lower-back',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
] as const;

export type Muscle = (typeof MUSCLES)[number];

/** Human labels for the player's "works" line. */
export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  'front-delts': 'Front delts',
  'side-delts': 'Side delts',
  'rear-delts': 'Rear delts',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  lats: 'Lats',
  'upper-back': 'Upper back',
  traps: 'Traps',
  'lower-back': 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  adductors: 'Adductors',
};
