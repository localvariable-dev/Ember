/**
 * Streak Repository
 * Master Plan Part 4 §5.3, Part 2 §3.3
 * SQLite persistence for the single-row streak_state table.
 */

import type { DayKey } from '../../domain/dayKey';
import { INITIAL_STREAK, type StreakState } from '../../domain/streakEngine';
import type { Db } from '../db';

interface RawStreakRow {
  id: number;
  current_streak: number;
  longest_streak: number;
  last_credit_day: string | null;
  grace_banked: number;
  grace_progress: number;
  grace_earned_total: number;
  grace_used_total: number;
  updated_at_ms: number;
}

export class StreakRepo {
  constructor(private db: Db) {}

  get(): StreakState {
    const row = this.db.first<RawStreakRow>('SELECT * FROM streak_state WHERE id = 1;');
    if (!row) {
      return INITIAL_STREAK;
    }
    return {
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      lastCreditDay: row.last_credit_day as DayKey | null,
      graceBanked: row.grace_banked,
      graceProgress: row.grace_progress,
      graceEarnedTotal: row.grace_earned_total,
      graceUsedTotal: row.grace_used_total,
    };
  }

  save(state: StreakState, nowMs = Date.now()): void {
    const res = this.db.run(
      `
      UPDATE streak_state SET
        current_streak = ?,
        longest_streak = ?,
        last_credit_day = ?,
        grace_banked = ?,
        grace_progress = ?,
        grace_earned_total = ?,
        grace_used_total = ?,
        updated_at_ms = ?
      WHERE id = 1;
      `,
      [
        state.currentStreak,
        state.longestStreak,
        state.lastCreditDay,
        state.graceBanked,
        state.graceProgress,
        state.graceEarnedTotal,
        state.graceUsedTotal,
        nowMs,
      ],
    );

    if (res.changes === 0) {
      this.db.run(
        `
        INSERT INTO streak_state (
          id, current_streak, longest_streak, last_credit_day,
          grace_banked, grace_progress, grace_earned_total, grace_used_total, updated_at_ms
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          state.currentStreak,
          state.longestStreak,
          state.lastCreditDay,
          state.graceBanked,
          state.graceProgress,
          state.graceEarnedTotal,
          state.graceUsedTotal,
          nowMs,
        ],
      );
    }
  }
}
