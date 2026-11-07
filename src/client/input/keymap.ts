export type RemoteAction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'OK' | 'BACK' | 'PLAYPAUSE';

/**
 * keyCode first: some TV WebViews report `key: "Unidentified"` for remote keys.
 * 10009 = Tizen Back, 461 = webOS Back, 179/415/19 = media Play/Pause variants.
 */
const BY_KEY_CODE: Readonly<Record<number, RemoteAction>> = {
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN',
  13: 'OK',
  23: 'OK',
  27: 'BACK',
  8: 'BACK',
  10009: 'BACK',
  461: 'BACK',
  179: 'PLAYPAUSE',
  415: 'PLAYPAUSE',
  19: 'PLAYPAUSE',
  10252: 'PLAYPAUSE',
};

const BY_KEY: Readonly<Record<string, RemoteAction>> = {
  ArrowLeft: 'LEFT',
  ArrowUp: 'UP',
  ArrowRight: 'RIGHT',
  ArrowDown: 'DOWN',
  Enter: 'OK',
  ' ': 'OK',
  Escape: 'BACK',
  Backspace: 'BACK',
  GoBack: 'BACK',
  BrowserBack: 'BACK',
  MediaPlayPause: 'PLAYPAUSE',
  MediaPlay: 'PLAYPAUSE',
  MediaPause: 'PLAYPAUSE',
};

export interface KeyLike {
  readonly keyCode?: number;
  readonly key?: string;
}

export function normalizeKey(e: KeyLike): RemoteAction | null {
  const byCode = e.keyCode ? BY_KEY_CODE[e.keyCode] : undefined;
  if (byCode) return byCode;
  return (e.key && BY_KEY[e.key]) || null;
}
