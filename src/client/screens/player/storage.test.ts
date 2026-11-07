import { beforeEach, describe, expect, it } from 'vitest';
import { clearLocal, pickNewest, readLocal, writeLocal } from './storage.ts';
import { createSession } from '../../../core/session/reducer.ts';
import type { Plan } from '../../../core/plan.ts';

const plan: Plan = { day: 'push', length: 'quick', seed: 1, items: [], droppedSlots: [], trimmedSlots: [], estimatedSec: 0 };
const state = createSession('abc', plan, 1000, 10);

describe('player storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips state per session id', () => {
    writeLocal({ ...state, rev: 4 });
    expect(readLocal('abc')?.rev).toBe(4);
    expect(readLocal('other')).toBeNull();
    clearLocal('abc');
    expect(readLocal('abc')).toBeNull();
  });

  it('ignores corrupt or foreign data', () => {
    window.localStorage.setItem('gymtv:session:abc', '{nope');
    expect(readLocal('abc')).toBeNull();
    window.localStorage.setItem('gymtv:session:abc', JSON.stringify({ ...state, schemaVersion: 99 }));
    expect(readLocal('abc')).toBeNull();
  });

  it('prefers the higher revision', () => {
    expect(pickNewest({ ...state, rev: 3 }, { ...state, rev: 5 }).rev).toBe(5);
    expect(pickNewest({ ...state, rev: 7 }, { ...state, rev: 5 }).rev).toBe(7);
    expect(pickNewest({ ...state, rev: 7 }, null).rev).toBe(7);
  });
});
