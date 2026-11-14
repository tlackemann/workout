import { memo } from 'react';
import { ChartFrame, LABEL_FONT, TICK_FONT, YGrid } from './ChartFrame.tsx';
import { bandScale, linear, roundedTopBar, type NiceDomain } from './scale.ts';

export interface Column {
  readonly key: string;
  /** Null draws a dash: the value is unknown, but the slot keeps the columns aligned. */
  readonly value: number | null;
  /** Outlined instead of filled (e.g. a workout that was ended early). */
  readonly hollow: boolean;
}

const MARGIN = { top: 40, right: 12, bottom: 12, left: 84 };
const HOLLOW_STROKE = 3;

/** Fixed-slot columns, newest on the right, against a domain shared with sibling panels. */
function ColumnChartImpl(props: {
  readonly columns: readonly Column[];
  readonly slots: number;
  readonly domain: NiceDomain;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  /** Tone class for the bars: `fill-push` and `stroke-push` style pairs. */
  readonly fill: string;
  readonly stroke: string;
  readonly formatValue: (value: number) => string;
}) {
  const plot = { left: MARGIN.left, right: props.width - MARGIN.right, top: MARGIN.top, bottom: props.height - MARGIN.bottom };
  const y = linear([props.domain.min, props.domain.max], [plot.bottom, plot.top]);
  const band = bandScale(props.slots, [plot.left, plot.right], 0.3, 32);
  const offset = props.slots - props.columns.length;
  const latest = [...props.columns].reverse().find((c) => c.value !== null);

  return (
    <ChartFrame width={props.width} height={props.height} label={props.label}>
      <YGrid ticks={props.domain.ticks} y={y} left={plot.left} right={plot.right} format={props.formatValue} />
      {props.columns.map((c, i) => {
        const x = band.x(i + offset);
        if (c.value === null) {
          return (
            <text key={c.key} x={x + band.width / 2} y={plot.bottom - 10} textAnchor="middle" fontSize={TICK_FONT} className="fill-faint" data-column="missing">
              –
            </text>
          );
        }
        const top = y(c.value);
        const inset = c.hollow ? HOLLOW_STROKE / 2 : 0;
        return (
          <path
            key={c.key}
            d={roundedTopBar(x + inset, top + inset, band.width - 2 * inset, plot.bottom - top - inset, 4)}
            strokeWidth={c.hollow ? HOLLOW_STROKE : 0}
            className={c.hollow ? `fill-none ${props.stroke}` : props.fill}
            data-column={c.hollow ? 'hollow' : 'filled'}
          />
        );
      })}
      {latest && latest.value !== null && (
        <text
          x={band.x(props.columns.indexOf(latest) + offset) + band.width / 2}
          y={y(latest.value) - 12}
          textAnchor="middle"
          fontSize={LABEL_FONT}
          className="tabular fill-text font-semibold"
        >
          {props.formatValue(latest.value)}
        </text>
      )}
    </ChartFrame>
  );
}

export const ColumnChart = memo(ColumnChartImpl);
