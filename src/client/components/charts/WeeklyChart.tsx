import { memo } from 'react';
import type { HeatCell, WeekBucket } from '../../../core/stats/types.ts';
import { ChartFrame, TICK_FONT, YGrid } from './ChartFrame.tsx';
import { bandScale, linear, niceDomain, roundedTopBar } from './scale.ts';

const LEFT = 80;
const RIGHT = 8;
const MONTH_ROW = 36;
const GAP = 40;
const BARS_HEIGHT = 200;
const CELL_GAP = 6;
const SEGMENT_GAP = 2;
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
/** Stack order, bottom up. Only neighbours touch, and those pairs pass the colour-blind check. */
const STACK = [
  { key: 'push', fill: 'fill-push' },
  { key: 'pull', fill: 'fill-pull' },
  { key: 'legs', fill: 'fill-legs' },
] as const;

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const monthOf = (key: string) => key.slice(0, 7);
const monthLabel = (key: string) => MONTH.format(new Date(`${key}T00:00:00Z`));

/** Cumulative [from, to] counts per non-empty segment, bottom up. */
function stackSegments(week: WeekBucket) {
  return STACK.filter((s) => week[s.key] > 0).map((s, j, present) => {
    const from = present.slice(0, j).reduce((sum, p) => sum + week[p.key], 0);
    return { ...s, from, to: from + week[s.key] };
  });
}

function cellClass(cell: HeatCell): string {
  if (cell.workouts >= 2) return 'fill-text';
  if (cell.workouts === 1) return 'fill-dim';
  if (cell.stretches > 0) return 'fill-stretch';
  return 'fill-surface-2';
}

/** A stretch on a training day: a dot in the cell's corner (the ring is reserved for today). */
const STRETCH_DOT = 0.2;

function WeeklyChartImpl(props: { readonly weeks: readonly WeekBucket[]; readonly heatmap: readonly (readonly HeatCell[])[]; readonly width: number }) {
  const columns = props.heatmap.length;
  const step = (props.width - LEFT - RIGHT) / Math.max(1, columns);
  const cell = step - CELL_GAP;
  const heatTop = MONTH_ROW;
  const heatBottom = heatTop + 7 * step;
  const barsTop = heatBottom + GAP;
  const barsBottom = barsTop + BARS_HEIGHT;
  const height = barsBottom + 8;
  const domain = niceDomain(props.weeks.map((w) => w.total), { zero: true, maxTicks: 3 });
  const y = linear([0, domain.max], [barsBottom, barsTop]);
  const band = bandScale(columns, [LEFT, LEFT + columns * step], 0.35, 28);
  const monthStarts = props.heatmap
    .map((col, i) => ({ i, key: col[0]?.date ?? '' }))
    .filter(({ i, key }) => i === 0 || monthOf(key) !== monthOf(props.heatmap[i - 1]?.[0]?.date ?? ''));

  return (
    <ChartFrame width={props.width} height={height} label="Workouts per day and per week" testId="weekly-chart">
      {monthStarts.map(({ i, key }) => (
        <text key={key} x={LEFT + i * step} y={MONTH_ROW - 12} fontSize={TICK_FONT} className="fill-faint">
          {monthLabel(key)}
        </text>
      ))}
      {WEEKDAY_LABELS.map((label, row) =>
        label ? (
          <text key={label} x={LEFT - 14} y={heatTop + row * step + cell / 2} dy="0.35em" textAnchor="end" fontSize={TICK_FONT} className="fill-faint">
            {label}
          </text>
        ) : null,
      )}
      {props.heatmap.flatMap((col, i) =>
        col
          .map((c, row) => ({ c, row }))
          .filter(({ c }) => !c.future)
          .map(({ c, row }) => (
            <g key={c.date}>
              <rect
                x={LEFT + i * step}
                y={heatTop + row * step}
                width={cell}
                height={cell}
                rx="5"
                strokeWidth={c.isToday ? 4 : 0}
                className={`${cellClass(c)} ${c.isToday ? 'stroke-focus' : ''}`}
                data-date={c.date}
                data-workouts={c.workouts}
                data-stretches={c.stretches}
              />
              {c.workouts > 0 && c.stretches > 0 && (
                <circle
                  cx={LEFT + i * step + cell * (1 - STRETCH_DOT)}
                  cy={heatTop + row * step + cell * STRETCH_DOT}
                  r={cell * STRETCH_DOT * 0.8}
                  className="fill-stretch"
                  data-stretch-dot={c.date}
                />
              )}
            </g>
          )),
      )}
      <YGrid ticks={domain.ticks} y={y} left={LEFT} right={props.width - RIGHT} format={(v) => `${v}`} />
      {props.weeks.map((week, i) => (
        <g key={week.weekStart} data-week={week.weekStart}>
          {stackSegments(week).map((seg, j, all) => {
            const top = y(seg.to);
            const bottom = y(seg.from) - (j === 0 ? 0 : SEGMENT_GAP);
            return j === all.length - 1 ? (
              <path key={seg.key} d={roundedTopBar(band.x(i), top, band.width, bottom - top, 4)} className={seg.fill} data-segment={seg.key} />
            ) : (
              <rect key={seg.key} x={band.x(i)} y={top} width={band.width} height={bottom - top} className={seg.fill} data-segment={seg.key} />
            );
          })}
        </g>
      ))}
    </ChartFrame>
  );
}

export const WeeklyChart = memo(WeeklyChartImpl);
