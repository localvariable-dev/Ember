/**
 * Ember Streak & Grace Engine
 * Master Plan Part 2 §3.3
 * Pure, deterministic retention mathematics with zero I/O.
 */

import { GRACE_EVERY_N_DAYS, GRACE_MAX_BANKED, FREE_PASS_STREAK_DAYS } from './constants';
import { addDays, daysBetween, type DayKey } from './dayKey';

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCreditDay: DayKey | null;
  graceBanked: number;
  graceProgress: number; // 0..5 (progress towards next Grace Day)
  graceEarnedTotal: number;
  graceUsedTotal: number;
}

export const INITIAL_STREAK: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastCreditDay: null,
  graceBanked: 0,
  graceProgress: 0,
  graceEarnedTotal: 0,
  graceUsedTotal: 0,
};

export interface CreditResult {
  next: StreakState;
  changed: boolean;
  coveredDays: DayKey[];
  graceEarned: number;
  reset: boolean;
}

/**
 * Applies daily practice credit to a streak state.
 * Executed exactly once per committed session.
 */
export function applyCredit(s: StreakState, today: DayKey): CreditResult {
  // Idempotent: same day or past day re-commit does not advance streak
  if (s.lastCreditDay !== null && daysBetween(s.lastCreditDay, today) <= 0) {
    return {
      next: s,
      changed: false,
      coveredDays: [],
      graceEarned: 0,
      reset: false,
    };
  }

  const n: StreakState = { ...s };
  const covered: DayKey[] = [];
  let reset = false;

  if (s.lastCreditDay === null) {
    // Day 1
    n.currentStreak = 1;
  } else {
    const missed = daysBetween(s.lastCreditDay, today) - 1;

    if (missed === 0) {
      // Consecutive practice day
      n.currentStreak = s.currentStreak + 1;
    } else if (missed <= s.graceBanked) {
      // Missed days covered by Rest Grace
      n.graceBanked -= missed;
      n.graceUsedTotal += missed;
      for (let i = 1; i <= missed; i++) {
        covered.push(addDays(s.lastCreditDay, i));
      }
      n.currentStreak = s.currentStreak + 1;
    } else {
      // Unforgiven gap: soft reset (streak resets, graceProgress resets, banked grace kept)
      n.currentStreak = 1;
      n.graceProgress = 0;
      reset = true;
    }
  }

  // Earn grace progress on practice days
  n.graceProgress += 1;
  let earned = 0;
  while (n.graceProgress >= GRACE_EVERY_N_DAYS && n.graceBanked < GRACE_MAX_BANKED) {
    n.graceBanked += 1;
    n.graceProgress -= GRACE_EVERY_N_DAYS;
    n.graceEarnedTotal += 1;
    earned += 1;
  }

  // Progress is held (not lost) while the bank is full
  if (n.graceProgress > GRACE_EVERY_N_DAYS) {
    n.graceProgress = GRACE_EVERY_N_DAYS;
  }

  n.longestStreak = Math.max(s.longestStreak, n.currentStreak);
  n.lastCreditDay = today;

  return {
    next: n,
    changed: true,
    coveredDays: covered,
    graceEarned: earned,
    reset,
  };
}

export type StreakStatus = 'fresh' | 'done_today' | 'open' | 'held_by_grace' | 'lapsed';

export interface ProjectedStreak {
  status: StreakStatus;
  display: number;
  graceWillCover: number;
}

/**
 * Projects streak status for display before practice occurs today.
 * Pure and non-mutating.
 */
export function projectStreak(s: StreakState, today: DayKey): ProjectedStreak {
  if (s.lastCreditDay === null) {
    return { status: 'fresh', display: 0, graceWillCover: 0 };
  }

  const gap = daysBetween(s.lastCreditDay, today);
  if (gap <= 0) {
    return { status: 'done_today', display: s.currentStreak, graceWillCover: 0 };
  }
  if (gap === 1) {
    return { status: 'open', display: s.currentStreak, graceWillCover: 0 };
  }

  const missed = gap - 1;
  if (missed <= s.graceBanked) {
    return {
      status: 'held_by_grace',
      display: s.currentStreak,
      graceWillCover: missed,
    };
  }

  return { status: 'lapsed', display: 0, graceWillCover: 0 };
}

/**
 * Evaluates whether the user qualifies for a Free Pass (3-day streak taste).
 * Requires 3 consecutive local days, each containing a committed short (5m or 10m) session.
 */
export function qualifiesForFreePass(
  daysWithShortSession: ReadonlySet<DayKey>,
  today: DayKey,
): boolean {
  for (let i = 0; i < FREE_PASS_STREAK_DAYS; i++) {
    if (!daysWithShortSession.has(addDays(today, -i))) {
      return false;
    }
  }
  return true;
}
