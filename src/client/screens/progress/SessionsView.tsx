import { DAYS, DAY_LABELS, type Day } from '../../../core/days.ts';
import type { SessionPoint, SessionTrends } from '../../../core/stats/types.ts';
import { LegendKey } from '../../components/charts/ChartFrame.tsx';
import { ColumnChart } from '../../components/charts/ColumnChart.tsx';
import { niceDomain, type NiceDomain } from '../../components/charts/scale.ts';
import { formatCompact, formatMinutes } from '../../lib/format.ts';

const PANEL = { width: 520, height: 170 };
const SLOTS = 10;
/** Day hues identify the panel; each panel is also titled, so colour is never the only cue. */
const TONE: Record<Day, { fill: string; stroke: string }> = {
  push: { fill: 'fill-push', stroke: 'stroke-push' },
  pull: { fill: 'fill-pull', stroke: 'stroke-pull' },
  legs: { fill: 'fill-legs', stroke: 'stroke-legs' },
};

interface Metric {
  readonly key: 'duration' | 'volume';
  readonly title: string;
  readonly value: (p: SessionPoint) => number | null;
  readonly format: (v: number) => string;
}

const METRICS: readonly Metric[] = [
  { key: 'duration', title: 'Workout length (min)', value: (p) => (p.durationSec === null ? null : Math.round(p.durationSec / 60)), format: (v) => `${v}` },
  { key: 'volume', title: 'Volume (lb lifted)', value: (p) => p.volume, format: formatCompact },
];

function Row(props: { readonly metric: Metric; readonly trends: SessionTrends }) {
  const { metric, trends } = props;
  const values = DAYS.flatMap((d) => trends.byDay[d].map(metric.value)).filter((v): v is number => v !== null);
  const domain: NiceDomain = niceDomain(values, { zero: true, maxTicks: 3 });
  return (
    <div data-testid={`sessions-${metric.key}`}>
      <h3 className="mb-2 text-[1.625rem] font-medium text-dim">{metric.title}</h3>
      <div className="flex gap-8">
        {DAYS.map((day) => {
          const points = trends.byDay[day];
          return (
            <div key={day} className="rounded-[1rem] bg-surface px-4 pb-1 pt-3">
              <div className="font-display text-[1.75rem] font-semibold uppercase leading-none">{DAY_LABELS[day]}</div>
              {points.length === 0 ? (
                <div className="flex items-center justify-center text-[1.5rem] text-faint" style={{ width: `${PANEL.width / 16}rem`, height: `${PANEL.height / 16}rem` }}>
                  No {DAY_LABELS[day]} sessions yet
                </div>
              ) : (
                <ColumnChart
                  columns={points.map((p) => ({ key: p.id, value: metric.value(p), hollow: p.endedEarly }))}
                  slots={SLOTS}
                  domain={domain}
                  width={PANEL.width}
                  height={PANEL.height}
                  label={`${DAY_LABELS[day]} ${metric.title}`}
                  fill={TONE[day].fill}
                  stroke={TONE[day].stroke}
                  formatValue={metric.format}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionsView(props: { readonly trends: SessionTrends }) {
  const { trends } = props;
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-10 text-[1.75rem] text-dim">
        <span>Last {SLOTS} sessions per day, newest on the right</span>
        {trends.avgDurationSec !== null && <span className="text-text">Average {formatMinutes(trends.avgDurationSec)}</span>}
        <LegendKey label="Ended early" swatch="fill-none stroke-dim [stroke-width:3]" />
        <LegendKey label="No reliable time" glyph="–" />
      </div>
      {METRICS.map((m) => (
        <Row key={m.key} metric={m} trends={trends} />
      ))}
      <p className="text-[1.375rem] text-faint">
        Volume = reps × weight over working sets (bodyweight counts as 0).
      </p>
    </div>
  );
}
