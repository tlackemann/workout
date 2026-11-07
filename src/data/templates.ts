import type { Templates } from '../core/generator/types.ts';

/**
 * Push / Pull / Legs templates for strength + size.
 * Anchors 4×5–8 with long rests; accessories 3×8–15 with short rests.
 * Priority: Quick keeps 1–2, Standard 1–3, Long everything (then trimmed to the time budget).
 */
export const TEMPLATES: Templates = {
  push: {
    day: 'push',
    slots: [
      { id: 'push.a1', label: 'Main press', role: 'anchor', candidates: ['bench-press'], fallbacks: ['machine-chest-press', 'db-bench-press', 'pushup-handles'], sets: 4, repMin: 5, repMax: 8, restSec: 180, priority: 1 },
      { id: 'push.a2', label: 'Overhead press', role: 'anchor', candidates: ['standing-military-press', 'seated-military-press'], fallbacks: ['machine-shoulder-press', 'db-shoulder-press'], sets: 4, repMin: 5, repMax: 8, restSec: 150, priority: 1 },
      { id: 'push.incline', label: 'Incline press', role: 'accessory', candidates: ['incline-bench-press', 'incline-db-press', 'machine-chest-press'], widen: ['incline_push', 'horizontal_push'], sets: 3, repMin: 8, repMax: 12, restSec: 120, priority: 2 },
      { id: 'push.triceps', label: 'Triceps', role: 'accessory', candidates: ['triceps-pushdown', 'triceps-pushdown-rope', 'triceps-pushdown-vbar', 'ez-skullcrusher', 'close-grip-ez-press', 'close-grip-bench', 'rope-overhead-extension', 'dips-triceps'], widen: ['triceps'], sets: 3, repMin: 8, repMax: 12, restSec: 75, priority: 2 },
      { id: 'push.chest-iso', label: 'Chest isolation', role: 'accessory', candidates: ['pec-fly', 'pushup-handles', 'dips-chest'], widen: ['chest_fly'], sets: 3, repMin: 10, repMax: 15, restSec: 75, priority: 3 },
      { id: 'push.side-delt', label: 'Side delts', role: 'accessory', candidates: ['cable-lateral-raise', 'db-lateral-raise', 'upright-cable-row', 'upright-barbell-row', 'low-pulley-delt-raise'], widen: ['lateral_raise'], sets: 3, repMin: 12, repMax: 15, restSec: 60, priority: 3 },
      { id: 'push.finisher', label: 'Finisher', role: 'accessory', candidates: ['pushup-close-wide', 'incline-pushup'], sets: 2, repMin: 8, repMax: 30, restSec: 60, priority: 4, amrap: true },
    ],
  },
  pull: {
    day: 'pull',
    slots: [
      { id: 'pull.a1', label: 'Main row', role: 'anchor', candidates: ['barbell-row'], fallbacks: ['seated-cable-row', 'db-row', 'inverted-row'], sets: 4, repMin: 5, repMax: 8, restSec: 150, priority: 1 },
      { id: 'pull.a2', label: 'Vertical pull', role: 'anchor', candidates: ['wide-lat-pulldown'], fallbacks: ['close-lat-pulldown', 'pullup', 'vbar-pulldown'], sets: 4, repMin: 5, repMax: 8, restSec: 120, priority: 1 },
      { id: 'pull.row', label: 'Row variation', role: 'accessory', candidates: ['seated-cable-row', 'inverted-row', 'reverse-grip-row', 'db-row'], widen: ['horizontal_pull'], sets: 3, repMin: 8, repMax: 12, restSec: 90, priority: 2 },
      { id: 'pull.biceps', label: 'Biceps', role: 'accessory', candidates: ['ez-curl', 'preacher-curl', 'barbell-curl', 'spider-curl', 'cable-curl', 'reverse-preacher-curl', 'db-curl', 'hammer-curl'], widen: ['biceps'], sets: 3, repMin: 8, repMax: 12, restSec: 75, priority: 2 },
      { id: 'pull.rear-delt', label: 'Rear delts', role: 'accessory', candidates: ['reverse-machine-fly', 'face-pull', 'low-pulley-rear-raise'], widen: ['rear_delt'], sets: 3, repMin: 12, repMax: 15, restSec: 60, priority: 3 },
      { id: 'pull.vertical-2', label: 'Lats', role: 'accessory', candidates: ['vbar-pulldown', 'underhand-pulldown', 'straight-arm-pulldown', 'close-lat-pulldown', 'chinup', 'pullup'], widen: ['vertical_pull'], sets: 3, repMin: 10, repMax: 12, restSec: 75, priority: 3 },
      { id: 'pull.traps', label: 'Traps', role: 'accessory', candidates: ['barbell-shrug', 'cable-shrug'], widen: ['shrug'], sets: 3, repMin: 10, repMax: 15, restSec: 60, priority: 4 },
    ],
  },
  legs: {
    day: 'legs',
    slots: [
      { id: 'legs.a1', label: 'Squat', role: 'anchor', candidates: ['back-squat', 'box-squat', 'front-squat'], fallbacks: ['leg-press'], sets: 4, repMin: 5, repMax: 8, restSec: 180, priority: 1 },
      { id: 'legs.a2', label: 'Hinge', role: 'anchor', candidates: ['romanian-deadlift', 'deadlift', 'stiff-leg-deadlift'], fallbacks: ['good-morning', 'hip-thrust'], sets: 4, repMin: 5, repMax: 8, restSec: 150, priority: 1 },
      { id: 'legs.quad', label: 'Quads', role: 'accessory', candidates: ['leg-press', 'narrow-leg-press', 'barbell-lunge', 'barbell-step-up', 'db-lunge'], widen: ['squat', 'lunge'], sets: 3, repMin: 8, repMax: 12, restSec: 120, priority: 2 },
      { id: 'legs.hams', label: 'Hamstrings', role: 'accessory', candidates: ['seated-leg-curl', 'lying-leg-curl'], widen: ['ham_curl', 'hinge'], sets: 3, repMin: 10, repMax: 15, restSec: 60, priority: 2 },
      { id: 'legs.quad-iso', label: 'Quad isolation', role: 'accessory', candidates: ['leg-extension'], widen: ['quad_iso'], sets: 3, repMin: 12, repMax: 15, restSec: 60, priority: 3 },
      { id: 'legs.glutes', label: 'Glutes', role: 'accessory', candidates: ['hip-thrust', 'glute-bridge', 'pull-through', 'good-morning'], widen: ['glute'], sets: 3, repMin: 8, repMax: 12, restSec: 90, priority: 3 },
      { id: 'legs.calves', label: 'Calves', role: 'accessory', candidates: ['leg-press-calf-raise', 'standing-calf-raise', 'rocking-calf-raise'], widen: ['calf'], sets: 3, repMin: 12, repMax: 20, restSec: 60, priority: 4 },
      { id: 'legs.core', label: 'Core', role: 'accessory', candidates: ['ab-crunch-machine', 'cable-crunch', 'barbell-rollout', 'hanging-leg-raise'], widen: ['core'], sets: 3, repMin: 12, repMax: 20, restSec: 60, priority: 4 },
    ],
  },
};
