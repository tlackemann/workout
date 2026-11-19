import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStretchSession, reduceStretch } from '../../../core/stretch/reducer.ts';
import { stretchCount } from '../../../core/stretch/selectors.ts';
import type { StretchState } from '../../../core/stretch/state.ts';
import { ApiError, type FinishInput } from '../../app/api.ts';
import { NO_STRETCH, NOW, sessionDto, stretchDto, stretchPlan } from '../../test/fixtures.ts';
import { KEYS, renderAt } from '../../test/render.tsx';
import { stretchMenuItems } from './stretchMenu.ts';

const api = vi.hoisted(() => ({
  home: vi.fn(),
  sessions: vi.fn(),
  deleteSession: vi.fn(),
  createStretch: vi.fn(),
  stretch: vi.fn(),
  stretchList: vi.fn(),
  rerollStretch: vi.fn(),
  startStretch: vi.fn(),
  finishStretch: vi.fn(),
  deleteStretch: vi.fn(),
}));

vi.mock('../../app/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/api.ts')>();
  return { ...actual, api: { ...actual.api, ...api } };
});

const cues = vi.hoisted(() => ({
  unlockAudio: vi.fn(),
  scheduleCountdown: vi.fn(() => () => undefined),
  chime: vi.fn(),
  configureAudio: vi.fn(),
  resumeOnVisible: vi.fn(() => () => undefined),
}));
vi.mock('../../audio/cues.ts', () => cues);

const { StretchPlayer } = await import('./StretchPlayer.tsx');
const { StretchPreview } = await import('./StretchPreview.tsx');
const { StretchDone } = await import('./StretchDone.tsx');
const { Home } = await import('../Home.tsx');
const { History, mergeHistory } = await import('../History.tsx');

const PLAN = stretchPlan('quick');
const phase = () => screen.getByTestId('stretch-player').getAttribute('data-phase');
const stepIndex = () => Number(screen.getByTestId('stretch-player').getAttribute('data-step'));

async function mountPlayer(dto = stretchDto({ status: 'active', startedAt: NOW, plan: PLAN })) {
  api.stretch.mockResolvedValue(dto);
  renderAt('/stretch/st1/play', <StretchPlayer id="st1" />);
  await screen.findByTestId('stretch-player');
}

