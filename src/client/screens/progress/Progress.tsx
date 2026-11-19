import type { StatsDto } from '../../../core/stats/types.ts';
import { api } from '../../app/api.ts';
import type { ProgressTab } from '../../app/routes.ts';
import { useAsync } from '../../app/useAsync.ts';
import { FocusButton } from '../../components/FocusButton.tsx';
import { KeyLegend, type LegendItem } from '../../components/KeyLegend.tsx';
import { Centered, Screen } from '../../components/Screen.tsx';
import { ConsistencyView } from './ConsistencyView.tsx';
import { LiftsView } from './LiftsView.tsx';
import { MusclesView } from './MusclesView.tsx';
import { ProgressTabs } from './ProgressTabs.tsx';
import { SessionsView } from './SessionsView.tsx';

function legendFor(tab: ProgressTab): LegendItem[] {
  return [
    { keys: '◀ ▶', label: 'View' },
    ...(tab === 'lifts' ? [{ keys: '▲ ▼', label: 'Exercise' }] : []),
    { keys: 'BACK', label: 'Home' },
  ];
}

function View(props: { readonly tab: ProgressTab; readonly stats: StatsDto }) {
  switch (props.tab) {
    case 'lifts':
      return <LiftsView lifts={props.stats.lifts} />;
    case 'consistency':
      return <ConsistencyView consistency={props.stats.consistency} />;
    case 'sessions':
      return <SessionsView trends={props.stats.sessions} />;
    case 'muscles':
      return <MusclesView balance={props.stats.muscles} />;
  }
}

export function Progress(props: { readonly tab: ProgressTab }) {
  // Fetched once per visit: switching tabs re-renders from the same data.
  const stats = useAsync(() => api.stats(), []);

  if (stats.error) {
    return (
      <Centered>
        <p className="text-dim">{stats.error}</p>
        <FocusButton autoFocus onPress={stats.reload} className="rounded-2xl bg-surface-2 px-10 py-4" testId="progress-retry">
          Try again
        </FocusButton>
      </Centered>
    );
  }
  if (!stats.data) return <Centered><p className="text-dim">Loading progress…</p></Centered>;
  if (stats.data.workouts === 0) {
    return (
      <Centered>
        <p className="font-display text-[4rem] font-semibold">No finished workouts yet</p>
        <p className="text-dim">
          {stats.data.stretches > 0
            ? `${stats.data.stretches} stretch ${stats.data.stretches === 1 ? 'session' : 'sessions'} so far. Finish a workout and your progress shows up here.`
            : 'Finish one and your progress shows up here.'}
        </p>
        <FocusButton autoFocus onPress={() => window.history.back()} className="rounded-2xl bg-surface-2 px-10 py-4">
          Back
        </FocusButton>
      </Centered>
    );
  }

  const count = stats.data.workouts;
  return (
    <Screen testId="progress" title="Progress" aside={<span className="tabular text-dim">{count} {count === 1 ? 'workout' : 'workouts'}</span>}>
      <ProgressTabs active={props.tab} />
      <div className="mt-6 min-h-0 flex-1" data-testid={`progress-${props.tab}`}>
        <View tab={props.tab} stats={stats.data} />
      </div>
      <div className="mt-4">
        <KeyLegend items={legendFor(props.tab)} />
      </div>
    </Screen>
  );
}
