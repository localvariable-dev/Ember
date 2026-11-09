/**
 * StreakHeader Component
 * Master Plan Part 1 §2.7, Part 2 §3.3 & Habit Formation Specification
 *
 * Renders the active ember ring, streak counters, 2 banked Grace dots,
 * upcoming milestone tracker (3, 7, 14, 30, 100 days), and quiet status copy.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { projectStreak, type StreakState } from '../../domain/streakEngine';
import type { DayKey } from '../../domain/dayKey';
import {
  getNextStreakMilestone,
  getStreakMilestone,
  getMilestoneCelebration,
} from '../../domain/dailyGoal';

interface StreakHeaderProps {
  streak: StreakState;
  today: DayKey;
}

export function StreakHeader({ streak, today }: StreakHeaderProps) {
  const projection = projectStreak(streak, today);
  const isHeldByGrace = projection.status === 'held_by_grace';
  const isLapsed = projection.status === 'lapsed';

  const displayCount = projection.display;

  // Milestone information
  const currentMilestone = getStreakMilestone(displayCount);
  const celebration = currentMilestone ? getMilestoneCelebration(currentMilestone) : null;
  const nextInfo = getNextStreakMilestone(displayCount);

  // Derive progress towards next milestone
  // Milestones: 0 -> 3 -> 7 -> 14 -> 30 -> 100
  let prevMilestone = 0;
  if (displayCount >= 30) prevMilestone = 30;
  else if (displayCount >= 14) prevMilestone = 14;
  else if (displayCount >= 7) prevMilestone = 7;
  else if (displayCount >= 3) prevMilestone = 3;

  const milestoneRange = Math.max(1, nextInfo.nextMilestone - prevMilestone);
  const milestoneProgress = Math.min(
    1,
    Math.max(0, (displayCount - prevMilestone) / milestoneRange),
  );

  let statusMessage = '';
  switch (projection.status) {
    case 'held_by_grace':
      statusMessage = 'Rest Grace is holding your streak.';
      break;
    case 'lapsed':
      statusMessage =
        streak.longestStreak > 0
          ? `Begin again — your best was ${streak.longestStreak}.`
          : 'Begin your daily practice.';
      break;
    case 'done_today':
      statusMessage = 'Rest complete for today.';
      break;
    case 'open':
      statusMessage = "Ready for today's rest.";
      break;
    case 'fresh':
    default:
      statusMessage = 'Begin your daily practice.';
      break;
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        {/* Current Streak */}
        <View style={styles.statGroup}>
          <View style={styles.ringWrapper}>
            <View
              style={[
                styles.emberOuter,
                isHeldByGrace && styles.emberOuterGrace,
                isLapsed && styles.emberOuterLapsed,
              ]}
            />
            <View
              style={[
                styles.emberCore,
                isHeldByGrace && styles.emberCoreGrace,
                isLapsed && styles.emberCoreLapsed,
              ]}
            />
          </View>
          <View>
            <Text style={styles.streakNumber}>
              {displayCount}
              <Text style={styles.streakUnit}>-day</Text>
            </Text>
            <Text style={styles.statLabel}>Current streak</Text>
          </View>
        </View>

        {/* Best Streak */}
        <View style={styles.statGroupSmall}>
          <Text style={styles.bestNumber}>{streak.longestStreak}</Text>
          <Text style={styles.statLabel}>Best</Text>
        </View>

        {/* Rest Grace Bank (max 2 dots) */}
        <View style={styles.statGroupSmall}>
          <View style={styles.graceDotsRow}>
            <View style={[styles.graceDot, streak.graceBanked >= 1 && styles.graceDotBanked]} />
            <View style={[styles.graceDot, streak.graceBanked >= 2 && styles.graceDotBanked]} />
          </View>
          <Text style={styles.statLabel}>
            {streak.graceBanked} {streak.graceBanked === 1 ? 'Grace' : 'Graces'}
          </Text>
        </View>
      </View>

      {/* Milestone Progress Card */}
      {celebration ? (
        <View style={styles.milestoneAchievedBlock}>
          <View style={styles.milestoneTitleRow}>
            <Text style={styles.milestoneSparkle}>✦</Text>
            <Text style={styles.milestoneAchievedTitle}>
              Milestone Reached: {celebration.title}
            </Text>
          </View>
          <Text style={styles.milestoneAchievedSubtitle}>{celebration.subtitle}</Text>
        </View>
      ) : (
        <View style={styles.nextMilestoneBlock}>
          <View style={styles.nextMilestoneHeader}>
            <Text style={styles.nextMilestoneLabel}>Next Milestone</Text>
            <Text style={styles.nextMilestoneTarget}>
              {nextInfo.nextMilestone}-Day Rest · {nextInfo.daysRemaining}{' '}
              {nextInfo.daysRemaining === 1 ? 'day' : 'days'} to go
            </Text>
          </View>
          <View style={styles.milestoneTrack}>
            <View
              style={[styles.milestoneFill, { width: `${Math.round(milestoneProgress * 100)}%` }]}
            />
          </View>
        </View>
      )}

      {/* Status Whisper Line */}
      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statGroupSmall: {
    alignItems: 'center',
    gap: 4,
  },
  ringWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  emberOuter: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentGlow,
  },
  emberOuterGrace: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  emberOuterLapsed: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emberCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  emberCoreGrace: {
    backgroundColor: colors.accentSoft,
    opacity: 0.7,
  },
  emberCoreLapsed: {
    backgroundColor: colors.textFaint,
  },
  streakNumber: {
    ...typography.displaySm,
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  streakUnit: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 14,
  },
  bestNumber: {
    ...typography.title,
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 12,
  },
  graceDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 18,
  },
  graceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textFaint,
    backgroundColor: 'transparent',
  },
  graceDotBanked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  milestoneAchievedBlock: {
    backgroundColor: 'rgba(245, 158, 11, 0.07)',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: spacing.sm,
    gap: 2,
  },
  milestoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  milestoneSparkle: {
    color: colors.accentSoft,
    fontSize: 12,
  },
  milestoneAchievedTitle: {
    ...typography.caption,
    color: colors.accentSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  milestoneAchievedSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  nextMilestoneBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radii.sm,
    padding: spacing.xs + 2,
    gap: 4,
  },
  nextMilestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextMilestoneLabel: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextMilestoneTarget: {
    ...typography.caption,
    color: colors.accentSoft,
    fontSize: 11,
    fontWeight: '500',
  },
  milestoneTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  milestoneFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
