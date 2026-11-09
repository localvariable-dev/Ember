import {
  evaluateDailyGoal,
  getNextStreakMilestone,
  getStreakMilestone,
  getMilestoneCelebration,
  STREAK_MILESTONES,
} from '../../src/domain/dailyGoal';
import { INITIAL_STREAK, type StreakState } from '../../src/domain/streakEngine';
import type { DayLedgerRow } from '../../src/data/types';

describe('Daily Goal & Streak Milestone Engine', () => {
  describe('Streak Milestone Identification', () => {
    it('accurately identifies configured milestones (3, 7, 14, 30, 100)', () => {
      for (const m of STREAK_MILESTONES) {
        expect(getStreakMilestone(m)).toBe(m);
        const details = getMilestoneCelebration(m);
        expect(details).not.toBeNull();
        expect(details?.milestone).toBe(m);
        expect(details?.title.length).toBeGreaterThan(0);
        expect(details?.insight.length).toBeGreaterThan(0);
      }
    });

    it('returns null for non-milestone days', () => {
      expect(getStreakMilestone(1)).toBeNull();
      expect(getStreakMilestone(2)).toBeNull();
      expect(getStreakMilestone(4)).toBeNull();
      expect(getStreakMilestone(15)).toBeNull();
      expect(getStreakMilestone(99)).toBeNull();
    });

    it('calculates the next upcoming milestone and days remaining', () => {
      expect(getNextStreakMilestone(0)).toEqual({ nextMilestone: 3, daysRemaining: 3 });
      expect(getNextStreakMilestone(1)).toEqual({ nextMilestone: 3, daysRemaining: 2 });
      expect(getNextStreakMilestone(3)).toEqual({ nextMilestone: 7, daysRemaining: 4 });
      expect(getNextStreakMilestone(7)).toEqual({ nextMilestone: 14, daysRemaining: 7 });
      expect(getNextStreakMilestone(14)).toEqual({ nextMilestone: 30, daysRemaining: 16 });
      expect(getNextStreakMilestone(30)).toEqual({ nextMilestone: 100, daysRemaining: 70 });
      expect(getNextStreakMilestone(100)).toEqual({ nextMilestone: 100, daysRemaining: 0 });
    });
  });

  describe('Daily Goal Evaluation', () => {
    const baseStreak: StreakState = {
      ...INITIAL_STREAK,
      currentStreak: 1,
      longestStreak: 1,
    };

    it('reports goal not met when no sessions completed today', () => {
      const status = evaluateDailyGoal(null, baseStreak);
      expect(status.targetSessions).toBe(1);
      expect(status.completedSessions).toBe(0);
      expect(status.isGoalMet).toBe(false);
      expect(status.isFirstSessionToday).toBe(false);
    });

    it('reports goal met when 1 session completed today', () => {
      const row: DayLedgerRow = {
        localDay: '2026-11-09',
        kind: 'practice',
        committedMs: 300_000,
        sessions: 1,
      };
      const status = evaluateDailyGoal(row, baseStreak, true);
      expect(status.targetSessions).toBe(1);
      expect(status.completedSessions).toBe(1);
      expect(status.isGoalMet).toBe(true);
      expect(status.isFirstSessionToday).toBe(true);
    });

    it('distinguishes first committed session from subsequent sessions on the same day', () => {
      const rowMulti: DayLedgerRow = {
        localDay: '2026-11-09',
        kind: 'practice',
        committedMs: 900_000,
        sessions: 2,
      };
      const status = evaluateDailyGoal(rowMulti, baseStreak, true);
      expect(status.completedSessions).toBe(2);
      expect(status.isGoalMet).toBe(true);
      expect(status.isFirstSessionToday).toBe(false);
    });

    it('detects milestone achievement in daily goal evaluation', () => {
      const streakAtSeven: StreakState = {
        ...INITIAL_STREAK,
        currentStreak: 7,
        longestStreak: 7,
      };
      const row: DayLedgerRow = {
        localDay: '2026-11-09',
        kind: 'practice',
        committedMs: 600_000,
        sessions: 1,
      };
      const status = evaluateDailyGoal(row, streakAtSeven, true);
      expect(status.streakMilestone).toBe(7);
      expect(status.nextMilestone).toBe(14);
      expect(status.daysToNextMilestone).toBe(7);
    });
  });
});
