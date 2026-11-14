import { memo } from 'react';
import { ChartFrame, LABEL_FONT, TICK_FONT } from './ChartFrame.tsx';
import { linear, niceDomain, roundedEndBar } from './scale.ts';

export interface HBarRow {
  readonly key: string;
  readonly label: string;
  readonly primary: number;
  readonly secondary: number;
}

const LABEL_WIDTH = 230;
const VALUE_ROOM = 80;
const AXIS = 44;
const SEGMENT_GAP = 2;

/** Two-part horizontal bars (primary + secondary) with an optional shaded target band. */
function HBarChartImpl(props: {
  readonly rows: readonly HBarRow[];
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly band?: readonly [number, number];
  readonly formatValue: (value: number) => string;
}) {
  const left = LABEL_WIDTH;
  const right = props.width - VALUE_ROOM;
  const totals = props.rows.map((r) => r.primary + r.secondary);
  const domain = niceDomain([...totals, props.band?.[1] ?? 0], { zero: true, maxTicks: 5 });
  const x = linear([0, domain.max], [left, right]);
  const step = (props.height - AXIS) / Math.max(1, props.rows.length);
  const barH = Math.min(24, step * 0.62);
  const rowY = (i: number) => AXIS + i * step + (step - barH) / 2;

  return (
    <ChartFrame width={props.width} height={props.height} label={props.label} testId="hbar-chart">
      {props.band && (
        <rect x={x(props.band[0])} y={AXIS - 6} width={x(props.band[1]) - x(props.band[0])} height={props.height - AXIS + 6} className="fill-surface" data-testid="target-band" />
      )}
      {domain.ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={AXIS - 6} y2={props.height} strokeWidth="1.5" className="stroke-line" />
          <text x={x(t)} y={AXIS - 16} textAnchor="middle" fontSize={TICK_FONT} className="tabular fill-faint">
            {props.formatValue(t)}
          </text>
        </g>
      ))}
      {props.rows.map((r, i) => {
        const top = rowY(i);
        const p = x(r.primary) - left;
        const s = r.secondary > 0 ? x(r.primary + r.secondary) - x(r.primary) - (r.primary > 0 ? SEGMENT_GAP : 0) : 0;
        const sLeft = left + p + (r.primary > 0 ? SEGMENT_GAP : 0);
        const total = r.primary + r.secondary;
        return (
          <g key={r.key} data-row={r.key}>
            <text x={left - 16} y={top + barH / 2} dy="0.35em" textAnchor="end" fontSize={TICK_FONT + 2} className={total > 0 ? 'fill-dim' : 'fill-faint'}>
              {r.label}
            </text>
            {r.secondary > 0 ? (
              <rect x={left} y={top} width={Math.max(0, p)} height={barH} className="fill-dim" data-part="primary" />
            ) : (
              <path d={roundedEndBar(left, top, p, barH, 4)} className="fill-dim" data-part="primary" />
            )}
            {s > 0 && <path d={roundedEndBar(sLeft, top, s, barH, 4)} className="fill-faint" data-part="secondary" />}
            {total > 0 && (
              <text x={x(total) + 12} y={top + barH / 2} dy="0.35em" fontSize={LABEL_FONT - 2} className="tabular fill-text">
                {props.formatValue(total)}
              </text>
            )}
          </g>
        );
      })}
    </ChartFrame>
  );
}

export const HBarChart = memo(HBarChartImpl);
