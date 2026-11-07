import type { ExerciseDef } from '../../../core/library/schema.ts';
import type { PlanItem, PlanSet } from '../../../core/plan.ts';
import { completedSets, currentItem, currentSet, elapsedMs, phaseLengthMs, remainingMs, totalSets, upNext } from '../../../core/session/selectors.ts';
import type { Phase, SessionState } from '../../../core/session/types.ts';
import { DAY_LABELS } from '../../../core/days.ts';
import { useAppData } from '../../app/AppData.tsx';
import { ExerciseDemo } from '../../components/ExerciseDemo.tsx';
import { KeyLegend, type LegendItem } from '../../components/KeyLegend.tsx';
import { loadHint } from '../../components/LoadInfo.tsx';
import { MuscleMap } from '../../components/MuscleMap.tsx';
import { Clock } from '../../components/Screen.tsx';
import { TimerRing } from '../../components/TimerRing.tsx';
import { cx } from '../../lib/cx.ts';
import { formatClock, formatLoad, formatWeight } from '../../lib/format.ts';

const PHASE: Record<Phase, { label: string; text: string; bg: string }> = {
  intro: { label: 'Get ready', text: 'text-ready', bg: 'bg-ready' },
  work: { label: 'Work', text: 'text-work', bg: 'bg-work' },
  rest: { label: 'Rest', text: 'text-rest', bg: 'bg-rest' },
  done: { label: 'Done', text: 'text-good', bg: 'bg-good' },
};

function setLabel(item: PlanItem, setIndex: number): string {
  const set = item.sets[setIndex];
  if (!set) return '';
  if (set.kind === 'warmup') return 'Warm-up';
  const workingIndex = item.sets.slice(0, setIndex + 1).filter((s) => s.kind === 'working').length;
  return `Set ${workingIndex} of ${item.workingSets}`;
}

function repsLabel(item: PlanItem, set: PlanSet): string {
  return item.amrap && set.kind === 'working' ? `${set.targetReps}+` : `${set.targetReps}`;
}

function SetPips(props: { readonly state: SessionState; readonly item: PlanItem; readonly itemIndex: number }) {
  const { state, item } = props;
  const isDone = (i: number) => state.logs.some((l) => l.position === item.position && l.setIndex === i);
  const isSkipped = (i: number) => state.skipped.some((s) => s.position === item.position && s.setIndex === i);
  const isCurrent = (i: number) => state.cursor.item === props.itemIndex && state.cursor.set === i;
  const phase = PHASE[state.phase];
  return (
    <div className="flex items-center gap-3" data-testid="set-pips">
      {item.sets.map((set, i) => (
        <span
          key={i}
          className={cx(
            'inline-block border-4',
            set.kind === 'warmup' ? 'h-5 w-5 rounded-md' : 'h-8 w-8 rounded-full',
            isDone(i) && `${phase.bg} border-transparent`,
            isSkipped(i) && 'border-line opacity-40',
            isCurrent(i) && !isDone(i) && 'border-text',
            !isDone(i) && !isSkipped(i) && !isCurrent(i) && 'border-line',
          )}
        />
      ))}
    </div>
  );
}

function Target(props: { readonly exercise: ExerciseDef; readonly item: PlanItem; readonly setIndex: number; readonly load: number }) {
  const { settings } = useAppData();
  const set = props.item.sets[props.setIndex];
  if (!set) return null;
  const hint = loadHint(props.exercise, props.load, settings);
  const last = props.item.lastLoad;
  return (
    <div data-testid="target">
      <div className="text-[2rem] font-medium text-dim">{setLabel(props.item, props.setIndex)}</div>
      <div className="tabular font-display text-[5.5rem] font-bold leading-none">
        {repsLabel(props.item, set)} <span className="text-[2.5rem] font-medium text-dim">reps</span>
      </div>
      <div className="tabular font-display text-[3.75rem] font-semibold leading-tight" data-testid="load">
        {formatLoad(props.load, props.exercise.load)}
      </div>
      {hint && <div className="text-[1.875rem] text-dim">{hint}</div>}
      {last !== null && last !== props.load && set.kind === 'working' && props.exercise.load.type !== 'bodyweight' && (
        <div className="text-[1.5rem] text-faint">Last time {formatWeight(last)}</div>
      )}
    </div>
  );
}

function LogPanel(props: { readonly state: SessionState; readonly exercise: ExerciseDef; readonly item: PlanItem }) {
  const draft = props.state.draft;
  if (!draft) return null;
  const bodyweight = props.exercise.load.type === 'bodyweight';
  return (
    <div data-testid="log-panel">
      <div className="text-[2rem] font-medium text-dim">Logged: {setLabel(props.item, draft.cursor.set)}</div>
      <div className="flex items-baseline gap-4">
        <span className="font-display text-[2rem] text-faint">▲▼</span>
        <span className="tabular font-display text-[5.5rem] font-bold leading-none" data-testid="log-reps">{draft.reps}</span>
        <span className="text-[2.5rem] text-dim">reps</span>
      </div>
      {!bodyweight && (
        <div className="flex items-baseline gap-4">
          <span className="font-display text-[2rem] text-faint">◀▶</span>
          <span className="tabular font-display text-[3.75rem] font-semibold" data-testid="log-load">{formatLoad(draft.load, props.exercise.load)}</span>
        </div>
      )}
    </div>
  );
}

