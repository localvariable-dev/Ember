/**
 * Application Restart & Local Calendar Persistence Tests
 * Master Plan Part 4 §5.1, Part 2 §3.3
 * Demonstrates that all user data survives application shutdown and restart,
 * and that local dates and timezone offsets are persisted with complete fidelity.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTestDatabase } from '../helpers/testDb';
import { migrate } from '../../src/data/migrations';
import {
  EntitlementRepo,
  LedgerRepo,
  PrefsRepo,
  SessionRepo,
  StreakRepo,
} from '../../src/data/repos';

describe('Application Restart Persistence', () => {
  let tempDbPath: string;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `ember-test-restart-${Date.now()}-${Math.random()}.db`);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
      const wal = `${tempDbPath}-wal`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      const shm = `${tempDbPath}-shm`;
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {}
  });

  it('preserves all sessions, streak, ledger, and entitlements across database restart', () => {
    // 1. First app launch: open DB and run migrations
    let db = openTestDatabase(tempDbPath);
    migrate(db);

    let sessionRepo = new SessionRepo(db);
    let streakRepo = new StreakRepo(db);
    let ledgerRepo = new LedgerRepo(db);
    let entitlementRepo = new EntitlementRepo(db);
    let prefsRepo = new PrefsRepo(db);

    // Create and commit a session
    const s = sessionRepo.create({
      protocolId: 'afternoon_recharge_10',
      voiceId: 'maya_warm',
      mode: 'focus',
      startedAtMs: 1_700_000_000_000,
      localDay: '2026-06-15',
      tzOffsetMin: 330, // IST (+05:30)
      plannedMs: 600_000,
      preState: 2, // Drained
    });
    sessionRepo.setPostState(s.id, 5); // Restored

    sessionRepo.commitSession(s.id, {
      listenedMs: 580_000,
      maxPositionMs: 580_000,
      commitReason: 'focus_threshold',
      nowMs: 1_700_000_600_000,
    });

    // Patch preferences
    prefsRepo.patch({
      selectedVoiceId: 'arjun_deep',
      hapticsEnabled: false,
      voiceVolume: 0.8,
    });

    // Grant an entitlement
    entitlementRepo.upsert({
      id: 'sub_monthly',
      kind: 'subscription',
      source: 'mock',
      productId: 'ember_pro_monthly',
      status: 'active',
      grantedAtMs: 1_700_000_000_000,
      expiresAtMs: 1_700_000_000_000 + 30 * 86_400_000,
      consumedAtMs: null,
      consumedSessionId: null,
      orderId: 'ord_123',
      purchaseToken: 'tok_123',
      lastVerifiedAtMs: 1_700_000_000_000,
      metaJson: null,
    });

    // 2. Simulate application termination: close DB connection
    db.close();

    // 3. Second app launch: reopen the same file from disk
    db = openTestDatabase(tempDbPath);

    // Verify migration is a safe no-op on restart
    const migResult = migrate(db);
    expect(migResult.previousVersion).toBe(3);
    expect(migResult.newVersion).toBe(3);

    // Re-initialize repositories
    sessionRepo = new SessionRepo(db);
    streakRepo = new StreakRepo(db);
    ledgerRepo = new LedgerRepo(db);
    entitlementRepo = new EntitlementRepo(db);
    prefsRepo = new PrefsRepo(db);

    // 4. Verify all records survived restart
    const reloadedSession = sessionRepo.getById(s.id);
    expect(reloadedSession).not.toBeNull();
    expect(reloadedSession?.status).toBe('completed');
    expect(reloadedSession?.localDay).toBe('2026-06-15');
    expect(reloadedSession?.tzOffsetMin).toBe(330);
    expect(reloadedSession?.preState).toBe(2);
    expect(reloadedSession?.postState).toBe(5);
    expect(reloadedSession?.listenedMs).toBe(580_000);

    const reloadedStreak = streakRepo.get();
    expect(reloadedStreak.currentStreak).toBe(1);
    expect(reloadedStreak.lastCreditDay).toBe('2026-06-15');

    const reloadedLedger = ledgerRepo.getByDay('2026-06-15');
    expect(reloadedLedger?.kind).toBe('practice');
    expect(reloadedLedger?.committedMs).toBe(580_000);
    expect(reloadedLedger?.sessions).toBe(1);

    const reloadedPrefs = prefsRepo.get();
    expect(reloadedPrefs.selectedVoiceId).toBe('arjun_deep');
    expect(reloadedPrefs.hapticsEnabled).toBe(false);
    expect(reloadedPrefs.voiceVolume).toBe(0.8);

    const reloadedEntitlement = entitlementRepo.getById('sub_monthly');
    expect(reloadedEntitlement?.status).toBe('active');
    expect(reloadedEntitlement?.productId).toBe('ember_pro_monthly');
    expect(entitlementRepo.hasActivePro(1_700_000_000_000)).toBe(true);

    db.close();
  });

  it('persists midnight crossover attribution and timezone offsets across restarts', () => {
    let db = openTestDatabase(tempDbPath);
    migrate(db);

    let sessionRepo = new SessionRepo(db);

    // Session starts at 23:50 on June 15 with US Eastern offset (-240 min)
    // Runs for 25 minutes into June 16 00:15
    const startedAtMs = new Date(2026, 5, 15, 23, 50, 0).getTime();
    const completedAtMs = new Date(2026, 5, 16, 0, 15, 0).getTime();

    const s = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs,
      localDay: '2026-06-15', // Attributed to start day
      tzOffsetMin: -240, // EDT
      plannedMs: 300_000,
    });

    sessionRepo.commitSession(s.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: completedAtMs,
    });

    db.close();

    // Reopen from disk
    db = openTestDatabase(tempDbPath);
    sessionRepo = new SessionRepo(db);
    const streakRepo = new StreakRepo(db);
    const ledgerRepo = new LedgerRepo(db);

    const reloaded = sessionRepo.getById(s.id);
    expect(reloaded?.localDay).toBe('2026-06-15');
    expect(reloaded?.tzOffsetMin).toBe(-240);

    // Streak attributed strictly to 2026-06-15
    expect(streakRepo.get().lastCreditDay).toBe('2026-06-15');

    // Ledger credited to 2026-06-15, NOT 2026-06-16
    expect(ledgerRepo.getByDay('2026-06-15')?.sessions).toBe(1);
    expect(ledgerRepo.getByDay('2026-06-16')).toBeNull();

    db.close();
  });
});
