import { memo } from 'react';
import { ChartFrame, LABEL_FONT, TICK_FONT, YGrid } from './ChartFrame.tsx';
import { linear, linePath, niceDomain } from './scale.ts';

export interface LinePoint {
  readonly date: number;
  readonly value: number;
}

export interface LineSeries {
  readonly key: string;
  readonly points: readonly LinePoint[];
  /** 'primary' is the series the chart is about (solid, dotted points); 'secondary' is context (dashed). */
  readonly tone: 'primary' | 'secondary';
}

const DAY_MS = 86_400_000;
const MARGIN = { top: 24, right: 150, bottom: 56, left: 90 };
const MAX_DOTS = 60;
/** End labels closer than this collide; the secondary one then defers to the legend and tiles. */
const LABEL_CLEARANCE = 32;

const STROKE = { primary: 'stroke-text', secondary: 'stroke-dim' } as const;

function LineChartImpl(props: {
  readonly series: readonly LineSeries[];
  /** Highlighted points (PRs), drawn on top. */
  readonly marks?: readonly LinePoint[];
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly formatValue: (value: number) => string;
  readonly formatDate: (epoch: number) => string;
}) {
  const all = props.series.flatMap((s) => s.points);
  const dates = all.map((p) => p.date);
  const first = Math.min(...dates);
  const last = Math.max(...dates);
  const [d0, d1] = first === last ? [first - 7 * DAY_MS, last + 7 * DAY_MS] : [first, last];
  const plot = { left: MARGIN.left, right: props.width - MARGIN.right, top: MARGIN.top, bottom: props.height - MARGIN.bottom };
  const x = linear([d0, d1], [plot.left, plot.right]);
  const domain = niceDomain(all.map((p) => p.value), { maxTicks: 4 });
  const y = linear([domain.min, domain.max], [plot.bottom, plot.top]);
  const xy = (p: LinePoint) => ({ x: x(p.date), y: y(p.value) });

  const ends = props.series
    .map((s) => ({ s, end: s.points.at(-1) }))
    .filter((e): e is { s: LineSeries; end: LinePoint } => e.end !== undefined);
  const primaryEnd = ends.find((e) => e.s.tone === 'primary');
  const labelled = ends.filter((e) => e.s.tone === 'primary' || !primaryEnd || Math.abs(y(e.end.value) - y(primaryEnd.end.value)) >= LABEL_CLEARANCE);
  const xLabels = [...new Set(first === last ? [first] : [first, last])];

  return (
    <ChartFrame width={props.width} height={props.height} label={props.label} testId="line-chart">
      <YGrid ticks={domain.ticks} y={y} left={plot.left} right={plot.right} format={props.formatValue} />
      {xLabels.map((d, i) => (
        <text key={d} x={x(d)} y={props.height - 12} fontSize={TICK_FONT} textAnchor={xLabels.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'} className="fill-faint">
          {props.formatDate(d)}
        </text>
      ))}
      {props.series.map((s) => (
        <path
          key={s.key}
          d={linePath(s.points.map(xy))}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={s.tone === 'secondary' ? '12 10' : undefined}
          className={STROKE[s.tone]}
          data-series={s.key}
        />
      ))}
      {props.series
        .filter((s) => s.tone === 'primary' && s.points.length <= MAX_DOTS)
        .flatMap((s) => s.points.map((p) => <circle key={`${s.key}-${p.date}`} cx={xy(p).x} cy={xy(p).y} r="6" strokeWidth="3" className="fill-text stroke-surface" />))}
      {(props.marks ?? []).map((p) => (
        <circle key={`pr-${p.date}`} cx={xy(p).x} cy={xy(p).y} r="11" strokeWidth="3" className="fill-good stroke-surface" data-testid="pr-mark" />
      ))}
      {labelled.map(({ s, end }) => (
        <text key={`end-${s.key}`} x={xy(end).x + 20} y={xy(end).y} dy="0.35em" fontSize={LABEL_FONT} className={s.tone === 'primary' ? 'tabular fill-text font-semibold' : 'tabular fill-dim'}>
          {props.formatValue(end.value)}
        </text>
      ))}
    </ChartFrame>
  );
}

export const LineChart = memo(LineChartImpl);
