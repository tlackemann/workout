/**
 * Synthesised audio cues (no asset files). Countdown pips are scheduled on the
 * AudioContext clock at phase start so main-thread jank can't delay them.
 */
type Ctx = AudioContext;

interface AudioPrefs {
  readonly enabled: boolean;
  readonly volume: number;
  readonly keepAlive: boolean;
}

let ctx: Ctx | null = null;
let prefs: AudioPrefs = { enabled: true, volume: 0.8, keepAlive: false };
let keepAliveNode: OscillatorNode | null = null;

const PIP = { freq: 880, dur: 0.12 };
const GO = { freq: 1320, dur: 0.45 };
const CHIME = [
  { freq: 660, at: 0, dur: 0.18 },
  { freq: 990, at: 0.16, dur: 0.3 },
];

function audioContextCtor(): typeof AudioContext | null {
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Call from a user gesture (the first OK press) so the WebView allows sound. */
export function unlockAudio(): void {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  ctx ??= new Ctor();
  void ctx.resume().catch(() => undefined);
  syncKeepAlive();
}

export function configureAudio(next: AudioPrefs): void {
  prefs = next;
  syncKeepAlive();
}

/** HDMI-ARC soundbars sleep after silence and clip the first beep; an inaudible tone keeps them awake. */
function syncKeepAlive(): void {
  if (!ctx) return;
  if (prefs.keepAlive && prefs.enabled && !keepAliveNode) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 30;
    gain.gain.value = 0.0005;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    keepAliveNode = osc;
  } else if ((!prefs.keepAlive || !prefs.enabled) && keepAliveNode) {
    keepAliveNode.stop();
    keepAliveNode = null;
  }
}

function tone(c: Ctx, freq: number, startAt: number, dur: number, peak: number): OscillatorNode {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.05);
  return osc;
}

function ready(): Ctx | null {
  if (!ctx || !prefs.enabled) return null;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

/** 3-2-1 pips and a "go" tone at the deadline. Returns a cancel function. */
export function scheduleCountdown(msUntilZero: number): () => void {
  const c = ready();
  if (!c || msUntilZero <= 0) return () => undefined;
  const zero = c.currentTime + msUntilZero / 1000;
  const peak = prefs.volume * 0.5;
  const nodes = [3, 2, 1]
    .map((s) => zero - s)
    .filter((t) => t > c.currentTime)
    .map((t) => tone(c, PIP.freq, t, PIP.dur, peak));
  nodes.push(tone(c, GO.freq, zero, GO.dur, peak));
  return () => {
    for (const n of nodes) {
      try {
        n.stop();
      } catch {
        // already stopped
      }
    }
  };
}

/** Soft two-note chime (rest started / workout finished). */
export function chime(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.02;
  for (const n of CHIME) tone(c, n.freq, t + n.at, n.dur, prefs.volume * 0.35);
}

export function resumeOnVisible(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void ctx?.resume().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
