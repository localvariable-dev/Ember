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

  it('attributes session spanning midnight to its START date, not completion date', () => {
    // Session starts at 23:50 on June 15 and runs for 25 minutes into June 16 00:15
    const startedAt = new Date(2026, 5, 15, 23, 50, 0);
    const completedAt = new Date(2026, 5, 16, 0, 15, 0);

    const startDayKey = dayKeyFromMs(startedAt.getTime());
    const completeDayKey = dayKeyFromMs(completedAt.getTime());

    expect(startDayKey).toBe('2026-06-15');
    expect(completeDayKey).toBe('2026-06-16');

    // Ember streak rule (Part 2 §3.3 R1): credit_day must be derived from session.startedAtMs
    const sessionCreditDay = dayKeyFromMs(startedAt.getTime());
    expect(sessionCreditDay).toBe('2026-06-15');
  });

  it('extracts local calendar components rather than UTC date', () => {
    // Construct local midnight + 10 minutes
    const localMidnightTen = new Date(2026, 5, 15, 0, 10, 0);
    const expectedLocal = `2026-06-15`;
    expect(dayKeyFromMs(localMidnightTen.getTime())).toBe(expectedLocal);
  });

  it('calculates calendar days correctly across DST transitions using pure UTC day arithmetic', () => {
    // US Daylight Saving Time 2026:
    // Spring forward on 2026-03-08 (23-hour day)
    // Fall back on 2026-11-01 (25-hour day)
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');

    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  });
});
