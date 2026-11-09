/**
 * Local Notification Planner
 * Master Plan Part 2 §3.6
 * Computes the exact single pending daily rest notification.
 * Pure function: deterministic, quiet-hour clamped, Doze tolerant.
 */

import { DEFAULT_REMINDER_MIN, QUIET_END_MIN, QUIET_START_MIN, WIND_DOWN_MIN } from './constants';
import { defaultProtocol } from './timeOfDay';

export interface PlannerInput {
  now: number;
  enabled: boolean;
  reminderMin: number | null; // User-chosen minutes since midnight [0..1439]
  medianCommitMin: number | null; // Median start minute of last 14 days (>= 3 sessions)
  creditedToday: boolean;
  sleepSessionsLast7d: number;
  daysSinceLastOpen: number;
  lapsedSentCount: number; // 0..2
  currentStreak?: number;
  isHeldByGrace?: boolean;
}

export interface PlannedNotification {
  fireAtMs: number;
  kind: 'daily' | 'wind_down' | 'lapsed';
  title: string;
  body: string;
  deepLink: string;
}

/**
 * Plans the next single gentle reminder.
 * Returns null if notifications are disabled or capped (e.g. after 2 lapsed nudges).
 */
export function planNextNotification(i: PlannerInput): PlannedNotification | null {
  // 1. Disabled check
  if (!i.enabled) return null;

  const nowDate = new Date(i.now);

  // 2. Lapsed re-engagement (daysSinceLastOpen >= 3)
  if (i.daysSinceLastOpen >= 3) {
    if (i.lapsedSentCount >= 2) {
      // Respect silence after 2 unengaged notifications until app is opened
      return null;
    }

    // Schedule for 11:00 AM local on the designated lapsed day (3 or 7)
    const targetDayOffset = i.lapsedSentCount === 0 ? 3 : 7;
    const targetDate = new Date(i.now);
    targetDate.setDate(targetDate.getDate() + Math.max(0, targetDayOffset - i.daysSinceLastOpen));
    targetDate.setHours(11, 0, 0, 0);

    let fireAt = targetDate.getTime();
    if (fireAt <= i.now) {
      // If already past 11:00 today, push to tomorrow 11:00
      targetDate.setDate(targetDate.getDate() + 1);
      fireAt = targetDate.getTime();
    }

    const body =
      i.lapsedSentCount === 0
        ? 'No pressure. Five minutes is here when you need it.'
        : "Whenever you're ready, we're here.";

    return {
      fireAtMs: fireAt,
      kind: 'lapsed',
      title: 'Ember',
      body,
      deepLink: 'ember://begin?protocol=rapid_reset_5',
    };
  }

  // 3. Determine preferred minute P
  let p = DEFAULT_REMINDER_MIN;
  let kind: 'daily' | 'wind_down' = 'daily';

  if (i.sleepSessionsLast7d >= 2) {
    p = WIND_DOWN_MIN;
    kind = 'wind_down';
  } else if (i.reminderMin !== null) {
    p = i.reminderMin;
  } else if (i.medianCommitMin !== null) {
    // Round to nearest 15 minutes and clamp to [08:00, 21:30]
    const rounded = Math.round(i.medianCommitMin / 15) * 15;
    p = Math.min(Math.max(rounded, 8 * 60), WIND_DOWN_MIN);
  }

  // 4. Calculate target fire time T
  const todayMidnight = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();
  let targetMs = todayMidnight + p * 60_000;

  // If already past (T - 5 min) or already practiced today, schedule for tomorrow
  if (i.now >= targetMs - 5 * 60_000 || i.creditedToday) {
    targetMs += 86_400_000;
  }

  // 5. Quiet-hour clamping (22:30 - 07:30)
  const targetDate = new Date(targetMs);
  const targetMinOfDay = targetDate.getHours() * 60 + targetDate.getMinutes();

  if (targetMinOfDay >= QUIET_START_MIN || targetMinOfDay < QUIET_END_MIN) {
    // Clamp to 07:30 of the following morning
    if (targetMinOfDay >= QUIET_START_MIN) {
      // Was late evening: move to next morning 07:30
      targetDate.setDate(targetDate.getDate() + 1);
    }
    targetDate.setHours(7, 30, 0, 0);
    targetMs = targetDate.getTime();
  }

  // 6. Build copy
  let title = 'Ember';
  let body = 'A five-minute reset is ready when you are.';
  let deepLink = 'ember://begin?protocol=rapid_reset_5';

  if (kind === 'wind_down') {
    title = 'Ember';
    body = 'Winding down? Deep Rest is ready.';
    deepLink = 'ember://begin?protocol=deep_rest_30';
  } else {
    // Daily copy
    const streak = i.currentStreak ?? 0;
    if (streak >= 3 && !i.isHeldByGrace) {
      if (streak + 1 === 7) {
        body = 'Day 7 is one quiet session away. 1 week of rest ahead.';
      } else if (streak + 1 === 14) {
        body = 'Day 14 is one quiet session away. 2 weeks of rest ahead.';
      } else if (streak + 1 === 30) {
        body = 'Day 30 is one quiet session away. 1 month of rest ahead.';
      } else if (streak + 1 === 100) {
        body = 'Day 100 is one quiet session away. 100 days of rest ahead.';
      } else {
        body = `Day ${streak + 1} is one quiet session away.`;
      }
    } else if (p >= 13 * 60 && p < 20 * 60) {
      body = 'The afternoon dip is here. Ten minutes?';
    } else {
      body = 'A five-minute reset is ready when you are.';
    }

    const suggested = defaultProtocol(new Date(targetMs));
    deepLink = `ember://begin?protocol=${suggested}`;
  }

  return {
    fireAtMs: targetMs,
    kind,
    title,
    body,
    deepLink,
  };
}
