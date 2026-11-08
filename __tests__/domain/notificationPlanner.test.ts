/**
 * Notification Planner Unit Tests
 * Master Plan Part 2 §3.6
 */

import { planNextNotification, type PlannerInput } from '../../src/domain/notificationPlanner';

describe('notificationPlanner: planNextNotification', () => {
  const baseDate = new Date(2026, 5, 15, 10, 0, 0); // 10:00 AM local
  const baseNow = baseDate.getTime();

  it('returns null when notifications are disabled', () => {
    const input: PlannerInput = {
      now: baseNow,
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

  it('schedules for today afternoon dip (14:15 default) when practicing in morning and uncredited', () => {
    const input: PlannerInput = {
      now: baseNow, // 10:00 AM
      enabled: true,
      reminderMin: null,
      medianCommitMin: null,
      creditedToday: false,
      sleepSessionsLast7d: 0,
      daysSinceLastOpen: 0,
      lapsedSentCount: 0,
    };

    const planned = planNextNotification(input);
    expect(planned).not.toBeNull();
    expect(planned?.kind).toBe('daily');
    expect(planned?.body).toBe('The afternoon dip is here. Ten minutes?');

    const fireDate = new Date(planned!.fireAtMs);
    expect(fireDate.getDate()).toBe(15);
    expect(fireDate.getHours()).toBe(14);
    expect(fireDate.getMinutes()).toBe(15);
  });

  it('schedules for tomorrow when already credited today', () => {
    const input: PlannerInput = {
      now: baseNow, // 10:00 AM
      enabled: true,
      reminderMin: null,
      medianCommitMin: null,
      creditedToday: true,
      sleepSessionsLast7d: 0,
      daysSinceLastOpen: 0,
      lapsedSentCount: 0,
    };

    const planned = planNextNotification(input);
    expect(planned).not.toBeNull();

    const fireDate = new Date(planned!.fireAtMs);
    expect(fireDate.getDate()).toBe(16); // Tomorrow
    expect(fireDate.getHours()).toBe(14);
    expect(fireDate.getMinutes()).toBe(15);
  });

  it('clamps reminders falling into quiet hours (22:30–07:30) to 07:30 next morning', () => {
    const input: PlannerInput = {
      now: baseNow,
      enabled: true,
      reminderMin: 23 * 60, // 23:00 (inside quiet hours)
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
  });

  it('schedules wind_down at 21:30 when user has >= 2 sleep sessions in last 7 days', () => {
    const input: PlannerInput = {
      now: baseNow,
      enabled: true,
      reminderMin: null,
      medianCommitMin: null,
      creditedToday: false,
      sleepSessionsLast7d: 2,
      daysSinceLastOpen: 0,
      lapsedSentCount: 0,
    };

    const planned = planNextNotification(input);
    expect(planned).not.toBeNull();
    expect(planned?.kind).toBe('wind_down');
    expect(planned?.body).toBe('Winding down? Deep Rest is ready.');
    expect(planned?.deepLink).toBe('ember://begin?protocol=deep_rest_30');

    const fireDate = new Date(planned!.fireAtMs);
    expect(fireDate.getHours()).toBe(21);
    expect(fireDate.getMinutes()).toBe(30);
  });

  it('handles lapsed user re-engagement at day 3 and day 7 at 11:00 AM, then silences', () => {
    // Lapsed 1: 3 days since last open
    const input1: PlannerInput = {
      now: baseNow,
      enabled: true,
      reminderMin: null,
      medianCommitMin: null,
      creditedToday: false,
      sleepSessionsLast7d: 0,
      daysSinceLastOpen: 3,
      lapsedSentCount: 0,
    };

    const planned1 = planNextNotification(input1);
    expect(planned1?.kind).toBe('lapsed');
    expect(planned1?.body).toBe('No pressure. Five minutes is here when you need it.');

    // Lapsed 2: 7 days since last open, count 1
    const input2: PlannerInput = {
      ...input1,
      daysSinceLastOpen: 7,
      lapsedSentCount: 1,
    };

    const planned2 = planNextNotification(input2);
    expect(planned2?.kind).toBe('lapsed');
    expect(planned2?.body).toBe("Whenever you're ready, we're here.");

    // Lapsed 3: count 2 -> silenced until app opened
    const input3: PlannerInput = {
      ...input1,
      daysSinceLastOpen: 10,
      lapsedSentCount: 2,
    };

    expect(planNextNotification(input3)).toBeNull();
  });

  it('does not mention streak if streak is held by grace', () => {
    const input: PlannerInput = {
      now: baseNow,
      enabled: true,
      reminderMin: null,
      medianCommitMin: null,
      creditedToday: false,
      sleepSessionsLast7d: 0,
      daysSinceLastOpen: 0,
      lapsedSentCount: 0,
      currentStreak: 5,
      isHeldByGrace: true,
    };

    const planned = planNextNotification(input);
    expect(planned?.body).not.toContain('Day 6');
    expect(planned?.body).toBe('The afternoon dip is here. Ten minutes?');
  });

  it('celebrates upcoming streak day when streak >= 3 and not held by grace', () => {
    const input: PlannerInput = {
      now: baseNow,
      enabled: true,
      reminderMin: null,
      medianCommitMin: null,
      creditedToday: false,
      sleepSessionsLast7d: 0,
      daysSinceLastOpen: 0,
      lapsedSentCount: 0,
      currentStreak: 4,
      isHeldByGrace: false,
    };

    const planned = planNextNotification(input);
    expect(planned?.body).toBe('Day 5 is one quiet session away.');
  });
});
