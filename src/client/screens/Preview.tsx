import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect, useState } from 'react';
import { DAY_LABELS, LENGTH_LABELS, SESSION_LENGTHS, type SessionLength } from '../../core/days.ts';
import { estimatedMinutes } from '../../core/generator/estimate.ts';
import type { PlanItem } from '../../core/plan.ts';
import { api, type SessionDto } from '../app/api.ts';
import { useAppData } from '../app/AppData.tsx';
import { useRouter } from '../app/router.tsx';
import { paths } from '../app/routes.ts';
import { useAsync } from '../app/useAsync.ts';
import { useOverlayHistory } from '../app/useOverlayHistory.ts';
import { ExerciseThumb } from '../components/ExerciseDemo.tsx';
import { FocusButton } from '../components/FocusButton.tsx';
import { FocusGroup } from '../components/FocusGroup.tsx';
import { KeyLegend } from '../components/KeyLegend.tsx';
import { Centered, Screen } from '../components/Screen.tsx';
import { cx } from '../lib/cx.ts';
import { formatLoad } from '../lib/format.ts';
import { ItemSheet, type Sheet } from './PreviewSheet.tsx';

const BADGES: Partial<Record<PlanItem['reason'], string>> = {
  first: 'New',
  progress: 'Weight up',
  deload: 'Deload',
  stale: 'Welcome back',
  maxed: 'Stack maxed',
};

export function repsText(item: PlanItem): string {
  if (item.amrap) return 'AMRAP';
  const working = item.sets.filter((s) => s.kind === 'working').map((s) => s.targetReps);
  const same = working.every((r) => r === working[0]);
  return same ? `${working.length} × ${working[0] ?? 0}` : working.join(' / ');
}

function PlanRow(props: { readonly item: PlanItem; readonly index: number; readonly onPress: () => void }) {
  const { library } = useAppData();
  const { item } = props;
  const exercise = library.get(item.exerciseId);
  const working = item.sets.find((s) => s.kind === 'working');
  const warmups = item.sets.filter((s) => s.kind === 'warmup').length;
  const badge = item.substituted ? 'Substituted' : BADGES[item.reason];
  return (
    <FocusButton
      focusKey={`row-${item.position}`}
      onPress={props.onPress}
      testId={`row-${item.exerciseId}`}
      flat
      className="flex items-center gap-8 rounded-[1.25rem] bg-surface px-6 py-3"
    >
      <span className="tabular w-12 text-center font-display text-[2.5rem] text-faint">{props.index + 1}</span>
      <ExerciseThumb exerciseId={item.exerciseId} className="h-[5rem]" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[2.75rem] font-semibold leading-tight">{exercise?.name ?? item.exerciseId}</div>
        <div className="flex items-center gap-4 text-[1.625rem] text-dim">
          <span>{item.slotLabel}</span>
          {warmups > 0 && <span>· {warmups} warm-up sets</span>}
          {badge && <span className="rounded-full border-2 border-line px-4 text-[1.5rem] font-medium text-dim">{badge}</span>}
        </div>
      </div>
      <div className="text-right">
        <div className="tabular font-display text-[2.75rem] font-semibold">{repsText(item)}</div>
        <div className="tabular text-[1.75rem] text-dim">{exercise && working ? formatLoad(working.targetLoad, exercise.load) : ''}</div>
      </div>
    </FocusButton>
  );
}

export function Preview(props: { readonly id: string }) {
  const { navigate } = useRouter();
  const loaded = useAsync(() => api.session(props.id), [props.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const session = loaded.data;

  // TV Back closes the sheet and puts focus back on the row it was opened from.
  useOverlayHistory(sheet !== null, () => closeSheet(sheet?.item.position));

  useEffect(() => {
    if (!session) return;
    if (session.status === 'active') navigate(paths.play(session.id), { replace: true });
    else if (session.status !== 'planned') navigate(paths.home(), { replace: true });
  }, [session, navigate]);

  async function run(label: string, action: () => Promise<SessionDto | void>) {
    if (busy) return;
    setBusy(label);
    setError(null);
    try {
      const next = await action();
      if (next) loaded.setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work');
    } finally {
      setBusy(null);
    }
  }

  function closeSheet(position?: number) {
    setSheet(null);
    if (position !== undefined) window.setTimeout(() => void setFocus(`row-${position}`), 0);
  }

  if (loaded.error) return <Centered><p className="text-dim">{loaded.error}</p></Centered>;
  if (!session) return <Centered><p className="text-dim">Planning…</p></Centered>;

  const empty = session.plan.items.length === 0;
  const start = () =>
    run('start', async () => {
      if (empty) return;
      await api.start(session.id);
      navigate(paths.play(session.id), { replace: true });
    });

  return (
    <Screen
      testId="preview"
      title={`${DAY_LABELS[session.day]} day`}
      aside={<span className="tabular text-dim">≈ {estimatedMinutes(session.plan)} min · {session.plan.items.length} exercises</span>}
    >
      <FocusGroup focusKey="preview-actions" className="mb-8 flex items-center gap-6">
        <FocusButton
          focusKey="start"
          autoFocus
          onPress={() => void start()}
          testId="start"
          className="rounded-[1.25rem] bg-work px-12 py-5 font-display text-[3rem] font-bold uppercase text-bg"
        >
          {empty ? 'Nothing to do' : busy === 'start' ? 'Starting…' : 'Start'}
        </FocusButton>
        {SESSION_LENGTHS.map((length: SessionLength) => (
          <FocusButton
            key={length}
            onPress={() => void run(length, () => api.reroll(session.id, length))}
            testId={`length-${length}`}
            className={cx(
              'rounded-full border-4 px-8 py-3 text-[2rem]',
              session.length === length ? 'border-text bg-surface-2' : 'border-line text-dim',
            )}
          >
            {busy === length ? '…' : LENGTH_LABELS[length]}
          </FocusButton>
        ))}
        <FocusButton
          onPress={() => void run('reroll', () => api.reroll(session.id))}
          testId="reroll"
          className="rounded-full border-4 border-line px-8 py-3 text-[2rem] text-dim"
        >
          {busy === 'reroll' ? 'Shuffling…' : 'Shuffle accessories'}
        </FocusButton>
      </FocusGroup>
      {error && <p className="mb-4 text-work" role="alert">{error}</p>}
      {empty && (
        <p className="mb-4 text-[2rem] text-ready" role="alert">
          No exercise fits your equipment for this day. Check Settings → Equipment.
        </p>
      )}
      {session.plan.droppedSlots.length > 0 && (
        <p className="mb-4 text-[1.75rem] text-faint">Skipped (no equipment): {session.plan.droppedSlots.join(', ')}</p>
      )}
      <FocusGroup focusKey="preview-list" className="fade-bottom -mx-4 min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-2 pb-16">
        {session.plan.items.map((item, index) => (
          <PlanRow key={item.position} item={item} index={index} onPress={() => setSheet({ mode: 'actions', item })} />
        ))}
      </FocusGroup>
      <div className="mt-6">
        <KeyLegend items={[{ keys: 'OK', label: 'Start / exercise options' }, { keys: '▲ ▼', label: 'Move' }, { keys: 'BACK', label: 'Home' }]} />
      </div>
      {sheet && (
        <ItemSheet
          sheet={sheet}
          session={session}
          onChange={setSheet}
          onClose={closeSheet}
          onSession={(next) => loaded.setData(next)}
        />
      )}
    </Screen>
  );
}
