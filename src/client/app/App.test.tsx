import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';
import { NO_STRETCH } from '../test/fixtures.ts';

const api = vi.hoisted(() => ({ settings: vi.fn(), prefs: vi.fn(), home: vi.fn(), sessions: vi.fn() }));
vi.mock('./api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api.ts')>();
  return { ...actual, api: { ...actual.api, ...api } };
});
vi.mock('../audio/cues.ts', () => ({ configureAudio: vi.fn(), resumeOnVisible: vi.fn(() => () => undefined) }));

const { App } = await import('./App.tsx');

describe('App', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    window.history.replaceState(null, '', '/');
  });

  it('boots into Home once settings load', async () => {
    api.settings.mockResolvedValue(DEFAULT_SETTINGS);
    api.prefs.mockResolvedValue({});
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: null, stretch: NO_STRETCH });
    api.sessions.mockResolvedValue([]);
    render(<App />);
    await screen.findByTestId('home');
  });

  it('shows a retry screen when the server is unreachable', async () => {
    api.settings.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(DEFAULT_SETTINGS);
    api.prefs.mockResolvedValue({});
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: null, stretch: NO_STRETCH });
    api.sessions.mockResolvedValue([]);
    render(<App />);
    fireEvent.click(await screen.findByTestId('retry'));
    await screen.findByTestId('home');
  });

  it('renders a not-found screen with a way home', async () => {
    window.history.replaceState(null, '', '/nowhere');
    api.settings.mockResolvedValue(DEFAULT_SETTINGS);
    api.prefs.mockResolvedValue({});
    api.home.mockResolvedValue({ nextDay: 'push', last: null, active: null, stretch: NO_STRETCH });
    api.sessions.mockResolvedValue([]);
    render(<App />);
    fireEvent.click(await screen.findByText('Go home'));
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });
});
