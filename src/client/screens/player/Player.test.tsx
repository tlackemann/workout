import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionState } from '../../../core/session/types.ts';
import { activeDto, sessionDto } from '../../test/fixtures.ts';
import { KEYS, key, renderAt } from '../../test/render.tsx';

const api = vi.hoisted(() => ({
  session: vi.fn(),
  saveState: vi.fn(),
  alternatives: vi.fn(),
}));

vi.mock('../../app/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/api.ts')>();
  return { ...actual, api: { ...actual.api, ...api } };
});

vi.mock('../../audio/cues.ts', () => ({
  unlockAudio: vi.fn(),
  scheduleCountdown: vi.fn(() => () => undefined),
  chime: vi.fn(),
  configureAudio: vi.fn(),
  resumeOnVisible: vi.fn(() => () => undefined),
}));

const { Player } = await import('./Player.tsx');

const phase = () => screen.getByTestId('player').getAttribute('data-phase');

async function mount(dto = activeDto()) {
  api.session.mockResolvedValue(dto);
  renderAt('/play/s1', <Player id="s1" />);
  await screen.findByTestId('player');
}

describe('Player', () => {
  beforeEach(() => {
    window.localStorage.clear();
    for (const fn of Object.values(api)) fn.mockReset();
    api.saveState.mockImplementation(async (_id: string, state: SessionState) => activeDto({ ...state }));
  });
  afterEach(() => vi.clearAllMocks());

  it('walks get-ready → work → rest with OK and edits the log', async () => {
    await mount();
    expect(phase()).toBe('intro');
    expect(screen.getByTestId('phase-label').textContent).toBe('Get ready');

    act(() => KEYS.ok());
    expect(phase()).toBe('work');
    expect(screen.getByTestId('target')).toBeTruthy();

    act(() => KEYS.ok());
    expect(phase()).toBe('rest');
    const reps = Number(screen.getByTestId('log-reps').textContent);
    act(() => KEYS.down());
    expect(screen.getByTestId('log-reps').textContent).toBe(String(reps - 1));
    act(() => KEYS.up());
    expect(screen.getByTestId('log-reps').textContent).toBe(String(reps));

    const load = screen.getByTestId('log-load').textContent;
    act(() => KEYS.right());
    expect(screen.getByTestId('log-load').textContent).not.toBe(load);
    act(() => KEYS.left());
    expect(screen.getByTestId('log-load').textContent).toBe(load);

    expect(screen.getByTestId('up-next')).toBeTruthy();
    act(() => KEYS.ok());
    expect(phase()).toBe('work');
  });

  it('saves each revision to the server (debounced) and mirrors it locally', async () => {
    await mount();
    act(() => KEYS.ok());
    await waitFor(() => expect(api.saveState).toHaveBeenCalled());
    const saved = api.saveState.mock.calls.at(-1)?.[1] as SessionState;
    expect(saved.phase).toBe('work');
    expect(window.localStorage.getItem('gymtv:session:s1')).toContain('"phase":"work"');
  });

  it('BACK opens the pause menu and resumes', async () => {
    await mount();
    act(() => KEYS.back());
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
    expect(screen.getByTestId('menu-resume').getAttribute('data-selected')).toBe('true');
    act(() => KEYS.down());
    expect(screen.getByTestId('menu-skipSet').getAttribute('data-selected')).toBe('true');
    act(() => KEYS.back());
    expect(screen.queryByTestId('pause-menu')).toBeNull();
  });

  it('a history pop (TV Back) after a key press opens the menu instead of leaving', async () => {
    await mount();
    act(() => KEYS.ok()); // arms the guard entry
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
    expect(window.location.pathname).toBe('/play/s1');
  });

  it('ends early through the confirmation and moves to the summary once saved', async () => {
    await mount();
    act(() => KEYS.ok());
    act(() => KEYS.back());
    act(() => KEYS.up()); // wraps to "End workout"
    expect(screen.getByTestId('menu-end').getAttribute('data-selected')).toBe('true');
    act(() => KEYS.ok());
    expect(screen.getByTestId('confirm-end')).toBeTruthy();
    act(() => KEYS.right());
    act(() => KEYS.ok());
    expect(screen.getByText('Workout complete')).toBeTruthy();
    await waitFor(() => expect(window.location.pathname).toBe('/summary/s1'));
    const saved = api.saveState.mock.calls.at(-1)?.[1] as SessionState;
    expect(saved).toMatchObject({ phase: 'done', endedEarly: true });
  });

  it('swaps the current exercise from the menu', async () => {
    const dto = activeDto();
    const current = dto.plan.items[0]!;
    const replacement = { ...current, exerciseId: 'machine-chest-press', sets: current.sets.filter((s) => s.kind === 'working') };
    api.alternatives.mockResolvedValue([replacement]);
    await mount(dto);
    act(() => KEYS.back());
    for (let i = 0; i < 5; i++) {
      if (screen.getByTestId('menu-swap').getAttribute('data-selected') === 'true') break;
      act(() => KEYS.down());
    }
    act(() => KEYS.ok());
    await screen.findByTestId('swap-machine-chest-press');
    act(() => KEYS.ok());
    expect(screen.getByTestId('exercise-name').textContent).toBe('Machine Chest Press');
    expect(phase()).toBe('intro');
  });

  it('restores an in-progress session paused with a welcome-back notice', async () => {
    const dto = activeDto();
    await mount({ ...dto, state: { ...dto.state!, rev: 5 } });
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
    expect(screen.getByText(/Welcome back/)).toBeTruthy();
  });

  it('adopts a newer server revision after a conflict', async () => {
    const dto = activeDto();
    // Another device already moved this session on to a rest.
    const newer = { ...dto.state!, rev: 50, phase: 'rest' as const, endsAt: Date.now() + 60_000, draft: { cursor: { item: 0, set: 0 }, reps: 3, load: 45 } };
    const { ApiError } = await import('../../app/api.ts');
    api.saveState.mockRejectedValueOnce(new ApiError(409, 'Stale', { ...dto, state: newer }));
    await mount(dto);
    act(() => KEYS.ok());
    expect(phase()).toBe('work');
    await waitFor(() => expect(phase()).toBe('rest'));
    expect(screen.getByTestId('log-reps').textContent).toBe('3');
  });

  it('shows an offline badge when saving fails, and keeps playing', async () => {
    api.saveState.mockRejectedValue(new Error('network down'));
    await mount();
    act(() => KEYS.ok());
    await screen.findByText(/Offline/);
    expect(phase()).toBe('work');
  });

  it('sends you home if the session is not active', async () => {
    api.session.mockResolvedValue(sessionDto({ status: 'completed' }));
    renderAt('/play/s1', <Player id="s1" />);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('explains load failures', async () => {
    api.session.mockRejectedValue(new Error('boom'));
    renderAt('/play/s1', <Player id="s1" />);
    await screen.findByText('Couldn’t load this workout');
  });

  it('stays in the player for two TV Backs (pause, resume) even before any key press', async () => {
    await mount();
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.queryByTestId('pause-menu')).toBeNull();
    expect(screen.getByTestId('player')).toBeTruthy();
  });

  it('Back on the error screen goes home', async () => {
    api.session.mockRejectedValue(new Error('boom'));
    renderAt('/play/s1', <Player id="s1" />);
    await screen.findByText('Couldn’t load this workout');
    act(() => KEYS.back());
    expect(window.location.pathname).toBe('/');
  });

  it('flushes a finished-but-unsaved state on load and moves to the summary', async () => {
    const dto = activeDto();
    window.localStorage.setItem('gymtv:session:s1', JSON.stringify({ ...dto.state!, rev: 0, phase: 'done', endedAt: Date.now(), endsAt: null }));
    await mount({ ...dto, state: { ...dto.state!, phase: 'done', endsAt: null, endedAt: Date.now() } }).catch(() => undefined);
    await waitFor(() => expect(api.saveState).toHaveBeenCalled());
    await waitFor(() => expect(window.location.pathname).toBe('/summary/s1'));
  });

  it('sends saves one at a time and never rolls back newer local progress', async () => {
    let release: (() => void) | null = null;
    const sent: number[] = [];
    api.saveState.mockImplementation(async (_id: string, state: SessionState) => {
      sent.push(state.rev);
      if (sent.length === 1) await new Promise<void>((r) => (release = r));
      return activeDto({ ...state });
    });
    await mount();
    act(() => KEYS.ok()); // rev 1
    await waitFor(() => expect(sent).toEqual([1]));
    act(() => KEYS.ok()); // rev 2 while rev 1 is still in flight
    act(() => KEYS.ok()); // rev 3
    await new Promise((r) => setTimeout(r, 500));
    expect(sent).toEqual([1]);
    act(() => release?.());
    await waitFor(() => expect(sent.at(-1)).toBe(3));
    expect(phase()).toBe('work');
  });

  it('names the upcoming exercise in the menu during the changeover rest', async () => {
    const dto = activeDto();
    const first = dto.plan.items[0]!;
    await mount(dto);
    act(() => KEYS.ok());
    for (let i = 0; i < first.sets.length - 1; i++) {
      act(() => KEYS.ok());
      act(() => KEYS.ok());
    }
    act(() => KEYS.ok()); // last set of the first exercise done → changeover rest
    expect(phase()).toBe('rest');
    act(() => KEYS.back());
    expect(screen.getByTestId('menu-skipExercise').textContent).toBe('Skip next exercise');
    expect(screen.getByTestId('menu-swap').textContent).toBe('Swap next exercise');
  });

  it('ignores unrelated keys', async () => {
    await mount();
    act(() => key('a', 65));
    expect(phase()).toBe('intro');
  });
});
