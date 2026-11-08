/**
 * Calm Delta Unit Tests
 * Master Plan Part 2 §3.8
 */

import {
  computeBestTimeOfDayBand,
  computeHeadlineInsight,
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
