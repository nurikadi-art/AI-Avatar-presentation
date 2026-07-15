import { describe, it, expect } from 'vitest';
import { todayLocalISO, isOverdue } from './date';

describe('todayLocalISO', () => {
  it('formats a Date as zero-padded local YYYY-MM-DD', () => {
    expect(todayLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayLocalISO(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('isOverdue', () => {
  it('is true only when a due date is strictly before today', () => {
    expect(isOverdue('2026-07-13', '2026-07-14')).toBe(true);
    expect(isOverdue('2026-07-14', '2026-07-14')).toBe(false);
    expect(isOverdue('2026-07-15', '2026-07-14')).toBe(false);
  });

  it('is false when there is no due date', () => {
    expect(isOverdue(null, '2026-07-14')).toBe(false);
  });
});
