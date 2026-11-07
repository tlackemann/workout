import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';
import { activeDto, NOW, sessionDto } from '../test/fixtures.ts';
import { KEYS, renderAt } from '../test/render.tsx';

const api = vi.hoisted(() => ({
  home: vi.fn(),
  sessions: vi.fn(),
  session: vi.fn(),
  createSession: vi.fn(),
  reroll: vi.fn(),
  alternatives: vi.fn(),
  swapPlanned: vi.fn(),
  start: vi.fn(),
  summary: vi.fn(),
  saveSettings: vi.fn(),
  savePref: vi.fn(),
}));

vi.mock('../app/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/api.ts')>();
  return { ...actual, api: { ...actual.api, ...api } };
});
vi.mock('../audio/cues.ts', () => ({ configureAudio: vi.fn(), resumeOnVisible: vi.fn(() => () => undefined) }));

const { Home } = await import('./Home.tsx');
const { Preview } = await import('./Preview.tsx');
const { Summary } = await import('./Summary.tsx');
const { History } = await import('./History.tsx');
const { Settings } = await import('./Settings.tsx');

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
});

describe('Home', () => {
  it('shows the three days and plans the chosen one', async () => {
    api.home.mockResolvedValue({ nextDay: 'pull', last: { day: 'push', endedAt: NOW }, active: null });
    api.sessions.mockResolvedValue([sessionDto({ status: 'completed', endedAt: NOW })]);
    api.createSession.mockResolvedValue(sessionDto({ id: 'new1', day: 'pull' }));
    renderAt('/', <Home />);
    await screen.findByTestId('home');
    expect(screen.getByTestId('day-pull').textContent).toContain('Next up');
    expect(screen.getByTestId('day-push').textContent).toContain('Bench Press');
    fireEvent.click(screen.getByTestId('day-pull'));
    await waitFor(() => expect(window.location.pathname).toBe('/preview/new1'));
    expect(api.createSession).toHaveBeenCalledWith('pull', 'standard');
  });

  it('offers to resume an active workout', async () => {
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: activeDto() });
    api.sessions.mockResolvedValue([]);
    renderAt('/', <Home />);
    fireEvent.click(await screen.findByTestId('resume'));
    expect(window.location.pathname).toBe('/play/s1');
  });

  it('reports planning failures', async () => {
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: null });
    api.sessions.mockResolvedValue([]);
    api.createSession.mockRejectedValue(new Error('Server is grumpy'));
    renderAt('/', <Home />);
    fireEvent.click(await screen.findByTestId('day-legs'));
    await screen.findByText('Server is grumpy');
  });

  it('navigates to history and settings', async () => {
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: null });
    api.sessions.mockResolvedValue([]);
    renderAt('/', <Home />);
    fireEvent.click(await screen.findByTestId('go-settings'));
    expect(window.location.pathname).toBe('/settings');
  });
});

describe('Preview', () => {
  it('lists the plan, rerolls lengths and starts', async () => {
    const planned = sessionDto();
    api.session.mockResolvedValue(planned);
    api.reroll.mockResolvedValue({ ...planned, length: 'long' });
    api.start.mockResolvedValue({ ...planned, status: 'active' });
    renderAt('/preview/s1', <Preview id="s1" />);
    await screen.findByTestId('preview');
    expect(screen.getByTestId('row-bench-press')).toBeTruthy();

    fireEvent.click(screen.getByTestId('length-long'));
    await waitFor(() => expect(api.reroll).toHaveBeenCalledWith('s1', 'long'));
    fireEvent.click(screen.getByTestId('reroll'));
    await waitFor(() => expect(api.reroll).toHaveBeenCalledWith('s1'));

    fireEvent.click(screen.getByTestId('start'));
    await waitFor(() => expect(window.location.pathname).toBe('/play/s1'));
  });

  it('swaps, favourites and bans through the row sheet', async () => {
    const planned = sessionDto();
    const second = planned.plan.items[1]!;
    const alt = { ...second, exerciseId: 'machine-shoulder-press' };
    api.session.mockResolvedValue(planned);
    api.alternatives.mockResolvedValue([alt]);
    api.swapPlanned.mockResolvedValue({ ...planned, plan: { ...planned.plan, items: planned.plan.items.map((i) => (i.position === second.position ? alt : i)) } });
    api.savePref.mockImplementation(async (_id: string, pref: unknown) => pref);
    renderAt('/preview/s1', <Preview id="s1" />);
    await screen.findByTestId('preview');

    fireEvent.click(screen.getByTestId(`row-${second.exerciseId}`));
    fireEvent.click(await screen.findByTestId('action-swap'));
    fireEvent.click(await screen.findByTestId('alt-machine-shoulder-press'));
    await screen.findByTestId('row-machine-shoulder-press');
    expect(api.swapPlanned).toHaveBeenCalledWith('s1', second.position, 'machine-shoulder-press');

    fireEvent.click(screen.getByTestId('row-machine-shoulder-press'));
    fireEvent.click(await screen.findByTestId('action-favorite'));
    await waitFor(() => expect(api.savePref).toHaveBeenCalledWith('machine-shoulder-press', { favorite: true, banned: false, startLoad: null }));

    fireEvent.click(screen.getByTestId('row-bench-press'));
    fireEvent.click(await screen.findByTestId('action-ban'));
    await waitFor(() => expect(api.savePref).toHaveBeenCalledWith('bench-press', { favorite: false, banned: true, startLoad: null }));

    fireEvent.click(screen.getByTestId('row-bench-press'));
    fireEvent.click(await screen.findByTestId('action-cancel'));
    await waitFor(() => expect(screen.queryByTestId('item-sheet')).toBeNull());
  });

  it('redirects a started session to the player', async () => {
    api.session.mockResolvedValue(activeDto());
    renderAt('/preview/s1', <Preview id="s1" />);
    await waitFor(() => expect(window.location.pathname).toBe('/play/s1'));
  });
});

