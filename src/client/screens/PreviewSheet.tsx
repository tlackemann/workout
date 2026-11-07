import { useState } from 'react';
import type { PlanItem } from '../../core/plan.ts';
import { api, type SessionDto } from '../app/api.ts';
import { useAppData } from '../app/AppData.tsx';
import { useAsync } from '../app/useAsync.ts';
import { ExerciseThumb } from '../components/ExerciseDemo.tsx';
import { FocusButton } from '../components/FocusButton.tsx';
import { FocusGroup } from '../components/FocusGroup.tsx';
import { formatLoad } from '../lib/format.ts';

export type Sheet = { readonly mode: 'actions'; readonly item: PlanItem } | { readonly mode: 'swap'; readonly item: PlanItem };

const OPTION = 'rounded-[1rem] bg-surface-2 px-8 py-4 text-[2.25rem]';

export function Overlay(props: { readonly children: React.ReactNode; readonly title: string; readonly testId?: string }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-bg/85" data-testid={props.testId}>
      <div className="w-[62rem] max-w-[90vw] rounded-[1.75rem] border-2 border-line bg-surface p-10">
        <h2 className="mb-6 font-display text-[3.5rem] font-semibold leading-tight">{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}

function SwapList(props: {
  readonly session: SessionDto;
  readonly item: PlanItem;
  readonly onPicked: (next: SessionDto) => void;
}) {
  const { library } = useAppData();
  const alts = useAsync(() => api.alternatives(props.session.id, props.item.position), [props.item.position]);
  const [error, setError] = useState<string | null>(null);

  async function pick(alt: PlanItem) {
    try {
      props.onPicked(await api.swapPlanned(props.session.id, props.item.position, alt.exerciseId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
    }
  }

  if (alts.error) return <p className="text-work">{alts.error}</p>;
  if (!alts.data) return <p className="text-dim">Finding alternatives…</p>;
  if (alts.data.length === 0) return <p className="text-dim">Nothing else fits this slot with your equipment.</p>;
  return (
    <FocusGroup focusKey="swap-list" boundary className="space-y-3">
      {alts.data.map((alt, i) => {
        const ex = library.get(alt.exerciseId);
        const load = alt.sets.find((s) => s.kind === 'working')?.targetLoad ?? 0;
        return (
          <FocusButton key={alt.exerciseId} autoFocus={i === 0} onPress={() => void pick(alt)} testId={`alt-${alt.exerciseId}`} flat className="flex items-center gap-6 rounded-[1rem] bg-surface-2 px-6 py-3">
            <ExerciseThumb exerciseId={alt.exerciseId} className="h-[4.5rem]" />
            <span className="flex-1 font-display text-[2.5rem] font-semibold">{ex?.name ?? alt.exerciseId}</span>
            <span className="tabular text-[1.75rem] text-dim">{ex ? formatLoad(load, ex.load) : ''}</span>
          </FocusButton>
        );
      })}
      {error && <p className="text-work">{error}</p>}
    </FocusGroup>
  );
}

export function ItemSheet(props: {
  readonly sheet: Sheet;
  readonly session: SessionDto;
  readonly onChange: (sheet: Sheet) => void;
  readonly onClose: (position?: number) => void;
  readonly onSession: (next: SessionDto) => void;
}) {
  const { library, prefs, updatePref } = useAppData();
  const { item } = props.sheet;
  const exercise = library.get(item.exerciseId);
  const pref = prefs[item.exerciseId] ?? { favorite: false, banned: false, startLoad: null };
  const [error, setError] = useState<string | null>(null);

  const picked = (next: SessionDto) => {
    props.onSession(next);
    props.onClose(item.position);
  };

  async function toggleFavorite() {
    try {
      await updatePref(item.exerciseId, { ...pref, favorite: !pref.favorite, banned: false });
      props.onClose(item.position);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function ban() {
    try {
      await updatePref(item.exerciseId, { ...pref, banned: true, favorite: false });
      const alts = await api.alternatives(props.session.id, item.position);
      const first = alts[0];
      if (first) picked(await api.swapPlanned(props.session.id, item.position, first.exerciseId));
      else props.onClose(item.position);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  const name = exercise?.name ?? item.exerciseId;
  if (props.sheet.mode === 'swap') {
    return (
      <Overlay title={`Swap ${name} for…`} testId="swap-sheet">
        <SwapList session={props.session} item={item} onPicked={picked} />
      </Overlay>
    );
  }
  return (
    <Overlay title={name} testId="item-sheet">
      <FocusGroup focusKey="item-actions" boundary className="grid gap-3">
        <FocusButton autoFocus onPress={() => props.onChange({ mode: 'swap', item })} testId="action-swap" flat className={OPTION}>
          Swap exercise
        </FocusButton>
        <FocusButton onPress={() => void toggleFavorite()} testId="action-favorite" flat className={OPTION}>
          {pref.favorite ? 'Remove from favourites' : 'Favourite (pick more often)'}
        </FocusButton>
        <FocusButton onPress={() => void ban()} testId="action-ban" flat className={OPTION}>
          Never suggest this
        </FocusButton>
        <FocusButton onPress={() => props.onClose(item.position)} testId="action-cancel" flat className={`${OPTION} text-dim`}>
          Cancel
        </FocusButton>
      </FocusGroup>
      {error && <p className="mt-4 text-work">{error}</p>}
    </Overlay>
  );
}