/** Finish echoes the outcome back as the server would. */
function echoFinish() {
  api.finishStretch.mockImplementation(async (_id: string, outcome: FinishInput) =>
    stretchDto({ status: outcome.completed.length === 0 ? 'abandoned' : outcome.endedEarly ? 'ended_early' : 'completed', plan: PLAN, completed: outcome.completed, skipped: outcome.skipped, startedAt: NOW, endedAt: NOW + 60_000 }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  for (const fn of Object.values(api)) fn.mockReset();
  cues.chime.mockClear();
  cues.scheduleCountdown.mockClear();
  echoFinish();
});
afterEach(() => vi.useRealTimers());

describe('StretchPlayer', () => {
  it('starts in "get into position", then holds on OK', async () => {
    await mountPlayer();
    expect(phase()).toBe('setup');
    expect(screen.getByTestId('phase-label').textContent).toBe('Get into position');
    await waitFor(() => expect(cues.scheduleCountdown).toHaveBeenCalled());
    act(() => KEYS.ok());
    expect(phase()).toBe('hold');
    expect(screen.getByTestId('phase-label').textContent).toBe('Move');
    expect(screen.getByTestId('up-next')).toBeTruthy();
    act(() => KEYS.ok());
    expect(phase()).toBe('setup');
    expect(stepIndex()).toBe(1);
    expect(cues.chime).toHaveBeenCalledTimes(1);
  });

  it('advances on its own when a countdown runs out', async () => {
    const overdue = { ...createStretchSession('st1', PLAN, Date.now() - 20_000) };
    window.localStorage.setItem('gymtv:stretch:st1', JSON.stringify(overdue));
    await mountPlayer();
    await waitFor(() => expect(phase()).toBe('hold'));
  });

  it('labels and mirrors the second side of a per-side stretch', async () => {
    const second = PLAN.steps.find((s) => s.side === 2)!;
    const atSecond = { ...createStretchSession('st1', PLAN, Date.now()), index: second.index, endsAt: Date.now() + 5_000 };
    window.localStorage.setItem('gymtv:stretch:st1', JSON.stringify(atSecond));
    await mountPlayer();
    expect(screen.getByTestId('phase-label').textContent).toBe('Switch sides');
    expect(screen.getByTestId('side').textContent).toBe('Second side');
    expect(document.querySelector('[data-mirrored="true"]')).not.toBeNull();
  });

  it('BACK opens the menu; Skip moves on; BACK resumes', async () => {
    await mountPlayer();
    act(() => KEYS.back());
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
    act(() => KEYS.back());
    expect(screen.queryByTestId('pause-menu')).toBeNull();

    act(() => KEYS.back());
    act(() => KEYS.down());
    act(() => KEYS.down());
    expect(screen.getByTestId('menu-skipStretch').getAttribute('data-selected')).toBe('true');
    act(() => KEYS.ok());
    expect(screen.queryByTestId('pause-menu')).toBeNull();
    expect(stepIndex()).toBe(1);
  });

  it('ending early asks first, reports the outcome and shows the summary', async () => {
    await mountPlayer();
    act(() => KEYS.ok());
    act(() => KEYS.ok());
    act(() => KEYS.back());
    act(() => KEYS.up());
    act(() => KEYS.ok());
    expect(screen.getByTestId('confirm-end').textContent).toContain('End this stretch session?');
    act(() => KEYS.right());
    act(() => KEYS.ok());
    await waitFor(() => expect(window.location.pathname).toBe('/stretch/st1/done'));
    expect(api.finishStretch).toHaveBeenCalledWith('st1', expect.objectContaining({ endedEarly: true, completed: [0], skipped: [] }));
    expect(window.localStorage.getItem('gymtv:stretch:st1')).toBeNull();
  });

  it('runs to the end with OK presses and reports every hold', async () => {
    await mountPlayer();
    for (let i = 0; i < PLAN.steps.length * 2; i++) act(() => KEYS.ok());
    await waitFor(() => expect(window.location.pathname).toBe('/stretch/st1/done'));
    expect(api.finishStretch).toHaveBeenCalledWith('st1', expect.objectContaining({ endedEarly: false, completed: PLAN.steps.map((s) => s.index) }));
  });

  it('goes home when nothing was held', async () => {
    await mountPlayer();
    act(() => KEYS.back());
    act(() => KEYS.up());
    act(() => KEYS.ok());
    act(() => KEYS.right());
    act(() => KEYS.ok());
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('keeps the result while offline and saves once the server is back', async () => {
    api.finishStretch.mockRejectedValueOnce(new ApiError(0, 'offline', null));
    await mountPlayer();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => KEYS.ok());
    act(() => KEYS.ok());
    act(() => KEYS.back());
    act(() => KEYS.up());
    act(() => KEYS.ok());
    act(() => KEYS.right());
    act(() => KEYS.ok());
    await screen.findByText('Waiting for the server to save…');
    expect(window.localStorage.getItem('gymtv:stretch:st1')).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(3_000));
    await waitFor(() => expect(window.location.pathname).toBe('/stretch/st1/done'));
    expect(api.finishStretch).toHaveBeenCalledTimes(2);
  });

  it('welcomes you back paused after a reload', async () => {
    const started = createStretchSession('st1', PLAN, Date.now());
    const progressed: StretchState = reduceStretch(started, { type: 'OK', now: Date.now() });
    window.localStorage.setItem('gymtv:stretch:st1', JSON.stringify(progressed));
    await mountPlayer();
    expect(screen.getByTestId('pause-menu').textContent).toContain('Welcome back');
    expect(phase()).toBe('hold');
  });

  it('goes Home (not back to the summary) when Back lands on a finished session', async () => {
    api.stretch.mockResolvedValue(stretchDto({ status: 'completed', startedAt: NOW, endedAt: NOW + 60_000 }));
    renderAt('/stretch/st1/play', <StretchPlayer id="st1" />);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('leaves for Home when the session is not running', async () => {
    api.stretch.mockResolvedValue(stretchDto({ status: 'planned' }));
    renderAt('/stretch/st1/play', <StretchPlayer id="st1" />);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('labels menu options for the phase and side', () => {
    const setup = createStretchSession('st1', PLAN, NOW);
    expect(stretchMenuItems(setup).map((i) => i.label)).toEqual(['Resume', '+15 s to get ready', 'Skip this stretch', 'End session']);
    const hold = reduceStretch(setup, { type: 'OK', now: NOW });
    expect(stretchMenuItems(hold)[1]?.label).toBe('+15 s more');
    const second = PLAN.steps.find((s) => s.side === 2)!;
    expect(stretchMenuItems({ ...setup, index: second.index })[2]?.label).toBe('Skip this side');
  });
});

describe('StretchPreview', () => {
  it('lists the stretches, changes length, shuffles and starts', async () => {
    const planned = stretchDto({ plan: PLAN });
    api.stretch.mockResolvedValue(planned);
    api.rerollStretch.mockResolvedValue(planned);
    api.startStretch.mockResolvedValue({ ...planned, status: 'active' });
    renderAt('/stretch/st1', <StretchPreview id="st1" />);
    await screen.findByTestId('stretch-preview');
    expect(document.querySelectorAll('[data-testid^="stretch-row-"]')).toHaveLength(stretchCount(PLAN.steps));
    const relax = PLAN.steps.at(-1)!.stretchId;
    expect(screen.getByTestId(`stretch-row-${relax}`).textContent).toMatch(/Hold \d+ s/);

    fireEvent.click(screen.getByTestId('stretch-length-long'));
    await waitFor(() => expect(api.rerollStretch).toHaveBeenCalledWith('st1', 'long'));
    fireEvent.click(screen.getByTestId('stretch-reroll'));
    await waitFor(() => expect(api.rerollStretch).toHaveBeenCalledWith('st1'));

    fireEvent.click(screen.getByTestId('stretch-start'));
    await waitFor(() => expect(window.location.pathname).toBe('/stretch/st1/play'));
    expect(api.startStretch).toHaveBeenCalledWith('st1');
  });

  it('jumps straight into a session that already started', async () => {
    api.stretch.mockResolvedValue(stretchDto({ status: 'active' }));
    renderAt('/stretch/st1', <StretchPreview id="st1" />);
    await waitFor(() => expect(window.location.pathname).toBe('/stretch/st1/play'));
  });

  it('explains an empty plan instead of starting', async () => {
    api.stretch.mockResolvedValue(stretchDto({ plan: { ...PLAN, steps: [] } }));
    renderAt('/stretch/st1', <StretchPreview id="st1" />);
    await screen.findByText(/No stretch fits your equipment/);
    fireEvent.click(screen.getByTestId('stretch-start'));
    expect(api.startStretch).not.toHaveBeenCalled();
  });
});

describe('StretchDone', () => {
  it('summarises what was held and what was skipped', async () => {
    const first = PLAN.steps[0]!;
    const rest = PLAN.steps.slice(1).map((s) => s.index);
    api.stretch.mockResolvedValue(stretchDto({ status: 'ended_early', plan: PLAN, completed: rest, skipped: [first.index], startedAt: NOW, endedAt: NOW + 9 * 60_000 }));
    renderAt('/stretch/st1/done', <StretchDone id="st1" />);
    await screen.findByTestId('stretch-done');
    const total = stretchCount(PLAN.steps);
    expect(screen.getByText(`${total - 1} of ${total}`)).toBeTruthy();
    expect(screen.getByText('Ended early')).toBeTruthy();
    expect(screen.getByTestId('stretch-done-list').textContent).toContain('Skipped');
    fireEvent.click(screen.getByTestId('stretch-done-home'));
    expect(window.location.pathname).toBe('/');
  });

  it('says so when the session never finished', async () => {
    api.stretch.mockResolvedValue(stretchDto({ status: 'abandoned' }));
    renderAt('/stretch/st1/done', <StretchDone id="st1" />);
    await screen.findByText('This stretch session wasn’t finished.');
  });
});

describe('Home stretch band', () => {
  it('shows the band and plans a stretch session at the default length', async () => {
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: null, stretch: NO_STRETCH });
    api.sessions.mockResolvedValue([]);
    api.createStretch.mockResolvedValue(stretchDto({ id: 'new-st' }));
    renderAt('/', <Home />);
    const band = await screen.findByTestId('stretch-band');
    expect(band.textContent).toContain('14 min');
    expect(band.textContent).toContain('Not yet');
    expect(screen.getByTestId('day-push').textContent).toContain('Next up');
    fireEvent.click(band);
    await waitFor(() => expect(window.location.pathname).toBe('/stretch/new-st'));
    expect(api.createStretch).toHaveBeenCalledWith('standard');
  });

  it('resumes an unfinished stretch session instead of planning a new one', async () => {
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: null, stretch: { ...NO_STRETCH, activeId: 'st7' } });
    api.sessions.mockResolvedValue([]);
    renderAt('/', <Home />);
    const band = await screen.findByTestId('stretch-band');
    expect(band.textContent).toContain('Resume');
    fireEvent.click(band);
    expect(window.location.pathname).toBe('/stretch/st7/play');
    expect(api.createStretch).not.toHaveBeenCalled();
  });

  it('reports planning failures', async () => {
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: null, stretch: { lastEndedAt: NOW, estimatedSec: 600, activeId: null } });
    api.sessions.mockResolvedValue([]);
    api.createStretch.mockRejectedValue(new Error('No stretches today'));
    renderAt('/', <Home />);
    fireEvent.click(await screen.findByTestId('stretch-band'));
    await screen.findByText('No stretches today');
  });
});

