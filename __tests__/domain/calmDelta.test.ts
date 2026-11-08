/**
 * Calm Delta Unit Tests
 * Master Plan Part 2 §3.8
 */

import {
  computeBestTimeOfDayBand,
  computeHeadlineInsight,
  computeMeanDeltaBySlice,
  computeWeeklyMeanDelta,
  type DetailedPairedSession,
  type PairedSession,
} from '../../src/domain/calmDelta';
import { STATE } from '../../src/domain/constants';

describe('calmDelta: computeHeadlineInsight', () => {
  it('returns guidance copy when fewer than 5 paired sessions exist', () => {
    const sessions: PairedSession[] = [
      { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.CALM },
      { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.CALM },
    ];
    const insight = computeHeadlineInsight(sessions);
    expect(insight.hasInsight).toBe(false);
    expect(insight.text).toBe('Log 5 sessions with a before-and-after tap to see your Calm Delta.');
  });

  it('generates percentage shift headline when a qualifying group (n >= 5) has pctCalmPlus >= 50%', () => {
    // 5 sessions of rapid_reset_5 starting Wired (1), ending Calm (4) or Restored (5)
    const sessions: PairedSession[] = [
      { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.CALM },
      { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.CALM },
      { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.CALM },
      { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.RESTORED },
      { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.RESTORED },
    ];

    const insight = computeHeadlineInsight(sessions);
    expect(insight.hasInsight).toBe(true);
    expect(insight.text).toContain(
      'When you start Wired, your 5-min sessions end Calm or Restored 100% of the time (5 sessions).',
    );
  });

  it('generates Restored percentage headline when pctRestored >= 50%', () => {
    const sessions: PairedSession[] = [
      { protocolId: 'afternoon_recharge_10', preState: STATE.DRAINED, postState: STATE.RESTORED },
      { protocolId: 'afternoon_recharge_10', preState: STATE.DRAINED, postState: STATE.RESTORED },
      { protocolId: 'afternoon_recharge_10', preState: STATE.DRAINED, postState: STATE.RESTORED },
      { protocolId: 'afternoon_recharge_10', preState: STATE.DRAINED, postState: STATE.CALM },
      { protocolId: 'afternoon_recharge_10', preState: STATE.DRAINED, postState: STATE.NEUTRAL },
    ];

    const insight = computeHeadlineInsight(sessions);
    expect(insight.hasInsight).toBe(true);
    expect(insight.text).toContain(
      'Your 10-min sessions shift you from Drained to Restored 60% of the time (5 sessions).',
    );
  });

  it('falls back to average delta across sessions when no single group reaches 5', () => {
    // 5 total sessions, but spread across different pre-states or protocols
    const sessions: PairedSession[] = [
      { protocolId: 'rapid_reset_5', preState: STATE.WIRED, postState: STATE.CALM }, // +3
      { protocolId: 'afternoon_recharge_10', preState: STATE.DRAINED, postState: STATE.CALM }, // +2
      { protocolId: 'rapid_reset_5', preState: STATE.NEUTRAL, postState: STATE.RESTORED }, // +2
      { protocolId: 'deep_rest_30', preState: STATE.WIRED, postState: STATE.RESTORED }, // +4
      { protocolId: 'afternoon_recharge_10', preState: STATE.NEUTRAL, postState: STATE.CALM }, // +1
    ];

    const insight = computeHeadlineInsight(sessions);
    expect(insight.hasInsight).toBe(true);
    expect(insight.text).toContain("Across 5 sessions you've moved up");
    expect(insight.averageDelta).toBeGreaterThan(0);
  });
});

describe('calmDelta: computeBestTimeOfDayBand', () => {
  it('selects the band with the highest mean delta with at least 3 sessions', () => {
    // 3 sessions in afternoon (15-18) with delta +3
    const baseDate = new Date(2026, 5, 15, 16, 0, 0); // 16:00
    const sessions = [
      {
        protocolId: 'afternoon_recharge_10' as const,
        preState: STATE.DRAINED,
        postState: STATE.RESTORED,
        startedAtMs: baseDate.getTime(),
      },
      {
        protocolId: 'afternoon_recharge_10' as const,
        preState: STATE.DRAINED,
        postState: STATE.RESTORED,
        startedAtMs: baseDate.getTime() + 86400000,
      },
      {
        protocolId: 'afternoon_recharge_10' as const,
        preState: STATE.DRAINED,
        postState: STATE.RESTORED,
        startedAtMs: baseDate.getTime() + 172800000,
      },
    ];

    const best = computeBestTimeOfDayBand(sessions);
    expect(best).not.toBeNull();
    expect(best?.band).toBe('15–18');
    expect(best?.meanDelta).toBe(3);
  });
});

