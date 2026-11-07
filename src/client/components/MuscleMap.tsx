import { useEffect, useRef } from 'react';
import createBodyHighlighter, { type BodyHighlighterInstance, type IExerciseData } from 'body-highlighter';
import type { Muscle } from '../../core/muscles.ts';

/** Our muscle vocabulary → body-highlighter's polygons. */
const MAP: Readonly<Record<Muscle, readonly string[]>> = {
  chest: ['chest'],
  'front-delts': ['front-deltoids'],
  'side-delts': ['front-deltoids', 'back-deltoids'],
  'rear-delts': ['back-deltoids'],
  triceps: ['triceps'],
  biceps: ['biceps'],
  forearms: ['forearm'],
  lats: ['upper-back'],
  'upper-back': ['upper-back'],
  traps: ['trapezius'],
  'lower-back': ['lower-back'],
  abs: ['abs'],
  obliques: ['obliques'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves', 'left-soleus', 'right-soleus'],
  adductors: ['adductor'],
};

const BODY = '#2c3137';
const SECONDARY = '#6b5a50';
const PRIMARY = '#ff6a3d';

export function toHighlightData(primary: readonly Muscle[], secondary: readonly Muscle[]): IExerciseData[] {
  const prim = new Set(primary.flatMap((m) => MAP[m]));
  const sec = [...new Set(secondary.flatMap((m) => MAP[m]))].filter((m) => !prim.has(m));
  // frequency 1 → highlightedColors[0], 2 → [1]
  return [
    { name: 'secondary', muscles: sec, frequency: 1 },
    { name: 'primary', muscles: [...prim], frequency: 2 },
  ];
}

function Body(props: { readonly type: 'anterior' | 'posterior'; readonly data: IExerciseData[] }) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<BodyHighlighterInstance | null>(null);

  useEffect(() => {
    if (!host.current) return undefined;
    instance.current = createBodyHighlighter({
      container: host.current,
      type: props.type,
      data: props.data,
      bodyColor: BODY,
      highlightedColors: [SECONDARY, PRIMARY],
      svgStyle: { width: '100%', height: '100%' },
      style: { width: '100%', height: '100%' },
    });
    return () => instance.current?.destroy();
    // data updates go through update() below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.type]);

  useEffect(() => {
    instance.current?.update({ data: props.data });
  }, [props.data]);

  return <div ref={host} className="h-full w-full" />;
}

export function MuscleMap(props: { readonly primary: readonly Muscle[]; readonly secondary: readonly Muscle[]; readonly className?: string }) {
  const data = toHighlightData(props.primary, props.secondary);
  return (
    <div className={props.className} aria-hidden="true">
      <div className="flex h-full gap-2">
        <Body type="anterior" data={data} />
        <Body type="posterior" data={data} />
      </div>
    </div>
  );
}