describe('History with stretch sessions', () => {
  const lift = sessionDto({ id: 'a1', status: 'completed', startedAt: NOW - 3_600_000, endedAt: NOW - 3_000_000 });
  const stretch = stretchDto({ id: 'st9', status: 'completed', plan: PLAN, completed: PLAN.steps.map((s) => s.index), startedAt: NOW, endedAt: NOW + 900_000 });

  it('interleaves stretch sessions with workouts, newest first, and opens their summary', async () => {
    api.sessions.mockResolvedValue([lift]);
    api.stretchList.mockResolvedValue([stretch]);
    renderAt('/history', <History />);
    const row = await screen.findByTestId('stretch-session-st9');
    const total = stretchCount(PLAN.steps);
    expect(row.textContent).toContain(`${total} of ${total} stretches`);
    const rows = [...document.querySelectorAll('[data-testid^="stretch-session-"], [data-testid^="session-"]')].map((el) => el.getAttribute('data-testid'));
    expect(rows).toEqual(['stretch-session-st9', 'session-a1']);
    fireEvent.click(row);
    expect(window.location.pathname).toBe('/stretch/st9/done');
  });

  it('deletes a stretch session without touching workouts', async () => {
    api.sessions.mockResolvedValue([lift]);
    api.stretchList.mockResolvedValue([stretch]);
    api.deleteStretch.mockResolvedValue({ id: 'st9' });
    renderAt('/history', <History />);
    fireEvent.click(await screen.findByTestId('delete-stretch-st9'));
    expect((await screen.findByTestId('confirm-delete')).textContent).toContain('doesn’t affect your lifting progress');
    fireEvent.click(screen.getByTestId('confirm-delete-yes'));
    await waitFor(() => expect(screen.queryByTestId('stretch-session-st9')).toBeNull());
    expect(api.deleteStretch).toHaveBeenCalledWith('st9');
    expect(api.deleteSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('session-a1')).toBeTruthy();
  });

  it('stops the merged list where either history runs out, so nothing is silently missing', () => {
    const day = 86_400_000;
    const lifts = [0, 1, 2, 3].map((i) => sessionDto({ id: `l${i}`, status: 'completed', endedAt: NOW - i * 3 * day }));
    const stretches = [0, 1].map((i) => stretchDto({ id: `s${i}`, status: 'completed', endedAt: NOW - (i * 2 + 1.5) * day }));
    // Stretch list is full (limit 2), reaching back 3.5 days: older lifts might have stretches we didn't fetch.
    expect(mergeHistory(lifts, stretches, 2).map((e) => e.session.id)).toEqual(['l0', 's0', 'l1', 's1']);
    // Neither list hit the limit: everything shows.
    expect(mergeHistory(lifts, stretches, 10)).toHaveLength(6);
  });

  it('still shows workouts when stretch history fails to load', async () => {
    api.sessions.mockResolvedValue([lift]);
    api.stretchList.mockRejectedValue(new Error('nope'));
    renderAt('/history', <History />);
    await screen.findByTestId('session-a1');
  });
});