function UpNext(props: { readonly state: SessionState }) {
  const { library, settings } = useAppData();
  const next = upNext(props.state);
  if (!next) return <div className="text-[2rem] text-dim">Last set: nice work.</div>;
  const exercise = library.get(next.item.exerciseId);
  if (!exercise) return null;
  const load = props.state.draft && next.item === currentItem(props.state) && next.set.kind === 'working' ? props.state.draft.load : next.set.targetLoad;
  const hint = loadHint(exercise, load, settings);
  return (
    <div className="rounded-[1.25rem] border-2 border-line px-8 py-5" data-testid="up-next">
      <div className="text-[1.75rem] font-semibold text-rest">Up next</div>
      <div className="font-display text-[3rem] font-semibold leading-tight">{exercise.name}</div>
      <div className="tabular text-[2rem] text-dim">
        {setLabel(next.item, next.setIndex)} · {repsLabel(next.item, next.set)} × {formatLoad(load, exercise.load)}
      </div>
      {hint && <div className="text-[1.75rem] text-dim">{hint}</div>}
    </div>
  );
}

function legendFor(state: SessionState, bodyweight: boolean): LegendItem[] {
  const load = bodyweight ? [] : [{ keys: '◀ ▶', label: 'Weight' }];
  if (state.phase === 'rest') return [{ keys: 'OK', label: 'Start next set' }, { keys: '▲ ▼', label: 'Reps' }, ...load, { keys: 'BACK', label: 'Menu' }];
  if (state.phase === 'intro') return [{ keys: 'OK', label: 'Start now' }, ...load, { keys: 'BACK', label: 'Menu' }];
  return [{ keys: 'OK', label: 'Set done' }, ...load, { keys: 'BACK', label: 'Menu' }];
}

export function PlayerView(props: { readonly state: SessionState; readonly now: number; readonly saving: string }) {
  const { library } = useAppData();
  const { state, now } = props;
  const item = currentItem(state);
  const set = currentSet(state);
  const exercise = item && library.get(item.exerciseId);
  if (!item || !set || !exercise) return null;

  const next = state.phase === 'rest' ? upNext(state) : null;
  const demoItem = next && next.item.position !== item.position ? next.item : item;
  const demo = library.get(demoItem.exerciseId) ?? exercise;
  const phase = PHASE[state.phase];
  const remaining = remainingMs(state, now);
  const length = phaseLengthMs(state);
  const progress = remaining !== null && length ? 1 - remaining / length : null;
  const timerLabel = remaining !== null ? formatClock(remaining) : formatClock(elapsedMs(state, now), false);
  const done = completedSets(state);
  const total = totalSets(state);

  return (
    <main className="safe flex h-full flex-col" data-testid="player" data-phase={state.phase}>
      <header className="flex items-baseline justify-between text-[1.75rem]">
        <span className="font-display text-[2.5rem] font-semibold uppercase tracking-wide text-dim">
          {DAY_LABELS[state.plan.day]} · Exercise {state.cursor.item + 1} of {state.plan.items.length}
        </span>
        <span className="flex items-baseline gap-8">
          {props.saving === 'offline' && <span className="text-ready">Offline: saving locally</span>}
          <span className="tabular text-dim">{formatClock(now - state.startedAt, false)} elapsed</span>
          <Clock />
        </span>
      </header>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cx('h-full rounded-full', phase.bg)} style={{ width: `${Math.round((done / Math.max(1, total)) * 100)}%` }} />
      </div>

      <div className="mt-8 grid min-h-0 flex-1 grid-cols-[55fr_45fr] gap-12">
        <section className="flex min-h-0 flex-col gap-6 overflow-hidden">
          <div className="relative">
            <ExerciseDemo exercise={demo} />
            <MuscleMap
              primary={demo.muscles.primary}
              secondary={demo.muscles.secondary}
              className="absolute bottom-4 right-4 h-[12rem] w-[13rem] rounded-[1rem] bg-bg/85 p-3"
            />
            {demo !== exercise && (
              <span className="absolute left-4 top-4 rounded-full bg-rest px-6 py-1 text-[1.75rem] font-semibold text-bg">Up next</span>
            )}
          </div>
          <ul className="space-y-1 text-[2.25rem]" data-testid="cues">
            {demo.cues.map((cue) => (
              <li key={cue} className="flex gap-4">
                <span className={phase.text}>›</span>
                {cue}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col gap-6">
          <div>
            <div className={cx('font-display text-[2.75rem] font-bold uppercase tracking-[0.2em]', phase.text)} data-testid="phase-label">
              {phase.label}
            </div>
            <h1 className="font-display text-[5rem] font-bold leading-[0.95]" data-testid="exercise-name">
              {exercise.name}
            </h1>
            <div className="mt-4">
              <SetPips state={state} item={item} itemIndex={state.cursor.item} />
            </div>
          </div>
          <div className="flex items-center gap-10">
            <TimerRing
              className="w-[23rem] shrink-0"
              progress={progress}
              label={timerLabel}
              caption={state.phase === 'work' ? 'Set time' : 'Left'}
              colorClass={phase.text}
            />
            {state.phase === 'rest' ? (
              <LogPanel state={state} exercise={exercise} item={item} />
            ) : (
              <Target exercise={exercise} item={item} setIndex={state.cursor.set} load={state.load} />
            )}
          </div>
          {state.phase === 'rest' && <UpNext state={state} />}
        </section>
      </div>
      <div className="mt-6">
        <KeyLegend items={legendFor(state, exercise.load.type === 'bodyweight')} />
      </div>
    </main>
  );
}
