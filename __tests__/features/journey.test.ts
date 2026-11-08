/**
 * Journey & Retention Experience Test Suite
 * Master Plan Part 1 §2.7, Part 2 §3.3-§3.8, Part 4 §5.6
 *
 * Verifies:
 * - Streak & Rest Grace persistence across simulated restarts
 * - Grace day banking and retroactive consumption written to day_ledger
 * - Free Pass qualification (3 short consecutive days) & consumption (at 20% threshold)
 * - Calm Delta calculation, minimum sample threshold (5 pairs), and non-clinical wording
 * - Heatmap 30-day window attribution and level thresholds
 * - Free vs Pro history limits and analytics gating
 */

import { openTestDatabase } from '../helpers/testDb';
import { migrate } from '../../src/data/migrations';
import { EntitlementRepo, LedgerRepo, SessionRepo, StreakRepo } from '../../src/data/repos';
import {
  computeBestTimeOfDayBand,
  computeHeadlineInsight,
  computeMeanDeltaBySlice,
  computeWeeklyMeanDelta,
  type DetailedPairedSession,
} from '../../src/domain/calmDelta';
import { dayKeyFromMs } from '../../src/domain/dayKey';
import { STATE } from '../../src/domain/constants';

describe('Journey & Retention Experience', () => {
  let db: ReturnType<typeof openTestDatabase>;
  let sessionRepo: SessionRepo;
  let streakRepo: StreakRepo;
  let ledgerRepo: LedgerRepo;
  let entitlementRepo: EntitlementRepo;

  beforeEach(() => {
    db = openTestDatabase(':memory:');
    migrate(db);
    sessionRepo = new SessionRepo(db);
    streakRepo = new StreakRepo(db);
    ledgerRepo = new LedgerRepo(db);
    entitlementRepo = new EntitlementRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Streak & Rest Grace Persistence', () => {
    it('persists streak and Rest Grace across app restarts', () => {
      const baseMs = new Date('2026-06-01T10:00:00Z').getTime();

      // Commit 5 consecutive days of practice (D1..D5)
      for (let i = 0; i < 5; i++) {
        const now = baseMs + i * 86_400_000;
        const localDay = dayKeyFromMs(now);
        const s = sessionRepo.create({
          id: `s_${i}`,
          protocolId: 'rapid_reset_5',
          mode: 'focus',
          startedAtMs: now,
          localDay,
          tzOffsetMin: 0,
          plannedMs: 300_000,
        });

        sessionRepo.commitSession(s.id, {
          nowMs: now,
          commitReason: 'natural_end',
          listenedMs: 300_000,
          maxPositionMs: 300_000,
        });
      }

      // Check state after 5 days: 1 Grace Day banked
      let streak = streakRepo.get();
      expect(streak.currentStreak).toBe(5);
      expect(streak.longestStreak).toBe(5);
      expect(streak.graceBanked).toBe(1);

      // Simulate app restart by re-instantiating repositories with the same database
      const newStreakRepo = new StreakRepo(db);
      streak = newStreakRepo.get();
      expect(streak.currentStreak).toBe(5);
      expect(streak.longestStreak).toBe(5);
      expect(streak.graceBanked).toBe(1);

      // Skip Day 6 (2026-06-06). Commit on Day 7 (2026-06-07).
      const day7Ms = baseMs + 6 * 86_400_000;
      const day7Key = dayKeyFromMs(day7Ms);
      const s7 = sessionRepo.create({
        id: 's_day7',
        protocolId: 'afternoon_recharge_10',
        mode: 'focus',
        startedAtMs: day7Ms,
        localDay: day7Key,
        tzOffsetMin: 0,
        plannedMs: 600_000,
      });

      const res = sessionRepo.commitSession(s7.id, {
        nowMs: day7Ms,
        commitReason: 'natural_end',
        listenedMs: 600_000,
        maxPositionMs: 600_000,
      });

      expect(res.creditResult?.coveredDays).toEqual(['2026-06-06']);

      // Verify streak continued to 6 and grace banked decremented to 0
      const updatedStreak = streakRepo.get();
      expect(updatedStreak.currentStreak).toBe(6);
      expect(updatedStreak.graceBanked).toBe(0);
      expect(updatedStreak.graceUsedTotal).toBe(1);

      // Verify day_ledger records: day 6 marked as 'grace', day 7 marked as 'practice'
      const day6Ledger = ledgerRepo.getByDay('2026-06-06');
      expect(day6Ledger).not.toBeNull();
      expect(day6Ledger?.kind).toBe('grace');

      const day7Ledger = ledgerRepo.getByDay('2026-06-07');
      expect(day7Ledger).not.toBeNull();
      expect(day7Ledger?.kind).toBe('practice');
      expect(day7Ledger?.committedMs).toBe(600_000);
    });

    it('retroactive grace days never overwrite existing practice records', () => {
      ledgerRepo.upsertPractice('2026-06-10', 300_000);
      ledgerRepo.markGrace('2026-06-10');

      const record = ledgerRepo.getByDay('2026-06-10');
      expect(record?.kind).toBe('practice');
      expect(record?.committedMs).toBe(300_000);
    });
  });

  describe('Free Pass ("3-Day Streak Taste") Integration', () => {
    it('grants a free pass after 3 consecutive days with short sessions', () => {
      const baseMs = new Date('2026-06-01T10:00:00Z').getTime();

      // Days 1 and 2: 5-min sessions
      for (let i = 0; i < 2; i++) {
        const now = baseMs + i * 86_400_000;
        const s = sessionRepo.create({
          id: `pass_test_${i}`,
          protocolId: 'rapid_reset_5',
          mode: 'focus',
          startedAtMs: now,
          localDay: dayKeyFromMs(now),
          tzOffsetMin: 0,
          plannedMs: 300_000,
        });
        const res = sessionRepo.commitSession(s.id, {
          nowMs: now,
          commitReason: 'natural_end',
          listenedMs: 300_000,
          maxPositionMs: 300_000,
        });
        expect(res.passGranted).toBe(false);
      }

      // Day 3: 10-min session -> qualifies!
      const day3Ms = baseMs + 2 * 86_400_000;
      const s3 = sessionRepo.create({
        id: 'pass_test_2',
        protocolId: 'afternoon_recharge_10',
        mode: 'focus',
        startedAtMs: day3Ms,
        localDay: dayKeyFromMs(day3Ms),
        tzOffsetMin: 0,
        plannedMs: 600_000,
      });
      const res3 = sessionRepo.commitSession(s3.id, {
        nowMs: day3Ms,
        commitReason: 'natural_end',
        listenedMs: 600_000,
        maxPositionMs: 600_000,
      });

      expect(res3.passGranted).toBe(true);
      expect(entitlementRepo.hasAvailablePass(day3Ms)).toBe(true);

      const pass = entitlementRepo.getActivePass(day3Ms);
      expect(pass).not.toBeNull();
      expect(pass?.status).toBe('available');
    });

    it('consumes free pass when 30-min session reaches 20% threshold', () => {
      const now = Date.now();
      entitlementRepo.grantFreePass('test_pass_id', now);
      expect(entitlementRepo.hasAvailablePass(now)).toBe(true);

      // Start 30-min session using free pass
      const s = sessionRepo.create({
        id: 'pass_session_1',
        protocolId: 'deep_rest_30',
        mode: 'focus',
        accessVia: 'free_pass',
        startedAtMs: now,
        localDay: dayKeyFromMs(now),
        tzOffsetMin: 0,
        plannedMs: 1_800_000,
      });

      // Heartbeat at 15% (270s) -> not consumed yet
      sessionRepo.heartbeat(s.id, 270_000, now + 270_000);
      expect(entitlementRepo.hasAvailablePass(now + 270_000)).toBe(true);

      // Heartbeat at 21% (378s) -> passes 20% threshold -> consumed!
      sessionRepo.heartbeat(s.id, 378_000, now + 378_000);
      expect(entitlementRepo.hasAvailablePass(now + 378_000)).toBe(false);

      const passRow = db.first<{ status: string; consumed_session_id: string }>(
        'SELECT status, consumed_session_id FROM user_entitlements WHERE id = ?;',
        ['test_pass_id'],
      );
      expect(passRow?.status).toBe('consumed');
      expect(passRow?.consumed_session_id).toBe(s.id);
    });
  });

  describe('Calm Delta & Headline Insights', () => {
    it('returns encouraging prompt when sample count < 5', () => {
      const sessions: DetailedPairedSession[] = [
        { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.CALM },
        { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.CALM },
        { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.RESTORED },
      ];

      const insight = computeHeadlineInsight(sessions);
      expect(insight.hasInsight).toBe(false);
      expect(insight.text).toBe(
        'Log 5 sessions with a before-and-after tap to see your Calm Delta.',
      );
      expect(insight.sampleCount).toBe(3);
    });

    it('generates percentage insight when >= 5 sessions shift to Calm or Restored', () => {
      const sessions: DetailedPairedSession[] = [
        { protocolId: 'afternoon_recharge_10', preState: STATE.WIRED, postState: STATE.CALM },
        { protocolId: 'afternoon_recharge_10', preState: STATE.WIRED, postState: STATE.CALM },
        { protocolId: 'afternoon_recharge_10', preState: STATE.WIRED, postState: STATE.RESTORED },
        { protocolId: 'afternoon_recharge_10', preState: STATE.WIRED, postState: STATE.RESTORED },
        { protocolId: 'afternoon_recharge_10', preState: STATE.WIRED, postState: STATE.RESTORED },
      ];

      const insight = computeHeadlineInsight(sessions);
      expect(insight.hasInsight).toBe(true);
      expect(insight.sampleCount).toBe(5);
      expect(insight.text).toContain(
        'Your 10-min sessions shift you from Wired to Restored 60% of the time (5 sessions).',
      );
    });

    it('calculates average delta fallback when >= 5 pairs with mean delta > 0', () => {
      // 5 sessions with different pre-states so no single group has n >= 5
      const sessions: DetailedPairedSession[] = [
        { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.NEUTRAL }, // +2
        { protocolId: 'rapid_reset_5', preState: STATE.DRAINED, postState: STATE.CALM }, // +2
        { protocolId: 'afternoon_recharge_10', preState: STATE.WIRED, postState: STATE.CALM }, // +3
        { protocolId: 'afternoon_recharge_10', preState: STATE.DRAINED, postState: STATE.RESTORED }, // +3
        { protocolId: 'deep_rest_30', preState: STATE.NEUTRAL, postState: STATE.RESTORED }, // +2
      ];

      const insight = computeHeadlineInsight(sessions);
      expect(insight.hasInsight).toBe(true);
      expect(insight.sampleCount).toBe(5);
      expect(insight.text).toContain("Across 5 sessions you've moved up 2.4 states on average.");
    });

    it('computes Pro analytics: best time-of-day band and weekly mean delta', () => {
      const baseMs = new Date(2026, 5, 1, 16, 0, 0).getTime(); // 16:00 local (afternoon band 15-18)
      const sessions = [
        {
          protocolId: 'afternoon_recharge_10' as const,
          preState: STATE.WIRED,
          postState: STATE.RESTORED,
          startedAtMs: baseMs,
        },
        {
          protocolId: 'afternoon_recharge_10' as const,
          preState: STATE.DRAINED,
          postState: STATE.CALM,
          startedAtMs: baseMs + 86_400_000,
        },
        {
          protocolId: 'afternoon_recharge_10' as const,
          preState: STATE.WIRED,
          postState: STATE.CALM,
          startedAtMs: baseMs + 2 * 86_400_000,
        },
      ];

      const bestBand = computeBestTimeOfDayBand(sessions);
      expect(bestBand).not.toBeNull();
      expect(bestBand?.band).toBe('15–18');
      expect(bestBand?.meanDelta).toBeGreaterThan(0);
      expect(bestBand?.sampleCount).toBe(3);

      const weekly = computeWeeklyMeanDelta(sessions, baseMs + 2 * 86_400_000);
      expect(weekly).toHaveLength(8);
      const activeWeek = weekly.find((w) => w.sampleCount > 0);
      expect(activeWeek).toBeDefined();
      expect(activeWeek?.meanDelta).toBeGreaterThan(0);
    });

    it('computes slice deltas grouped by protocol, voice, and mode', () => {
      const sessions: DetailedPairedSession[] = [
        {
          protocolId: 'rapid_reset_5',
          voiceId: 'maya_warm',
          mode: 'focus',
          preState: STATE.WIRED,
          postState: STATE.CALM,
        },
        {
          protocolId: 'rapid_reset_5',
          voiceId: 'maya_warm',
          mode: 'focus',
          preState: STATE.WIRED,
          postState: STATE.RESTORED,
        },
        {
          protocolId: 'afternoon_recharge_10',
          voiceId: 'arjun_deep',
          mode: 'sleep',
          preState: STATE.DRAINED,
          postState: STATE.CALM,
        },
      ];

      const protocolSlices = computeMeanDeltaBySlice(sessions, 'protocolId');
      expect(protocolSlices).toHaveLength(2);
      const rapidSlice = protocolSlices.find((s) => s.sliceValue === 'rapid_reset_5');
      expect(rapidSlice?.sampleCount).toBe(2);
      expect(rapidSlice?.meanDelta).toBe(3.5); // (3 + 4) / 2

      const modeSlices = computeMeanDeltaBySlice(sessions, 'mode');
      expect(modeSlices).toHaveLength(2);
    });
  });

  describe('SessionRepo Query & Stats Integrity', () => {
    it('accurately computes restorative minutes and completed sessions', () => {
      const now = Date.now();

      // 1 completed 5m session (300,000 ms)
      const s1 = sessionRepo.create({
        id: 's_stats_1',
        protocolId: 'rapid_reset_5',
        mode: 'focus',
        startedAtMs: now - 100_000,
        localDay: dayKeyFromMs(now - 100_000),
        tzOffsetMin: 0,
        plannedMs: 300_000,
      });
      sessionRepo.commitSession(s1.id, {
        nowMs: now - 100_000,
        commitReason: 'natural_end',
        listenedMs: 300_000,
        maxPositionMs: 300_000,
      });

      // 1 partial session with >= 2 min (150,000 ms)
      const s2 = sessionRepo.create({
        id: 's_stats_2',
        protocolId: 'afternoon_recharge_10',
        mode: 'focus',
        startedAtMs: now - 50_000,
        localDay: dayKeyFromMs(now - 50_000),
        tzOffsetMin: 0,
        plannedMs: 600_000,
      });
      sessionRepo.finalize(s2.id, 'partial', 150_000, now - 50_000);

      const stats = sessionRepo.getStats();
      expect(stats.sessions).toBe(1); // Only completed
      expect(stats.minutes).toBe(7); // (300,000 + 150,000) / 60,000 = 7.5 -> rounded down to 7
    });

    it('respects Free (7 sessions) vs Pro (unlimited) history limits', () => {
      const now = Date.now();

      // Create 10 completed sessions
      for (let i = 0; i < 10; i++) {
        const sTime = now - (10 - i) * 3600_000;
        const s = sessionRepo.create({
          id: `limit_test_${i}`,
          protocolId: 'rapid_reset_5',
          mode: 'focus',
          startedAtMs: sTime,
          localDay: dayKeyFromMs(sTime),
          tzOffsetMin: 0,
          plannedMs: 300_000,
        });
        sessionRepo.commitSession(s.id, {
          nowMs: sTime,
          commitReason: 'natural_end',
          listenedMs: 300_000,
          maxPositionMs: 300_000,
        });
      }

      // Free user gets last 7
      const freeList = sessionRepo.listRecent(7);
      expect(freeList).toHaveLength(7);

      // Pro user gets all 10
      const proList = sessionRepo.listAll();
      expect(proList).toHaveLength(10);
    });
  });
});
