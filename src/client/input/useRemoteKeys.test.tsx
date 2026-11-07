import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRemoteKeys } from './useRemoteKeys.ts';

function press(init: KeyboardEventInit & { keyCode?: number }) {
  const event = new KeyboardEvent('keydown', { ...init, cancelable: true });
  if (init.keyCode) Object.defineProperty(event, 'keyCode', { value: init.keyCode });
  window.dispatchEvent(event);
  return event;
}

describe('useRemoteKeys', () => {
  it('normalises keys, passes repeat, and prevents default', () => {
    const handler = vi.fn();
    renderHook(() => useRemoteKeys(handler));
    const event = press({ key: 'ArrowLeft', keyCode: 37, repeat: true });
    expect(handler).toHaveBeenCalledWith('LEFT', { repeat: true });
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves unmapped keys alone', () => {
    const handler = vi.fn();
    renderHook(() => useRemoteKeys(handler));
    const event = press({ key: 'a', keyCode: 65 });
    expect(handler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('can be disabled and cleans up on unmount', () => {
    const handler = vi.fn();
    const { rerender, unmount } = renderHook(({ on }) => useRemoteKeys(handler, on), { initialProps: { on: false } });
    press({ key: 'Enter', keyCode: 13 });
    expect(handler).not.toHaveBeenCalled();
    rerender({ on: true });
    press({ key: 'Enter', keyCode: 13 });
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
    press({ key: 'Enter', keyCode: 13 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
