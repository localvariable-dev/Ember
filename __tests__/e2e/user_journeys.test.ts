/**
 * Ember End-to-End User Journey Test Suite
 * Master Plan Parts 1, 2, 3, 4, 5, 6
 *
 * Verifies the 15 mandatory canonical user journeys:
 * 1. Fresh install → Sanctuary
 * 2. Start five-minute session
 * 3. Complete session
 * 4. Record Calm Delta
 * 5. Restart app and verify history
 * 6. Download audio and use it offline
 * 7. Switch narrator during playback
 * 8. Pause and resume
 * 9. Complete Sleep Mode (auto-commit & morning reconcile)
 * 10. Trigger and reconcile interrupted session
 * 11. Earn and consume free pass
 * 12. Open Paywall and complete mock purchase
 * 13. Restore purchase
 * 14. Open Journey
 * 15. Deny notification permission & verify normal operation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MockAudioDriver } from '../../src/audio/MockAudioDriver';
import {
  OfflineAudioManager,
  type FileSystemDriver,
  type DownloadProgressCallback,
} from '../../src/audio/OfflineAudioManager';
import { resolveAudioSource } from '../../src/audio/assetSources';
import {
  VOICE_TRACKS_METADATA,
  AMBIENT_BEDS_METADATA,
} from '../../src/audio/assetRegistry.generated';
import { EntitlementServiceImpl } from '../../src/billing/EntitlementServiceImpl';
import { MockBillingAdapter } from '../../src/billing/MockBillingAdapter';
import type { Db } from '../../src/data/dbTypes';
import { MIGRATIONS } from '../../src/data/migrations';
import {
  EntitlementRepo,
  LedgerRepo,
  PrefsRepo,
  SessionRepo,
  StreakRepo,
} from '../../src/data/repos';
import { TestClock } from '../../src/domain/clock';
import { dayKeyFromMs } from '../../src/domain/dayKey';
import { SessionController } from '../../src/features/player/SessionController';
import { CANONICAL_CARDS } from '../../src/features/sanctuary/SessionCardList';
import { syncNotificationSchedule } from '../../src/services/NotificationService';
import { openTestDatabase } from '../helpers/testDb';

class MemoryFsDriver implements FileSystemDriver {
  public files = new Map<string, string>();

  async exists(filePath: string): Promise<boolean> {
    return this.files.has(filePath);
  }

  async readFileAsBase64(filePath: string): Promise<string> {
    const data = this.files.get(filePath);
    if (data === undefined) throw new Error(`File not found: ${filePath}`);
    return Buffer.from(data).toString('base64');
  }

  async writeFile(filePath: string, content: string | Uint8Array): Promise<void> {
    const str = typeof content === 'string' ? content : Buffer.from(content).toString('utf8');
    this.files.set(filePath, str);
  }

  async deleteFile(filePath: string): Promise<void> {
    this.files.delete(filePath);
  }

  async rename(srcPath: string, destPath: string): Promise<void> {
    const data = this.files.get(srcPath);
    if (data !== undefined) {
      this.files.set(destPath, data);
      this.files.delete(srcPath);
    }
  }

  async mkdir(_dirPath: string): Promise<void> {}

  async downloadFile(
    _url: string,
    destPath: string,
    _onProgress?: DownloadProgressCallback,
  ): Promise<void> {
    this.files.set(destPath, 'test-audio-content');
  }
}

function createMigratedDb(dbPath = ':memory:'): Db {
  const db = openTestDatabase(dbPath);
  for (const m of MIGRATIONS) {
    m.up(db);
  }
  return db;
}

describe('Ember Complete 15-Journey E2E Suite', () => {
  let db: Db;
  let sessionRepo: SessionRepo;
  let prefsRepo: PrefsRepo;
  let streakRepo: StreakRepo;
  let ledgerRepo: LedgerRepo;
  let entitlementRepo: EntitlementRepo;
  let billingService: MockBillingAdapter;
  let entitlementService: EntitlementServiceImpl;
  let driver: MockAudioDriver;
  let clock: TestClock;
  let controller: SessionController;

  const BASE_MS = 1_700_000_000_000; // fixed test epoch timestamp

  beforeEach(() => {
    db = createMigratedDb();
    sessionRepo = new SessionRepo(db);
    prefsRepo = new PrefsRepo(db);
    streakRepo = new StreakRepo(db);
    ledgerRepo = new LedgerRepo(db);
    entitlementRepo = new EntitlementRepo(db);

    clock = new TestClock(BASE_MS);
    billingService = new MockBillingAdapter(clock, undefined, {
      latencyMs: 0,
      nextOutcome: 'success',
    });
    entitlementService = new EntitlementServiceImpl(entitlementRepo, clock);

    driver = new MockAudioDriver();
    controller = new SessionController(
      { sessionRepo, prefsRepo, streakRepo, entitlementRepo },
      driver,
      clock,
    );
    jest.useFakeTimers();
  });

  afterEach(() => {
    controller.cleanupSession();
    jest.useRealTimers();
    db.close?.();
  });

  // ---------------------------------------------------------------------------
  // Journey 1: Fresh install → Sanctuary
  // ---------------------------------------------------------------------------
  test('Journey 1: Fresh install → Sanctuary initial state and access rules', () => {
    // 1. Initial streak state is zeroed
    const streak = streakRepo.get();
    expect(streak.currentStreak).toBe(0);
    expect(streak.longestStreak).toBe(0);
    expect(streak.graceBanked).toBe(0);
    expect(streak.lastCreditDay).toBeNull();

    // 2. Default preferences are set
    const prefs = prefsRepo.get();
    expect(prefs.selectedVoiceId).toBe('maya_warm');
    expect(prefs.ambientBedId).toBeNull();
    expect(prefs.voiceVolume).toBe(0.9);
    expect(prefs.ambientVolume).toBe(0.5);
    expect(prefs.sighPacerDefault).toBe(false);
    expect(prefs.notificationsEnabled).toBe(false);

    // 3. Entitlement is Free tier
    const snap = entitlementService.getSnapshot();
    expect(snap.level).toBe('free');
    expect(snap.plan).toBe('none');
    expect(snap.passAvailable).toBe(false);

    // 4. Canonical catalog: 5m and 10m free, 30m locked
    expect(CANONICAL_CARDS).toHaveLength(3);
    expect(entitlementService.canStartProtocol('rapid_reset_5').allowed).toBe(true);
    expect(entitlementService.canStartProtocol('afternoon_recharge_10').allowed).toBe(true);

    const proDecision = entitlementService.canStartProtocol('deep_rest_30');
    expect(proDecision.allowed).toBe(false);
    if (!proDecision.allowed) {
      expect(proDecision.paywallVariant).toBe('default');
    }
  });

  // ---------------------------------------------------------------------------
  // Journey 2: Start five-minute session
  // ---------------------------------------------------------------------------
  test('Journey 2: Start five-minute session initializes active state and DB row', async () => {
    await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false, // 5-minute session skips sigh pacer
    });

    const machineState = controller.getMachineState();
    expect(machineState.stage).toBe('ACTIVE');
    expect(machineState.isPlaying).toBe(true);
    expect(machineState.protocolId).toBe('rapid_reset_5');
    expect(machineState.plannedMs).toBe(300_000);

    const sessionId = controller.getActiveSessionId();
    expect(sessionId).toBeTruthy();

    const inProgress = sessionRepo.findInProgress();
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]?.id).toBe(sessionId);
    expect(inProgress[0]?.protocolId).toBe('rapid_reset_5');
    expect(inProgress[0]?.mode).toBe('focus');
    expect(inProgress[0]?.status).toBe('in_progress');

    // Dual-track audio driver initialized
    const voicePlayer = driver.createdPlayers[0];
    expect(voicePlayer).toBeDefined();
    expect(voicePlayer?.isPlaying).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Journey 3: Complete session
  // ---------------------------------------------------------------------------
  test('Journey 3: Complete session commits to session_logs and updates day_ledger and streak', async () => {
    await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false,
    });

    const sessionId = controller.getActiveSessionId()!;
    const voicePlayer = driver.createdPlayers[0];

    // Advance playback and trigger completion
    clock.advance(300_000);
    voicePlayer?.simulateTick(300_000, 300_000, true);
    await Promise.resolve();
    jest.advanceTimersByTime(3500); // allow chime rise transition to CHECKIN

    const machineState = controller.getMachineState();
    expect(machineState.stage).toBe('CHECKIN');

    // Verify session row was committed
    const sessionRow = sessionRepo.getById(sessionId);
    expect(sessionRow?.status).toBe('completed');
    expect(['natural_end', 'focus_threshold']).toContain(sessionRow?.commitReason);
    expect(sessionRow?.committedAtMs).toBeTruthy();
    expect(sessionRow?.listenedMs).toBeGreaterThanOrEqual(270_000);

    // Verify streak and day ledger credit
    const updatedStreak = streakRepo.get();
    expect(updatedStreak.currentStreak).toBe(1);
    expect(updatedStreak.longestStreak).toBe(1);
    expect(updatedStreak.lastCreditDay).toBe(dayKeyFromMs(BASE_MS));

    const ledger = ledgerRepo.getByDay(dayKeyFromMs(BASE_MS));
    expect(ledger?.sessions).toBe(1);
    expect(ledger?.committedMs).toBeGreaterThanOrEqual(270_000);
  });

  // ---------------------------------------------------------------------------
  // Journey 4: Record Calm Delta
  // ---------------------------------------------------------------------------
  test('Journey 4: Record Calm Delta updates self-reported recovery state', async () => {
    await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false,
    });

    const sessionId = controller.getActiveSessionId()!;
    const voicePlayer = driver.createdPlayers[0];

    // Non-blocking pre-checkin recorded during session
    controller.recordPreCheckin(1); // 1 = Overstimulated/Restless

    // Advance and complete
    clock.advance(300_000);
    voicePlayer?.simulateTick(300_000, 300_000, true);
    await Promise.resolve();
    jest.advanceTimersByTime(3500);

    // Post-checkin in CHECKIN stage
    controller.recordPostCheckin(4); // 4 = Settled/Calm

    const sessionRow = sessionRepo.getById(sessionId);
    expect(sessionRow?.preState).toBe(1);
    expect(sessionRow?.postState).toBe(4);

    const paired = sessionRepo.getPairedSessions();
    expect(paired).toHaveLength(1);
    const delta = (paired[0]?.postState as number) - (paired[0]?.preState as number);
    expect(delta).toBe(3); // 4 - 1 = +3 perceived shift
  });

  // ---------------------------------------------------------------------------
  // Journey 5: Restart app and verify history
  // ---------------------------------------------------------------------------
  test('Journey 5: Restart app preserves all session history and streak data across clean DB reopen', () => {
    const tempDbPath = path.join(os.tmpdir(), `ember-e2e-restart-${Date.now()}.db`);

    try {
      // 1. Initial run: Create and commit session
      let persistentDb = openTestDatabase(tempDbPath);
      for (const m of MIGRATIONS) {
        m.up(persistentDb);
      }

      let sRepo = new SessionRepo(persistentDb);
      let stRepo = new StreakRepo(persistentDb);

      const s = sRepo.create({
        protocolId: 'afternoon_recharge_10',
        voiceId: 'maya_warm',
        mode: 'focus',
        startedAtMs: BASE_MS,
        localDay: '2026-06-10',
        tzOffsetMin: 330,
        plannedMs: 600_000,
        preState: 2,
      });

      sRepo.commitSession(s.id, {
        listenedMs: 600_000,
        maxPositionMs: 600_000,
        commitReason: 'focus_threshold',
        nowMs: BASE_MS + 600_000,
      });
      sRepo.setPostState(s.id, 5);

      persistentDb.close?.();

      // 2. Relaunch: Reopen database and verify
      persistentDb = openTestDatabase(tempDbPath);
      sRepo = new SessionRepo(persistentDb);
      stRepo = new StreakRepo(persistentDb);

      const recent = sRepo.listRecent(7);
      expect(recent).toHaveLength(1);
      expect(recent[0]?.protocolId).toBe('afternoon_recharge_10');
      expect(recent[0]?.preState).toBe(2);
      expect(recent[0]?.postState).toBe(5);

      const stats = sRepo.getStats();
      expect(stats.sessions).toBe(1);
      expect(stats.minutes).toBe(10);

      const streakData = stRepo.get();
      expect(streakData.currentStreak).toBe(1);

      persistentDb.close?.();
    } finally {
      try {
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        if (fs.existsSync(`${tempDbPath}-wal`)) fs.unlinkSync(`${tempDbPath}-wal`);
        if (fs.existsSync(`${tempDbPath}-shm`)) fs.unlinkSync(`${tempDbPath}-shm`);
      } catch {}
    }
  });

  // ---------------------------------------------------------------------------
  // Journey 6: Download audio and use it offline
  // ---------------------------------------------------------------------------
  test('Journey 6: Bundled audio assets resolve offline without network and manager validates storage', async () => {
    // 1. Bundled assets resolve offline
    const rapidResetMaya = VOICE_TRACKS_METADATA.find(
      (v) => v.protocolId === 'rapid_reset_5' && v.voiceId === 'maya_warm',
    );
    expect(rapidResetMaya).toBeDefined();

    const source = resolveAudioSource(rapidResetMaya!.assetKey);
    expect(source).toBeTruthy();

    const rainBed = AMBIENT_BEDS_METADATA.rain;
    expect(rainBed).toBeDefined();
    expect(resolveAudioSource(rainBed.assetKey)).toBeTruthy();

    // 2. Offline audio manager validates local file storage and installation
    const mockFs = new MemoryFsDriver();
    const offlineMgr = new OfflineAudioManager({
      storageDir: '/data/user/0/com.emberrest.app/files/audio',
      fsDriver: mockFs,
    });

    const localPath = offlineMgr.resolveLocalPath('voices/arjun.ogg');
    expect(localPath).toContain('voices/arjun.ogg');

    // Simulate saving a downloaded asset
    await mockFs.writeFile(localPath, 'test-voice-bytes');
    const isInstalled = await offlineMgr.isAssetInstalled('voices/arjun.ogg');
    expect(isInstalled).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Journey 7: Switch narrator during playback
  // ---------------------------------------------------------------------------
  test('Journey 7: In-flight narrator switch preserves playback position and updates session record', async () => {
    await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false,
    });

    const sessionId = controller.getActiveSessionId()!;
    const voicePlayer = driver.createdPlayers[0];

    // Play until 60 seconds
    clock.advance(60_000);
    voicePlayer?.simulateTick(60_000, 300_000);

    // Perform in-flight narrator switch to Arjun
    const switchPromise = controller.switchVoice('arjun_deep');
    await Promise.resolve();
    jest.advanceTimersByTime(1500); // 1,500ms crossfade
    const switchSuccess = await switchPromise;
    expect(switchSuccess).toBe(true);

    // Machine state updated
    expect(controller.getMachineState().voiceId).toBe('arjun_deep');

    // Active session record in SQLite updated
    const sessionRow = sessionRepo.getById(sessionId);
    expect(sessionRow?.voiceId).toBe('arjun_deep');

    // Preferences updated
    expect(prefsRepo.get().selectedVoiceId).toBe('arjun_deep');

    // New active voice player retains exact position
    const arjunPlayer = driver.createdPlayers[driver.createdPlayers.length - 1];
    expect(arjunPlayer?.positionMs).toBe(60_000);
    expect(arjunPlayer?.isPlaying).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Journey 8: Pause and resume
  // ---------------------------------------------------------------------------
  test('Journey 8: Pause and resume manages driver and machine state without clock drift', async () => {
    await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false,
    });

    const voicePlayer = driver.createdPlayers[0];
    clock.advance(45_000);
    voicePlayer?.simulateTick(45_000, 300_000);

    // Pause playback
    controller.togglePlayPause();
    expect(controller.getMachineState().stage).toBe('ACTIVE');
    expect(controller.getMachineState().isPlaying).toBe(false);
    expect(voicePlayer?.isPlaying).toBe(false);

    // Wall clock advances while paused (e.g. 30 seconds pause)
    clock.advance(30_000);

    // Resume playback
    controller.togglePlayPause();
    expect(controller.getMachineState().stage).toBe('ACTIVE');
    expect(controller.getMachineState().isPlaying).toBe(true);
    expect(voicePlayer?.isPlaying).toBe(true);

    // Position was preserved without drift
    expect(voicePlayer?.positionMs).toBe(45_000);
  });

  // ---------------------------------------------------------------------------
  // Journey 9: Complete Sleep Mode
  // ---------------------------------------------------------------------------
  test('Journey 9: Sleep Mode auto-commits at 85% and prepares candidate for morning check-in', async () => {
    await controller.startSession({
      protocolId: 'afternoon_recharge_10',
      mode: 'sleep',
      voiceId: 'maya_warm',
      ambientBedId: 'theta_6hz',
      sigh: false,
    });

    const sessionId = controller.getActiveSessionId()!;
    const voicePlayer = driver.createdPlayers[0];

    // Play past 85% threshold (0.85 * 600,000 = 510,000 ms)
    clock.advance(510_000);
    voicePlayer?.simulateTick(510_000, 600_000);

    // Session is auto-committed in DB
    const sessionRow = sessionRepo.getById(sessionId);
    expect(sessionRow?.status).toBe('completed');
    expect(sessionRow?.commitReason).toBe('sleep_auto_commit');

    // Complete playback reaches end of track
    clock.advance(90_000);
    voicePlayer?.simulateTick(600_000, 600_000, true);
    await Promise.resolve();

    // Machine enters silent done
    expect(controller.getMachineState().stage).toBe('DONE_SILENT');

    // Next morning: candidate awaiting check-in
    const candidate = sessionRepo.getMorningCheckinCandidate(BASE_MS + 600_000 + 3600_000);
    expect(candidate?.id).toBe(sessionId);

    // User submits morning rating
    sessionRepo.setPostState(candidate!.id, 4);
    const updated = sessionRepo.getById(sessionId);
    expect(updated?.postState).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // Journey 10: Trigger and reconcile interrupted session
  // ---------------------------------------------------------------------------
  test('Journey 10: Cold start reconciles interrupted session based on mode and progress', () => {
    // Scenario A: Sleep session reached 90% before app crash -> committed with sleep_reconcile
    const s1 = sessionRepo.create({
      protocolId: 'afternoon_recharge_10',
      mode: 'sleep',
      startedAtMs: BASE_MS,
      localDay: '2026-06-11',
      tzOffsetMin: 330,
      plannedMs: 600_000,
    });
    sessionRepo.heartbeat(s1.id, 540_000, BASE_MS + 540_000);

    // Scenario B: Focus session reached 40% before crash -> finalized as partial
    const s2 = sessionRepo.create({
      protocolId: 'afternoon_recharge_10',
      mode: 'focus',
      startedAtMs: BASE_MS,
      localDay: '2026-06-11',
      tzOffsetMin: 330,
      plannedMs: 600_000,
    });
    sessionRepo.heartbeat(s2.id, 240_000, BASE_MS + 240_000);

    // Scenario C: Session killed after only 15 seconds -> abandoned
    const s3 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: BASE_MS,
      localDay: '2026-06-11',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    sessionRepo.heartbeat(s3.id, 15_000, BASE_MS + 15_000);

    // Run cold start reconciliation
    const reconciledCount = SessionController.reconcileColdStart(sessionRepo, clock);
    expect(reconciledCount).toBe(3);

    // Verify outcomes
    expect(sessionRepo.getById(s1.id)?.commitReason).toBe('sleep_reconcile');
    expect(sessionRepo.getById(s1.id)?.status).toBe('completed');

    expect(sessionRepo.getById(s2.id)?.status).toBe('partial');
    expect(sessionRepo.getById(s3.id)?.status).toBe('abandoned');
  });

  // ---------------------------------------------------------------------------
  // Journey 11: Earn and consume free pass
  // ---------------------------------------------------------------------------
  test('Journey 11: 3-day streak earns 14-day free pass, consumed at 20% of 30m session', async () => {
    // Day 1
    const s1 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: BASE_MS,
      localDay: '2026-06-01',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    sessionRepo.commitSession(s1.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: BASE_MS + 300_000,
    });

    // Day 2
    const s2 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: BASE_MS + 86_400_000,
      localDay: '2026-06-02',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    sessionRepo.commitSession(s2.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: BASE_MS + 86_400_000 + 300_000,
    });

    // Day 3
    const s3 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: BASE_MS + 2 * 86_400_000,
      localDay: '2026-06-03',
      tzOffsetMin: 330,
      plannedMs: 300_000,
    });
    sessionRepo.commitSession(s3.id, {
      listenedMs: 290_000,
      maxPositionMs: 290_000,
      commitReason: 'natural_end',
      nowMs: BASE_MS + 2 * 86_400_000 + 300_000,
    });

    // Free pass is earned! Refresh entitlement service to sync with repo
    clock.set(BASE_MS + 2 * 86_400_000);
    await entitlementService.init();

    expect(entitlementRepo.hasAvailablePass(BASE_MS + 2 * 86_400_000)).toBe(true);
    expect(entitlementService.canStartProtocol('deep_rest_30').allowed).toBe(true);

    // Start 30-min session with pass
    clock.set(BASE_MS + 3 * 86_400_000);
    await controller.startSession({
      protocolId: 'deep_rest_30',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false,
    });

    const voicePlayer = driver.createdPlayers[0];

    // Advance to 20% (360,000 ms of 1,800,000 ms)
    clock.advance(365_000);
    voicePlayer?.simulateTick(365_000, 1_800_000);

    // Pass is consumed!
    expect(entitlementRepo.hasAvailablePass(clock.now())).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Journey 12: Open Paywall and complete mock purchase
  // ---------------------------------------------------------------------------
  test('Journey 12: Paywall purchase unlocks Pro entitlement and features', async () => {
    // Fetch products
    const products = await billingService.getProducts();
    const lifetimeProduct = products.find((p) => p.id === 'ember_pro_lifetime');
    expect(lifetimeProduct).toBeDefined();

    // Purchase Lifetime Pro
    const purchaseResult = await billingService.purchase('ember_pro_lifetime');
    expect(purchaseResult.status).toBe('purchased');

    // Apply owned purchase to entitlement service
    if (purchaseResult.status === 'purchased') {
      await entitlementService.applyPurchase(purchaseResult);
    }

    // Verify snapshot is Pro
    const snap = entitlementService.getSnapshot();
    expect(snap.level).toBe('pro');
    expect(snap.plan).toBe('lifetime');

    // 30-minute session is now permanently allowed
    expect(entitlementService.canStartProtocol('deep_rest_30').allowed).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Journey 13: Restore purchase
  // ---------------------------------------------------------------------------
  test('Journey 13: Restore purchase recovers active Pro entitlement', async () => {
    // Seed mock adapter with pre-existing purchase
    await billingService.devGrant('ember_pro_monthly');

    // Simulate app startup or restore button tap
    const restored = await billingService.restore();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.productId).toBe('ember_pro_monthly');

    await entitlementService.applyOwned(restored);

    const snap = entitlementService.getSnapshot();
    expect(snap.level).toBe('pro');
    expect(snap.plan).toBe('monthly');
  });

  // ---------------------------------------------------------------------------
  // Journey 14: Open Journey
  // ---------------------------------------------------------------------------
  test('Journey 14: Open Journey displays accurate aggregates, history, and retention heatmap', () => {
    // Seed 1 completed session
    const s1 = sessionRepo.create({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      startedAtMs: BASE_MS,
      localDay: '2026-06-01',
      tzOffsetMin: 330,
      plannedMs: 300_000,
      preState: 1,
    });
    sessionRepo.commitSession(s1.id, {
      listenedMs: 300_000,
      maxPositionMs: 300_000,
      commitReason: 'natural_end',
      nowMs: BASE_MS + 300_000,
    });
    sessionRepo.setPostState(s1.id, 4);

    const stats = sessionRepo.getStats();
    expect(stats.sessions).toBe(1);
    expect(stats.minutes).toBe(5);

    const paired = sessionRepo.getPairedSessions();
    expect(paired).toHaveLength(1);
    const delta = (paired[0]?.postState as number) - (paired[0]?.preState as number);
    expect(delta).toBe(3);

    const recentSessions = sessionRepo.listRecent(7);
    expect(recentSessions).toHaveLength(1);

    const range = ledgerRepo.getRange('2026-06-01', '2026-06-01');
    expect(range).toHaveLength(1);
    expect(range[0]?.sessions).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Journey 15: Deny notification permission & verify normal operation
  // ---------------------------------------------------------------------------
  test('Journey 15: Denying notification permission leaves core rest functionality completely unimpaired', async () => {
    // Set notifications disabled
    prefsRepo.patch({ notificationsEnabled: false });

    // Sync notification schedule
    const planned = await syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo }, BASE_MS);
    expect(planned).toBeNull();

    // App and playback operate 100% cleanly
    await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false,
    });

    expect(controller.getMachineState().stage).toBe('ACTIVE');
    const voicePlayer = driver.createdPlayers[0];
    expect(voicePlayer?.isPlaying).toBe(true);
  });
});
