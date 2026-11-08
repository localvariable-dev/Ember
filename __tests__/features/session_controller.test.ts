/**
 * SessionController Integration Tests
 * Master Plan Part 2 §3.4, Part 5 §6.7-§6.9
 */

import { MockAudioDriver } from '../../src/audio/MockAudioDriver';
import { openTestDatabase, type Db } from '../../src/data/db';
import { MIGRATIONS } from '../../src/data/migrations';
import { EntitlementRepo } from '../../src/data/repos/EntitlementRepo';
import { PrefsRepo } from '../../src/data/repos/PrefsRepo';
import { SessionRepo } from '../../src/data/repos/SessionRepo';
import { StreakRepo } from '../../src/data/repos/StreakRepo';
import { TestClock } from '../../src/domain/clock';
import { SessionController } from '../../src/features/player/SessionController';

function createMigratedDb(): Db {
  const db = openTestDatabase(':memory:');
  for (const m of MIGRATIONS) {
    m.up(db);
  }
  return db;
}

describe('SessionController', () => {
  let db: Db;
  let sessionRepo: SessionRepo;
  let prefsRepo: PrefsRepo;
  let streakRepo: StreakRepo;
  let entitlementRepo: EntitlementRepo;
  let driver: MockAudioDriver;
  let clock: TestClock;
  let controller: SessionController;

  beforeEach(() => {
    db = createMigratedDb();
    sessionRepo = new SessionRepo(db);
    prefsRepo = new PrefsRepo(db);
    streakRepo = new StreakRepo(db);
    entitlementRepo = new EntitlementRepo(db);
    driver = new MockAudioDriver();
    clock = new TestClock(1_700_000_000_000); // fixed epoch timestamp

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
  });

  it('creates SQLite session log and starts playback', async () => {
    const sessionId = await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false,
    });

    expect(sessionId).toBeDefined();
    const session = sessionRepo.getById(sessionId);
    expect(session).not.toBeNull();
    expect(session?.protocolId).toBe('rapid_reset_5');
    expect(session?.mode).toBe('focus');
    expect(session?.voiceId).toBe('maya_warm');
    expect(session?.ambientBedId).toBe('rain');
    expect(session?.status).toBe('in_progress');

    // DualTrackEngine should be active
    expect(controller.getEngine().getIsPlaying()).toBe(true);
  });

  it('persists periodic heartbeats every 5 seconds to SQLite', async () => {
    const sessionId = await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: null,
      sigh: false,
    });

    const voicePlayer = driver.createdPlayers[0];

    // Tick at 5,000ms
    clock.advance(5000);
    voicePlayer?.simulateTick(5000, 300_000);

    let session = sessionRepo.getById(sessionId);
    expect(session?.heartbeatAtMs).toBe(clock.now());

    // Advance 5 more seconds
    clock.advance(5000);
    voicePlayer?.simulateTick(10_000, 300_000);

    session = sessionRepo.getById(sessionId);
    expect(session?.heartbeatAtMs).toBe(clock.now());
    expect(session?.maxPositionMs).toBe(10_000);
  });

  it('silently auto-commits sleep mode sessions at 85% threshold', async () => {
    const sessionId = await controller.startSession({
      protocolId: 'afternoon_recharge_10',
      mode: 'sleep',
      voiceId: 'maya_warm',
      ambientBedId: 'rain',
      sigh: false,
    });

    const voicePlayer = driver.createdPlayers[0];

    // 85% of 600,000ms = 510,000ms
    clock.advance(510_000);
    voicePlayer?.simulateTick(510_000, 600_000);

    const session = sessionRepo.getById(sessionId);
    expect(session?.status).toBe('completed');
    expect(session?.commitReason).toBe('sleep_auto_commit');
    expect(session?.committedAtMs).not.toBeNull();

    // Verify streak was credited
    const streak = streakRepo.get();
    expect(streak.currentStreak).toBe(1);
  });

  it('records in-flight narrator switch in SQLite session_logs and user preferences', async () => {
    const sessionId = await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: null,
      sigh: false,
    });

    const voicePlayer = driver.createdPlayers[0];
    voicePlayer?.simulateTick(30_000, 300_000);

    // Switch narrator mid-flight to Arjun
    const switchPromise = controller.switchVoice('arjun_deep');
    await Promise.resolve();
    jest.advanceTimersByTime(1500); // allow 1,500ms crossfade to complete
    await switchPromise;

    // Verify session_logs.voice_id was updated to arjun_deep
    const session = sessionRepo.getById(sessionId);
    expect(session?.voiceId).toBe('arjun_deep');

    // Verify user preferences persisted choice
    const prefs = prefsRepo.get();
    expect(prefs.selectedVoiceId).toBe('arjun_deep');
  });

  it('records pre-checkin and post-checkin perceived states in SQLite', async () => {
    const sessionId = await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: null,
      sigh: false,
    });

    // Record pre-state (1 = Wired) during first 20s
    controller.recordPreCheckin(1);
    let session = sessionRepo.getById(sessionId);
    expect(session?.preState).toBe(1);

    // Complete session and record post-state (4 = Calm)
    const voicePlayer = driver.createdPlayers[0];
    voicePlayer?.simulateTick(300_000, 300_000, true);
    await Promise.resolve();
    jest.advanceTimersByTime(3500); // allow chime rise to transition ENDING -> CHECKIN

    controller.recordPostCheckin(4);
    session = sessionRepo.getById(sessionId);
    expect(session?.postState).toBe(4);
  });

  it('finalizes uncommitted session as partial or abandoned on early exit', async () => {
    const sessionId = await controller.startSession({
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: null,
      sigh: false,
    });

    const voicePlayer = driver.createdPlayers[0];
    // Listened for 150 seconds (>= 120s threshold -> partial)
    voicePlayer?.simulateTick(150_000, 300_000);

    controller.endSessionEarly();

    const session = sessionRepo.getById(sessionId);
    expect(session?.status).toBe('partial');
    expect(session?.committedAtMs).toBeNull();
  });

  it('reconciles cold start: auto-commits sleep session reaching >= 85%', () => {
    // Insert orphaned in_progress sleep session that reached 85%
    sessionRepo.create({
      id: 'interrupted_sleep_session',
      protocolId: 'afternoon_recharge_10',
      voiceId: 'maya_warm',
      mode: 'sleep',
      ambientBedId: null,
      sighPacer: false,
      accessVia: 'free',
      startedAtMs: clock.now() - 600_000,
      localDay: '2026-11-08',
      tzOffsetMin: 330,
      plannedMs: 600_000,
    });
    sessionRepo.heartbeat('interrupted_sleep_session', 520_000, clock.now() - 80_000);

    const reconciled = SessionController.reconcileColdStart(sessionRepo, clock);
    expect(reconciled).toBe(1);

    const session = sessionRepo.getById('interrupted_sleep_session');
    expect(session?.status).toBe('completed');
    expect(session?.commitReason).toBe('sleep_reconcile');
  });
});
