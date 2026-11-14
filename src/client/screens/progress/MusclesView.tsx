import { MUSCLE_LABELS } from '../../../core/muscles.ts';
import type { MuscleBalance } from '../../../core/stats/types.ts';
import { LegendKey } from '../../components/charts/ChartFrame.tsx';
import { HBarChart } from '../../components/charts/HBarChart.tsx';
import { formatDayKey, formatDecimal, formatWeeks } from '../../lib/format.ts';

const CHART = { width: 1100, height: 640 };
/** Common hypertrophy guidance: roughly 10–20 hard sets per muscle per week. */
const TARGET_BAND = [10, 20] as const;

export function MusclesView(props: { readonly balance: MuscleBalance }) {
  const b = props.balance;
  const rows = b.rows.map((r) => ({ key: r.muscle, label: MUSCLE_LABELS[r.muscle], primary: r.primary / b.weeks, secondary: r.secondary / b.weeks }));
  const empty = b.rows.every((r) => r.total === 0);
  return (
    <div className="flex h-full min-h-0 gap-12">
      {empty ? (
        <p className="text-dim">Nothing logged in the last 4 weeks.</p>
      ) : (
        <HBarChart rows={rows} width={CHART.width} height={CHART.height} label="Working sets per muscle per week" band={TARGET_BAND} formatValue={formatDecimal} />
      )}
      <aside className="flex flex-1 flex-col gap-5 text-[1.75rem] text-dim">
        <p className="text-text">
          Working sets per week, averaged over {formatWeeks(b.weeks)} ({formatDayKey(b.from)} – {formatDayKey(b.to)}).
        </p>
        <div className="flex flex-col gap-3">
          <LegendKey label="As the main muscle (1 set)" swatch="fill-dim" />
          <LegendKey label="As a helper (½ set)" swatch="fill-faint" />
          <LegendKey label="10–20 sets: a common target" swatch="fill-surface stroke-line [stroke-width:2]" />
        </div>
        {b.unmappedSets > 0 && (
          <p className="text-[1.5rem] text-faint" data-testid="muscles-unmapped">
            {b.unmappedSets} set{b.unmappedSets === 1 ? '' : 's'} from retired exercises ({b.unmappedNames.join(', ')}) not counted.
          </p>
        )}
      </aside>
    </div>
  );
}
