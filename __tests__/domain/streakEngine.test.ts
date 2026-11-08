/**
 * Streak Engine Test Vectors (S1-S12, P1-P5, F1-F2)
 * Master Plan Part 2 §3.3
 */

import {
  applyCredit,
  INITIAL_STREAK,
  projectStreak,
  qualifiesForFreePass,
  type StreakState,
} from '../../src/domain/streakEngine';

describe('streakEngine: applyCredit (S1-S12)', () => {
  // S1: INITIAL -> D1
  it('S1: initial practice day creates streak 1, progress 1, banked 0', () => {
    const res = applyCredit(INITIAL_STREAK, '2026-06-01');
    expect(res.changed).toBe(true);
    expect(res.next.currentStreak).toBe(1);
    expect(res.next.longestStreak).toBe(1);
    expect(res.next.graceBanked).toBe(0);
    expect(res.next.graceProgress).toBe(1);
    expect(res.next.lastCreditDay).toBe('2026-06-01');
    expect(res.next.graceEarnedTotal).toBe(0);
  });

  // S2: consecutive credits D1..D5 from INITIAL
  it('S2: consecutive credits D1..D5 banks 1 Grace Day', () => {
    let s = INITIAL_STREAK;
    for (let i = 1; i <= 5; i++) {
      const d = `2026-06-0${i}`;
      s = applyCredit(s, d).next;
    }
    expect(s.currentStreak).toBe(5);
    expect(s.longestStreak).toBe(5);
    expect(s.graceBanked).toBe(1);
    expect(s.graceProgress).toBe(0);
    expect(s.graceEarnedTotal).toBe(1);
  });

  // S3: continue to D10 -> banks 2nd Grace Day
  it('S3: continuing to D10 banks 2nd Grace Day', () => {
    let s = INITIAL_STREAK;
    for (let i = 1; i <= 10; i++) {
      const d = `2026-06-${String(i).padStart(2, '0')}`;
      s = applyCredit(s, d).next;
    }
    expect(s.currentStreak).toBe(10);
    expect(s.graceBanked).toBe(2);
    expect(s.graceProgress).toBe(0);
    expect(s.graceEarnedTotal).toBe(2);
  });

  // S4: continue to D15 -> bank full at 2, progress held at 5
  it('S4: continuing to D15 holds progress at 5 while bank is full', () => {
    let s = INITIAL_STREAK;
    for (let i = 1; i <= 15; i++) {
      const d = `2026-06-${String(i).padStart(2, '0')}`;
      s = applyCredit(s, d).next;
    }
    expect(s.currentStreak).toBe(15);
    expect(s.graceBanked).toBe(2);
    expect(s.graceProgress).toBe(5); // Progress held
    expect(s.graceEarnedTotal).toBe(2);
  });

  // S5: S2 end state (streak 5, banked 1, last D5) -> D7
  it('S5: 1 missed day (D6) consumed by 1 banked Grace Day bridges to D7', () => {
    let s = INITIAL_STREAK;
    for (let i = 1; i <= 5; i++) {
      s = applyCredit(s, `2026-06-0${i}`).next;
    }
    const res = applyCredit(s, '2026-06-07');
    expect(res.changed).toBe(true);
    expect(res.coveredDays).toEqual(['2026-06-06']);
    expect(res.next.currentStreak).toBe(6);
    expect(res.next.graceBanked).toBe(0);
    expect(res.next.graceUsedTotal).toBe(1);
    expect(res.next.graceProgress).toBe(1);
  });

  // S6: S2 end state -> D8 (missed D6, D7 > 1 banked)
  it('S6: missing 2 days with only 1 Grace Day soft resets streak to 1, banked 1 kept', () => {
    let s = INITIAL_STREAK;
    for (let i = 1; i <= 5; i++) {
      s = applyCredit(s, `2026-06-0${i}`).next;
    }
    const res = applyCredit(s, '2026-06-08');
    expect(res.reset).toBe(true);
    expect(res.next.currentStreak).toBe(1);
    expect(res.next.longestStreak).toBe(5);
    expect(res.next.graceBanked).toBe(1); // Never take grace for a streak that already ended
    expect(res.next.graceProgress).toBe(1);
    expect(res.coveredDays).toEqual([]);
  });

  // S7: streak 10, banked 2, last D10 -> D13 (missed D11, D12)
  it('S7: 2 missed days covered by 2 banked Grace Days', () => {
    let s = INITIAL_STREAK;
    for (let i = 1; i <= 10; i++) {
      s = applyCredit(s, `2026-06-${String(i).padStart(2, '0')}`).next;
    }
    const res = applyCredit(s, '2026-06-13');
    expect(res.next.currentStreak).toBe(11);
    expect(res.coveredDays).toEqual(['2026-06-11', '2026-06-12']);
    expect(res.next.graceBanked).toBe(0);
    expect(res.next.graceUsedTotal).toBe(2);
    expect(res.next.graceProgress).toBe(1);
  });

  // S8: same day commit is idempotent
  it('S8: committing on the same day leaves state unchanged', () => {
    const s1 = applyCredit(INITIAL_STREAK, '2026-06-01').next;
    const s2 = applyCredit(s1, '2026-06-01');
    expect(s2.changed).toBe(false);
    expect(s2.next).toEqual(s1);
  });

  // S9: clock rollback (today < lastCreditDay)
  it('S9: clock rollback returns unchanged state', () => {
    let s = INITIAL_STREAK;
    for (let i = 1; i <= 10; i++) {
      s = applyCredit(s, `2026-06-${String(i).padStart(2, '0')}`).next;
    }
    const res = applyCredit(s, '2026-06-08');
    expect(res.changed).toBe(false);
    expect(res.next).toEqual(s);
  });

  // S10: S4 state (banked 2, progress 5, last D15) -> D17
  it('S10: 1 missed day consumes 1 Grace Day; held progress immediately restores it on practice', () => {
    let s = INITIAL_STREAK;
    for (let i = 1; i <= 15; i++) {
      s = applyCredit(s, `2026-06-${String(i).padStart(2, '0')}`).next;
    }
    expect(s.graceProgress).toBe(5);
    const res = applyCredit(s, '2026-06-17');
    expect(res.coveredDays).toEqual(['2026-06-16']);
    expect(res.next.currentStreak).toBe(16);
    expect(res.next.graceBanked).toBe(2); // Restored from held progress
    expect(res.next.graceProgress).toBe(1);
    expect(res.graceEarned).toBe(1);
  });

  // S11: month boundary 2026-02-28 -> 2026-03-01
  it('S11: non-leap month boundary is gap 1 (consecutive)', () => {
    const s: StreakState = {
      ...INITIAL_STREAK,
      currentStreak: 3,
      longestStreak: 3,
      lastCreditDay: '2026-02-28',
    };
    const res = applyCredit(s, '2026-03-01');
    expect(res.next.currentStreak).toBe(4);
    expect(res.coveredDays).toEqual([]);
  });

  // S12: leap year month boundary 2028-02-28 -> 2028-03-01
  it('S12: leap year month boundary has leap day 2028-02-29 as missed day covered by grace', () => {
    const s: StreakState = {
      ...INITIAL_STREAK,
      currentStreak: 3,
      longestStreak: 3,
      graceBanked: 1,
      lastCreditDay: '2028-02-28',
    };
    const res = applyCredit(s, '2028-03-01');
    expect(res.coveredDays).toEqual(['2028-02-29']);
    expect(res.next.currentStreak).toBe(4);
    expect(res.next.graceBanked).toBe(0);
  });
});

