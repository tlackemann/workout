import type { Consistency } from '../../../core/stats/types.ts';
import { LegendKey } from '../../components/charts/ChartFrame.tsx';
import { WeeklyChart } from '../../components/charts/WeeklyChart.tsx';
import { StatTile } from '../../components/StatTile.tsx';
import { formatDecimal, formatWeeks } from '../../lib/format.ts';

const CHART_WIDTH = 1160;

export function ConsistencyView(props: { readonly consistency: Consistency }) {
  const { streak, avgPerWeek } = props.consistency;
  const atRisk = streak.current > 0 && streak.thisWeek === 0;
  return (
    <div className="flex h-full min-h-0 gap-12">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-10">
          <span className="text-[1.75rem] text-dim">Last 26 weeks</span>
          <LegendKey label="1 workout" swatch="fill-dim" />
          <LegendKey label="2 in a day" swatch="fill-text" />
        </div>
        <WeeklyChart weeks={props.consistency.weeks} heatmap={props.consistency.heatmap} width={CHART_WIDTH} />
        <div className="flex items-center gap-10">
          <span className="text-[1.75rem] text-dim">Workouts per week</span>
          <LegendKey label="Push" swatch="fill-push" />
          <LegendKey label="Pull" swatch="fill-pull" />
          <LegendKey label="Legs" swatch="fill-legs" />
        </div>
      </section>
      <section className="flex flex-1 flex-col gap-4" data-testid="consistency-tiles">
        <StatTile compact label="Streak" value={formatWeeks(streak.current)} note={atRisk ? 'Train this week to keep it' : undefined} testId="streak" />
        <StatTile compact label="Best streak" value={formatWeeks(streak.best)} />
        <StatTile compact label="This week" value={`${streak.thisWeek}`} />
        <StatTile compact label="Average / week" value={avgPerWeek === null ? '–' : formatDecimal(avgPerWeek)} note={avgPerWeek === null ? 'After your first full week' : 'Last 8 full weeks'} />
      </section>
    </div>
  );
}
