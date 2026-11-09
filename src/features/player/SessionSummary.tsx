/**
 * SessionSummary Component
 * Master Plan Part 1 §2.6 & Habit Formation Specification
 *
 * Polished post-session completion experience:
 * - Restrained, elegant completion animation and glowing ember ring
 * - Richer celebration for key milestones (3, 7, 14, 30, 100 days)
 * - Session duration and protocol badge
 * - State shift & Calm Delta
 * - Daily goal progress update ("Daily Rest Goal Met • 1/1")
 * - Contextual encouraging motivation copy
 * - Personal progress insight based on real history
 * - Gentle next-session suggestion
 * - Subtle, deduplicated haptic feedback
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, stateColors, typography } from '../../design/tokens';
import type { RecoveryState } from '../../data/types';
import type { ProtocolId } from '../../domain/constants';
import type { DailyGoalStatus, MilestoneCelebration } from '../../domain/dailyGoal';
import {
  hapticCardSelect,
  hapticDailyGoalComplete,
  hapticMilestoneAchieved,
  hapticSessionComplete,
} from '../../design/haptics';

interface SessionSummaryProps {
  preState: RecoveryState | null;
  postState: RecoveryState | null;
  streakCount: number;
  graceEarned?: boolean;
  passUnlocked?: boolean;
  onDone: () => void;
  // Extended habit-formation props
  protocolId?: ProtocolId;
  durationMinutes?: number;
  dailyGoalStatus?: DailyGoalStatus | null;
  encouragingMessage?: string;
  personalInsight?: string | null;
  nextSuggestion?: string;
  milestoneDetails?: MilestoneCelebration | null;
  hapticsEnabled?: boolean;
}

const PROTOCOL_NAMES: Record<string, string> = {
  rapid_reset_5: 'Rapid Reset • 5m',
  afternoon_recharge_10: 'Afternoon Recharge • 10m',
  deep_rest_30: 'Deep Rest • 30m',
};

export function SessionSummary({
  preState,
  postState,
  streakCount,
  graceEarned = false,
  passUnlocked = false,
  onDone,
  protocolId = 'rapid_reset_5',
  durationMinutes,
  dailyGoalStatus,
  encouragingMessage,
  personalInsight,
  nextSuggestion,
  milestoneDetails,
  hapticsEnabled = true,
}: SessionSummaryProps) {
  const emberScale = useMemo(() => new Animated.Value(0.7), []);
  const emberGlow = useMemo(() => new Animated.Value(0), []);
  const contentFade = useMemo(() => new Animated.Value(0), []);
  const milestoneScale = useMemo(() => new Animated.Value(0.9), []);
  const hapticFiredRef = useRef(false);

  const isMilestone = Boolean(milestoneDetails);

  useEffect(() => {
    // 1. Fire subtle completion or milestone haptics once
    if (!hapticFiredRef.current) {
      hapticFiredRef.current = true;
      if (isMilestone) {
        void hapticMilestoneAchieved(hapticsEnabled);
      } else if (dailyGoalStatus?.isFirstSessionToday) {
        void hapticDailyGoalComplete(hapticsEnabled);
      } else {
        void hapticSessionComplete(hapticsEnabled);
      }
    }

    // 2. Coordinated entry animation: ember spring + content fade
    Animated.parallel([
      Animated.spring(emberScale, {
        toValue: 1.0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(emberGlow, {
        toValue: 1.0,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1.0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(milestoneScale, {
        toValue: 1.0,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    dailyGoalStatus,
    emberGlow,
    emberScale,
    contentFade,
    hapticsEnabled,
    isMilestone,
    milestoneScale,
  ]);

  const preItem = preState ? stateColors[preState] : null;
  const postItem = postState ? stateColors[postState] : null;

  // Calm Delta = postState - preState
  const hasCalmDelta = preState != null && postState != null;
  const delta = hasCalmDelta ? (postState as number) - (preState as number) : 0;
  const deltaText =
    delta > 0 ? `+${delta} Calm Delta` : delta === 0 ? '0 Calm Delta' : `${delta} Calm Delta`;
  const isNegative = delta < 0;

  const protocolTitle =
    PROTOCOL_NAMES[protocolId] ?? (durationMinutes ? `${durationMinutes}m Rest` : 'Rest Complete');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.innerContent, { opacity: contentFade }]}>
          {/* Protocol Badge */}
          <View style={styles.protocolBadge}>
            <Text style={styles.protocolBadgeText}>{protocolTitle}</Text>
          </View>

          {/* State Shift or Rest Complete Headline */}
          {hasCalmDelta && preItem && postItem ? (
            <View style={styles.stateShiftRow}>
              <Text style={[styles.stateText, { color: preItem.color }]}>{preItem.label}</Text>
              <Text style={styles.arrowText}>→</Text>
              <Text style={[styles.stateText, { color: postItem.color }]}>{postItem.label}</Text>
            </View>
          ) : postItem ? (
            <View style={styles.singleStateRow}>
              <Text style={[styles.stateText, { color: postItem.color }]}>{postItem.label}</Text>
            </View>
          ) : (
            <Text style={styles.completeTitle}>Rest Complete</Text>
          )}

          {/* Calm Delta */}
          {hasCalmDelta && (
            <View style={styles.deltaContainer}>
              <Text style={[styles.deltaText, isNegative && styles.deltaNeutral]}>{deltaText}</Text>
              {isNegative && <Text style={styles.deltaWhisper}>Some sessions just need time.</Text>}
            </View>
          )}

          {/* Streak Counter & Animated Ember */}
          <Animated.View
            style={[
              styles.streakRow,
              isMilestone && styles.streakRowMilestone,
              {
                transform: [{ scale: emberScale }],
              },
            ]}
          >
            <View style={styles.emberIconWrapper}>
              <View style={[styles.emberOuter, isMilestone && styles.emberOuterMilestone]} />
              <View style={styles.emberCore} />
            </View>
            <Text style={styles.streakText}>Day {streakCount} Streak</Text>
          </Animated.View>

          {/* Meaningful Milestone Rich Celebration Card */}
          {isMilestone && milestoneDetails && (
            <Animated.View
              style={[
                styles.milestoneCard,
                {
                  transform: [{ scale: milestoneScale }],
                },
              ]}
            >
              <View style={styles.milestoneHeader}>
                <Text style={styles.milestoneSparkle}>✦</Text>
                <Text style={styles.milestoneTitle}>{milestoneDetails.title}</Text>
              </View>
              <Text style={styles.milestoneSubtitle}>{milestoneDetails.subtitle}</Text>
              <Text style={styles.milestoneInsight}>{milestoneDetails.insight}</Text>
            </Animated.View>
          )}

          {/* Daily Goal Status Badge */}
          {dailyGoalStatus?.isGoalMet && (
            <View style={styles.goalBanner}>
              <Text style={styles.goalBannerSparkle}>✦</Text>
              <Text style={styles.goalBannerText}>Daily Rest Goal Met • 1/1</Text>
            </View>
          )}

          {/* Contextual Encouraging Message */}
          {Boolean(encouragingMessage) && (
            <View style={styles.encouragementBlock}>
              <Text style={styles.encouragingText}>{encouragingMessage}</Text>
            </View>
          )}

          {/* Earned Rewards (Rest Grace / Free Pass) */}
          {graceEarned && (
            <View style={styles.badgeBanner}>
              <Text style={styles.badgeText}>✦ A Rest Grace day was banked.</Text>
            </View>
          )}

          {passUnlocked && (
            <View style={styles.badgeBanner}>
              <Text style={styles.badgeText}>✦ You unlocked a free Deep Rest.</Text>
            </View>
          )}

          {/* Real Personal Progress Insight */}
          {Boolean(personalInsight) && (
            <View style={styles.insightCard}>
              <Text style={styles.insightLabel}>Personal Progress</Text>
              <Text style={styles.insightText}>{personalInsight}</Text>
            </View>
          )}

          {/* Gentle Next-Session Suggestion */}
          {Boolean(nextSuggestion) && (
            <View style={styles.suggestionBlock}>
              <Text style={styles.suggestionText}>{nextSuggestion}</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Done Action */}
      <View style={styles.footer}>
        <Pressable
          style={styles.doneButton}
          onPress={() => {
            hapticCardSelect(hapticsEnabled);
            onDone();
          }}
          accessibilityRole="button"
          accessibilityLabel="Done. Return to sanctuary."
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  innerContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  protocolBadge: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  protocolBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stateShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  singleStateRow: {
    alignItems: 'center',
  },
  completeTitle: {
    ...typography.displaySm,
    color: colors.text,
  },
  stateText: {
    ...typography.displaySm,
    fontSize: 28,
    fontWeight: '500',
  },
  arrowText: {
    fontSize: 24,
    color: colors.accent,
  },
  deltaContainer: {
    alignItems: 'center',
  },
  deltaText: {
    ...typography.title,
    fontSize: 20,
    color: colors.accent,
    fontWeight: '600',
  },
  deltaNeutral: {
    color: colors.textMuted,
  },
  deltaWhisper: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.xs,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  streakRowMilestone: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  emberIconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emberOuter: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
  },
  emberOuterMilestone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
  },
  emberCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
  },
  streakText: {
    ...typography.title,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  milestoneCard: {
    width: '100%',
    padding: spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  milestoneSparkle: {
    color: colors.accentSoft,
    fontSize: 16,
  },
  milestoneTitle: {
    ...typography.title,
    color: colors.accentSoft,
    fontSize: 18,
    fontWeight: '600',
  },
  milestoneSubtitle: {
    ...typography.caption,
    color: colors.text,
    fontSize: 14,
    fontStyle: 'italic',
  },
  milestoneInsight: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  goalBannerSparkle: {
    color: colors.accent,
    fontSize: 12,
  },
  goalBannerText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  encouragementBlock: {
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  encouragingText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  badgeBanner: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    ...typography.caption,
    color: colors.accentSoft,
    fontSize: 13,
  },
  insightCard: {
    width: '100%',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  insightLabel: {
    ...typography.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  insightText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionBlock: {
    marginTop: spacing.xs,
  },
  suggestionText: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    fontSize: 12,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  doneButton: {
    width: '100%',
    height: 52,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
});
