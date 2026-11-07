import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouterProvider, useRouter } from './router.tsx';
import { useAsync } from './useAsync.ts';
import { useOverlayHistory } from './useOverlayHistory.ts';
import { useNow } from '../timer/useNow.ts';

describe('router', () => {
  function Where() {
    const { route, navigate } = useRouter();
    return (
      <div>
        <span data-testid="route">{route.name}</span>
        <button onClick={() => navigate('/settings')}>go</button>
        <button onClick={() => navigate('/history', { replace: true })}>replace</button>
      </div>
    );
  }

  it('follows navigate, replace and history pops', async () => {
    window.history.replaceState(null, '', '/');
    render(<RouterProvider><Where /></RouterProvider>);
    expect(screen.getByTestId('route').textContent).toBe('home');
    act(() => screen.getByText('go').click());
    expect(screen.getByTestId('route').textContent).toBe('settings');
    act(() => screen.getByText('replace').click());
    expect(screen.getByTestId('route').textContent).toBe('history');
    window.history.replaceState(null, '', '/');
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.getByTestId('route').textContent).toBe('home');
  });

  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useRouter())).toThrow(/RouterProvider/);
  });
});

describe('useAsync', () => {
  it('loads, reports errors, reloads and accepts local updates', async () => {
    let n = 0;
    const load = vi.fn(async () => {
      n += 1;
      if (n === 2) throw new Error('nope');
      return n;
    });
    const { result } = renderHook(() => useAsync(load, []));
    await waitFor(() => expect(result.current.data).toBe(1));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe('nope'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe(3));
    act(() => result.current.setData(42));
    expect(result.current.data).toBe(42);
  });
});

describe('useOverlayHistory', () => {
  it('pushes an entry when opened and closes on a history pop', () => {
    const onClose = vi.fn();
    const push = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook(({ open }) => useOverlayHistory(open, onClose), { initialProps: { open: false } });
    rerender({ open: true });
    expect(push).toHaveBeenCalledTimes(1);
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('consumes its own entry when closed programmatically, without calling onClose', () => {
    const onClose = vi.fn();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { rerender } = renderHook(({ open }) => useOverlayHistory(open, onClose), { initialProps: { open: true } });
    rerender({ open: false });
    expect(back).toHaveBeenCalledTimes(1);
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(onClose).not.toHaveBeenCalled();
    back.mockRestore();
  });
});

describe('useNow', () => {
  it('ticks forward', async () => {
    const { result } = renderHook(() => useNow(10));
    const first = result.current;
    await waitFor(() => expect(result.current).toBeGreaterThan(first), { timeout: 1500 });
  });
});
