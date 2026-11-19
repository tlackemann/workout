import type { StretchSlot } from '../core/stretch/types.ts';

const ROLLS = ['roll-quads', 'roll-it-band', 'roll-calves', 'roll-hamstrings', 'roll-glutes', 'roll-adductors', 'roll-upper-back', 'roll-lats'];

/**
 * Full-body stretch day. Every session covers the priority-1 regions; Standard adds
 * foam rolling and the lower-leg regions, Long adds everything else. The stretch picked
 * for each region rotates (seeded, with a recency penalty).
 */
export const STRETCH_TEMPLATE: readonly StretchSlot[] = [
  { id: 'warm.upper', label: 'Warm-up', block: 'warm', priority: 1, candidates: ['arm-circles', 'shoulder-rolls', 'chest-opener-swings', 'elbow-circles'] },
  { id: 'warm.hips', label: 'Warm-up', block: 'warm', priority: 1, candidates: ['leg-swings', 'hip-circles', 'worlds-greatest', 'inchworm'] },
  { id: 'warm.spine', label: 'Warm-up', block: 'warm', priority: 3, candidates: ['cat-cow', 'inchworm', 'worlds-greatest'] },
  { id: 'roll.legs', label: 'Foam roll', block: 'roll', priority: 2, candidates: ['roll-quads', 'roll-it-band', 'roll-calves', 'roll-hamstrings', 'roll-glutes', 'roll-adductors'] },
  { id: 'roll.back', label: 'Foam roll', block: 'roll', priority: 2, candidates: ['roll-upper-back', 'roll-lats'] },
  { id: 'roll.extra', label: 'Foam roll', block: 'roll', priority: 3, candidates: ROLLS },
  { id: 'hip-flexors', label: 'Hip flexors', block: 'stretch', priority: 1, candidates: ['kneeling-hip-flexor', 'standing-hip-flexor', 'strap-hip-quad'] },
  { id: 'hamstrings', label: 'Hamstrings', block: 'stretch', priority: 1, candidates: ['seated-hamstring', 'leg-up-hamstring', 'strap-hamstring', 'runners-stretch', 'hamstring-90-90', 'strap-standing-hamstring'] },
  { id: 'glutes', label: 'Glutes', block: 'stretch', priority: 1, candidates: ['figure-four', 'knee-across-body', 'knee-to-chest', 'strap-it-band-glute'] },
  { id: 'chest', label: 'Chest', block: 'stretch', priority: 1, candidates: ['stick-chest-opener', 'elbows-back', 'ball-chest'] },
  { id: 'lats', label: 'Lats', block: 'stretch', priority: 1, candidates: ['wall-lat', 'standing-side-bend', 'side-lying-lat'] },
  { id: 'quads', label: 'Quads', block: 'stretch', priority: 2, candidates: ['all-fours-quad', 'side-lying-quad', 'bench-quad', 'strap-quad'] },
  { id: 'calves', label: 'Calves', block: 'stretch', priority: 2, candidates: ['wall-calf', 'toe-pull-calf', 'soleus-stretch', 'seated-calf'] },
  { id: 'adductors', label: 'Inner thighs', block: 'stretch', priority: 2, candidates: ['side-lying-groin', 'straddle', 'butterfly'] },
  { id: 'shoulders', label: 'Shoulders', block: 'stretch', priority: 3, candidates: ['cross-body-shoulder', 'overhead-triceps'] },
  { id: 'back', label: 'Back', block: 'stretch', priority: 3, candidates: ['upper-back-reach', 'standing-twist', 'bench-twist', 'ball-hug'] },
  { id: 'neck', label: 'Neck', block: 'stretch', priority: 3, candidates: ['side-neck', 'chin-to-chest'] },
  { id: 'relax', label: 'Relax', block: 'stretch', priority: 1, candidates: ['childs-pose', 'knees-to-chest'], pin: 'last' },
];
