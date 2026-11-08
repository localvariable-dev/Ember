/**
 * Session Lifecycle State Machine Tests
 * Master Plan Part 2 §3.4
 */

import {
  INITIAL_SESSION_STATE,
  reduceSession,
  type SessionState,
} from '../../src/domain/sessionMachine';

describe('sessionMachine: lifecycle and commits', () => {
  it('begins session without sigh pacer directly into ACTIVE with START_AUDIO effect', () => {
    const res = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya',
      ambientBedId: 'rain',
      sigh: false,
      startedAtMs: 1000,
    });

    expect(res.state.stage).toBe('ACTIVE');
    expect(res.state.isPlaying).toBe(true);
    expect(res.effects).toContainEqual({
      type: 'START_AUDIO',
      protocolId: 'rapid_reset_5',
      voiceId: 'maya',
      ambientBedId: 'rain',
      positionMs: 0,
    });
  });

  it('begins session with sigh pacer into PREROLL; skips pacer into ACTIVE', () => {
    const beginRes = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya',
      ambientBedId: 'off',
      sigh: true,
      startedAtMs: 1000,
    });

    expect(beginRes.state.stage).toBe('PREROLL');
    expect(beginRes.state.isPlaying).toBe(false);

    const skipRes = reduceSession(beginRes.state, { type: 'PACER_SKIP' });
    expect(skipRes.state.stage).toBe('ACTIVE');
    expect(skipRes.state.isPlaying).toBe(true);
    expect(skipRes.effects).toContainEqual({
      type: 'START_AUDIO',
      protocolId: 'rapid_reset_5',
      voiceId: 'maya',
      ambientBedId: 'off',
      positionMs: 0,
    });
  });

  it('commits Focus mode session at 90% threshold', () => {
    let s: SessionState = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'rapid_reset_5', // planned = 300,000 ms; 90% = 270,000 ms
      mode: 'focus',
      voiceId: 'maya',
      ambientBedId: 'off',
      sigh: false,
      startedAtMs: 1000,
    }).state;

    // Below 90%
    const update1 = reduceSession(s, {
      type: 'POSITION_UPDATE',
      positionMs: 260_000,
      timestampMs: 261_000,
    });
    expect(update1.state.committed).toBe(false);
    expect(update1.effects.some((e) => e.type === 'COMMIT_SESSION')).toBe(false);

    // At 90%
    const update2 = reduceSession(update1.state, {
      type: 'POSITION_UPDATE',
      positionMs: 270_000,
      timestampMs: 271_000,
    });
    expect(update2.state.committed).toBe(true);
    expect(update2.state.commitReason).toBe('focus_threshold');
    expect(update2.effects).toContainEqual({
      type: 'COMMIT_SESSION',
      reason: 'focus_threshold',
    });

    // Subsequent updates do not re-emit commit
    const update3 = reduceSession(update2.state, {
      type: 'POSITION_UPDATE',
      positionMs: 280_000,
      timestampMs: 281_000,
    });
    expect(update3.effects.some((e) => e.type === 'COMMIT_SESSION')).toBe(false);
  });

  it('commits Sleep mode session at 85% threshold with auto_commit', () => {
    let s: SessionState = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'afternoon_recharge_10', // planned = 600,000 ms; 85% = 510,000 ms
      mode: 'sleep',
      voiceId: 'maya',
      ambientBedId: 'rain',
      sigh: false,
      startedAtMs: 1000,
    }).state;

    const res = reduceSession(s, {
      type: 'POSITION_UPDATE',
      positionMs: 510_000,
      timestampMs: 511_000,
    });

    expect(res.state.committed).toBe(true);
    expect(res.state.commitReason).toBe('sleep_auto_commit');
    expect(res.effects).toContainEqual({
      type: 'COMMIT_SESSION',
      reason: 'sleep_auto_commit',
    });
  });

  it('fades ambient audio during the final 90 seconds of Sleep mode', () => {
    let s: SessionState = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'rapid_reset_5', // planned = 300,000 ms; fade starts at 210,000 ms
      mode: 'sleep',
      voiceId: 'maya',
      ambientBedId: 'rain',
      sigh: false,
      startedAtMs: 1000,
    }).state;

    const res = reduceSession(s, {
      type: 'POSITION_UPDATE',
      positionMs: 255_000, // 45s remaining of 90s fade -> t = 0.5 -> cubic = 0.125
      timestampMs: 256_000,
    });

    const fadeEffect = res.effects.find((e) => e.type === 'FADE_AMBIENT');
    expect(fadeEffect).toBeDefined();
    if (fadeEffect && fadeEffect.type === 'FADE_AMBIENT') {
      expect(fadeEffect.fadeFactor).toBeCloseTo(0.125, 2);
    }
  });

  it('switches narrator in-flight without resetting position or progress', () => {
    let s: SessionState = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya',
      ambientBedId: 'off',
      sigh: false,
      startedAtMs: 1000,
    }).state;

    s = reduceSession(s, {
      type: 'POSITION_UPDATE',
      positionMs: 150_000,
      timestampMs: 151_000,
    }).state;

    const switchRes = reduceSession(s, {
      type: 'SWITCH_VOICE',
      voiceId: 'arjun',
    });

    expect(switchRes.state.voiceId).toBe('arjun');
    expect(switchRes.state.positionMs).toBe(150_000);
    expect(switchRes.state.listenedMs).toBe(150_000);
    expect(switchRes.effects).toContainEqual({
      type: 'SWITCH_VOICE',
      targetVoiceId: 'arjun',
      positionMs: 150_000,
    });
  });

  it('consumes Free Pass at 20% mark for 30-minute session', () => {
    let s: SessionState = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'deep_rest_30', // planned = 1,800,000 ms; 20% = 360,000 ms
      mode: 'sleep',
      voiceId: 'maya',
      ambientBedId: 'rain',
      sigh: false,
      startedAtMs: 1000,
      accessVia: 'free_pass',
    }).state;

    expect(s.passConsumed).toBe(false);

    // Below 20%
    const res1 = reduceSession(s, {
      type: 'POSITION_UPDATE',
      positionMs: 350_000,
      timestampMs: 351_000,
    });
    expect(res1.state.passConsumed).toBe(false);
    expect(res1.effects.some((e) => e.type === 'CONSUME_PASS')).toBe(false);

    // At 20% (6 minutes)
    const res2 = reduceSession(res1.state, {
      type: 'POSITION_UPDATE',
      positionMs: 360_000,
      timestampMs: 361_000,
    });
    expect(res2.state.passConsumed).toBe(true);
    expect(res2.effects).toContainEqual({ type: 'CONSUME_PASS' });
  });

  it('handles early exit: abandoned if listened < 120s, partial if >= 120s', () => {
    // Under 120s -> abandoned
    let s1: SessionState = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya',
      ambientBedId: 'off',
      sigh: false,
      startedAtMs: 1000,
    }).state;

    s1 = reduceSession(s1, {
      type: 'POSITION_UPDATE',
      positionMs: 60_000,
      timestampMs: 61_000,
    }).state;

    const exit1 = reduceSession(s1, { type: 'END_CONFIRMED' });
    expect(exit1.state.stage).toBe('DONE');
    expect(exit1.effects).toContainEqual({
      type: 'FINALIZE_SESSION',
      status: 'abandoned',
      listenedMs: 60_000,
    });

    // 120s or more -> partial
    let s2: SessionState = reduceSession(INITIAL_SESSION_STATE, {
      type: 'BEGIN',
      protocolId: 'rapid_reset_5',
      mode: 'focus',
      voiceId: 'maya',
      ambientBedId: 'off',
      sigh: false,
      startedAtMs: 1000,
    }).state;

    s2 = reduceSession(s2, {
      type: 'POSITION_UPDATE',
      positionMs: 130_000,
      timestampMs: 131_000,
    }).state;

    const exit2 = reduceSession(s2, { type: 'END_CONFIRMED' });
    expect(exit2.state.stage).toBe('DONE');
    expect(exit2.effects).toContainEqual({
      type: 'FINALIZE_SESSION',
      status: 'partial',
      listenedMs: 130_000,
    });
  });
});
