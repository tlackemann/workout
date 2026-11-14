import { cx } from '../lib/cx.ts';

/** A labelled headline number (Summary and Progress). */
export function StatTile(props: { readonly label: string; readonly value: string; readonly note?: string; readonly compact?: boolean; readonly testId?: string }) {
  return (
    <div className={cx('rounded-[1.25rem] bg-surface', props.compact ? 'px-6 py-4' : 'px-8 py-5')} data-testid={props.testId}>
      <div className="text-[1.75rem] font-medium text-dim">{props.label}</div>
      <div className={cx('tabular font-display font-bold leading-tight', props.compact ? 'text-[3.25rem]' : 'text-[4rem]')}>{props.value}</div>
      {props.note && <div className="text-[1.5rem] text-faint">{props.note}</div>}
    </div>
  );
}
