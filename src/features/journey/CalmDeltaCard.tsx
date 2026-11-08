/**
 * CalmDeltaCard Component
 * Master Plan Part 1 §2.7, Part 2 §3.8
 *
 * Displays self-reported perceived-state shifts (Calm Delta = post_state - pre_state).
 * Free tier: Headline insight with minimum sample threshold of 5 pairs.
 * Pro tier: Deep insights including Best Time-of-Day band, 8-week SVG bar chart, and slice breakdown.
 *
 * Non-clinical, non-medical disclosure strictly preserved.
 */

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors, radii, spacing, typography } from '../../design/tokens';
import {
  computeBestTimeOfDayBand,
  computeHeadlineInsight,
  computeMeanDeltaBySlice,
  computeWeeklyMeanDelta,
  type DetailedPairedSession,
} from '../../domain/calmDelta';

interface CalmDeltaCardProps {
  pairedSessions: DetailedPairedSession[];
  isPro: boolean;
  nowMs?: number;
}

const PROTOCOL_NAMES: Record<string, string> = {
  rapid_reset_5: '5m Rapid Reset',
  afternoon_recharge_10: '10m Afternoon Recharge',
  deep_rest_30: '30m Deep Rest',
};

const VOICE_NAMES: Record<string, string> = {
  maya_warm: 'Maya',
  arjun_deep: 'Arjun',
};

const MODE_NAMES: Record<string, string> = {
  focus: 'Focus Mode (Day)',
  sleep: 'Sleep Mode (Night)',
};

