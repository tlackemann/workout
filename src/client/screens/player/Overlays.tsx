import type { PlanItem } from '../../../core/plan.ts';
import type { Notice } from '../../../core/session/types.ts';
import { useAppData } from '../../app/AppData.tsx';
import { ExerciseThumb } from '../../components/ExerciseDemo.tsx';
import { cx } from '../../lib/cx.ts';
import { formatLoad } from '../../lib/format.ts';
import { Overlay } from '../PreviewSheet.tsx';
import type { MenuItem } from './menuItems.ts';

const NOTICES: Record<Exclude<Notice, null>, string> = {
  welcome_back: 'Welcome back. Your workout is paused.',
  caught_up: 'Paused while you were away.',
};

function Option(props: { readonly selected: boolean; readonly children: React.ReactNode; readonly testId?: string }) {
  return (
    <div
      data-testid={props.testId}
      data-selected={props.selected ? 'true' : 'false'}
      className={cx('focusable focus-flat rounded-[1rem] px-8 py-4 text-[2.5rem]', props.selected ? 'is-focused bg-surface-2' : 'text-dim')}
    >
      {props.children}
    </div>
  );
}

export function PauseMenu(props: { readonly items: readonly MenuItem[]; readonly index: number; readonly notice: Notice }) {
  return (
    <Overlay title="Paused" testId="pause-menu">
      {props.notice && <p className="mb-6 text-[2rem] text-ready">{NOTICES[props.notice]}</p>}
      <div className="grid gap-2">
        {props.items.map((item, i) => (
          <Option key={item.action} selected={i === props.index} testId={`menu-${item.action}`}>
            {item.label}
          </Option>
        ))}
      </div>
    </Overlay>
  );
}

export function SwapPicker(props: { readonly alternatives: readonly PlanItem[] | null; readonly error: string | null; readonly index: number }) {
  const { library } = useAppData();
  return (
    <Overlay title="Swap for…" testId="swap-picker">
      {props.error && <p className="text-work">{props.error}</p>}
      {!props.alternatives && !props.error && <p className="text-dim">Finding alternatives…</p>}
      {props.alternatives?.length === 0 && <p className="text-dim">Nothing else fits with your equipment. Press BACK.</p>}
      <div className="grid gap-2">
        {props.alternatives?.map((alt, i) => {
          const ex = library.get(alt.exerciseId);
          const load = alt.sets.find((s) => s.kind === 'working')?.targetLoad ?? 0;
          return (
            <div
              key={alt.exerciseId}
              data-testid={`swap-${alt.exerciseId}`}
              className={cx('focusable focus-flat flex items-center gap-6 rounded-[1rem] px-6 py-3', i === props.index ? 'is-focused bg-surface-2' : 'text-dim')}
            >
              <ExerciseThumb exerciseId={alt.exerciseId} className="h-[4.5rem]" />
              <span className="flex-1 font-display text-[2.5rem] font-semibold">{ex?.name ?? alt.exerciseId}</span>
              <span className="tabular text-[1.75rem]">{ex ? formatLoad(load, ex.load) : ''}</span>
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}

export function ConfirmEnd(props: { readonly endSelected: boolean }) {
  return (
    <Overlay title="End this workout?" testId="confirm-end">
      <p className="mb-6 text-[2rem] text-dim">Logged sets are kept. Skipped exercises won’t count toward progression.</p>
      <div className="grid grid-cols-2 gap-4">
        <Option selected={!props.endSelected} testId="confirm-cancel">
          Keep going
        </Option>
        <Option selected={props.endSelected} testId="confirm-end-yes">
          End workout
        </Option>
      </div>
    </Overlay>
  );
}
