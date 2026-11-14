import { useState } from 'react';
import { DAYS, DAY_LABELS, type Day } from '../../core/days.ts';
import type { Settings } from '../../core/settings.ts';
import type { Library } from '../../core/library/index.ts';
import { TEMPLATES } from '../../data/templates.ts';
import { api, type SessionDto } from '../app/api.ts';
import { useAppData } from '../app/AppData.tsx';
import { useRouter } from '../app/router.tsx';
import { paths } from '../app/routes.ts';
import { useAsync } from '../app/useAsync.ts';
import { FocusButton } from '../components/FocusButton.tsx';
import { FocusGroup } from '../components/FocusGroup.tsx';
import { KeyLegend } from '../components/KeyLegend.tsx';
import { Centered, Screen } from '../components/Screen.tsx';
import { formatAgo } from '../lib/format.ts';
import { cx } from '../lib/cx.ts';

const DAY_BG: Record<Day, string> = { push: 'bg-push', pull: 'bg-pull', legs: 'bg-legs' };
/** Variant classes win over the base bg-surface regardless of stylesheet order. */
const DAY_FOCUS_BG: Record<Day, string> = {
  push: 'data-[focused=true]:bg-push',
  pull: 'data-[focused=true]:bg-pull',
  legs: 'data-[focused=true]:bg-legs',
};
const DAY_TEXT: Record<Day, string> = { push: 'text-push', pull: 'text-pull', legs: 'text-legs' };

function anchorNames(day: Day, settings: Settings, library: Library): string[] {
  return TEMPLATES[day].slots
    .filter((s) => s.role === 'anchor')
    .map((s) => library.get(settings.anchors[day][s.id] ?? s.candidates[0] ?? '')?.name ?? s.label);
}

function DayTile(props: {
  readonly day: Day;
  readonly isNext: boolean;
  readonly last: number | null;
  readonly anchors: readonly string[];
  readonly busy: boolean;
  readonly autoFocus: boolean;
  readonly onPress: () => void;
}) {
  const { day } = props;
  return (
    <FocusButton
      focusKey={`day-${day}`}
      autoFocus={props.autoFocus}
      onPress={props.onPress}
      testId={`day-${day}`}
      label={`${DAY_LABELS[day]} day`}
      className={cx('group relative flex h-full flex-col justify-between overflow-hidden rounded-[1.75rem] bg-surface p-10', DAY_FOCUS_BG[day])}
    >
      <div className={cx('absolute inset-x-0 top-0 h-3', DAY_BG[day])} />
      <div className="flex items-center justify-between">
        <span className="text-[2rem] font-semibold text-dim group-data-[focused=true]:text-text">
          {props.isNext ? 'Next up' : ' '}
        </span>
        <span className="text-[1.75rem] text-faint group-data-[focused=true]:text-text">
          {props.last ? formatAgo(props.last, Date.now()) : 'Not yet'}
        </span>
      </div>
      <div>
        <div className={cx('font-display text-[9rem] font-bold uppercase leading-[0.9]', DAY_TEXT[day], 'group-data-[focused=true]:text-text')}>
          {props.busy ? '…' : DAY_LABELS[day]}
        </div>
        <ul className="mt-6 space-y-1 text-[2rem] text-dim group-data-[focused=true]:text-text">
          {props.anchors.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    </FocusButton>
  );
}

function ResumeBar(props: { readonly session: SessionDto; readonly onPress: () => void }) {
  const state = props.session.state;
  const total = props.session.plan.items.reduce((n, i) => n + i.sets.length, 0);
  const done = state ? state.logs.length + state.skipped.length : 0;
  return (
    <FocusButton
      focusKey="resume"
      autoFocus
      onPress={props.onPress}
      testId="resume"
      className="mb-8 flex items-center justify-between rounded-[1.5rem] border-4 border-ready bg-surface px-10 py-6"
    >
      <span className="font-display text-[3.5rem] font-semibold uppercase">Resume {DAY_LABELS[props.session.day]}</span>
      <span className="tabular text-[2rem] text-dim">
        {done} of {total} sets done
      </span>
    </FocusButton>
  );
}

export function Home() {
  const { navigate } = useRouter();
  const { settings, library } = useAppData();
  const home = useAsync(() => Promise.all([api.home(), api.sessions(30)]), []);
  const [busy, setBusy] = useState<Day | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(day: Day) {
    if (busy) return;
    setBusy(day);
    setError(null);
    try {
      const session = await api.createSession(day, settings.defaultLength);
      navigate(paths.preview(session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not plan that workout');
      setBusy(null);
    }
  }

  if (home.error) {
    return (
      <Centered>
        <p className="text-dim">{home.error}</p>
        <FocusButton autoFocus onPress={home.reload} className="rounded-2xl bg-surface-2 px-10 py-4">
          Try again
        </FocusButton>
      </Centered>
    );
  }
  if (!home.data) return <Centered><p className="text-dim">Loading…</p></Centered>;

  const [info, recent] = home.data;
  const lastByDay = (day: Day) => recent.find((s) => s.day === day)?.endedAt ?? null;

  return (
    <Screen testId="home" title="Gym TV">
      {info.active && <ResumeBar session={info.active} onPress={() => navigate(paths.play(info.active!.id))} />}
      <h1 className="mb-6 font-display text-[3rem] font-semibold text-dim">What are we training?</h1>
      <FocusGroup focusKey="days" className="grid min-h-0 flex-1 grid-cols-3 gap-10">
        {DAYS.map((day) => (
          <DayTile
            key={day}
            day={day}
            isNext={info.nextDay === day}
            last={lastByDay(day)}
            anchors={anchorNames(day, settings, library)}
            busy={busy === day}
            autoFocus={!info.active && info.nextDay === day}
            onPress={() => void pick(day)}
          />
        ))}
      </FocusGroup>
      {error && <p className="mt-6 text-work" role="alert">{error}</p>}
      <div className="mt-10 flex items-end justify-between">
        <FocusGroup focusKey="home-links" className="flex gap-6">
          <FocusButton onPress={() => navigate(paths.history())} testId="go-history" className="rounded-2xl bg-surface-2 px-8 py-4 text-[2rem]">
            History
          </FocusButton>
          <FocusButton onPress={() => navigate(paths.progress())} testId="go-progress" className="rounded-2xl bg-surface-2 px-8 py-4 text-[2rem]">
            Progress
          </FocusButton>
          <FocusButton onPress={() => navigate(paths.settings())} testId="go-settings" className="rounded-2xl bg-surface-2 px-8 py-4 text-[2rem]">
            Settings
          </FocusButton>
        </FocusGroup>
        <KeyLegend items={[{ keys: '◀ ▶', label: 'Choose' }, { keys: 'OK', label: 'Plan workout' }]} />
      </div>
    </Screen>
  );
}