describe('streakEngine: projectStreak (P1-P5)', () => {
  it('P1: fresh user with no practice shows fresh status and 0', () => {
    const res = projectStreak(INITIAL_STREAK, '2026-06-01');
    expect(res.status).toBe('fresh');
    expect(res.display).toBe(0);
  });

  it('P2: done today shows done_today status and current streak', () => {
    const s: StreakState = { ...INITIAL_STREAK, currentStreak: 4, lastCreditDay: '2026-06-05' };
    const res = projectStreak(s, '2026-06-05');
    expect(res.status).toBe('done_today');
    expect(res.display).toBe(4);
  });

  it('P3: gap = 1 shows open status and current streak', () => {
    const s: StreakState = { ...INITIAL_STREAK, currentStreak: 4, lastCreditDay: '2026-06-05' };
    const res = projectStreak(s, '2026-06-06');
    expect(res.status).toBe('open');
    expect(res.display).toBe(4);
  });

  it('P4: gap >= 2 with sufficient grace shows held_by_grace status and current streak', () => {
    const s: StreakState = {
      ...INITIAL_STREAK,
      currentStreak: 7,
      graceBanked: 2,
      lastCreditDay: '2026-06-05',
    };
    const res = projectStreak(s, '2026-06-07'); // 1 missed day (06-06)
    expect(res.status).toBe('held_by_grace');
    expect(res.display).toBe(7);
    expect(res.graceWillCover).toBe(1);
  });

  it('P5: gap >= 2 exceeding banked grace shows lapsed status and 0', () => {
    const s: StreakState = {
      ...INITIAL_STREAK,
      currentStreak: 7,
      graceBanked: 0,
      lastCreditDay: '2026-06-05',
    };
    const res = projectStreak(s, '2026-06-07');
    expect(res.status).toBe('lapsed');
    expect(res.display).toBe(0);
  });
});

describe('streakEngine: qualifiesForFreePass (F1-F2)', () => {
  it('F1: 3 consecutive days with short sessions qualifies for free pass', () => {
    const days = new Set(['2026-06-03', '2026-06-02', '2026-06-01']);
    expect(qualifiesForFreePass(days, '2026-06-03')).toBe(true);
  });

  it('F2: gap in 3 days does not qualify for free pass', () => {
    const days = new Set(['2026-06-03', '2026-06-01', '2026-05-31']);
    expect(qualifiesForFreePass(days, '2026-06-03')).toBe(false);
  });
});
