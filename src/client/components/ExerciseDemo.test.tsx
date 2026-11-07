import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExerciseDemo } from './ExerciseDemo.tsx';
import { indexLibrary, requireExercise } from '../../core/library/index.ts';
import { LIBRARY } from '../../data/library.ts';

const bench = requireExercise(indexLibrary(LIBRARY), 'bench-press'); // tempo down 2, up 1

describe('ExerciseDemo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds each pose for the tempo and alternates', () => {
    const { container } = render(<ExerciseDemo exercise={bench} />);
    const end = () => (container.querySelectorAll('img')[1] as HTMLImageElement).style.opacity;
    expect(end()).toBe('0');
    act(() => void vi.advanceTimersByTime(2000));
    expect(end()).toBe('1');
    act(() => void vi.advanceTimersByTime(1000));
    expect(end()).toBe('0');
  });

  it('stays on the start pose when not animating', () => {
    const { container } = render(<ExerciseDemo exercise={bench} animate={false} />);
    act(() => void vi.advanceTimersByTime(5000));
    expect((container.querySelectorAll('img')[1] as HTMLImageElement).style.opacity).toBe('0');
  });
});
