/**
 * Ember Domain Constants
 * Master Plan Part 2 §3.2 — Single Source of Truth
 * Pure domain definitions: zero React, React Native, Expo, or SQLite imports.
 */

export const PROTOCOL_IDS = ['rapid_reset_5', 'afternoon_recharge_10', 'deep_rest_30'] as const;

export type ProtocolId = (typeof PROTOCOL_IDS)[number];

export const PLANNED_MS: Record<ProtocolId, number> = {
  rapid_reset_5: 300_000,
  afternoon_recharge_10: 600_000,
  deep_rest_30: 1_800_000,
};

// Commit (streak-credit) thresholds as a fraction of planned duration
export const COMMIT_THRESHOLD = {
  focus: 0.9,
  sleep: 0.85,
} as const;

export const PARTIAL_MIN_LISTENED_MS = 120_000; // below this an early exit is 'abandoned'

// Grace ("Rest Grace")
export const GRACE_EVERY_N_DAYS = 5;
export const GRACE_MAX_BANKED = 2;

// Free pass ("3-Day Streak Taste")
export const FREE_PASS_STREAK_DAYS = 3;
export const FREE_PASS_VALID_DAYS = 14;
export const FREE_PASS_CONSUME_AT = 0.2; // fraction of the 30-min session
export const FREE_PASS_MAX_LIFETIME = 1;

// Sleep mode
export const SLEEP_FADE_MS = 90_000;
export const SLEEP_RECONCILE_MIN_PROGRESS = 0.5; // heartbeat must have shown >= 50% progress
export const MORNING_CHECKIN_WINDOW_MS = 10 * 3_600_000;

// Insights
export const CALM_DELTA_MIN_SAMPLES = 5;

// Notifications (minutes from local midnight)
export const QUIET_START_MIN = 22 * 60 + 30; // 22:30 (1350 min)
export const QUIET_END_MIN = 7 * 60 + 30; // 07:30 (450 min)
export const DEFAULT_REMINDER_MIN = 14 * 60 + 15; // 14:15 (afternoon dip, 855 min)
export const WIND_DOWN_MIN = 21 * 60 + 30; // 21:30 (1290 min)
export const LAPSED_NUDGE_AFTER_DAYS = [3, 7] as const; // then silence

// Perceived state scale used by check-ins (self-reported, non-clinical)
export const STATE = {
  WIRED: 1,
  DRAINED: 2,
  NEUTRAL: 3,
  CALM: 4,
  RESTORED: 5,
} as const;

export type PerceivedState = (typeof STATE)[keyof typeof STATE];
