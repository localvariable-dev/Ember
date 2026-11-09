import {
  getEncouragingMessage,
  getPersonalProgressInsight,
  getNextSessionSuggestion,
  type MotivationContext,
} from '../../src/domain/motivation';

describe('Motivation & Encouragement Engine', () => {
  describe('Encouraging Messages Rotation and Context', () => {
    it('returns thoughtful copy for first-time practitioners', () => {
      const ctx: MotivationContext = {
        totalCompletedSessions: 1,
        sessionsToday: 1,
        currentStreak: 1,
        longestStreak: 1,
        isFirstSessionEver: true,
        isDailyGoalJustCompleted: true,
        isReturningFromGap: false,
        streakMilestone: null,
      };
      const msg = getEncouragingMessage(ctx, 0);
      expect(msg).toBe('You made space for yourself today.');
    });

    it('returns milestone-specific copy when landing on a milestone', () => {
      const ctx: MotivationContext = {
        totalCompletedSessions: 7,
        sessionsToday: 1,
        currentStreak: 7,
        longestStreak: 7,
        isFirstSessionEver: false,
        isDailyGoalJustCompleted: true,
        isReturningFromGap: false,
        streakMilestone: 7,
      };
      const msg = getEncouragingMessage(ctx, 0);
      expect(msg).toMatch(/week/i);
    });

    it('returns gentle, welcoming copy when returning from a gap without guilt or shaming', () => {
      const ctx: MotivationContext = {
        totalCompletedSessions: 10,
        sessionsToday: 1,
        currentStreak: 1,
        longestStreak: 8,
        isFirstSessionEver: false,
        isDailyGoalJustCompleted: true,
        isReturningFromGap: true,
        streakMilestone: null,
      };
      const msg = getEncouragingMessage(ctx, 0);
      expect(msg).toMatch(/welcome back|no rush|space made|quiet is never lost/i);
      // Ensure zero guilt or manipulative shaming
      expect(msg).not.toMatch(/shame|lost|missed out|penalty|hurry|warning|urgent/i);
    });

    it('returns goal-completed messages on regular single-session days', () => {
      const ctx: MotivationContext = {
        totalCompletedSessions: 4,
        sessionsToday: 1,
        currentStreak: 4,
        longestStreak: 4,
        isFirstSessionEver: false,
        isDailyGoalJustCompleted: true,
        isReturningFromGap: false,
        streakMilestone: null,
      };
      const msg = getEncouragingMessage(ctx, 0);
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toMatch(/streak broken|danger|expires/i);
    });
  });

  describe('Personal Progress Insights', () => {
    it('returns null if fewer than 2 sessions to avoid fabricating insights', () => {
      expect(
        getPersonalProgressInsight({
          totalSessions: 1,
          totalCommittedMs: 300_000,
        }),
      ).toBeNull();
    });

    it('includes perceived calm delta if available and positive', () => {
      const insight = getPersonalProgressInsight({
        totalSessions: 5,
        totalCommittedMs: 1_500_000, // 25 min
        averageCalmDelta: 1.8,
      });
      expect(insight).toContain('25m');
      expect(insight).toContain('5 sessions');
      expect(insight).toContain('+1.8');
    });

    it('formats hours accurately when committed time exceeds 60 minutes', () => {
      const insight = getPersonalProgressInsight({
        totalSessions: 8,
        totalCommittedMs: 7_200_000, // 120 min = 2.0 hours
      });
      expect(insight).toContain('2.0 hours');
      expect(insight).toContain('8 sessions');
    });
  });

  describe('Next Session Suggestions', () => {
    it('suggests Deep Rest for sleep during evening or after deep rest', () => {
      const suggestion = getNextSessionSuggestion('deep_rest_30', null, 21);
      expect(suggestion).toMatch(/rest well tonight/i);
    });

    it('suggests Afternoon Recharge during morning hours', () => {
      const suggestion = getNextSessionSuggestion('rapid_reset_5', null, 9);
      expect(suggestion).toMatch(/afternoon recharge/i);
    });

    it('suggests evening wind-down during afternoon hours', () => {
      const suggestion = getNextSessionSuggestion('afternoon_recharge_10', null, 14);
      expect(suggestion).toMatch(/deep rest for sleep/i);
    });
  });
});
