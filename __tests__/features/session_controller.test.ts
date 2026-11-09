/**
 * SessionController Integration Tests
 * Master Plan Part 2 §3.4, Part 5 §6.7-§6.9
 */

import { MockAudioDriver } from '../../src/audio/MockAudioDriver';
import { BUNDLED_AUDIO_SOURCES } from '../../src/audio/assetSources';
import type { Db } from '../../src/data/db';
import { openTestDatabase } from '../helpers/testDb';
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
    db.close?.();
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

  it('rejects duplicate session starts while native audio preparation is pending', async () => {
    const options = {
      protocolId: 'rapid_reset_5' as const,
      mode: 'focus' as const,
      voiceId: 'maya_warm',
      ambientBedId: null,
      sigh: false,
    };

    const firstStart = controller.startSession(options);
    await expect(controller.startSession(options)).rejects.toThrow(
      'A rest session is already active or starting.',
    );
    await expect(firstStart).resolves.toBeDefined();
    expect(sessionRepo.findInProgress()).toHaveLength(1);
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

  it.each([
    ['rapid_reset_5', 300_000],
    ['afternoon_recharge_10', 600_000],
    ['deep_rest_30', 1_800_000],
  ] as const)(
    'keeps %s duration aligned through pause and resume',
    async (protocolId, durationMs) => {
      await controller.startSession({
        protocolId,
        mode: 'focus',
        voiceId: 'maya_warm',
        ambientBedId: null,
        sigh: false,
      });
      expect(controller.getMachineState().plannedMs).toBe(durationMs);

      const player = driver.createdPlayers[0];
      controller.pause();
      player?.simulateTick(30_000, durationMs);
      expect(controller.getMachineState().listenedMs).toBe(0);

      controller.play();
      player?.simulateTick(60_000, durationMs);
      expect(controller.getMachineState().listenedMs).toBe(30_000);
    },
  );

  it('preserves elapsed time across repeated background interruptions and resume', async () => {
    await controller.startSession({
      protocolId: 'afternoon_recharge_10',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: null,
      sigh: false,
    });
    const player = driver.createdPlayers[0];
    player?.simulateTick(10_000, 600_000);
    controller.pauseForBackground();
    controller.pauseForBackground();
    player?.simulateTick(90_000, 600_000);

    expect(controller.getMachineState().isPlaying).toBe(false);
    expect(controller.getMachineState().listenedMs).toBe(10_000);

    controller.play();
    player?.simulateTick(100_000, 600_000);
    expect(controller.getMachineState().listenedMs).toBe(20_000);
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

  it('routes the 10-minute Maya and Arjun selections to their own bundled recordings', async () => {
    await controller.startSession({
      protocolId: 'afternoon_recharge_10',
      mode: 'focus',
      voiceId: 'maya_warm',
      ambientBedId: null,
      sigh: false,
    });

    const mayaPlayer = driver.createdPlayers[0];
    expect(mayaPlayer?.source).toBe(BUNDLED_AUDIO_SOURCES.voice_maya_afternoon_recharge_10_focus);
    mayaPlayer?.simulateTick(30_000, 600_000);

    const switchPromise = controller.switchVoice('arjun_deep');
    await Promise.resolve();
    jest.advanceTimersByTime(1500);
    await expect(switchPromise).resolves.toBe(true);

    const arjunPlayer = driver.createdPlayers[1];
    expect(arjunPlayer?.source).toBe(BUNDLED_AUDIO_SOURCES.voice_arjun_afternoon_recharge_10_focus);
    expect(arjunPlayer?.seekCalls).toContain(30_000);
    expect(mayaPlayer?.isReleased).toBe(true);
    expect(arjunPlayer?.isPlaying).toBe(true);
    expect(controller.getMachineState().voiceId).toBe('arjun_deep');
    expect(sessionRepo.findInProgress()[0]?.voiceId).toBe('arjun_deep');
    expect(prefsRepo.get().selectedVoiceId).toBe('arjun_deep');
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
