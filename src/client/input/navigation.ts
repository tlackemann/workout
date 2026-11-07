import { init, setKeyMap } from '@noriginmedia/norigin-spatial-navigation';

let initialised = false;

/** Spatial (D-pad) focus for menu screens. Arrows 37–40, OK = Enter (13) or DPAD_CENTER (23). */
export function initNavigation(): void {
  if (initialised) return;
  initialised = true;
  // No key throttling: it drops an OK pressed right after an arrow.
  init({ debug: false, visualDebug: false });
  setKeyMap({ left: [37], up: [38], right: [39], down: [40], enter: [13, 23] });
}
