import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { statsDto } from '../../test/fixtures.ts';
import { ColumnChart } from './ColumnChart.tsx';
import { HBarChart } from './HBarChart.tsx';
import { LineChart } from './LineChart.tsx';
import { niceDomain } from './scale.ts';
import { WeeklyChart } from './WeeklyChart.tsx';

const DAY = 86_400_000;
const fmt = (v: number) => `${v}`;

describe('LineChart', () => {
  const points = [100, 110, 120].map((value, i) => ({ date: i * 7 * DAY, value }));

  it('draws each series, PR markers and an end label, with no animation', () => {
    const { container } = render(
      <LineChart
        series={[
          { key: 'e1rm', tone: 'primary', points },
          { key: 'top', tone: 'secondary', points: points.map((p) => ({ ...p, value: p.value - 30 })) },
        ]}
        marks={points.slice(1)}
        width={1000}
        height={400}
        label="Bench"
        formatValue={fmt}
        formatDate={() => 'Nov 1'}
      />,
    );
    expect(container.querySelectorAll('[data-series]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid="pr-mark"]')).toHaveLength(2);
    expect(container.querySelector('[data-series="top"]')?.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(container.textContent).toContain('120');
    expect(container.querySelectorAll('animate, animateTransform')).toHaveLength(0);
  });

  it('drops the secondary end label when it would collide with the primary one', () => {
    const { container } = render(
      <LineChart
        series={[
          { key: 'a', tone: 'primary', points },
          { key: 'b', tone: 'secondary', points: points.map((p) => ({ ...p, value: p.value - 1 })) },
        ]}
        width={1000}
        height={400}
        label="x"
        formatValue={fmt}
        formatDate={() => ''}
      />,
    );
    expect(container.textContent).toContain('120');
    expect(container.textContent).not.toContain('119');
  });
});

describe('WeeklyChart', () => {
  it('draws a cell for every past day and stacks the weekly bars by day type', () => {
    const { consistency } = statsDto();
    const { container } = render(<WeeklyChart weeks={consistency.weeks} heatmap={consistency.heatmap} width={1160} />);
    const cells = container.querySelectorAll('[data-date]');
    const future = consistency.heatmap.flat().filter((c) => c.future).length;
    expect(cells).toHaveLength(26 * 7 - future);
    expect(container.querySelectorAll('[data-workouts="1"]').length).toBe(statsDto().workouts);
    const segments = [...container.querySelectorAll('[data-segment]')].map((el) => el.getAttribute('data-segment'));
    expect(segments).toContain('push');
    expect(segments).toContain('legs');
  });
});

describe('ColumnChart', () => {
  it('fills, outlines (ended early) and dashes (unknown) columns', () => {
    const { container } = render(
      <ColumnChart
        columns={[
          { key: 'a', value: 50, hollow: false },
          { key: 'b', value: 40, hollow: true },
          { key: 'c', value: null, hollow: false },
        ]}
        slots={10}
        domain={niceDomain([50], { zero: true })}
        width={540}
        height={220}
        label="x"
        fill="fill-push"
        stroke="stroke-push"
        formatValue={fmt}
      />,
    );
    expect(container.querySelectorAll('[data-column="filled"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-column="hollow"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-column="missing"]')).toHaveLength(1);
  });
});

describe('HBarChart', () => {
  it('splits each bar into primary and secondary parts and labels totals', () => {
    const { container } = render(
      <HBarChart
        rows={[
          { key: 'chest', label: 'Chest', primary: 8, secondary: 2 },
          { key: 'calves', label: 'Calves', primary: 0, secondary: 0 },
        ]}
        width={1000}
        height={200}
        label="x"
        band={[10, 20]}
        formatValue={fmt}
      />,
    );
    expect(container.querySelector('[data-row="chest"] [data-part="secondary"]')).toBeTruthy();
    expect(container.querySelector('[data-row="chest"]')?.textContent).toContain('10');
    expect(container.querySelector('[data-row="calves"] [data-part="secondary"]')).toBeNull();
  });
});
