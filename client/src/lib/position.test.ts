import { describe, it, expect } from 'vitest';
import { positionBetween } from './position';

describe('positionBetween', () => {
  it('returns a non-empty first key for (null, null)', () => {
    const k = positionBetween(null, null);
    expect(typeof k).toBe('string');
    expect(k.length).toBeGreaterThan(0);
  });

  it('appends after a key when the right bound is null', () => {
    const a = positionBetween(null, null);
    const after = positionBetween(a, null);
    expect(a < after).toBe(true);
  });

  it('prepends before a key when the left bound is null', () => {
    const a = positionBetween(null, null);
    const before = positionBetween(null, a);
    expect(before < a).toBe(true);
  });

  it('returns a key that sorts strictly between two adjacent keys', () => {
    const a = positionBetween(null, null);
    const b = positionBetween(a, null);
    const mid = positionBetween(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);
  });
});
