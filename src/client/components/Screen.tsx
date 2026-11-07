import type { ReactNode } from 'react';
import { useNow } from '../timer/useNow.ts';
import { formatTimeOfDay } from '../lib/format.ts';
import { cx } from '../lib/cx.ts';

export function Clock() {
  const now = useNow(1000);
  return <span className="tabular text-dim">{formatTimeOfDay(now)}</span>;
}

/** Full-screen page inside the 5% TV safe area, with an optional header row. */
export function Screen(props: {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly aside?: ReactNode;
  readonly className?: string;
  readonly testId?: string;
}) {
  return (
    <main data-testid={props.testId} className={cx('safe flex h-full flex-col', props.className)}>
      {(props.title || props.aside) && (
        <header className="mb-8 flex items-baseline justify-between gap-8">
          <div className="font-display text-[3rem] font-semibold uppercase tracking-wide text-dim">{props.title}</div>
          <div className="flex items-baseline gap-8 text-[1.75rem]">
            {props.aside}
            <Clock />
          </div>
        </header>
      )}
      {props.children}
    </main>
  );
}

export function Centered(props: { readonly children: ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-6 text-center">{props.children}</div>;
}
