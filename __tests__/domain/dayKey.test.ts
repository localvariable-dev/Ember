/**
 * DayKey Unit Tests
 * Master Plan Part 2 §3.3
 */

import { addDays, dayKeyFromMs, daysBetween } from '../../src/domain/dayKey';

describe('dayKey', () => {
  it('converts timestamp to local DayKey', () => {
    // 2026-06-15 12:00:00 UTC
    const date = new Date(2026, 5, 15, 12, 0, 0);
    expect(dayKeyFromMs(date.getTime())).toBe('2026-06-15');
  });

  it('calculates days between two dates correctly', () => {
    expect(daysBetween('2026-06-15', '2026-06-15')).toBe(0);
    expect(daysBetween('2026-06-15', '2026-06-16')).toBe(1);
    expect(daysBetween('2026-06-15', '2026-06-20')).toBe(5);
    expect(daysBetween('2026-06-20', '2026-06-15')).toBe(-5);
  });

  it('handles month boundaries in non-leap year (2026)', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('handles leap year (2028) correctly', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
  });

  it('adds negative days correctly', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
