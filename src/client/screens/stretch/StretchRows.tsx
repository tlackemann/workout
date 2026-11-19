import { REGION_LABELS } from '../../../core/stretch/schema.ts';
import type { StretchItem } from '../../../core/stretch/selectors.ts';
import { useAppData } from '../../app/AppData.tsx';
import { ExerciseThumb } from '../../components/ExerciseDemo.tsx';

const BLOCK_VERB = { warm: 'Move', roll: 'Roll', stretch: 'Hold' } as const;

/** "Hold 30 s · each side", "Roll 45 s", "Move 30 s". */
export function timingText(item: StretchItem, block: keyof typeof BLOCK_VERB): string {
  return `${BLOCK_VERB[block]} ${item.holdSec} s${item.perSide ? ' · each side' : ''}`;
}

/** Thumb, name and region/timing for one stretch (used by the preview and the Done screen). */
export function StretchRowBody(props: { readonly item: StretchItem; readonly trailing?: React.ReactNode }) {
  const { stretches } = useAppData();
  const def = stretches.get(props.item.stretchId);
  return (
    <>
      <ExerciseThumb exerciseId={props.item.stretchId} className="h-[3.75rem] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[2.25rem] font-semibold leading-tight">{def?.name ?? props.item.stretchId}</div>
        <div className="truncate text-[1.5rem] text-dim">
          {def ? `${REGION_LABELS[def.region]} · ${timingText(props.item, def.block)}` : ''}
        </div>
      </div>
      {props.trailing}
    </>
  );
}
