import { DAY_LABELS } from '../../core/days.ts';
import { api } from '../app/api.ts';
import { useRouter } from '../app/router.tsx';
import { paths } from '../app/routes.ts';
import { useAsync } from '../app/useAsync.ts';
import { FocusButton } from '../components/FocusButton.tsx';
import { FocusGroup } from '../components/FocusGroup.tsx';
import { KeyLegend } from '../components/KeyLegend.tsx';
import { Centered, Screen } from '../components/Screen.tsx';
import { formatClock, formatDate } from '../lib/format.ts';

export function History() {
  const { navigate } = useRouter();
  const sessions = useAsync(() => api.sessions(40), []);
  if (sessions.error) return <Centered><p className="text-dim">{sessions.error}</p></Centered>;
  if (!sessions.data) return <Centered><p className="text-dim">Loading…</p></Centered>;

  return (
    <Screen testId="history" title="History">
      {sessions.data.length === 0 ? (
        <Centered>
          <p className="text-dim">No finished workouts yet.</p>
          <FocusButton autoFocus onPress={() => window.history.back()} className="rounded-2xl bg-surface-2 px-10 py-4">
            Back
          </FocusButton>
        </Centered>
      ) : (
        <FocusGroup focusKey="history-list" className="-mx-4 min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-2">
          {sessions.data.map((s, i) => {
            const logged = s.state?.logs.filter((l) => l.kind === 'working').length ?? 0;
            const duration = s.endedAt && s.startedAt ? formatClock(s.endedAt - s.startedAt, false) : '–';
            return (
              <FocusButton
                key={s.id}
                autoFocus={i === 0}
                flat
                onPress={() => navigate(paths.summary(s.id))}
                className="flex items-center gap-10 rounded-[1rem] bg-surface px-8 py-4"
              >
                <span className="w-[18rem] text-[2rem] text-dim">{formatDate(s.endedAt ?? s.createdAt)}</span>
                <span className="w-[12rem] font-display text-[3rem] font-semibold uppercase">{DAY_LABELS[s.day]}</span>
                <span className="tabular flex-1 text-[2rem] text-dim">{logged} sets · {duration}</span>
                {s.status === 'ended_early' && <span className="text-[1.75rem] text-ready">Ended early</span>}
              </FocusButton>
            );
          })}
        </FocusGroup>
      )}
      <div className="mt-6">
        <KeyLegend items={[{ keys: 'OK', label: 'Open summary' }, { keys: 'BACK', label: 'Home' }]} />
      </div>
    </Screen>
  );
}