describe('calmDelta: computeMeanDeltaBySlice', () => {
  const sessions: DetailedPairedSession[] = [
    {
      protocolId: 'rapid_reset_5',
      voiceId: 'maya',
      mode: 'focus',
      preState: STATE.WIRED,
      postState: STATE.CALM, // +3
    },
    {
      protocolId: 'rapid_reset_5',
      voiceId: 'arjun',
      mode: 'focus',
      preState: STATE.DRAINED,
      postState: STATE.CALM, // +2
    },
    {
      protocolId: 'afternoon_recharge_10',
      voiceId: 'maya',
      mode: 'sleep',
      preState: STATE.DRAINED,
      postState: STATE.RESTORED, // +3
    },
  ];

  it('computes mean delta grouped by protocolId', () => {
    const slices = computeMeanDeltaBySlice(sessions, 'protocolId');
    const rapid = slices.find((s) => s.sliceValue === 'rapid_reset_5');
    const recharge = slices.find((s) => s.sliceValue === 'afternoon_recharge_10');

    expect(rapid).toBeDefined();
    expect(rapid?.sampleCount).toBe(2);
    expect(rapid?.meanDelta).toBe(2.5); // (3 + 2) / 2

    expect(recharge).toBeDefined();
    expect(recharge?.sampleCount).toBe(1);
    expect(recharge?.meanDelta).toBe(3);
  });

  it('computes mean delta grouped by voiceId', () => {
    const slices = computeMeanDeltaBySlice(sessions, 'voiceId');
    const maya = slices.find((s) => s.sliceValue === 'maya');
    const arjun = slices.find((s) => s.sliceValue === 'arjun');

    expect(maya?.sampleCount).toBe(2);
    expect(maya?.meanDelta).toBe(3); // (3 + 3) / 2

    expect(arjun?.sampleCount).toBe(1);
    expect(arjun?.meanDelta).toBe(2);
  });

  it('computes mean delta grouped by mode', () => {
    const slices = computeMeanDeltaBySlice(sessions, 'mode');
    const focus = slices.find((s) => s.sliceValue === 'focus');
    const sleep = slices.find((s) => s.sliceValue === 'sleep');

    expect(focus?.sampleCount).toBe(2);
    expect(focus?.meanDelta).toBe(2.5);

    expect(sleep?.sampleCount).toBe(1);
    expect(sleep?.meanDelta).toBe(3);
  });
});

describe('calmDelta: computeWeeklyMeanDelta', () => {
  it('generates 8 consecutive ISO weeks starting on Monday', () => {
    // Reference date: Wednesday 2026-06-17
    const refDate = new Date(2026, 5, 17, 14, 0, 0);

    // Two sessions: one this week (2026-06-16, delta +3), one 2 weeks ago (2026-06-02, delta +2)
    const sessions = [
      {
        protocolId: 'rapid_reset_5' as const,
        preState: STATE.WIRED,
        postState: STATE.CALM, // +3
        startedAtMs: new Date(2026, 5, 16, 10, 0, 0).getTime(),
      },
      {
        protocolId: 'afternoon_recharge_10' as const,
        preState: STATE.DRAINED,
        postState: STATE.CALM, // +2
        startedAtMs: new Date(2026, 5, 2, 15, 0, 0).getTime(),
      },
    ];

    const weeks = computeWeeklyMeanDelta(sessions, refDate.getTime());

    expect(weeks.length).toBe(8);

    // The most recent week (index 7) starts on Monday 2026-06-15
    expect(weeks[7]?.weekStartDayKey).toBe('2026-06-15');
    expect(weeks[7]?.sampleCount).toBe(1);
    expect(weeks[7]?.meanDelta).toBe(3);

    // Index 5 (two weeks ago) starts on Monday 2026-06-01
    expect(weeks[5]?.weekStartDayKey).toBe('2026-06-01');
    expect(weeks[5]?.sampleCount).toBe(1);
    expect(weeks[5]?.meanDelta).toBe(2);

    // Empty week (index 6, starting 2026-06-08)
    expect(weeks[6]?.weekStartDayKey).toBe('2026-06-08');
    expect(weeks[6]?.sampleCount).toBe(0);
    expect(weeks[6]?.meanDelta).toBeNull();
  });
});