export function CalmDeltaCard({ pairedSessions, isPro, nowMs }: CalmDeltaCardProps) {
  const [defaultNow] = useState(() => Date.now());
  const refTime = nowMs ?? defaultNow;

  const headline = useMemo(() => computeHeadlineInsight(pairedSessions), [pairedSessions]);

  // Pro: Best time of day band (requires startedAtMs)
  const timeBandInsight = useMemo(() => {
    if (!isPro) return null;
    const valid = pairedSessions.filter(
      (s): s is DetailedPairedSession & { startedAtMs: number } => s.startedAtMs != null,
    );
    return computeBestTimeOfDayBand(valid);
  }, [pairedSessions, isPro]);

  // Pro: Weekly mean delta for last 8 ISO weeks
  const weeklyDeltas = useMemo(() => {
    if (!isPro) return [];
    const valid = pairedSessions.filter(
      (s): s is DetailedPairedSession & { startedAtMs: number } => s.startedAtMs != null,
    );
    return computeWeeklyMeanDelta(valid, refTime);
  }, [pairedSessions, isPro, refTime]);

  // Pro: Slice deltas by protocol, voice, and mode
  const protocolSlices = useMemo(() => {
    if (!isPro) return [];
    return computeMeanDeltaBySlice(pairedSessions, 'protocolId');
  }, [pairedSessions, isPro]);

  const voiceSlices = useMemo(() => {
    if (!isPro) return [];
    return computeMeanDeltaBySlice(pairedSessions, 'voiceId');
  }, [pairedSessions, isPro]);

  const modeSlices = useMemo(() => {
    if (!isPro) return [];
    return computeMeanDeltaBySlice(pairedSessions, 'mode');
  }, [pairedSessions, isPro]);

  // SVG Bar Chart Dimensions
  const chartWidth = 280;
  const chartHeight = 90;
  const barWidth = 20;
  const gap = 12;
  const zeroY = 65; // Baseline y position for delta = 0
  const maxBarHeight = 45; // Max height for delta = +3 or +4

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Your Calm Delta</Text>
        <Text style={styles.headerSubtitle}>Self-reported state shift</Text>
      </View>

      {/* Headline Insight */}
      <View style={styles.insightBox}>
        <Text style={styles.headlineText}>&ldquo;{headline.text}&rdquo;</Text>
        <Text style={styles.sampleCountLabel}>
          Based on {headline.sampleCount}{' '}
          {headline.sampleCount === 1 ? 'paired check-in' : 'paired check-ins'}.
        </Text>
      </View>

      {/* Pro Analytics */}
      {isPro && (
        <View style={styles.proSection}>
          <View style={styles.divider} />

          {/* Best Time of Day Insight */}
          {timeBandInsight ? (
            <View style={styles.proItem}>
              <Text style={styles.proLabel}>BEST REST WINDOW</Text>
              <Text style={styles.proValue}>
                You report the highest calm shift around {timeBandInsight.label} (avg +
                {timeBandInsight.meanDelta.toFixed(1)}).
              </Text>
            </View>
          ) : null}

          {/* 8-Week Trend Bar Chart */}
          {weeklyDeltas.length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.proLabel}>WEEKLY SHIFT (LAST 8 WEEKS)</Text>
              <View style={styles.chartWrapper}>
                <Svg width={chartWidth} height={chartHeight}>
                  {/* Zero Baseline */}
                  <Line
                    x1="0"
                    y1={zeroY}
                    x2={chartWidth}
                    y2={zeroY}
                    stroke={colors.border}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />

                  {weeklyDeltas.map((wk, idx) => {
                    const x = idx * (barWidth + gap) + 6;
                    const delta = wk.meanDelta ?? 0;
                    const hasData = wk.sampleCount > 0;

                    if (!hasData) {
                      return (
                        <Rect
                          key={wk.weekStartDayKey}
                          x={x}
                          y={zeroY - 2}
                          width={barWidth}
                          height={4}
                          rx={2}
                          fill={colors.surfaceRaised}
                        />
                      );
                    }

                    // Positive deltas grow upward from zeroY
                    const height = Math.max(
                      4,
                      Math.min(maxBarHeight, (Math.abs(delta) / 3) * maxBarHeight),
                    );
                    const y = delta >= 0 ? zeroY - height : zeroY;
                    const fill = delta >= 0 ? colors.accent : colors.textMuted;

                    return (
                      <React.Fragment key={wk.weekStartDayKey}>
                        <Rect x={x} y={y} width={barWidth} height={height} rx={3} fill={fill} />
                        <SvgText
                          x={x + barWidth / 2}
                          y={chartHeight - 4}
                          fontSize="9"
                          fill={colors.textFaint}
                          textAnchor="middle"
                        >
                          W{idx + 1}
                        </SvgText>
                      </React.Fragment>
                    );
                  })}
                </Svg>
              </View>
            </View>
          )}

          {/* Slice Breakdowns */}
          {(protocolSlices.length > 0 || voiceSlices.length > 0) && (
            <View style={styles.slicesContainer}>
              <Text style={styles.proLabel}>AVERAGE SHIFT BY PROTOCOL</Text>
              <View style={styles.sliceGrid}>
                {protocolSlices.map((s) => (
                  <View key={s.sliceValue} style={styles.sliceChip}>
                    <Text style={styles.sliceName}>
                      {PROTOCOL_NAMES[s.sliceValue] ?? s.sliceValue}
                    </Text>
                    <Text style={styles.sliceDelta}>
                      {s.meanDelta > 0 ? `+${s.meanDelta.toFixed(1)}` : s.meanDelta.toFixed(1)}
                    </Text>
                  </View>
                ))}
              </View>

              {voiceSlices.length > 0 && (
                <>
                  <Text style={[styles.proLabel, { marginTop: spacing.sm }]}>BY NARRATOR</Text>
                  <View style={styles.sliceGrid}>
                    {voiceSlices.map((s) => (
                      <View key={s.sliceValue} style={styles.sliceChip}>
                        <Text style={styles.sliceName}>
                          {VOICE_NAMES[s.sliceValue] ?? s.sliceValue}
                        </Text>
                        <Text style={styles.sliceDelta}>
                          {s.meanDelta > 0 ? `+${s.meanDelta.toFixed(1)}` : s.meanDelta.toFixed(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {modeSlices.length > 0 && (
                <>
                  <Text style={[styles.proLabel, { marginTop: spacing.sm }]}>BY REST MODE</Text>
                  <View style={styles.sliceGrid}>
                    {modeSlices.map((s) => (
                      <View key={s.sliceValue} style={styles.sliceChip}>
                        <Text style={styles.sliceName}>
                          {MODE_NAMES[s.sliceValue] ?? s.sliceValue}
                        </Text>
                        <Text style={styles.sliceDelta}>
                          {s.meanDelta > 0 ? `+${s.meanDelta.toFixed(1)}` : s.meanDelta.toFixed(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    gap: 2,
  },
  headerTitle: {
    ...typography.title,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  headerSubtitle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
  },
  insightBox: {
    paddingVertical: spacing.xs,
    gap: 4,
  },
  headlineText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.accentSoft,
    fontStyle: 'italic',
  },
  sampleCountLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  proSection: {
    gap: spacing.md,
  },
  proItem: {
    gap: 2,
  },
  proLabel: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  proValue: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  chartContainer: {
    gap: spacing.xs,
  },
  chartWrapper: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  slicesContainer: {
    gap: spacing.xs,
  },
  sliceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sliceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sliceName: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  sliceDelta: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
});
