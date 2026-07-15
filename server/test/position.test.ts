import { describe, it, expect } from 'vitest';
import { positionBetween } from '../src/lib/position';

describe('positionBetween', () => {
  it('appends after a key when the upper bound is open, staying ascending', () => {
    const first = positionBetween(null, null);
    const second = positionBetween(first, null);
    const third = positionBetween(second, null);
    expect(first < second).toBe(true);
    expect(second < third).toBe(true);
  });

  it('produces a key strictly between neighbours that share an integer part', () => {
    const lo = 'a0V';
    const hi = 'a0k';
    const mid = positionBetween(lo, hi);
    expect(lo < mid).toBe(true);
    expect(mid < hi).toBe(true);
  });

  it('appends jitter so repeated calls between identical bounds rarely collide', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) keys.add(positionBetween(null, null));
    expect(keys.size).toBeGreaterThanOrEqual(90);
  });

  it('sorts by (position, id) as a deterministic tie-break for equal positions', () => {
    const rows = [
      { position: 'a0', id: 'm2' },
      { position: 'a0', id: 'm1' },
    ];
    rows.sort((x, y) =>
      x.position === y.position
        ? x.id.localeCompare(y.id)
        : x.position.localeCompare(y.position),
    );
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2']);
  });
});
