import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('uses dev defaults', () => {
    expect(loadConfig({})).toMatchObject({ production: false, port: 8787, staticDir: null, mediaDir: './public/media' });
  });

  it('serves the build in production', () => {
    expect(loadConfig({ NODE_ENV: 'production', PORT: '3000' })).toMatchObject({
      production: true,
      port: 3000,
      staticDir: './dist',
      mediaDir: './dist/media',
    });
  });

  it('fails fast on bad values', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
