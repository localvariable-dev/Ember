/**
 * DualTrackEngine Unit & Integration Tests
 * Master Plan Part 5 §6.7, §6.8, §6.9
 */

import { DualTrackEngine } from '../../src/audio/DualTrackEngine';
import { MockAudioDriver } from '../../src/audio/MockAudioDriver';
import { TestClock } from '../../src/domain/clock';

describe('DualTrackEngine', () => {
  let driver: MockAudioDriver;
  let clock: TestClock;
  let engine: DualTrackEngine;

  beforeEach(() => {
    driver = new MockAudioDriver();
    clock = new TestClock(1_000_000);
    engine = new DualTrackEngine(driver, clock);
    jest.useFakeTimers();
  });

  afterEach(() => {
    engine.dispose();
    jest.useRealTimers();
  });

  it('prepares and plays voice as master clock with perceptual volume taper', async () => {
    const positionEvents: number[] = [];
    engine.on((e) => {
      if (e.type === 'position') {
        positionEvents.push(e.positionMs);
      }
    });

    await engine.prepare({
      voiceSource: { uri: 'voice_maya.ogg' },
      voiceId: 'maya_warm',
      bedSource: { uri: 'bed_rain.ogg' },
      mode: 'focus',
      plannedMs: 300_000,
      voiceVolume: 0.8, // 0.8^2 = 0.64
      ambientVolume: 0.5, // 0.5^2 = 0.25
    });

    const voicePlayer = driver.createdPlayers[0];
    const ambientPlayer = driver.createdPlayers[1];

    expect(voicePlayer).toBeDefined();
    expect(ambientPlayer).toBeDefined();

    // Verify perceptual volume taper (v^2)
    expect(voicePlayer?.volume).toBeCloseTo(0.64, 2);
    expect(ambientPlayer?.volume).toBeCloseTo(0.25, 2);
    expect(ambientPlayer?.isLooping).toBe(true);

    engine.start();
    expect(voicePlayer?.isPlaying).toBe(true);
    expect(ambientPlayer?.isPlaying).toBe(true);

    // Simulate voice track tick (Track A = Master clock)
    voicePlayer?.simulateTick(5000, 300_000);
    expect(positionEvents).toContain(5000);
  });

  it('performs in-flight narrator switch with 1,500ms equal-power crossfade and timeline alignment', async () => {
    let switchedVoiceId: string | null = null;
    engine.on((e) => {
      if (e.type === 'voice_switched') {
        switchedVoiceId = e.voiceId;
      }
    });

    await engine.prepare({
      voiceSource: { uri: 'voice_maya.ogg' },
      voiceId: 'maya_warm',
      bedSource: null,
      mode: 'focus',
      plannedMs: 300_000,
      voiceVolume: 1.0,
      ambientVolume: 0.5,
    });

    engine.start();
    const mayaPlayer = driver.createdPlayers[0];
    mayaPlayer?.simulateTick(42_000, 300_000);

    // Switch to Arjun in-flight at 42,000ms
    const switchPromise = engine.switchVoice({ uri: 'voice_arjun.ogg' }, 'arjun_deep');
    await Promise.resolve();

    // Incoming player should be created and seeked to current playback position (42,000ms)
    const arjunPlayer = driver.createdPlayers[1];
    expect(arjunPlayer).toBeDefined();
    expect(arjunPlayer?.seekCalls).toContain(42_000);

    // Advance halfway through crossfade (750ms)
    jest.advanceTimersByTime(750);
    // Equal power at midpoint (progress = 0.5): cos(pi/4) = sin(pi/4) ~= 0.7071
    expect(mayaPlayer?.volume).toBeCloseTo(Math.cos(Math.PI / 4), 2);
    expect(arjunPlayer?.volume).toBeCloseTo(Math.sin(Math.PI / 4), 2);

    // Advance remainder of crossfade (1500ms total)
    jest.advanceTimersByTime(750);
    await switchPromise;

    expect(switchedVoiceId).toBe('arjun_deep');
    expect(engine.getVoiceId()).toBe('arjun_deep');
    expect(mayaPlayer?.isReleased).toBe(true);
    expect(arjunPlayer?.isPlaying).toBe(true);
  });

  it('safely falls back to existing voice if incoming voice fails to load or seek', async () => {
    let switchError: string | null = null;
    engine.on((e) => {
      if (e.type === 'voice_switch_failed') {
        switchError = e.error;
      }
    });

    await engine.prepare({
      voiceSource: { uri: 'voice_maya.ogg' },
      voiceId: 'maya_warm',
      bedSource: null,
      mode: 'focus',
      plannedMs: 300_000,
      voiceVolume: 1.0,
      ambientVolume: 0.5,
    });

    engine.start();
    const mayaPlayer = driver.createdPlayers[0];
    mayaPlayer?.simulateTick(10_000, 300_000);

    // Inject failure for incoming player creation
    driver.nextCreateError = new Error('Disk read failure');

    await engine.switchVoice({ uri: 'bad_asset.ogg' }, 'arjun_deep');

    expect(switchError).toBe('Disk read failure');
    // Maya narrator remains uninterrupted
    expect(engine.getVoiceId()).toBe('maya_warm');
    expect(mayaPlayer?.isPlaying).toBe(true);
    expect(mayaPlayer?.isReleased).toBe(false);
  });

  it('applies pause-safe cubic ambient fade over final 90 seconds in sleep mode', async () => {
    await engine.prepare({
      voiceSource: { uri: 'voice_maya.ogg' },
      voiceId: 'maya_warm',
      bedSource: { uri: 'bed_rain.ogg' },
      mode: 'sleep',
      plannedMs: 600_000, // 10 minutes
      voiceVolume: 0.9,
      ambientVolume: 1.0, // user volume 1.0 -> max 1.0
    });

    engine.start();
    const voicePlayer = driver.createdPlayers[0];
    const ambientPlayer = driver.createdPlayers[1];

    // At 500,000ms (100s remaining, > 90s), volume is full
    voicePlayer?.simulateTick(500_000, 600_000);
    expect(ambientPlayer?.volume).toBeCloseTo(1.0, 2);

    // At 555,000ms (45s remaining, half of 90s):
    // fadeFactor = (45 / 90)^3 = 0.5^3 = 0.125
    voicePlayer?.simulateTick(555_000, 600_000);
    expect(ambientPlayer?.volume).toBeCloseTo(0.125, 2);

    // At 600,000ms (0s remaining): volume is 0
    voicePlayer?.simulateTick(600_000, 600_000);
    expect(ambientPlayer?.volume).toBeCloseTo(0.0, 2);
  });

  it('emits natural completion only once if native status repeats didJustFinish', async () => {
    await engine.prepare({
      voiceSource: { uri: 'voice_maya.ogg' },
      voiceId: 'maya_warm',
      bedSource: null,
      mode: 'focus',
      plannedMs: 300_000,
      voiceVolume: 0.9,
      ambientVolume: 0.5,
    });
    let endedCount = 0;
    engine.on((event) => {
      if (event.type === 'ended') endedCount += 1;
    });
    engine.start();

    const player = driver.createdPlayers[0];
    player?.simulateTick(300_000, 300_000, true);
    player?.simulateTick(300_000, 300_000, true);

    expect(endedCount).toBe(1);
  });

  it('fades ambient over 6s during focus mode ending chime', async () => {
    await engine.prepare({
      voiceSource: { uri: 'voice_maya.ogg' },
      voiceId: 'maya_warm',
      bedSource: { uri: 'bed_rain.ogg' },
      mode: 'focus',
      plannedMs: 300_000,
      voiceVolume: 0.9,
      ambientVolume: 1.0,
    });

    engine.start();
    const ambientPlayer = driver.createdPlayers[1];

    await engine.playEndingChime({ uri: 'chime_rise.wav' });

    const chimePlayer = driver.createdPlayers[2];
    expect(chimePlayer).toBeDefined();
    expect(chimePlayer?.isPlaying).toBe(true);

    // Advance 3 seconds (halfway through 6s fade)
    jest.advanceTimersByTime(3000);
    expect(ambientPlayer?.volume).toBeCloseTo(0.5, 1);

    // Advance to 6s
    jest.advanceTimersByTime(3000);
    expect(ambientPlayer?.volume).toBeCloseTo(0.0, 1);
  });

  it('pauses playback on audio interruption and headphone disconnect', async () => {
    let interruptedTransient: boolean | null = null;
    engine.on((e) => {
      if (e.type === 'interrupted') {
        interruptedTransient = e.transient;
      }
    });

    await engine.prepare({
      voiceSource: { uri: 'voice_maya.ogg' },
      voiceId: 'maya_warm',
      bedSource: null,
      mode: 'focus',
      plannedMs: 300_000,
      voiceVolume: 0.9,
      ambientVolume: 0.5,
    });

    engine.start();
    expect(engine.getIsPlaying()).toBe(true);

    // Incoming phone call (transient interruption)
    engine.handleAudioInterruption(true);
    expect(engine.getIsPlaying()).toBe(false);
    expect(interruptedTransient).toBe(true);

    // Headphones unplugged (audio becoming noisy)
    engine.start();
    engine.handleAudioBecomingNoisy();
    expect(engine.getIsPlaying()).toBe(false);
    expect(interruptedTransient).toBe(false);
  });
});
