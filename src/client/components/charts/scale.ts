/** Pure scale and geometry helpers for the hand-rolled SVG charts. */

export type Range = readonly [number, number];

export function linear(domain: Range, range: Range): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/** Smallest 1-2-5 × 10ⁿ step that covers the span in at most `maxTicks` intervals. */
function niceStep(span: number, maxTicks: number): number {
  const raw = span / Math.max(1, maxTicks);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  return step ?? 10 * magnitude;
}

const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

export function niceTicks(min: number, max: number, maxTicks = 5): number[] {
  if (max <= min) return [tidy(min)];
  const step = niceStep(max - min, maxTicks);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const count = Math.round((end - start) / step);
  return Array.from({ length: count + 1 }, (_, i) => tidy(start + i * step));
}

export interface NiceDomain {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

/** A domain covering `values`, extended to tidy tick values. */
export function niceDomain(values: readonly number[], options: { readonly zero?: boolean; readonly maxTicks?: number } = {}): NiceDomain {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (options.zero) lo = Math.min(0, lo);
  if (hi === lo) {
    const pad = Math.max(1, Math.abs(hi) * 0.1);
    hi += pad;
    lo = options.zero ? lo : lo - pad;
  }
  const ticks = niceTicks(lo, hi, options.maxTicks ?? 5);
  return { min: ticks[0] ?? lo, max: ticks.at(-1) ?? hi, ticks };
}

export interface Band {
  /** Distance between band starts. */
  readonly step: number;
  /** Width of one bar. */
  readonly width: number;
  /** Left edge of bar `i` (centred in its step). */
  readonly x: (i: number) => number;
}

/** `n` equal slots across `range`; `gap` is the share of each slot left empty. */
export function bandScale(n: number, range: Range, gap: number, maxWidth = Infinity): Band {
  const step = (range[1] - range[0]) / Math.max(1, n);
  const width = Math.min(step * (1 - gap), maxWidth);
  return { step, width, x: (i) => range[0] + i * step + (step - width) / 2 };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function linePath(points: readonly { readonly x: number; readonly y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r1(p.x)} ${r1(p.y)}`).join('');
}

/** A bar growing up from `y + h`, square at the baseline and rounded at its data end. */
export function roundedTopBar(x: number, y: number, w: number, h: number, radius: number): string {
  if (h <= 0 || w <= 0) return '';
  const r = Math.min(radius, w / 2, h);
  const [l, t, rt, b] = [r1(x), r1(y), r1(x + w), r1(y + h)];
  return `M${l} ${b}V${r1(y + r)}Q${l} ${t} ${r1(x + r)} ${t}H${r1(x + w - r)}Q${rt} ${t} ${rt} ${r1(y + r)}V${b}Z`;
}

/** A bar growing right from `x`, square at the baseline and rounded at its data end. */
export function roundedEndBar(x: number, y: number, w: number, h: number, radius: number): string {
  if (h <= 0 || w <= 0) return '';
  const r = Math.min(radius, h / 2, w);
  const [l, t, rt, b] = [r1(x), r1(y), r1(x + w), r1(y + h)];
  return `M${l} ${t}H${r1(x + w - r)}Q${rt} ${t} ${rt} ${r1(y + r)}V${r1(y + h - r)}Q${rt} ${b} ${r1(x + w - r)} ${b}H${l}Z`;
}
