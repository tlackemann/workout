import { describe, expect, it } from 'vitest';
import { bandScale, linear, linePath, niceDomain, niceTicks, roundedEndBar, roundedTopBar } from './scale.ts';

describe('linear', () => {
  it('maps a domain onto a range', () => {
    const y = linear([0, 200], [400, 0]);
    expect(y(0)).toBe(400);
    expect(y(100)).toBe(200);
    expect(y(200)).toBe(0);
  });

  it('centres a zero-width domain', () => {
    expect(linear([5, 5], [0, 100])(5)).toBe(50);
  });
});

describe('niceTicks', () => {
  it('uses 1-2-5 steps', () => {
    expect(niceTicks(0, 187)).toEqual([0, 50, 100, 150, 200]);
    expect(niceTicks(0, 9)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(130, 182)).toEqual([120, 140, 160, 180, 200]);
    expect(niceTicks(130, 182, 10)).toEqual([130, 140, 150, 160, 170, 180, 190]);
  });
});

describe('niceDomain', () => {
  it('pads a range out to tidy tick values', () => {
    expect(niceDomain([131, 187])).toEqual({ min: 120, max: 200, ticks: [120, 140, 160, 180, 200] });
  });

  it('can anchor the domain at zero', () => {
    expect(niceDomain([131, 187], { zero: true }).min).toBe(0);
  });

  it('handles empty and single values', () => {
    expect(niceDomain([])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
    const single = niceDomain([150]);
    expect(single.min).toBeLessThan(150);
    expect(single.max).toBeGreaterThan(150);
    expect(niceDomain([0], { zero: true }).max).toBeGreaterThan(0);
  });
});

describe('bandScale', () => {
  it('splits a range into equal bands with a gap', () => {
    const band = bandScale(4, [0, 400], 0.25);
    expect(band.step).toBe(100);
    expect(band.width).toBe(75);
    expect(band.x(0)).toBe(12.5);
    expect(band.x(3)).toBe(312.5);
  });

  it('caps the band width', () => {
    expect(bandScale(2, [0, 400], 0.2, 24).width).toBe(24);
  });
});

describe('paths', () => {
  it('draws a polyline', () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 5.25, y: 2.5 }])).toBe('M0 10L5.3 2.5');
    expect(linePath([])).toBe('');
  });

  it('rounds only the top of a bar and never more than it can fit', () => {
    expect(roundedTopBar(0, 0, 20, 100, 4)).toBe('M0 100V4Q0 0 4 0H16Q20 0 20 4V100Z');
    expect(roundedTopBar(0, 98, 20, 2, 4)).toBe('M0 100V100Q0 98 2 98H18Q20 98 20 100V100Z');
    expect(roundedTopBar(0, 0, 20, 0, 4)).toBe('');
  });

  it('rounds only the end of a horizontal bar', () => {
    expect(roundedEndBar(10, 0, 50, 20, 4)).toBe('M10 0H56Q60 0 60 4V16Q60 20 56 20H10Z');
    expect(roundedEndBar(10, 0, 0, 20, 4)).toBe('');
  });
});
