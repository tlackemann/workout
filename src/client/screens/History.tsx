import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useState } from 'react';
import { DAY_LABELS } from '../../core/days.ts';
import { stretchCount } from '../../core/stretch/selectors.ts';
import { api, type SessionDto, type StretchSessionDto } from '../app/api.ts';
import { useRouter } from '../app/router.tsx';
import { paths } from '../app/routes.ts';
import { useAsync } from '../app/useAsync.ts';
import { useOverlayHistory } from '../app/useOverlayHistory.ts';
import { FocusButton } from '../components/FocusButton.tsx';
import { FocusGroup } from '../components/FocusGroup.tsx';
import { KeyLegend } from '../components/KeyLegend.tsx';
import { Centered, Screen } from '../components/Screen.tsx';
import { cx } from '../lib/cx.ts';
import { formatClock, formatDate } from '../lib/format.ts';
import { Overlay } from './PreviewSheet.tsx';

/** A History row: a lifting workout or a stretch session. */
export type HistoryEntry =
  | { readonly kind: 'lift'; readonly session: SessionDto }
  | { readonly kind: 'stretch'; readonly session: StretchSessionDto };

const entryId = (e: HistoryEntry) => `${e.kind}-${e.session.id}`;
const rowKey = (e: HistoryEntry) => `history-${entryId(e)}`;
const deleteKey = (e: HistoryEntry) => `history-delete-${entryId(e)}`;
const OPTION = 'rounded-[1rem] bg-surface-2 px-8 py-4 text-[2.25rem]';

const workingSets = (s: SessionDto) => s.state?.logs.filter((l) => l.kind === 'working').length ?? 0;
const entryDate = (e: HistoryEntry) => e.session.endedAt ?? e.session.createdAt;
const focusLater = (key: string) => window.setTimeout(() => void setFocus(key), 0);

const HISTORY_LIMIT = 40;

/** Oldest date a list is complete back to: a list that hit the fetch limit may have older rows. */
function horizon(entries: readonly HistoryEntry[], limit: number): number {
  return entries.length >= limit ? Math.min(...entries.map(entryDate)) : -Infinity;
}

/**
 * Newest first, lifting and stretching interleaved. Each kind is fetched with its own limit,
 * so the merged list stops where the first one runs out: past that, rows of the other kind
 * would be missing without saying so.
 */
export function mergeHistory(lifts: readonly SessionDto[], stretches: readonly StretchSessionDto[], limit = HISTORY_LIMIT): HistoryEntry[] {
  const liftEntries = lifts.map((session): HistoryEntry => ({ kind: 'lift', session }));
  const stretchEntries = stretches.map((session): HistoryEntry => ({ kind: 'stretch', session }));
  const cutoff = Math.max(horizon(liftEntries, limit), horizon(stretchEntries, limit));
  return [...liftEntries, ...stretchEntries].filter((e) => entryDate(e) >= cutoff).sort((a, b) => entryDate(b) - entryDate(a));
}

function entryText(e: HistoryEntry): { readonly title: string; readonly detail: string } {
  if (e.kind === 'stretch') {
    const held = new Set(e.session.plan.steps.filter((s) => e.session.completed.includes(s.index)).map((s) => s.stretchId)).size;
    return { title: 'Stretch', detail: `${held} of ${stretchCount(e.session.plan.steps)} stretches` };
  }
  return { title: DAY_LABELS[e.session.day], detail: `${workingSets(e.session)} sets` };
}

function HistoryRow(props: {
  readonly entry: HistoryEntry;
  readonly autoFocus: boolean;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}) {
  const { entry } = props;
  const s = entry.session;
  const { title, detail } = entryText(entry);
  const stretch = entry.kind === 'stretch';
  const duration = s.endedAt && s.startedAt ? formatClock(s.endedAt - s.startedAt, false) : '–';
  return (
    <div className="flex items-center gap-4">
      <FocusButton
        focusKey={rowKey(entry)}
        testId={stretch ? `stretch-session-${s.id}` : `session-${s.id}`}
        autoFocus={props.autoFocus}
        flat
        onPress={props.onOpen}
        className="flex flex-1 items-center gap-10 rounded-[1rem] bg-surface px-8 py-4"
      >
        <span className="w-[18rem] text-[2rem] text-dim">{formatDate(entryDate(entry))}</span>
        <span className={cx('w-[12rem] font-display text-[3rem] font-semibold uppercase', stretch && 'text-stretch')}>{title}</span>
        <span className="tabular flex-1 text-[2rem] text-dim">
          {detail} · {duration}
        </span>
        {s.status === 'ended_early' && <span className="text-[1.75rem] text-ready">Ended early</span>}
      </FocusButton>
      <FocusButton
        focusKey={deleteKey(entry)}
        testId={stretch ? `delete-stretch-${s.id}` : `delete-${s.id}`}
        label={`Delete ${title} ${stretch ? 'session' : 'workout'} from ${formatDate(entryDate(entry))}`}
        flat
        onPress={props.onDelete}
        className="flex items-center self-stretch rounded-[1rem] px-6 text-[1.75rem] text-faint"
        focusedClassName="bg-surface-2 text-text"
      >
        Delete
      </FocusButton>
    </div>
  );
}

