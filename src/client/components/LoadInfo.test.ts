import { describe, expect, it } from 'vitest';
import { loadHint } from './LoadInfo.tsx';
import { indexLibrary, requireExercise } from '../../core/library/index.ts';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';
import { LIBRARY } from '../../data/library.ts';
import { toHighlightData } from './MuscleMap.tsx';

const lib = indexLibrary(LIBRARY);

describe('loadHint', () => {
  it('shows plates per side for barbells', () => {
    expect(loadHint(requireExercise(lib, 'bench-press'), 185, DEFAULT_SETTINGS)).toBe('Per side: 45 · 25');
    expect(loadHint(requireExercise(lib, 'bench-press'), 45, DEFAULT_SETTINGS)).toBe('Empty bar');
  });

  it('uses the EZ bar weight', () => {
    expect(loadHint(requireExercise(lib, 'ez-curl'), 45, DEFAULT_SETTINGS)).toBe('Per side: 10');
  });

  it('shows the pin for stacks and nothing for bodyweight', () => {
    expect(loadHint(requireExercise(lib, 'leg-press'), 120, DEFAULT_SETTINGS)).toBe('Pin at 120');
    expect(loadHint(requireExercise(lib, 'pushup'), 0, DEFAULT_SETTINGS)).toBeNull();
  });
});

describe('toHighlightData', () => {
  it('keeps primary muscles out of the secondary group', () => {
    const [secondary, primary] = toHighlightData(['side-delts'], ['rear-delts', 'traps']);
    expect(primary?.muscles).toEqual(['front-deltoids', 'back-deltoids']);
    expect(secondary?.muscles).toEqual(['trapezius']);
  });
});
