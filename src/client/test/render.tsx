import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AppDataProvider } from '../app/AppData.tsx';
import { RouterProvider } from '../app/router.tsx';
import { DEFAULT_SETTINGS, type Prefs, type Settings } from '../../core/settings.ts';

/** Render a screen inside the app's providers at a given URL. */
export function renderAt(path: string, ui: ReactElement, opts: { settings?: Settings; prefs?: Prefs } = {}) {
  window.history.replaceState(null, '', path);
  return render(
    <AppDataProvider initial={{ settings: opts.settings ?? DEFAULT_SETTINGS, prefs: opts.prefs ?? {} }}>
      <RouterProvider>{ui}</RouterProvider>
    </AppDataProvider>,
  );
}

export function key(k: string, keyCode: number, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'keyCode', { value: keyCode });
  window.dispatchEvent(event);
}

export const KEYS = {
  ok: () => key('Enter', 13),
  back: () => key('Escape', 27),
  up: () => key('ArrowUp', 38),
  down: () => key('ArrowDown', 40),
  left: () => key('ArrowLeft', 37),
  right: () => key('ArrowRight', 39),
};
