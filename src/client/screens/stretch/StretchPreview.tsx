import { useEffect, useState } from 'react';
import { LENGTH_LABELS, SESSION_LENGTHS, type SessionLength } from '../../../core/days.ts';
import { estimatedMinutes } from '../../../core/generator/estimate.ts';
import { stretchItems } from '../../../core/stretch/selectors.ts';
import { api, type StretchSessionDto } from '../../app/api.ts';
import { useRouter } from '../../app/router.tsx';
import { paths } from '../../app/routes.ts';
import { useAsync } from '../../app/useAsync.ts';
import { FocusButton } from '../../components/FocusButton.tsx';
import { FocusGroup } from '../../components/FocusGroup.tsx';
import { KeyLegend } from '../../components/KeyLegend.tsx';
import { Centered, Screen } from '../../components/Screen.tsx';
import { cx } from '../../lib/cx.ts';
import { StretchRowBody } from './StretchRows.tsx';

export function StretchPreview(props: { readonly id: string }) {
  const { navigate } = useRouter();
  const loaded = useAsync(() => api.stretch(props.id), [props.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = loaded.data;

  useEffect(() => {
    if (!session) return;
    if (session.status === 'active') navigate(paths.stretchPlay(session.id), { replace: true });
    else if (session.status !== 'planned') navigate(paths.home(), { replace: true });
  }, [session, navigate]);

  async function run(label: string, action: () => Promise<StretchSessionDto | void>) {
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

  if (loaded.error) return <Centered><p className="text-dim">{loaded.error}</p></Centered>;
  if (!session) return <Centered><p className="text-dim">Planning…</p></Centered>;

  const items = stretchItems(session.plan.steps);
  const empty = items.length === 0;
  const start = () =>
    run('start', async () => {
      if (empty) return;
      await api.startStretch(session.id);
      navigate(paths.stretchPlay(session.id), { replace: true });
    });

  return (
    <Screen
      testId="stretch-preview"
      title={<span className="text-stretch">Stretch · Recovery</span>}
      aside={<span className="tabular text-dim">≈ {estimatedMinutes(session.plan)} min · {items.length} stretches</span>}
    >
      <FocusGroup focusKey="stretch-actions" className="mb-8 flex items-center gap-6">
        <FocusButton
          focusKey="stretch-start"
          autoFocus
          onPress={() => void start()}
          testId="stretch-start"
          className="rounded-[1.25rem] bg-stretch px-12 py-5 font-display text-[3rem] font-bold uppercase text-bg"
        >
          {empty ? 'Nothing to do' : busy === 'start' ? 'Starting…' : 'Start'}
        </FocusButton>
        {SESSION_LENGTHS.map((length: SessionLength) => (
          <FocusButton
            key={length}
            onPress={() => void run(length, () => api.rerollStretch(session.id, length))}
            testId={`stretch-length-${length}`}
            className={cx('rounded-full border-4 px-8 py-3 text-[2rem]', session.length === length ? 'border-text bg-surface-2' : 'border-line text-dim')}
          >
            {busy === length ? '…' : LENGTH_LABELS[length]}
          </FocusButton>
        ))}
        <FocusButton
          onPress={() => void run('reroll', () => api.rerollStretch(session.id))}
          testId="stretch-reroll"
          className="rounded-full border-4 border-line px-8 py-3 text-[2rem] text-dim"
        >
          {busy === 'reroll' ? 'Shuffling…' : 'Shuffle stretches'}
        </FocusButton>
      </FocusGroup>
      {error && <p className="mb-4 text-work" role="alert">{error}</p>}
      {empty && (
        <p className="mb-4 text-[2rem] text-ready" role="alert">
          No stretch fits your equipment. Check Settings → Equipment.
        </p>
      )}
      <FocusGroup focusKey="stretch-list" className="fade-bottom -mx-4 grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-3 overflow-hidden px-4 py-2 pb-16">
        {items.map((item, index) => (
          <FocusButton
            key={item.indices[0]}
            focusKey={`stretch-row-${index}`}
            testId={`stretch-row-${item.stretchId}`}
            flat
            className="flex items-center gap-4 rounded-[1.25rem] bg-surface px-5 py-2"
          >
            <span className="tabular w-8 shrink-0 text-center font-display text-[2rem] text-faint">{index + 1}</span>
            <StretchRowBody item={item} />
          </FocusButton>
        ))}
      </FocusGroup>
      <div className="mt-6">
        <KeyLegend items={[{ keys: 'OK', label: 'Start' }, { keys: '▲ ▼', label: 'Browse' }, { keys: 'BACK', label: 'Home' }]} />
      </div>
    </Screen>
  );
}
