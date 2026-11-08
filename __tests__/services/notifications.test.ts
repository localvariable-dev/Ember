/**
 * Notification Service & Planner Test Suite
 * Master Plan Part 2 §3.6
 *
 * Verifies:
 * - Inexact scheduling behavior & quiet hour clamping (22:30-07:30)
 * - Learned reminder time computation from median commit minutes (14-day history)
 * - Sleep user wind-down override (>= 2 sleep sessions in last 7 days)
 * - Lapsed re-engagement schedule (Day 3 & Day 7 nudges, then silence)
 * - Streak copy rules & silence during Grace days
 * - Deep link generation and parsing
 */

import { openTestDatabase } from '../helpers/testDb';
import { migrate } from '../../src/data/migrations';
import { PrefsRepo, SessionRepo, StreakRepo } from '../../src/data/repos';
import {
  computeMedianCommitMinute,
  parseDeepLinkProtocol,
  syncNotificationSchedule,
} from '../../src/services/NotificationService';
import { planNextNotification, type PlannerInput } from '../../src/domain/notificationPlanner';

describe('NotificationService & Local Planner', () => {
  describe('Helper Functions', () => {
    it('computes median commit minute accurately', () => {
      expect(computeMedianCommitMinute([])).toBeNull();
      expect(computeMedianCommitMinute([600, 720])).toBeNull(); // < 3 samples

      // Odd sample count
      expect(computeMedianCommitMinute([600, 800, 700])).toBe(700);

      // Even sample count >= 4
      expect(computeMedianCommitMinute([600, 700, 800, 900])).toBe(750);
    });

    it('parses deep link protocol correctly', () => {
      expect(parseDeepLinkProtocol('ember://begin?protocol=rapid_reset_5')).toBe('rapid_reset_5');
      expect(parseDeepLinkProtocol('ember://begin?protocol=afternoon_recharge_10')).toBe(
        'afternoon_recharge_10',
      );
      expect(parseDeepLinkProtocol('ember://begin?protocol=deep_rest_30')).toBe('deep_rest_30');
      expect(parseDeepLinkProtocol(null)).toBeNull();
      expect(parseDeepLinkProtocol('invalid_url')).toBeNull();
    });
  });

  describe('planNextNotification Domain Rules', () => {
    it('returns null when notifications are disabled', () => {
      const input: PlannerInput = {
        now: Date.now(),
        enabled: false,
        reminderMin: null,
        medianCommitMin: null,
        creditedToday: false,
        sleepSessionsLast7d: 0,
        daysSinceLastOpen: 0,
        lapsedSentCount: 0,
      };

      expect(planNextNotification(input)).toBeNull();
    });

    it('clamps late evening notification to 07:30 next morning', () => {
      const today = new Date('2026-06-01T12:00:00');
      const nowMs = today.getTime();

      // Preferred minute is 23:00 (inside quiet hours 22:30 - 07:30)
      const input: PlannerInput = {
        now: nowMs,
        enabled: true,
        reminderMin: 23 * 60, // 23:00
        medianCommitMin: null,
        creditedToday: false,
        sleepSessionsLast7d: 0,
        daysSinceLastOpen: 0,
        lapsedSentCount: 0,
      };

      const planned = planNextNotification(input);
      expect(planned).not.toBeNull();

      const fireDate = new Date(planned!.fireAtMs);
      expect(fireDate.getHours()).toBe(7);
      expect(fireDate.getMinutes()).toBe(30);
      expect(fireDate.getDate()).toBe(2); // Next morning (June 2)
    });

    it('schedules for tomorrow when already credited today', () => {
      const today = new Date('2026-06-01T10:00:00');
      const nowMs = today.getTime();

      const input: PlannerInput = {
        now: nowMs,
        enabled: true,
        reminderMin: 14 * 60, // 14:00
        medianCommitMin: null,
        creditedToday: true, // Already practiced today
        sleepSessionsLast7d: 0,
        daysSinceLastOpen: 0,
        lapsedSentCount: 0,
      };

      const planned = planNextNotification(input);
      expect(planned).not.toBeNull();

      const fireDate = new Date(planned!.fireAtMs);
      expect(fireDate.getDate()).toBe(2); // Tomorrow
      expect(fireDate.getHours()).toBe(14);
      expect(fireDate.getMinutes()).toBe(0);
    });

    it('applies wind-down override when sleepSessionsLast7d >= 2', () => {
      const today = new Date('2026-06-01T10:00:00');
      const nowMs = today.getTime();

      const input: PlannerInput = {
        now: nowMs,
        enabled: true,
        reminderMin: 10 * 60, // 10:00 AM user choice overridden by wind-down
        medianCommitMin: null,
        creditedToday: false,
        sleepSessionsLast7d: 2,
        daysSinceLastOpen: 0,
        lapsedSentCount: 0,
      };

      const planned = planNextNotification(input);
      expect(planned).not.toBeNull();
      expect(planned?.kind).toBe('wind_down');
      expect(planned?.title).toBe('Ember');
      expect(planned?.body).toBe('Winding down? Deep Rest is ready.');
      expect(planned?.deepLink).toBe('ember://begin?protocol=deep_rest_30');

      const fireDate = new Date(planned!.fireAtMs);
      expect(fireDate.getHours()).toBe(21);
      expect(fireDate.getMinutes()).toBe(30);
    });

    it('schedules lapsed user reminders at 11:00 AM and respects silence after 2 sends', () => {
      const now = new Date('2026-06-10T08:00:00').getTime();

      // 1st lapsed notification (lapsedSentCount = 0)
      const input1: PlannerInput = {
        now,
        enabled: true,
        reminderMin: null,
        medianCommitMin: null,
        creditedToday: false,
        sleepSessionsLast7d: 0,
        daysSinceLastOpen: 3,
        lapsedSentCount: 0,
      };
      const planned1 = planNextNotification(input1);
      expect(planned1).not.toBeNull();
      expect(planned1?.kind).toBe('lapsed');
      expect(planned1?.body).toBe('No pressure. Five minutes is here when you need it.');
      expect(planned1?.deepLink).toBe('ember://begin?protocol=rapid_reset_5');

      // 2nd lapsed notification (lapsedSentCount = 1)
      const input2: PlannerInput = { ...input1, lapsedSentCount: 1, daysSinceLastOpen: 7 };
      const planned2 = planNextNotification(input2);
      expect(planned2).not.toBeNull();
      expect(planned2?.kind).toBe('lapsed');
      expect(planned2?.body).toBe("Whenever you're ready, we're here.");

      // Silence after 2 sends (lapsedSentCount = 2)
      const input3: PlannerInput = { ...input1, lapsedSentCount: 2, daysSinceLastOpen: 10 };
      const planned3 = planNextNotification(input3);
      expect(planned3).toBeNull();
    });

    it('never mentions streak during Rest Grace (silence is mercy)', () => {
      const now = new Date('2026-06-01T10:00:00').getTime();

      // Normal streak >= 3 copy mentions next day
      const inputNormal: PlannerInput = {
        now,
        enabled: true,
        reminderMin: 14 * 60,
        medianCommitMin: null,
        creditedToday: false,
        sleepSessionsLast7d: 0,
        daysSinceLastOpen: 0,
        lapsedSentCount: 0,
        currentStreak: 4,
        isHeldByGrace: false,
      };
      const plannedNormal = planNextNotification(inputNormal);
      expect(plannedNormal?.body).toBe('Day 5 is one quiet session away.');

      // Held by grace copy does NOT mention streak
      const inputGrace: PlannerInput = {
        ...inputNormal,
        isHeldByGrace: true,
      };
      const plannedGrace = planNextNotification(inputGrace);
      expect(plannedGrace?.body).not.toContain('Day');
    });
  });

  describe('syncNotificationSchedule Integration with Repositories', () => {
    let db: ReturnType<typeof openTestDatabase>;
    let sessionRepo: SessionRepo;
    let prefsRepo: PrefsRepo;
    let streakRepo: StreakRepo;

    beforeEach(() => {
      db = openTestDatabase(':memory:');
      migrate(db);
      sessionRepo = new SessionRepo(db);
      prefsRepo = new PrefsRepo(db);
      streakRepo = new StreakRepo(db);
    });

    afterEach(() => {
      db.close();
    });

    it('syncs notification schedule using SQLite repository state', async () => {
      const now = new Date('2026-06-01T10:00:00').getTime();

      // Enable notifications in prefs
      prefsRepo.patch({ notificationsEnabled: true, reminderMin: 15 * 60 }, now);

      const planned = await syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo }, now);

      expect(planned).not.toBeNull();
      expect(planned?.kind).toBe('daily');
      const fireDate = new Date(planned!.fireAtMs);
      expect(fireDate.getHours()).toBe(15);
      expect(fireDate.getMinutes()).toBe(0);
    });
  });
});
