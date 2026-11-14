import type { ReactNode } from 'react';

/** Chart units are CSS px at 1080p (1rem = 16 units), so charts scale with the rest of the UI. */
export const UNITS_PER_REM = 16;
export const TICK_FONT = 22;
export const LABEL_FONT = 26;

export function ChartFrame(props: {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly testId?: string;
  readonly children: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${props.width} ${props.height}`}
      style={{ width: `${props.width / UNITS_PER_REM}rem`, height: `${props.height / UNITS_PER_REM}rem` }}
      role="img"
      aria-label={props.label}
      data-testid={props.testId}
      className="block shrink-0 overflow-visible"
    >
      {props.children}
    </svg>
  );
}

/** Legend key: a short line or swatch beside text-token text (identity never by colour alone). */
export function LegendKey(props: {
  readonly label: string;
  readonly swatch?: string;
  readonly shape?: 'box' | 'line' | 'dashed' | 'dot';
  /** A text mark instead of a swatch (e.g. "–" for a missing value). */
  readonly glyph?: string;
}) {
  const shape = props.shape ?? 'box';
  return (
    <span className="flex items-center gap-3 text-[1.5rem] text-dim">
      {props.glyph ? (
        <span className="w-[2.5rem] text-center text-faint">{props.glyph}</span>
      ) : (
        <svg viewBox="0 0 40 16" className="h-[1rem] w-[2.5rem] overflow-visible" aria-hidden="true">
          {shape === 'line' || shape === 'dashed' ? (
            <line x1="2" x2="38" y1="8" y2="8" strokeWidth="4" strokeLinecap="round" strokeDasharray={shape === 'dashed' ? '8 7' : undefined} className={props.swatch} />
          ) : shape === 'dot' ? (
            <circle cx="20" cy="8" r="8" className={props.swatch} />
          ) : (
            <rect x="8" y="0" width="24" height="16" rx="3" className={props.swatch} />
          )}
        </svg>
      )}
      {props.label}
    </span>
  );
}

/** Horizontal gridlines with tick labels on the left edge of the plot. */
export function YGrid(props: {
  readonly ticks: readonly number[];
  readonly y: (value: number) => number;
  readonly left: number;
  readonly right: number;
  readonly format: (value: number) => string;
}) {
  return (
    <g>
      {props.ticks.map((t) => (
        <g key={t}>
          <line x1={props.left} x2={props.right} y1={props.y(t)} y2={props.y(t)} strokeWidth="1.5" className="stroke-line" />
          <text x={props.left - 14} y={props.y(t)} dy="0.35em" textAnchor="end" fontSize={TICK_FONT} className="tabular fill-faint">
            {props.format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}
