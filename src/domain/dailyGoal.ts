/**
 * Ember Daily Goal & Streak Milestone Domain Engine
 * Master Plan Part 2 §3.3 & Habit Formation Specifications
 * Pure, deterministic business logic for daily rest goals and milestones.
 */

import type { DayLedgerRow } from '../data/types';
import type { StreakState } from './streakEngine';

export const DEFAULT_DAILY_GOAL_SESSIONS = 1;

export const STREAK_MILESTONES = [3, 7, 14, 30, 100] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

export interface MilestoneCelebration {
  milestone: StreakMilestone;
  title: string;
  subtitle: string;
  insight: string;
}

export const MILESTONE_DETAILS: Record<StreakMilestone, MilestoneCelebration> = {
  3: {
    milestone: 3,
    title: '3 Days of Rest',
    subtitle: 'Momentum is taking shape.',
    insight: 'Three consecutive days of rest. The mind begins to recognize the ritual of quiet.',
  },
  7: {
    milestone: 7,
    title: '1 Week of Rest',
    subtitle: 'A restorative rhythm.',
    insight: 'A full week of intentional pauses. Your nervous system thrives on predictability.',
  },
  14: {
    milestone: 14,
    title: '2 Weeks of Rest',
    subtitle: 'Practice takes root.',
    insight: 'Fourteen days of showing up for yourself. Rest is becoming an instinctive refuge.',
  },
  30: {
    milestone: 30,
    title: '1 Month of Rest',
    subtitle: 'A lasting habit.',
    insight:
      'Thirty days of protected recovery. Consistency has transformed into a steady sanctuary.',
  },
  100: {
    milestone: 100,
    title: '100 Days of Rest',
    subtitle: 'A quiet transformation.',
    insight: 'One hundred days of intentional space. A profound commitment to inner restoration.',
  },
};

export interface DailyGoalStatus {
  targetSessions: number;
  completedSessions: number;
  isGoalMet: boolean;
  isFirstSessionToday: boolean;
  streakMilestone: StreakMilestone | null;
  nextMilestone: StreakMilestone;
  daysToNextMilestone: number;
}

/**
 * Checks if a given streak count lands on a key milestone (3, 7, 14, 30, 100).
 */
export function getStreakMilestone(currentStreak: number): StreakMilestone | null {
  if ((STREAK_MILESTONES as readonly number[]).includes(currentStreak)) {
    return currentStreak as StreakMilestone;
  }
  return null;
}

/**
 * Calculates the next upcoming milestone and how many days remain to achieve it.
 */
export function getNextStreakMilestone(currentStreak: number): {
  nextMilestone: StreakMilestone;
  daysRemaining: number;
} {
  for (const m of STREAK_MILESTONES) {
    if (currentStreak < m) {
      return {
        nextMilestone: m,
        daysRemaining: m - currentStreak,
      };
    }
  }
  // Beyond 100 days: next horizon is 100
  return {
    nextMilestone: 100,
    daysRemaining: 0,
  };
}

/**
 * Returns celebration details for a milestone, if applicable.
 */
export function getMilestoneCelebration(streak: number): MilestoneCelebration | null {
  const milestone = getStreakMilestone(streak);
  if (!milestone) return null;
  return MILESTONE_DETAILS[milestone];
}

/**
 * Evaluates current daily goal progress from the day ledger and streak state.
 *
 * @param todayLedger - Row from day_ledger for today, or null if no activity yet
 * @param streak - Current streak state
 * @param sessionJustCommitted - Set true when evaluating immediately after a session completes
 */
export function evaluateDailyGoal(
  todayLedger: DayLedgerRow | null,
  streak: StreakState,
  sessionJustCommitted: boolean = false,
): DailyGoalStatus {
  const completedSessions = todayLedger ? todayLedger.sessions : 0;
  const isGoalMet = completedSessions >= DEFAULT_DAILY_GOAL_SESSIONS;
  const isFirstSessionToday = sessionJustCommitted && completedSessions === 1;

  const currentStreak = streak.currentStreak;
  const milestone = getStreakMilestone(currentStreak);
  const nextInfo = getNextStreakMilestone(currentStreak);

  return {
    targetSessions: DEFAULT_DAILY_GOAL_SESSIONS,
    completedSessions,
    isGoalMet,
    isFirstSessionToday,
    streakMilestone: milestone,
    nextMilestone: nextInfo.nextMilestone,
    daysToNextMilestone: nextInfo.daysRemaining,
  };
}
