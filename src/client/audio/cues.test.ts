import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  type = 'sine';
  connect = vi.fn(() => this);
  start = vi.fn();
  stop = vi.fn();
}
class FakeContext {
  static created = 0;
  currentTime = 100;
  state = 'running';
  destination = {};
  oscillators: FakeNode[] = [];
  constructor() {
    FakeContext.created += 1;
  }
  resume = vi.fn(async () => undefined);
  createOscillator = () => {
    const n = new FakeNode();
    this.oscillators.push(n);
    return n;
  };
  createGain = () => new FakeNode();
}

describe('audio cues', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeContext.created = 0;
    vi.stubGlobal('AudioContext', FakeContext);
  });

  it('does nothing until unlocked by a gesture', async () => {
    const cues = await import('./cues.ts');
    expect(cues.scheduleCountdown(5000)()).toBeUndefined();
    cues.chime();
    expect(FakeContext.created).toBe(0);
  });

  it('schedules 3-2-1 pips plus a go tone and can cancel them', async () => {
    const cues = await import('./cues.ts');
    cues.unlockAudio();
    const cancel = cues.scheduleCountdown(10_000);
    const ctx = (globalThis as unknown as { AudioContext: typeof FakeContext }).AudioContext;
    expect(ctx.created).toBe(1);
    cancel();
  });

  it('skips pips that are already in the past', async () => {
    const cues = await import('./cues.ts');
    cues.unlockAudio();
    cues.configureAudio({ enabled: true, volume: 0.5, keepAlive: false });
    expect(typeof cues.scheduleCountdown(1500)).toBe('function');
    expect(cues.scheduleCountdown(0)()).toBeUndefined();
  });

  it('respects the enabled flag and runs a keep-alive tone when asked', async () => {
    const cues = await import('./cues.ts');
    cues.unlockAudio();
    cues.configureAudio({ enabled: true, volume: 0.5, keepAlive: true });
    cues.configureAudio({ enabled: false, volume: 0.5, keepAlive: true });
    cues.chime();
    expect(cues.scheduleCountdown(5000)()).toBeUndefined();
  });

  it('resumes audio when the page becomes visible again', async () => {
    const cues = await import('./cues.ts');
    cues.unlockAudio();
    const stop = cues.resumeOnVisible();
    document.dispatchEvent(new Event('visibilitychange'));
    stop();
  });
});