describe('Summary', () => {
  it('shows totals, PRs and next targets', async () => {
    api.session.mockResolvedValue(sessionDto({ status: 'completed', endedAt: NOW, startedAt: NOW - 3_000_000 }));
    api.summary.mockResolvedValue({
      durationSec: 3000,
      volume: 9600,
      workingSets: 12,
      skippedSets: 0,
      exercises: [
        {
          exerciseId: 'bench-press',
          bestE1rm: 170,
          isPr: true,
          next: { load: 140, reps: [5, 5, 5, 5], reason: 'progress', promote: false, lastLoad: 135 },
          sets: [{ position: 0, setIndex: 1, exerciseId: 'bench-press', kind: 'working', reps: 8, load: 135, targetReps: 8, targetLoad: 135, repMin: 5, repMax: 8, plannedSets: 4, loggedAt: NOW }],
        },
      ],
    });
    renderAt('/summary/s1', <Summary id="s1" />);
    await screen.findByTestId('summary');
    expect(screen.getByText('PR')).toBeTruthy();
    expect(screen.getByTestId('summary-list').textContent).toContain('Next: 4 × 5 @ 140 ↑');
    expect(screen.getByText('9,600 lb')).toBeTruthy();
    fireEvent.click(screen.getByTestId('summary-done'));
    expect(window.location.pathname).toBe('/');
  });
});

describe('History', () => {
  it('lists finished sessions and opens a summary', async () => {
    api.sessions.mockResolvedValue([sessionDto({ id: 'old1', status: 'ended_early', startedAt: NOW - 1_800_000, endedAt: NOW })]);
    renderAt('/history', <History />);
    await screen.findByTestId('history');
    expect(screen.getByText('Ended early')).toBeTruthy();
    fireEvent.click(screen.getByText('Push'));
    expect(window.location.pathname).toBe('/summary/old1');
  });

  it('has an empty state', async () => {
    api.sessions.mockResolvedValue([]);
    renderAt('/history', <History />);
    await screen.findByText('No finished workouts yet.');
  });
});

describe('Settings', () => {
  it('toggles equipment and steps values, saving (debounced) to the server', async () => {
    api.saveSettings.mockImplementation(async (s: unknown) => s);
    renderAt('/settings', <Settings />);
    const dumbbells = screen.getByTestId('equip-dumbbells');
    expect(dumbbells.textContent).toContain('Off');
    fireEvent.click(dumbbells);
    expect(screen.getByTestId('equip-dumbbells').textContent).toContain('On');

    const lengthRow = screen.getByTestId('setting-length');
    fireEvent.click(lengthRow.querySelectorAll('[role="button"]')[1]!);
    expect(screen.getByTestId('setting-length').textContent).toContain('Long');

    fireEvent.click(screen.getByTestId('setting-sound'));
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled(), { timeout: 2000 });
    const saved = api.saveSettings.mock.calls.at(-1)?.[0] as typeof DEFAULT_SETTINGS;
    expect(saved.equipment).toContain('dumbbells');
    expect(saved.defaultLength).toBe('long');
    expect(saved.audio.enabled).toBe(false);
  });

  it('BACK-free: keyboard arrows on a focused stepper are handled by spatial nav (no crash)', () => {
    renderAt('/settings', <Settings />);
    act(() => KEYS.right());
    expect(screen.getByTestId('settings')).toBeTruthy();
  });
});
