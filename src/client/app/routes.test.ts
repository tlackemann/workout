import { describe, expect, it } from 'vitest';
import { matchRoute, paths } from './routes.ts';

describe('matchRoute', () => {
  it('matches every screen', () => {
    expect(matchRoute('/')).toEqual({ name: 'home' });
    expect(matchRoute('/settings')).toEqual({ name: 'settings' });
    expect(matchRoute('/history')).toEqual({ name: 'history' });
    expect(matchRoute(paths.preview('abc-1'))).toEqual({ name: 'preview', id: 'abc-1' });
    expect(matchRoute(paths.play('abc-1'))).toEqual({ name: 'play', id: 'abc-1' });
    expect(matchRoute(paths.summary('abc-1'))).toEqual({ name: 'summary', id: 'abc-1' });
  });

  it('matches the progress screen and its tabs', () => {
    expect(matchRoute('/progress')).toEqual({ name: 'progress', tab: 'lifts' });
    expect(matchRoute(paths.progress('muscles'))).toEqual({ name: 'progress', tab: 'muscles' });
    expect(matchRoute(paths.progress())).toEqual({ name: 'progress', tab: 'lifts' });
    expect(paths.progress('consistency')).toBe('/progress/consistency');
    expect(matchRoute('/progress/bogus')).toEqual({ name: 'notFound' });
  });

  it('rejects unknown or malformed paths', () => {
    expect(matchRoute('/play/../etc')).toEqual({ name: 'notFound' });
    expect(matchRoute('/nope')).toEqual({ name: 'notFound' });
  });
});
