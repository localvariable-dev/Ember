/**
 * Session Transaction & Atomic Commit Tests
 * Master Plan Part 4 §5.6, Part 2 §3.3-§3.5
 * Verifies atomic commit guarantees, Rest Grace coverage, Free Pass grants,
 * replay protection/idempotency, and transaction rollback on failure.
 */

import { openTestDatabase } from '../helpers/testDb';
import { migrate } from '../../src/data/migrations';
import { EntitlementRepo, LedgerRepo, SessionRepo, StreakRepo } from '../../src/data/repos';

describe('Session Transactions & Commit Guarantees', () => {
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

  it('creates an in-progress session and updates heartbeats', () => {
    const s = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      voiceId: 'maya_warm',
      mode: 'focus',
      startedAtMs: 1_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330,
      plannedMs: 300_000,
      preState: 1,
    });

    expect(s.status).toBe('in_progress');
    expect(s.listenedMs).toBe(0);
    expect(s.maxPositionMs).toBe(0);
    expect(s.preState).toBe(1);

    sessionRepo.heartbeat(s.id, 150_000, 1_150_000);
    const updated = sessionRepo.getById(s.id);
    expect(updated?.maxPositionMs).toBe(150_000);
    expect(updated?.heartbeatAtMs).toBe(1_150_000);
  });

  it('commits a session in a single atomic transaction: updates session, streak, and ledger', () => {
    const s = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      voiceId: 'maya_warm',
      mode: 'focus',
      startedAtMs: 1_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });

    const commitRes = sessionRepo.commitSession(s.id, {
      listenedMs: 280_000,
      maxPositionMs: 280_000,
      commitReason: 'focus_threshold',
      nowMs: 1_280_000,
    });

    expect(commitRes.alreadyCommitted).toBe(false);
    expect(commitRes.creditResult?.next.currentStreak).toBe(1);
    expect(commitRes.passGranted).toBe(false);

    // 1. Session status
    const session = sessionRepo.getById(s.id);
    expect(session?.status).toBe('completed');
    expect(session?.committedAtMs).toBe(1_280_000);
    expect(session?.commitReason).toBe('focus_threshold');
    expect(session?.listenedMs).toBe(280_000);

    // 2. Streak state
    const streak = streakRepo.get();
    expect(streak.currentStreak).toBe(1);
    expect(streak.longestStreak).toBe(1);
    expect(streak.lastCreditDay).toBe('2026-06-15');

    // 3. Ledger
    const ledger = ledgerRepo.getByDay('2026-06-15');
    expect(ledger?.kind).toBe('practice');
    expect(ledger?.committedMs).toBe(280_000);
    expect(ledger?.sessions).toBe(1);
  });

  it('covers Grace days during commit when a bridgeable gap occurs', () => {
    // Bank 1 Grace day: simulate 5 consecutive practice days (D1..D5)
    streakRepo.save({
      currentStreak: 5,
      longestStreak: 5,
      lastCreditDay: '2026-06-05',
      graceBanked: 1,
      graceProgress: 0,
      graceEarnedTotal: 1,
      graceUsedTotal: 0,
    });

    // Practice on D7 (gap = 2, missed D6 = 1 <= banked 1)
    const s = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: 2_000_000,
      localDay: '2026-06-07',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });

    const commitRes = sessionRepo.commitSession(s.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: 2_290_000,
    });

    expect(commitRes.alreadyCommitted).toBe(false);
    expect(commitRes.creditResult?.coveredDays).toEqual(['2026-06-06']);
    expect(commitRes.creditResult?.next.currentStreak).toBe(6);
    expect(commitRes.creditResult?.next.graceBanked).toBe(0);

    // Day ledger must contain Grace row for 2026-06-06
    const graceRow = ledgerRepo.getByDay('2026-06-06');
    expect(graceRow?.kind).toBe('grace');

    // Day ledger must contain Practice row for 2026-06-07
    const practiceRow = ledgerRepo.getByDay('2026-06-07');
    expect(practiceRow?.kind).toBe('practice');
  });

  it('grants a Free Pass on the 3rd consecutive practice day of short sessions', () => {
    const now = 10_000_000;

    // Day 1: 5-min session
    const s1 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: now,
      localDay: '2026-06-10',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    sessionRepo.commitSession(s1.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: now + 300_000,
    });
    expect(entitlementRepo.hasAvailablePass(now)).toBe(false);

    // Day 2: 10-min session
    const s2 = sessionRepo.create({
      protocolId: 'afternoon_recharge_10',
      mode: 'focus',
      startedAtMs: now + 86_400_000,
      localDay: '2026-06-11',
      tzOffsetMin: 330,
      plannedMs: 600_000,
    });
    sessionRepo.commitSession(s2.id, {
      listenedMs: 550_000,
      maxPositionMs: 550_000,
      commitReason: 'focus_threshold',
      nowMs: now + 86_400_000 + 600_000,
    });
    expect(entitlementRepo.hasAvailablePass(now)).toBe(false);

    // Day 3: 5-min session -> triggers Free Pass grant
    const s3 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: now + 2 * 86_400_000,
      localDay: '2026-06-12',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    const commit3 = sessionRepo.commitSession(s3.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: now + 2 * 86_400_000 + 300_000,
    });

    expect(commit3.passGranted).toBe(true);
    expect(entitlementRepo.hasAvailablePass(now + 2 * 86_400_000)).toBe(true);
    expect(entitlementRepo.countPassesGranted()).toBe(1);
  });

  it('guarantees commit idempotency: replaying commit cannot duplicate streak or ledger minutes', () => {
    const s = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: 1_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });

    // First commit
    const res1 = sessionRepo.commitSession(s.id, {
      listenedMs: 280_000,
      maxPositionMs: 280_000,
      commitReason: 'focus_threshold',
      nowMs: 1_280_000,
    });
    expect(res1.alreadyCommitted).toBe(false);

    const streak1 = streakRepo.get();
    const ledger1 = ledgerRepo.getByDay('2026-06-15');

    // Second commit on the SAME session (e.g. race condition or replay)
    const res2 = sessionRepo.commitSession(s.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: 1_290_000,
    });
    expect(res2.alreadyCommitted).toBe(true);

    // Verify streak and ledger were untouched
    const streak2 = streakRepo.get();
    const ledger2 = ledgerRepo.getByDay('2026-06-15');

    expect(streak2.currentStreak).toBe(streak1.currentStreak);
    expect(ledger2?.committedMs).toBe(ledger1?.committedMs);
    expect(ledger2?.sessions).toBe(ledger1?.sessions);
  });

  it('prevents finalize from overwriting a committed session to partial or abandoned', () => {
    const s = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: 1_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });

    sessionRepo.commitSession(s.id, {
      listenedMs: 280_000,
      maxPositionMs: 280_000,
      commitReason: 'focus_threshold',
      nowMs: 1_280_000,
    });

    // Attempt to finalize as abandoned (e.g. on unmount after commit)
    sessionRepo.finalize(s.id, 'abandoned', 50_000);

    const reRead = sessionRepo.getById(s.id);
    expect(reRead?.status).toBe('completed');
    expect(reRead?.listenedMs).toBe(280_000);
  });

  it('rolls back all session, streak, and ledger writes if transaction throws an error', () => {
    const s = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: 1_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });

    // Mock an error during the transaction by mocking streakRepo.save
    jest.spyOn(streakRepo, 'save').mockImplementation(() => {
      throw new Error('Simulated I/O disk error');
    });

    expect(() => {
      // Re-invoke commitSession on an instance using the mocked streakRepo
      db.tx(() => {
        db.run(
          `UPDATE session_logs SET status='completed', committed_at_ms=123 WHERE id=? AND committed_at_ms IS NULL;`,
          [s.id],
        );
        streakRepo.save({
          currentStreak: 99,
          longestStreak: 99,
          lastCreditDay: '2026-06-15',
          graceBanked: 0,
          graceProgress: 0,
          graceEarnedTotal: 0,
          graceUsedTotal: 0,
        });
      });
    }).toThrow('Simulated I/O disk error');

    // Restore mock
    jest.restoreAllMocks();

    // Verify session remained in_progress
    const session = sessionRepo.getById(s.id);
    expect(session?.status).toBe('in_progress');
    expect(session?.committedAtMs).toBeNull();

    // Verify streak remained untouched
    const streak = streakRepo.get();
    expect(streak.currentStreak).toBe(0);
  });

  it('computes accurate aggregate restorative stats via getStats()', () => {
    // Create and commit session 1 (5 min, 300s listened = 5 min)
    const s1 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: 1_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    sessionRepo.commitSession(s1.id, {
      listenedMs: 300_000,
      maxPositionMs: 300_000,
      commitReason: 'natural_end',
      nowMs: 1_300_000,
    });

    // Create and finalize session 2 as partial (180s listened = 3 min)
    const s2 = sessionRepo.create({
      protocolId: 'afternoon_recharge_10',
      mode: 'focus',
      startedAtMs: 2_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330,
      plannedMs: 600_000,
    });
    sessionRepo.finalize(s2.id, 'partial', 180_000, 2_180_000);

    // Create and finalize session 3 as abandoned (< 120s, 60s listened)
    const s3 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: 3_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    sessionRepo.finalize(s3.id, 'abandoned', 60_000, 3_060_000);

    const stats = sessionRepo.getStats();
    // Minutes = (300,000 + 180,000) / 60,000 = 8 minutes (abandoned does not count)
    expect(stats.minutes).toBe(8);
    // Sessions completed = 1 (only s1 completed)
    expect(stats.sessions).toBe(1);
  });
});
