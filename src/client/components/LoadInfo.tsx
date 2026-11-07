import type { ExerciseDef } from '../../core/library/schema.ts';
import { platesPerSide } from '../../core/plates.ts';
import type { Settings } from '../../core/settings.ts';
import { formatWeight } from '../lib/format.ts';

/** "Per side: 45 · 10 · 2.5" for bars, "Pin at 120" for stacks. */
export function loadHint(exercise: ExerciseDef, load: number, settings: Settings): string | null {
  switch (exercise.load.type) {
    case 'barbell':
    case 'ez_bar': {
      const bar = exercise.load.type === 'barbell' ? settings.barWeight : settings.ezBarWeight;
      const plates = platesPerSide(load, bar, settings.plates);
      if (!plates) return null;
      return plates.length === 0 ? 'Empty bar' : `Per side: ${plates.map(formatWeight).join(' · ')}`;
    }
    case 'stack':
      return `Pin at ${formatWeight(load)}`;
    case 'dumbbell':
      return 'Dumbbells';
    case 'bodyweight':
      return null;
  }
}
