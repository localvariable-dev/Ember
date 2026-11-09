/**
 * Ember Motivation & Encouragement Engine
 * Master Plan Habit Formation Specification
 *
 * Provides calm, elegant, rotating restorative encouragement grounded in real user activity.
 * Strict rules:
 * - Zero guilt, zero shaming, zero urgency, zero manipulative retention mechanics.
 * - Rest is an act of care, not an obligation or chore.
 * - Zero fabricated health claims or unsupported statistics.
 */

import type { ProtocolId } from './constants';
import type { RecoveryState } from '../data/types';
import type { StreakMilestone } from './dailyGoal';

export interface MotivationContext {
  totalCompletedSessions: number; // lifetime sessions
  sessionsToday: number; // sessions committed today
  currentStreak: number;
  longestStreak: number;
  isFirstSessionEver: boolean;
  isDailyGoalJustCompleted: boolean;
  isReturningFromGap: boolean; // returned after gap / rest grace
  streakMilestone: StreakMilestone | null;
  calmDelta?: number | null | undefined;
  protocolId?: ProtocolId | undefined;
}

export interface PersonalProgressStats {
  totalSessions: number;
  totalCommittedMs: number;
  averageCalmDelta?: number | null | undefined;
  graceDaysBanked?: number | undefined;
}

const FIRST_SESSION_MESSAGES = [
  'You made space for yourself today.',
  'A first step into intentional rest.',
  'Your sanctuary is always open.',
];

const DAILY_GOAL_MET_MESSAGES = [
  'Today’s rest goal is complete.',
  'Another moment of rest, intentionally chosen.',
  'Consistency begins with showing up.',
  'You honored your need to slow down.',
  'Space protected for quiet recovery.',
];

const MILESTONE_MESSAGES: Record<StreakMilestone, string[]> = {
  3: ['Three days in. Your rest practice is becoming a habit.', 'A quiet momentum is taking root.'],
  7: [
    'One full week of showing up for yourself.',
    'Seven days of intentional calm. A steady rhythm.',
  ],
  14: [
    'Two weeks of honoring your nervous system.',
    'Fourteen days of calm, chosen one session at a time.',
  ],
  30: [
    'One month of dedicated restoration.',
    'Thirty days of protected stillness. A true practice.',
  ],
  100: ['One hundred days of mindful recovery.', 'A quiet, profound journey of rest.'],
};

const RETURNING_MESSAGES = [
  'Welcome back. Rest is always waiting when you are ready.',
  'No rush, no catching up. Begin right here.',
  'Space made for yourself today.',
  'Quiet is never lost, only paused.',
];

const REGULAR_REST_MESSAGES = [
  'Another moment of rest, intentionally chosen.',
  'You made space for yourself today.',
  'A calm pause in the flow of the day.',
  'Your nervous system thanks you for this stillness.',
  'Rest is an essential rhythm, not a reward.',
];

/**
 * Deterministically picks a message from an array using a numeric seed (e.g. session count or day key).
 */
function pickWithSeed<T>(items: readonly T[], seed: number): T {
  const index = Math.abs(seed) % items.length;
  return items[index]!;
}

/**
 * Returns a calm, encouraging message tailored to the user's authentic rest context.
 */
export function getEncouragingMessage(ctx: MotivationContext, seed: number = Date.now()): string {
  // 1. First session ever
  if (ctx.isFirstSessionEver || ctx.totalCompletedSessions <= 1) {
    return pickWithSeed(FIRST_SESSION_MESSAGES, seed);
  }

  // 2. Streak milestone achieved
  if (ctx.streakMilestone && MILESTONE_MESSAGES[ctx.streakMilestone]) {
    return pickWithSeed(MILESTONE_MESSAGES[ctx.streakMilestone], seed);
  }

  // 3. Returning after a break / grace recovery
  if (ctx.isReturningFromGap) {
    return pickWithSeed(RETURNING_MESSAGES, seed);
  }

  // 4. First session of the day completing daily goal
  if (ctx.isDailyGoalJustCompleted) {
    return pickWithSeed(DAILY_GOAL_MET_MESSAGES, seed);
  }

  // 5. Subsequent practice or regular rest
  return pickWithSeed(REGULAR_REST_MESSAGES, seed);
}

/**
 * Derives a factual, personal progress insight from actual user history.
 * Returns null if insufficient data exists (< 2 sessions) to avoid fabricating claims.
 */
export function getPersonalProgressInsight(stats: PersonalProgressStats): string | null {
  if (stats.totalSessions < 2 || stats.totalCommittedMs <= 0) {
    return null;
  }

  const totalMinutes = Math.round(stats.totalCommittedMs / 60_000);

  if (stats.averageCalmDelta != null && stats.averageCalmDelta > 0) {
    const roundedDelta = Math.round(stats.averageCalmDelta * 10) / 10;
    return `You've rested ${totalMinutes}m across ${stats.totalSessions} sessions, averaging +${roundedDelta} in perceived calm.`;
  }

  if (totalMinutes >= 60) {
    const hours = (totalMinutes / 60).toFixed(1);
    return `You've dedicated ${hours} hours to intentional stillness across ${stats.totalSessions} sessions.`;
  }

  return `You've dedicated ${totalMinutes} minutes to intentional rest across ${stats.totalSessions} sessions.`;
}

/**
 * Provides a gentle, non-pushy suggestion for the next rest ritual based on protocol and time.
 */
export function getNextSessionSuggestion(
  completedProtocolId: ProtocolId,
  postState?: RecoveryState | null,
  hourOfDay: number = new Date().getHours(),
): string {
  if (completedProtocolId === 'deep_rest_30' || hourOfDay >= 20 || hourOfDay < 5) {
    return 'Rest well tonight. Tomorrow awaits with a fresh reset.';
  }

  if (hourOfDay >= 12 && hourOfDay < 17) {
    return 'Tonight: Deep Rest for sleep when your day winds down.';
  }

  if (hourOfDay < 12) {
    return 'Later today: Afternoon Recharge when the energy dip arrives.';
  }

  return 'Tonight: Deep Rest is ready whenever you are ready to sleep.';
}