function ConfirmDelete(props: {
  readonly entry: HistoryEntry;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const { title, detail } = entryText(props.entry);
  const stretch = props.entry.kind === 'stretch';
  return (
    <Overlay title={stretch ? 'Delete this stretch session?' : 'Delete this workout?'} testId="confirm-delete">
      <p className="mb-2 text-[2.25rem]">
        {title} · {formatDate(entryDate(props.entry))} · {detail}
      </p>
      <p className="mb-6 text-[2rem] text-dim">
        {stretch
          ? 'It comes off your calendar. It doesn’t affect your lifting progress. This can’t be undone.'
          : 'Its sets come out of your progress charts and future weight targets. This can’t be undone.'}
      </p>
      <FocusGroup focusKey="confirm-delete" boundary className="grid grid-cols-2 gap-4">
        <FocusButton autoFocus onPress={props.onCancel} testId="confirm-delete-cancel" flat className={OPTION}>
          Keep it
        </FocusButton>
        <FocusButton onPress={props.onConfirm} testId="confirm-delete-yes" flat className={`${OPTION} text-work`}>
          {props.busy ? 'Deleting…' : 'Delete'}
        </FocusButton>
      </FocusGroup>
      {props.error && (
        <p className="mt-4 text-work" role="alert">
          {props.error}
        </p>
      )}
    </Overlay>
  );
}

export function History() {
  const { navigate } = useRouter();
  const lifts = useAsync(() => api.sessions(HISTORY_LIMIT), []);
  // Separate request: if stretches fail to load, lifting history still shows.
  const stretches = useAsync(() => api.stretchList(HISTORY_LIMIT).catch(() => [] as StretchSessionDto[]), []);
  const [pending, setPending] = useState<HistoryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TV Back closes the confirmation and returns focus to the Delete it came from.
  useOverlayHistory(pending !== null, () => closeConfirm(pending));

  function openConfirm(entry: HistoryEntry) {
    setError(null);
    setPending(entry);
  }

  function closeConfirm(entry: HistoryEntry | null) {
    setPending(null);
    setError(null);
    if (entry) focusLater(deleteKey(entry));
  }

  async function confirmDelete() {
    if (!pending || !lifts.data || !stretches.data || busy) return;
    const list = mergeHistory(lifts.data, stretches.data);
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'stretch') {
        await api.deleteStretch(pending.session.id);
        stretches.setData(stretches.data.filter((s) => s.id !== pending.session.id));
      } else {
        await api.deleteSession(pending.session.id);
        lifts.setData(lifts.data.filter((s) => s.id !== pending.session.id));
      }
      const index = list.findIndex((e) => entryId(e) === entryId(pending));
      const neighbour = list[index + 1] ?? list[index - 1];
      setPending(null);
      if (neighbour) focusLater(rowKey(neighbour));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that');
    } finally {
      setBusy(false);
    }
  }

  if (lifts.error) return <Centered><p className="text-dim">{lifts.error}</p></Centered>;
  if (!lifts.data || !stretches.data) return <Centered><p className="text-dim">Loading…</p></Centered>;
  const entries = mergeHistory(lifts.data, stretches.data);

  return (
    <Screen testId="history" title="History">
      {entries.length === 0 ? (
        <Centered>
          <p className="text-dim">No finished workouts yet.</p>
          <FocusButton autoFocus onPress={() => window.history.back()} className="rounded-2xl bg-surface-2 px-10 py-4">
            Back
          </FocusButton>
        </Centered>
      ) : (
        <FocusGroup focusKey="history-list" className="-mx-4 min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-2">
          {entries.map((entry, i) => (
            <HistoryRow
              key={entryId(entry)}
              entry={entry}
              autoFocus={i === 0}
              onOpen={() => navigate(entry.kind === 'stretch' ? paths.stretchDone(entry.session.id) : paths.summary(entry.session.id))}
              onDelete={() => openConfirm(entry)}
            />
          ))}
        </FocusGroup>
      )}
      <div className="mt-6">
        <KeyLegend
          items={[
            { keys: 'OK', label: 'Open summary' },
            { keys: '▶', label: 'Delete' },
            { keys: 'BACK', label: 'Home' },
          ]}
        />
      </div>
      {pending && (
        <ConfirmDelete
          entry={pending}
          busy={busy}
          error={error}
          onCancel={() => closeConfirm(pending)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </Screen>
  );
}
