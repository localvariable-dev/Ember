/**
 * Calm Delta & Perceived-State Insights
 * Master Plan Part 2 §3.8
 * Pure domain logic: measures self-reported perceived state change.
 * Non-clinical, non-diagnostic.
 */

import { CALM_DELTA_MIN_SAMPLES, STATE, type PerceivedState, type ProtocolId } from './constants';

export interface PairedSession {
  protocolId: ProtocolId;
  preState: PerceivedState;
  postState: PerceivedState;
  startedAtMs?: number;
}

export interface HeadlineInsight {
  hasInsight: boolean;
  text: string;
  sampleCount: number;
  averageDelta?: number;
}

const PRE_STATE_NAMES: Record<number, string> = {
  1: 'Wired',
  2: 'Drained',
  3: 'Neutral',
};

const PROTOCOL_DURATIONS: Record<ProtocolId, string> = {
  rapid_reset_5: '5',
  afternoon_recharge_10: '10',
  deep_rest_30: '30',
};

/**
 * Computes the headline Calm Delta insight card for Journey sheet.
 */
export function computeHeadlineInsight(sessions: readonly PairedSession[]): HeadlineInsight {
  const eligible = sessions.filter((s) => s.preState >= STATE.WIRED && s.postState >= STATE.WIRED);

  if (eligible.length < CALM_DELTA_MIN_SAMPLES) {
    return {
      hasInsight: false,
      text: 'Log 5 sessions with a before-and-after tap to see your Calm Delta.',
      sampleCount: eligible.length,
    };
  }

  // Group by (protocol_id, pre_state) for pre-states 1..3 (Wired, Drained, Neutral)
  interface GroupData {
    protocolId: ProtocolId;
    preState: number;
    sessions: PairedSession[];
  }

  const groups = new Map<string, GroupData>();

  for (const s of eligible) {
    if (s.preState > STATE.NEUTRAL) continue; // Only pre-states 1..3 are candidates for state shift
    const key = `${s.protocolId}_${s.preState}`;
    let g = groups.get(key);
    if (!g) {
      g = { protocolId: s.protocolId, preState: s.preState, sessions: [] };
      groups.set(key, g);
    }
    g.sessions.push(s);
  }

  // Filter groups with n >= 5 and calculate shift rates
  interface ScoredGroup extends GroupData {
    n: number;
    pctRestored: number;
    pctCalmPlus: number;
  }

  const qualifying: ScoredGroup[] = [];

  for (const g of groups.values()) {
    const n = g.sessions.length;
    if (n < CALM_DELTA_MIN_SAMPLES) continue;

    const restoredCount = g.sessions.filter((s) => s.postState === STATE.RESTORED).length;
    const calmPlusCount = g.sessions.filter((s) => s.postState >= STATE.CALM).length;

    const pctRestored = restoredCount / n;
    const pctCalmPlus = calmPlusCount / n;

    if (pctCalmPlus >= 0.5) {
      qualifying.push({
        ...g,
        n,
        pctRestored,
        pctCalmPlus,
      });
    }
  }

  // Pick the group with largest n (tie-breaker: higher pctCalmPlus)
  if (qualifying.length > 0) {
    qualifying.sort((a, b) => {
      if (b.n !== a.n) return b.n - a.n;
      return b.pctCalmPlus - a.pctCalmPlus;
    });

    const best = qualifying[0]!;
    const d = PROTOCOL_DURATIONS[best.protocolId];
    const pre = PRE_STATE_NAMES[best.preState] ?? 'Wired';

    if (best.pctRestored >= 0.5) {
      const pct = Math.round(best.pctRestored * 100);
      return {
        hasInsight: true,
        text: `Your ${d}-min sessions shift you from ${pre} to Restored ${pct}% of the time (${best.n} sessions).`,
        sampleCount: best.n,
      };
    } else {
      const pct = Math.round(best.pctCalmPlus * 100);
      return {
        hasInsight: true,
        text: `When you start ${pre}, your ${d}-min sessions end Calm or Restored ${pct}% of the time (${best.n} sessions).`,
        sampleCount: best.n,
      };
    }
  }

  // Fallback 1: Calculate global average delta if positive
  const totalDelta = eligible.reduce((acc, s) => acc + (s.postState - s.preState), 0);
  const avgDelta = totalDelta / eligible.length;

  if (avgDelta > 0) {
    return {
      hasInsight: true,
      text: `Across ${eligible.length} sessions you've moved up ${avgDelta.toFixed(1)} states on average.`,
      sampleCount: eligible.length,
      averageDelta: avgDelta,
    };
  }

  // Fallback 2: Encouraging forward copy (never negative)
  return {
    hasInsight: false,
    text: 'Keep going — patterns take about 10 sessions to show.',
    sampleCount: eligible.length,
    averageDelta: avgDelta,
  };
}

/**
 * Time of day bands for Pro insights
 */
export interface TimeBandInsight {
  band: string;
  meanDelta: number;
  sampleCount: number;
  label: string;
}

const TIME_BANDS = [
  { key: '05–10', startH: 5, endH: 10, label: 'early morning (5–10 AM)' },
  { key: '11–14', startH: 11, endH: 14, label: 'midday (11 AM–2 PM)' },
  { key: '15–18', startH: 15, endH: 18, label: 'afternoon (3–6 PM)' },
  { key: '19–22', startH: 19, endH: 22, label: 'evening (7–10 PM)' },
  { key: '23–04', startH: 23, endH: 4, label: 'night (11 PM–4 AM)' },
] as const;

export function computeBestTimeOfDayBand(
  sessions: readonly (PairedSession & { startedAtMs: number })[],
): TimeBandInsight | null {
  const bandBuckets = new Map<string, number[]>();

  for (const s of sessions) {
    const d = new Date(s.startedAtMs);
    const hour = d.getHours();
    const delta = s.postState - s.preState;

    for (const b of TIME_BANDS) {
      const match =
        b.startH <= b.endH
          ? hour >= b.startH && hour <= b.endH
          : hour >= b.startH || hour <= b.endH;

      if (match) {
        let arr = bandBuckets.get(b.key);
        if (!arr) {
          arr = [];
          bandBuckets.set(b.key, arr);
        }
        arr.push(delta);
        break;
      }
    }
  }

  let best: TimeBandInsight | null = null;

  for (const b of TIME_BANDS) {
    const deltas = bandBuckets.get(b.key);
    if (!deltas || deltas.length < 3) continue;

    const mean = deltas.reduce((a, c) => a + c, 0) / deltas.length;
    if (best === null || mean > best.meanDelta) {
      best = {
        band: b.key,
        meanDelta: Math.round(mean * 10) / 10,
        sampleCount: deltas.length,
        label: b.label,
      };
    }
  }

  return best;
}
