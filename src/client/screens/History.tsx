import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useState } from 'react';
import { DAY_LABELS } from '../../core/days.ts';
import { api, type SessionDto } from '../app/api.ts';
import { useRouter } from '../app/router.tsx';
import { paths } from '../app/routes.ts';
import { useAsync } from '../app/useAsync.ts';
import { useOverlayHistory } from '../app/useOverlayHistory.ts';
import { FocusButton } from '../components/FocusButton.tsx';
import { FocusGroup } from '../components/FocusGroup.tsx';
import { KeyLegend } from '../components/KeyLegend.tsx';
import { Centered, Screen } from '../components/Screen.tsx';
import { formatClock, formatDate } from '../lib/format.ts';
import { Overlay } from './PreviewSheet.tsx';

const rowKey = (id: string) => `history-${id}`;
const deleteKey = (id: string) => `history-delete-${id}`;
const OPTION = 'rounded-[1rem] bg-surface-2 px-8 py-4 text-[2.25rem]';

const workingSets = (s: SessionDto) => s.state?.logs.filter((l) => l.kind === 'working').length ?? 0;
const sessionDate = (s: SessionDto) => formatDate(s.endedAt ?? s.createdAt);
const focusLater = (key: string) => window.setTimeout(() => void setFocus(key), 0);

function HistoryRow(props: {
  readonly session: SessionDto;
  readonly autoFocus: boolean;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}) {
  const s = props.session;
  const duration = s.endedAt && s.startedAt ? formatClock(s.endedAt - s.startedAt, false) : '–';
  return (
    <div className="flex items-center gap-4">
      <FocusButton
        focusKey={rowKey(s.id)}
        testId={`session-${s.id}`}
        autoFocus={props.autoFocus}
        flat
        onPress={props.onOpen}
        className="flex flex-1 items-center gap-10 rounded-[1rem] bg-surface px-8 py-4"
      >
        <span className="w-[18rem] text-[2rem] text-dim">{sessionDate(s)}</span>
        <span className="w-[12rem] font-display text-[3rem] font-semibold uppercase">{DAY_LABELS[s.day]}</span>
        <span className="tabular flex-1 text-[2rem] text-dim">{workingSets(s)} sets · {duration}</span>
        {s.status === 'ended_early' && <span className="text-[1.75rem] text-ready">Ended early</span>}
      </FocusButton>
      <FocusButton
        focusKey={deleteKey(s.id)}
        testId={`delete-${s.id}`}
        label={`Delete ${DAY_LABELS[s.day]} workout from ${sessionDate(s)}`}
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
  readonly session: SessionDto;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const s = props.session;
  return (
    <Overlay title="Delete this workout?" testId="confirm-delete">
      <p className="mb-2 text-[2.25rem]">
        {DAY_LABELS[s.day]} · {sessionDate(s)} · {workingSets(s)} sets
      </p>
      <p className="mb-6 text-[2rem] text-dim">
        Its sets come out of your progress charts and future weight targets. This can’t be undone.
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
  const sessions = useAsync(() => api.sessions(40), []);
  const [pending, setPending] = useState<SessionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TV Back closes the confirmation and returns focus to the Delete it came from.
  useOverlayHistory(pending !== null, () => closeConfirm(pending));

  function openConfirm(session: SessionDto) {
    setError(null);
    setPending(session);
  }

  function closeConfirm(session: SessionDto | null) {
    setPending(null);
    setError(null);
    if (session) focusLater(deleteKey(session.id));
  }

  async function confirmDelete() {
    const list = sessions.data;
    if (!pending || !list || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteSession(pending.id);
      const index = list.findIndex((s) => s.id === pending.id);
      const neighbour = list[index + 1] ?? list[index - 1];
      sessions.setData(list.filter((s) => s.id !== pending.id));
      setPending(null);
      if (neighbour) focusLater(rowKey(neighbour.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that workout');
    } finally {
      setBusy(false);
    }
  }

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
          {sessions.data.map((s, i) => (
            <HistoryRow
              key={s.id}
              session={s}
              autoFocus={i === 0}
              onOpen={() => navigate(paths.summary(s.id))}
              onDelete={() => openConfirm(s)}
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
          session={pending}
          busy={busy}
          error={error}
          onCancel={() => closeConfirm(pending)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </Screen>
  );
}
