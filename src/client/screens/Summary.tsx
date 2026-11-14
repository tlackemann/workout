import { useEffect } from 'react';
import type { Target } from '../../core/progression/types.ts';
import { DAY_LABELS } from '../../core/days.ts';
import { api } from '../app/api.ts';
import { useAppData } from '../app/AppData.tsx';
import { useRouter } from '../app/router.tsx';
import { paths } from '../app/routes.ts';
import { useAsync } from '../app/useAsync.ts';
import { FocusButton } from '../components/FocusButton.tsx';
import { KeyLegend } from '../components/KeyLegend.tsx';
import { StatTile } from '../components/StatTile.tsx';
import { Centered, Screen } from '../components/Screen.tsx';
import { formatClock, formatDate, formatVolume, formatWeight } from '../lib/format.ts';
import type { ExerciseDef } from '../../core/library/schema.ts';

const IDLE_HOME_MS = 5 * 60_000;

function nextText(next: Target | null, exercise: ExerciseDef | undefined): string {
  if (!next || !exercise) return '';
  const reps = next.reps.every((r) => r === next.reps[0]) ? `${next.reps.length} × ${next.reps[0]}` : next.reps.join('/');
  const load = exercise.load.type === 'bodyweight' ? '' : ` @ ${formatWeight(next.load)}`;
  const tag = next.reason === 'progress' ? ' ↑' : next.reason === 'deload' ? ' (deload)' : next.reason === 'promote' ? ' (level up)' : '';
  return `Next: ${reps}${load}${tag}`;
}

export function Summary(props: { readonly id: string }) {
  const { navigate } = useRouter();
  const { library } = useAppData();
  const loaded = useAsync(() => Promise.all([api.session(props.id), api.summary(props.id)]), [props.id]);
  const goHome = () => navigate(paths.home(), { replace: true });

  useEffect(() => {
    let timer = window.setTimeout(goHome, IDLE_HOME_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(goHome, IDLE_HOME_MS);
    };
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', reset);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loaded.error) return <Centered><p className="text-dim">{loaded.error}</p></Centered>;
  if (!loaded.data) return <Centered><p className="text-dim">Loading summary…</p></Centered>;
  const [session, summary] = loaded.data;
  const prs = summary.exercises.filter((e) => e.isPr).length;

  return (
    <Screen
      testId="summary"
      title={`${DAY_LABELS[session.day]} · ${formatDate(session.endedAt ?? session.createdAt)}`}
      aside={session.status === 'ended_early' ? <span className="text-ready">Ended early</span> : undefined}
    >
      <h1 className="mb-8 font-display text-[6rem] font-bold uppercase leading-none text-good">Workout complete</h1>
      <div className="mb-8 grid grid-cols-4 gap-6">
        <StatTile label="Time" value={formatClock(summary.durationSec * 1000, false)} />
        <StatTile label="Volume" value={formatVolume(summary.volume)} />
        <StatTile label="Working sets" value={`${summary.workingSets}`} />
        <StatTile label="PRs" value={`${prs}`} />
      </div>
      <ul className="min-h-0 flex-1 space-y-3 overflow-hidden" data-testid="summary-list">
        {summary.exercises.map((ex) => {
          const def = library.get(ex.exerciseId);
          const working = ex.sets.filter((s) => s.kind === 'working');
          return (
            <li key={ex.exerciseId} className="flex items-center gap-8 rounded-[1rem] bg-surface px-8 py-3">
              <span className="w-[24rem] truncate font-display text-[2.5rem] font-semibold">{def?.name ?? ex.exerciseId}</span>
              <span className="tabular flex-1 text-[1.875rem] text-dim">
                {working.map((s) => (def?.load.type === 'bodyweight' ? `${s.reps}` : `${formatWeight(s.load)}×${s.reps}`)).join('  ·  ')}
              </span>
              {ex.isPr && <span className="rounded-full bg-good px-5 text-[1.5rem] font-semibold uppercase text-bg">PR</span>}
              <span className="tabular text-[1.875rem]">{nextText(ex.next, def)}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <FocusButton autoFocus onPress={goHome} testId="summary-done" className="rounded-[1.25rem] bg-surface-2 px-12 py-4 font-display text-[2.5rem] font-semibold uppercase">
          Done
        </FocusButton>
        <KeyLegend items={[{ keys: 'OK', label: 'Home' }]} />
      </div>
    </Screen>
  );
}
