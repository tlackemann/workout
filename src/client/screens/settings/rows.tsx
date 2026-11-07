import type { ReactNode } from 'react';
import { FocusButton } from '../../components/FocusButton.tsx';
import { cx } from '../../lib/cx.ts';

const ROW = 'flex items-center justify-between gap-8 rounded-[1rem] bg-surface px-8 py-4';

export function Section(props: { readonly title: string; readonly hint?: string; readonly children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-[3rem] font-semibold uppercase tracking-wide text-dim">{props.title}</h2>
      {props.hint && <p className="mb-3 text-[1.75rem] text-faint">{props.hint}</p>}
      <div className="grid gap-3">{props.children}</div>
    </section>
  );
}

export function ToggleRow(props: { readonly label: string; readonly on: boolean; readonly onToggle: () => void; readonly testId?: string }) {
  return (
    <FocusButton flat onPress={props.onToggle} testId={props.testId} className={ROW}>
      <span className="text-[2.25rem]">{props.label}</span>
      <span
        className={cx(
          'rounded-full px-6 py-1 text-[1.75rem] font-semibold',
          props.on ? 'bg-good text-bg' : 'border-2 border-line text-faint',
        )}
      >
        {props.on ? 'On' : 'Off'}
      </span>
    </FocusButton>
  );
}

function StepButton(props: { readonly label: string; readonly onPress: () => void }) {
  return (
    <span
      role="button"
      onClick={(e) => {
        e.stopPropagation();
        props.onPress();
      }}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 font-display text-[2.5rem] text-dim"
    >
      {props.label}
    </span>
  );
}

/** ◀▶ adjusts the value (and the − / + buttons do the same for touch). ▲▼ moves between rows. */
export function StepperRow(props: {
  readonly label: string;
  readonly value: string;
  readonly onStep: (direction: 1 | -1) => void;
  readonly testId?: string;
}) {
  return (
    <FocusButton
      flat
      testId={props.testId}
      onArrow={(direction) => {
        if (direction === 'left' || direction === 'right') {
          props.onStep(direction === 'right' ? 1 : -1);
          return false;
        }
        return true;
      }}
      className={ROW}
    >
      <span className="text-[2.25rem]">{props.label}</span>
      <span className="flex items-center gap-5">
        <StepButton label="−" onPress={() => props.onStep(-1)} />
        <span className="tabular min-w-[9rem] text-center font-display text-[2.75rem] font-semibold">{props.value}</span>
        <StepButton label="+" onPress={() => props.onStep(1)} />
      </span>
    </FocusButton>
  );
}

/** Cycle through options with ◀▶ (or tap to advance). */
export function ChoiceRow<T extends string>(props: {
  readonly label: string;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly testId?: string;
}) {
  const index = Math.max(0, props.options.findIndex((o) => o.value === props.value));
  const move = (direction: 1 | -1) => {
    const n = props.options.length;
    const next = props.options[(index + direction + n) % n];
    if (next) props.onChange(next.value);
  };
  return (
    <StepperRow label={props.label} value={props.options[index]?.label ?? '–'} onStep={move} testId={props.testId} />
  );
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
