import { stretchItems } from '../../../core/stretch/selectors.ts';
import { api } from '../../app/api.ts';
import { useRouter } from '../../app/router.tsx';
import { paths } from '../../app/routes.ts';
import { useAsync } from '../../app/useAsync.ts';
import { useIdleReturn } from '../../app/useIdleReturn.ts';
import { FocusButton } from '../../components/FocusButton.tsx';
import { KeyLegend } from '../../components/KeyLegend.tsx';
import { Centered, Screen } from '../../components/Screen.tsx';
import { StatTile } from '../../components/StatTile.tsx';
import { cx } from '../../lib/cx.ts';
import { formatClock, formatDate } from '../../lib/format.ts';
import { IDLE_HOME_MS } from '../Summary.tsx';
import { StretchRowBody } from './StretchRows.tsx';

const FINISHED = ['completed', 'ended_early'];

/** End-of-session screen; History's stretch rows open it too. */
export function StretchDone(props: { readonly id: string }) {
  const { navigate } = useRouter();
  const loaded = useAsync(() => api.stretch(props.id), [props.id]);
  const goHome = () => navigate(paths.home(), { replace: true });
  useIdleReturn(goHome, IDLE_HOME_MS);

  if (loaded.error) return <Centered><p className="text-dim">{loaded.error}</p></Centered>;
  const session = loaded.data;
  if (!session) return <Centered><p className="text-dim">Loading…</p></Centered>;
  if (!FINISHED.includes(session.status)) {
    return (
      <Centered>
        <p className="text-dim">This stretch session wasn’t finished.</p>
        <FocusButton autoFocus onPress={goHome} className="rounded-2xl bg-surface-2 px-10 py-4">
          Go home
        </FocusButton>
      </Centered>
    );
  }

  const items = stretchItems(session.plan.steps);
  const held = (indices: readonly number[]) => indices.some((i) => session.completed.includes(i));
  const done = items.filter((item) => held(item.indices)).length;
  const duration = session.endedAt && session.startedAt ? formatClock(session.endedAt - session.startedAt, false) : '–';

  return (
    <Screen
      testId="stretch-done"
      title={`Stretch · ${formatDate(session.endedAt ?? session.createdAt)}`}
      aside={session.status === 'ended_early' ? <span className="text-ready">Ended early</span> : undefined}
    >
      {/* Heading and tiles share a row so a Long session's 18 stretches fit below. */}
      <div className="mb-6 flex items-center gap-6">
        <h1 className="flex-1 font-display text-[5rem] font-bold uppercase leading-none text-stretch">Stretch complete</h1>
        <div className="grid w-[60%] grid-cols-3 gap-6">
          <StatTile compact label="Time" value={duration} />
          <StatTile compact label="Stretches" value={`${done} of ${items.length}`} />
          <StatTile compact label="Skipped" value={`${items.length - done}`} />
        </div>
      </div>
      <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-3 overflow-hidden" data-testid="stretch-done-list">
        {items.map((item) => (
          <li key={item.indices[0]} className={cx('flex items-center gap-4 rounded-[1rem] bg-surface px-5 py-2', !held(item.indices) && 'opacity-50')}>
            <StretchRowBody item={item} trailing={held(item.indices) ? <span className="text-[2.5rem] text-stretch">✓</span> : <span className="text-[1.75rem] text-faint">Skipped</span>} />
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <FocusButton autoFocus onPress={goHome} testId="stretch-done-home" className="rounded-[1.25rem] bg-surface-2 px-12 py-4 font-display text-[2.5rem] font-semibold uppercase">
          Done
        </FocusButton>
        <KeyLegend items={[{ keys: 'OK', label: 'Home' }]} />
      </div>
    </Screen>
  );
}
