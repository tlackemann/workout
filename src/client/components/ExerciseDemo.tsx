import { useEffect, useState } from 'react';
import type { ExerciseDef } from '../../core/library/schema.ts';
import { mediaUrl } from '../app/api.ts';
import { cx } from '../lib/cx.ts';

/** Quick fade between poses: long blends just show two ghosted photos. */
const FADE_MS = 300;

/**
 * Two photos (start pose / end pose) alternating at the exercise's rep tempo: the start
 * pose holds for `tempo.down` seconds (lowering) and the end pose for `tempo.up` (lifting),
 * so the demo doubles as a pace cue.
 */
export function ExerciseDemo(props: { readonly exercise: ExerciseDef; readonly className?: string; readonly animate?: boolean }) {
  const { exercise, animate = true } = props;
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    setShowEnd(false);
    if (!animate) return undefined;
    let timer = 0;
    let end = false;
    const hold = () => (end ? exercise.tempo.up : exercise.tempo.down) * 1000;
    const step = () => {
      end = !end;
      setShowEnd(end);
      timer = window.setTimeout(step, hold());
    };
    timer = window.setTimeout(step, hold());
    return () => window.clearTimeout(timer);
  }, [exercise.id, exercise.tempo.down, exercise.tempo.up, animate]);

  return (
    <div className={cx('relative aspect-[3/2] overflow-hidden rounded-[1.25rem] bg-surface', props.className)}>
      <img src={mediaUrl(exercise.id, 0)} alt={`${exercise.name}: start position`} className="absolute inset-0 h-full w-full object-cover" />
      <img
        src={mediaUrl(exercise.id, 1)}
        alt={`${exercise.name}: end position`}
        className="frame-fade absolute inset-0 h-full w-full object-cover"
        style={{ opacity: showEnd ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      />
    </div>
  );
}

export function ExerciseThumb(props: { readonly exerciseId: string; readonly className?: string }) {
  return (
    <img
      src={mediaUrl(props.exerciseId, 0)}
      alt=""
      loading="lazy"
      className={cx('aspect-[3/2] rounded-[0.75rem] bg-surface object-cover', props.className)}
    />
  );
}
