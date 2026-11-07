import { cx } from '../lib/cx.ts';

/** Big phase ring. `progress` 0..1 is how much of the phase has elapsed. */
export function TimerRing(props: {
  readonly progress: number | null;
  readonly label: string;
  readonly caption?: string;
  readonly colorClass: string;
  readonly className?: string;
}) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const remaining = props.progress === null ? 1 : Math.max(0, Math.min(1, 1 - props.progress));
  return (
    <div className={cx('relative aspect-square', props.className)} data-testid="timer">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-surface-2)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - remaining)}
          className={props.colorClass}
          style={{ transition: 'stroke-dashoffset 250ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-display text-[9.5rem] font-semibold leading-none" data-testid="timer-label">
          {props.label}
        </span>
        {props.caption && <span className="mt-2 text-[2rem] font-medium text-dim">{props.caption}</span>}
      </div>
    </div>
  );
}
