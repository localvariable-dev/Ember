/**
 * Free Pass ("3-Day Streak Taste") Business Rules & Lifecycle Tests
 * Master Plan Part 2 §3.5, Part 3 §4.1-§4.6, Part 4 §5.6
 *
 * Verifies the 6 mandatory product guarantees:
 * 1. Pass granted after three qualifying consecutive days (5 or 10 min sessions).
 * 2. Pass expires after 14 days (FREE_PASS_VALID_DAYS).
 * 3. Pass is consumed at the correct session threshold (20% of 30-min session).
 * 4. Repeated qualification cannot grant a second lifetime pass (FREE_PASS_MAX_LIFETIME = 1).
 * 5. Active Pro users do not receive a redundant pass.
 * 6. A failed transaction cannot partially grant or consume a pass (atomic rollback).
 */

import { FREE_PASS_VALID_DAYS } from '../../src/domain/constants';
import { openTestDatabase } from '../../src/data/db';
import { migrate } from '../../src/data/migrations';
import { EntitlementRepo, SessionRepo } from '../../src/data/repos';

describe('Free Pass Business Rules & Entitlement Integrity', () => {
  let db: ReturnType<typeof openTestDatabase>;
  let sessionRepo: SessionRepo;
  let entitlementRepo: EntitlementRepo;

  beforeEach(() => {
    db = openTestDatabase(':memory:');
    migrate(db);
    sessionRepo = new SessionRepo(db);
    entitlementRepo = new EntitlementRepo(db);
  });

  afterEach(() => {
    db.close?.();
  });

  it('1. grants Free Pass with 14-day validity after 3 consecutive days of short sessions', () => {
    const startMs = 1_700_000_000_000;

    // Day 1: 5-min session
    const s1 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: startMs,
      localDay: '2026-06-01',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    sessionRepo.commitSession(s1.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: startMs + 300_000,
    });
    expect(entitlementRepo.hasAvailablePass(startMs)).toBe(false);

    // Day 2: 10-min session
    const s2 = sessionRepo.create({
      protocolId: 'afternoon_recharge_10',
      mode: 'focus',
      startedAtMs: startMs + 86_400_000,
      localDay: '2026-06-02',
      tzOffsetMin: 330,
      plannedMs: 600_000,
    });
    sessionRepo.commitSession(s2.id, {
      listenedMs: 580_000,
      maxPositionMs: 580_000,
      commitReason: 'natural_end',
      nowMs: startMs + 86_400_000 + 600_000,
    });
    expect(entitlementRepo.hasAvailablePass(startMs + 86_400_000)).toBe(false);

    // Day 3: 5-min session -> qualifies!
    const grantNowMs = startMs + 2 * 86_400_000 + 300_000;
    const s3 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: startMs + 2 * 86_400_000,
      localDay: '2026-06-03',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    const res3 = sessionRepo.commitSession(s3.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: grantNowMs,
    });

    expect(res3.passGranted).toBe(true);
    expect(entitlementRepo.countPassesGranted()).toBe(1);

    const pass = entitlementRepo.getActivePass(grantNowMs);
    expect(pass).not.toBeNull();
    expect(pass?.kind).toBe('free_pass');
    expect(pass?.source).toBe('app');
    expect(pass?.status).toBe('available');
    expect(pass?.grantedAtMs).toBe(grantNowMs);

    // 14 days validity
    const expectedExpiry = grantNowMs + FREE_PASS_VALID_DAYS * 86_400_000;
    expect(pass?.expiresAtMs).toBe(expectedExpiry);
  });

  it('2. expires Free Pass exactly after 14 days', () => {
    const grantMs = 1_700_000_000_000;
    entitlementRepo.grantFreePass('pass-expiry-test', grantMs);

    const validDurationMs = FREE_PASS_VALID_DAYS * 86_400_000;

    // Within validity window (e.g. 13 days 23 hours later)
    const justBeforeExpiry = grantMs + validDurationMs - 3_600_000;
    expect(entitlementRepo.hasAvailablePass(justBeforeExpiry)).toBe(true);
    expect(entitlementRepo.getActivePass(justBeforeExpiry)?.id).toBe('pass-expiry-test');

    // Exactly at or after expiry (14 days + 1 second)
    const afterExpiry = grantMs + validDurationMs + 1000;
    expect(entitlementRepo.hasAvailablePass(afterExpiry)).toBe(false);
    expect(entitlementRepo.getActivePass(afterExpiry)).toBeNull();

    // Verify stale pass status was automatically transitioned to 'expired'
    const passRow = entitlementRepo.getById('pass-expiry-test');
    expect(passRow?.status).toBe('expired');
  });

  it('3. consumes Free Pass at exactly 20% of the 30-minute session (6:00)', () => {
    const nowMs = 1_700_000_000_000;
    const pass = entitlementRepo.grantFreePass('pass-consume-test', nowMs);
    expect(pass.status).toBe('available');

    // Start a 30-min Deep Rest session using the free pass
    const session = sessionRepo.create({
      protocolId: 'deep_rest_30',
      mode: 'focus',
      accessVia: 'free_pass',
      startedAtMs: nowMs,
      localDay: '2026-06-05',
      tzOffsetMin: 330,
      plannedMs: 1_800_000,
    });

    // 20% threshold of 1,800,000 ms is 360,000 ms (6 minutes)
    // Heartbeat at 5 minutes (300,000 ms = 16.7%) -> Pass remains available
    sessionRepo.heartbeat(session.id, 300_000, nowMs + 300_000);
    expect(entitlementRepo.getById('pass-consume-test')?.status).toBe('available');

    // User exits/quits at 5:50 (350,000 ms = 19.4%) -> Finalize does NOT consume
    sessionRepo.finalize(session.id, 'partial', 350_000, nowMs + 350_000);
    expect(entitlementRepo.getById('pass-consume-test')?.status).toBe('available');

    // Second attempt: User starts another 30-min session with the available pass
    const session2 = sessionRepo.create({
      protocolId: 'deep_rest_30',
      mode: 'sleep',
      accessVia: 'free_pass',
      startedAtMs: nowMs + 1_000_000,
      localDay: '2026-06-05',
      tzOffsetMin: 330,
      plannedMs: 1_800_000,
    });

    // Heartbeat crosses 20% threshold at exactly 360,000 ms (6:00)
    sessionRepo.heartbeat(session2.id, 360_000, nowMs + 1_360_000);

    const consumedPass = entitlementRepo.getById('pass-consume-test');
    expect(consumedPass?.status).toBe('consumed');
    expect(consumedPass?.consumedSessionId).toBe(session2.id);
    expect(consumedPass?.consumedAtMs).toBe(nowMs + 1_360_000);
    expect(entitlementRepo.hasAvailablePass(nowMs + 1_360_000)).toBe(false);
  });

  it('4. enforces lifetime limit: repeated qualification cannot grant a second pass', () => {
    const startMs = 1_700_000_000_000;

    // Day 1, 2, 3: First qualification
    for (let day = 1; day <= 3; day++) {
      const s = sessionRepo.create({
        protocolId: 'rapid_reset_5',
        mode: 'focus',
        startedAtMs: startMs + (day - 1) * 86_400_000,
        localDay: `2026-06-0${day}`,
        tzOffsetMin: 330,
        plannedMs: 300_000,
      });
      sessionRepo.commitSession(s.id, {
        listenedMs: 290_000,
        maxPositionMs: 290_000,
        commitReason: 'natural_end',
        nowMs: startMs + (day - 1) * 86_400_000 + 300_000,
      });
    }

    expect(entitlementRepo.countPassesGranted()).toBe(1);

    // Consume the first pass
    const activePass = entitlementRepo.getActivePass(startMs + 3 * 86_400_000)!;
    entitlementRepo.consumeFreePass(activePass.id, 'session-xyz', startMs + 3 * 86_400_000);
    expect(entitlementRepo.hasAvailablePass(startMs + 3 * 86_400_000)).toBe(false);

    // Day 4: Another short session completed
    const s4 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: startMs + 3 * 86_400_000,
      localDay: '2026-06-04',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    const res4 = sessionRepo.commitSession(s4.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: startMs + 3 * 86_400_000 + 300_000,
    });

    // Must NOT grant a second pass
    expect(res4.passGranted).toBe(false);
    expect(entitlementRepo.countPassesGranted()).toBe(1);

    // Day 5: Another short session completed
    const s5 = sessionRepo.create({
      protocolId: 'afternoon_recharge_10',
      mode: 'focus',
      startedAtMs: startMs + 4 * 86_400_000,
      localDay: '2026-06-05',
      tzOffsetMin: 330,
      plannedMs: 600_000,
    });
    const res5 = sessionRepo.commitSession(s5.id, {
      listenedMs: 580_000,
      maxPositionMs: 580_000,
      commitReason: 'natural_end',
      nowMs: startMs + 4 * 86_400_000 + 600_000,
    });

    expect(res5.passGranted).toBe(false);
    expect(entitlementRepo.countPassesGranted()).toBe(1);
  });

  it('5. active Pro users do not receive redundant Free Pass grants', () => {
    const startMs = 1_700_000_000_000;

    // User is active Pro (e.g. Monthly subscription)
    entitlementRepo.upsert({
      id: 'sub-active-pro',
      kind: 'subscription',
      source: 'google_play',
      productId: 'ember_pro_monthly',
      status: 'active',
      grantedAtMs: startMs,
      expiresAtMs: startMs + 30 * 86_400_000,
      consumedAtMs: null,
      consumedSessionId: null,
      orderId: 'GPA.1234',
      purchaseToken: 'tok-1234',
      lastVerifiedAtMs: startMs,
      metaJson: null,
    });

    expect(entitlementRepo.hasActivePro(startMs)).toBe(true);

    // Complete 3 consecutive days of short sessions
    for (let day = 1; day <= 3; day++) {
      const s = sessionRepo.create({
        protocolId: 'rapid_reset_5',
        mode: 'focus',
        startedAtMs: startMs + (day - 1) * 86_400_000,
        localDay: `2026-06-0${day}`,
        tzOffsetMin: 330,
        plannedMs: 300_000,
      });
      const res = sessionRepo.commitSession(s.id, {
        listenedMs: 290_000,
        maxPositionMs: 290_000,
        commitReason: 'natural_end',
        nowMs: startMs + (day - 1) * 86_400_000 + 300_000,
      });

      // No pass granted to Pro user
      expect(res.passGranted).toBe(false);
    }

    expect(entitlementRepo.countPassesGranted()).toBe(0);
  });

  it('6. atomic transaction guarantee: failed commit cannot partially grant or consume a pass', () => {
    const nowMs = 1_700_000_000_000;
    entitlementRepo.grantFreePass('atomic-pass-test', nowMs);
    expect(entitlementRepo.countPassesGranted()).toBe(1);

    const s = sessionRepo.create({
      protocolId: 'deep_rest_30',
      mode: 'focus',
      accessVia: 'free_pass',
      startedAtMs: nowMs,
      localDay: '2026-06-10',
      tzOffsetMin: 330,
      plannedMs: 1_800_000,
    });

    // Mock an error during commit transaction (e.g. disk write failure in streakRepo)
    jest.spyOn(db, 'run').mockImplementation((sql: string, params: unknown[] = []) => {
      if (sql.includes('streak_state')) {
        throw new Error('Simulated I/O disk error during streak update');
      }
      return (db as any).db.prepare(sql).run(...params);
    });

    // Commit should throw and rollback
    expect(() => {
      sessionRepo.commitSession(s.id, {
        listenedMs: 1_700_000,
        maxPositionMs: 1_700_000,
        commitReason: 'natural_end',
        nowMs: nowMs + 1_700_000,
      });
    }).toThrow('Simulated I/O disk error');

    // Restore mock
    jest.restoreAllMocks();

    // Verify session remained in_progress
    const sessionAfter = sessionRepo.getById(s.id);
    expect(sessionAfter?.status).toBe('in_progress');
    expect(sessionAfter?.committedAtMs).toBeNull();

    // Verify Free Pass was NOT consumed
    const passAfter = entitlementRepo.getById('atomic-pass-test');
    expect(passAfter?.status).toBe('available');
    expect(passAfter?.consumedAtMs).toBeNull();
    expect(passAfter?.consumedSessionId).toBeNull();
  });
});
