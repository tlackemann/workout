import { MUSCLE_LABELS } from '../../../core/muscles.ts';
import { REGION_LABELS, type StretchDef } from '../../../core/stretch/schema.ts';
import { currentStep, elapsedMs, nextStep, phaseLengthMs, remainingMs, stretchCount, stretchNumber, stretchProgress } from '../../../core/stretch/selectors.ts';
import type { StretchState } from '../../../core/stretch/state.ts';
import type { StretchStep } from '../../../core/stretch/types.ts';
import { useAppData } from '../../app/AppData.tsx';
import { ExerciseDemo, type DemoSubject } from '../../components/ExerciseDemo.tsx';
import { KeyLegend, type LegendItem } from '../../components/KeyLegend.tsx';
import { MuscleMap } from '../../components/MuscleMap.tsx';
import { Clock } from '../../components/Screen.tsx';
import { TimerRing } from '../../components/TimerRing.tsx';
import { cx } from '../../lib/cx.ts';
import { formatClock } from '../../lib/format.ts';

/** Setup alternates the two photos briskly (how to get in); holds drift slowly between them. */
const SETUP_TEMPO = { down: 2, up: 2 } as const;
const HOLD_TEMPO = { down: 4, up: 4 } as const;

const HOLD_LABEL: Record<StretchDef['block'], string> = { warm: 'Move', roll: 'Roll', stretch: 'Hold' };

function phaseLabel(state: StretchState, step: StretchStep, def: StretchDef): string {
  if (state.phase === 'hold') return HOLD_LABEL[def.block];
  return step.side === 2 ? 'Switch sides' : 'Get into position';
}

function sideText(step: StretchStep): string {
  if (step.side === 1) return 'First side';
  if (step.side === 2) return 'Second side';
  return 'Both sides';
}

function SidePips(props: { readonly step: StretchStep; readonly holding: boolean }) {
  if (props.step.side === null) return null;
  return (
    <div className="flex items-center gap-3" data-testid="side-pips">
      {[1, 2].map((side) => {
        const done = side < (props.step.side ?? 0) || (side === props.step.side && props.holding);
        return (
          <span
            key={side}
            className={cx('inline-block h-8 w-8 rounded-full border-4', done ? 'border-transparent bg-stretch' : side === props.step.side ? 'border-text' : 'border-line')}
          />
        );
      })}
    </div>
  );
}

function UpNext(props: { readonly state: StretchState }) {
  const { stretches } = useAppData();
  const step = currentStep(props.state);
  const next = nextStep(props.state);
  if (!next) return <div className="text-[2rem] text-dim">Last one: nice work.</div>;
  const def = stretches.get(next.stretchId);
  const sameStretch = step?.stretchId === next.stretchId;
  return (
    <div className="rounded-[1.25rem] border-2 border-line px-8 py-5" data-testid="up-next">
      <div className="text-[1.75rem] font-semibold text-stretch">Up next</div>
      <div className="font-display text-[3rem] font-semibold leading-tight">{sameStretch ? 'Switch sides' : (def?.name ?? next.stretchId)}</div>
      {!sameStretch && def && <div className="text-[2rem] text-dim">{REGION_LABELS[def.region]}</div>}
    </div>
  );
}

function legendFor(state: StretchState): LegendItem[] {
  return state.phase === 'setup'
    ? [{ keys: 'OK', label: 'Start now' }, { keys: 'BACK', label: 'Menu' }]
    : [{ keys: 'OK', label: 'Next' }, { keys: 'BACK', label: 'Menu' }];
}

export function StretchView(props: { readonly state: StretchState; readonly now: number; readonly offline: boolean }) {
  const { stretches } = useAppData();
  const { state, now } = props;
  const step = currentStep(state);
  const def = step && stretches.get(step.stretchId);
  if (!step || !def) return null;

  const holding = state.phase === 'hold';
  const subject: DemoSubject = { id: def.id, name: def.name, tempo: holding ? HOLD_TEMPO : SETUP_TEMPO };
  const remaining = remainingMs(state, now);
  const length = phaseLengthMs(state);
  const progress = remaining !== null && length ? 1 - remaining / length : null;
  const color = holding ? 'text-stretch' : 'text-ready';
  const muscles = [...def.muscles.primary, ...def.muscles.secondary].map((m) => MUSCLE_LABELS[m]).join(' · ');

  return (
    <main className="safe flex h-full flex-col" data-testid="stretch-player" data-phase={state.phase} data-step={state.index}>
      <header className="flex items-baseline justify-between text-[1.75rem]">
        <span className="font-display text-[2.5rem] font-semibold uppercase tracking-wide text-dim">
          Stretch · {stretchNumber(state)} of {stretchCount(state.plan.steps)}
        </span>
        <span className="flex items-baseline gap-8">
          {props.offline && <span className="text-ready">Offline: will save when back</span>}
          <span className="tabular text-dim">{formatClock(Math.max(0, now - state.startedAt), false)} elapsed</span>
          <Clock />
        </span>
      </header>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-stretch" style={{ width: `${Math.round(stretchProgress(state) * 100)}%` }} />
      </div>

      <div className="mt-8 grid min-h-0 flex-1 grid-cols-[55fr_45fr] gap-12">
        <section className="flex min-h-0 flex-col gap-6 overflow-hidden">
          <div className="relative">
            <ExerciseDemo exercise={subject} mirrored={step.side === 2} />
            <MuscleMap
              primary={def.muscles.primary}
              secondary={def.muscles.secondary}
              className="absolute bottom-4 right-4 h-[12rem] w-[13rem] rounded-[1rem] bg-bg/85 p-3"
            />
          </div>
          <ul className="space-y-1 text-[2.25rem]" data-testid="cues">
            {def.cues.map((cue) => (
              <li key={cue} className="flex gap-4">
                <span className={color}>›</span>
                {cue}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col gap-6">
          <div>
            <div className={cx('font-display text-[2.75rem] font-bold uppercase tracking-[0.2em]', color)} data-testid="phase-label">
              {phaseLabel(state, step, def)}
            </div>
            <h1 className="font-display text-[5rem] font-bold leading-[0.95]" data-testid="stretch-name">
              {def.name}
            </h1>
            <div className="mt-3 flex items-center gap-6 text-[2rem] text-dim">
              <SidePips step={step} holding={holding} />
              <span data-testid="side">{sideText(step)}</span>
            </div>
          </div>
          <div className="flex items-center gap-10">
            <TimerRing
              className="w-[23rem] shrink-0"
              progress={progress}
              label={remaining !== null ? formatClock(remaining) : formatClock(elapsedMs(state, now), false)}
              caption={holding ? HOLD_LABEL[def.block] : 'Get ready'}
              colorClass={color}
            />
            <div className="min-w-0 text-[2rem] text-dim">
              <div className="font-display text-[3rem] font-semibold text-text">{REGION_LABELS[def.region]}</div>
              <div>{muscles}</div>
              <div className="tabular mt-2">
                {HOLD_LABEL[def.block]} {step.holdSec} s
              </div>
            </div>
          </div>
          {holding ? <UpNext state={state} /> : null}
        </section>
      </div>
      <div className="mt-6">
        <KeyLegend items={legendFor(state)} />
      </div>
    </main>
  );
}
