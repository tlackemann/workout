import { useState } from 'react';
import type { LiftPoint, LiftSeries } from '../../../core/stats/types.ts';
import { LegendKey } from '../../components/charts/ChartFrame.tsx';
import { LineChart } from '../../components/charts/LineChart.tsx';
import { FocusButton } from '../../components/FocusButton.tsx';
import { FocusGroup } from '../../components/FocusGroup.tsx';
import { StatTile } from '../../components/StatTile.tsx';
import { cx } from '../../lib/cx.ts';
import { formatShortDate, formatWeight } from '../../lib/format.ts';

const CHART = { width: 1180, height: 400 };

const valueOf = (lift: LiftSeries, p: LiftPoint) => (lift.metric === 'e1rm' ? p.e1rm : p.bestReps);
const formatMetric = (lift: LiftSeries, v: number) => (lift.metric === 'e1rm' ? `${formatWeight(Math.round(v))}` : `${v}`);

function LiftRow(props: { readonly lift: LiftSeries; readonly selected: boolean; readonly onFocused: () => void }) {
  const { lift } = props;
  const latest = lift.points.at(-1);
  return (
    <FocusButton
      focusKey={`lift-${lift.exerciseId}`}
      testId={`lift-${lift.exerciseId}`}
      flat
      onFocused={props.onFocused}
      onPress={props.onFocused}
      className={cx('flex items-center gap-4 rounded-[1rem] px-6 py-3', props.selected ? 'bg-surface-2' : 'bg-surface')}
    >
      <span className={cx('min-w-0 flex-1 truncate text-[2rem]', lift.known ? 'text-text' : 'text-dim')}>{lift.name}</span>
      {!lift.known && <span className="rounded-full border-2 border-line px-3 text-[1.25rem] text-faint">Retired</span>}
      {latest?.isPr && <span className="rounded-full bg-good px-3 text-[1.25rem] font-semibold uppercase text-bg">PR</span>}
      <span className="tabular text-[1.75rem] text-dim">{latest ? formatMetric(lift, valueOf(lift, latest)) : ''}</span>
    </FocusButton>
  );
}

function Tiles(props: { readonly lift: LiftSeries }) {
  const { lift } = props;
  const latest = lift.points.at(-1);
  if (!latest) return null;
  const sessions = `${lift.points.length}${lift.prCount ? ` · ${lift.prCount} PR${lift.prCount === 1 ? '' : 's'}` : ''}`;
  if (lift.metric === 'reps') {
    return (
      <div className="grid grid-cols-3 gap-4">
        <StatTile compact label="Best set, last time" value={`${latest.bestReps} reps`} />
        <StatTile compact label="All-time best" value={`${lift.best} reps`} />
        <StatTile compact label="Sessions" value={sessions} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 gap-4">
      <StatTile compact label="Est. 1RM, last time" value={`${formatWeight(Math.round(latest.e1rm))} lb`} />
      <StatTile compact label="Best est. 1RM" value={`${formatWeight(Math.round(lift.best))} lb`} />
      <StatTile compact label="Top set" value={`${formatWeight(latest.topLoad)} × ${latest.topReps}`} />
      <StatTile compact label="Sessions" value={sessions} />
    </div>
  );
}

function Detail(props: { readonly lift: LiftSeries }) {
  const { lift } = props;
  const loaded = lift.metric === 'e1rm';
  const primary = { key: 'value', tone: 'primary' as const, points: lift.points.map((p) => ({ date: p.date, value: valueOf(lift, p) })) };
  const series = loaded ? [primary, { key: 'top', tone: 'secondary' as const, points: lift.points.map((p) => ({ date: p.date, value: p.topLoad })) }] : [primary];
  const marks = lift.points.filter((p) => p.isPr).map((p) => ({ date: p.date, value: valueOf(lift, p) }));
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4" data-testid="lift-detail">
      <h2 className="font-display text-[3.5rem] font-bold leading-none" data-testid="lift-title">
        {lift.name}
      </h2>
      <Tiles lift={lift} />
      <div className="flex items-center gap-10">
        <LegendKey shape="line" label={loaded ? 'Estimated 1-rep max' : 'Best set (reps)'} swatch="stroke-text" />
        {loaded && <LegendKey shape="dashed" label="Heaviest set" swatch="stroke-dim" />}
        {marks.length > 0 && <LegendKey shape="dot" label="PR" swatch="fill-good" />}
      </div>
      {lift.points.length > 1 ? (
        <LineChart
          series={series}
          marks={marks}
          width={CHART.width}
          height={CHART.height}
          label={`${lift.name} progress`}
          formatValue={(v) => formatMetric(lift, v)}
          formatDate={formatShortDate}
        />
      ) : (
        <p className="text-dim">One session so far: the trend starts after the next one.</p>
      )}
    </section>
  );
}

export function LiftsView(props: { readonly lifts: readonly LiftSeries[] }) {
  const [selectedId, setSelectedId] = useState(props.lifts[0]?.exerciseId ?? null);
  const selected = props.lifts.find((l) => l.exerciseId === selectedId) ?? props.lifts[0];
  if (!selected) return <p className="text-dim">No lifts logged yet.</p>;
  return (
    <div className="flex h-full min-h-0 gap-12">
      <FocusGroup
        focusKey="lift-list"
        preferredChildFocusKey={`lift-${selected.exerciseId}`}
        className="fade-bottom -mx-3 flex w-[30rem] shrink-0 flex-col gap-2 overflow-hidden px-3 py-2"
      >
        {props.lifts.map((lift) => (
          <LiftRow key={lift.exerciseId} lift={lift} selected={lift === selected} onFocused={() => setSelectedId(lift.exerciseId)} />
        ))}
      </FocusGroup>
      <Detail lift={selected} />
    </div>
  );
}
