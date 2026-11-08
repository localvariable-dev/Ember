/**
 * StreakHeader Component
 * Master Plan Part 1 §2.7, Part 2 §3.3
 * Renders the active ember ring, streak counters, 2 banked Grace dots, and quiet status copy.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { projectStreak, type StreakState } from '../../domain/streakEngine';
import type { DayKey } from '../../domain/dayKey';

interface StreakHeaderProps {
  streak: StreakState;
  today: DayKey;
}

export function StreakHeader({ streak, today }: StreakHeaderProps) {
  const projection = projectStreak(streak, today);
  const isHeldByGrace = projection.status === 'held_by_grace';
  const isLapsed = projection.status === 'lapsed';

  const displayCount = projection.display;

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
    gap: spacing.md,
  },
  ringWrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emberOuter: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentGlow,
  },
  emberOuterGrace: {
    backgroundColor: 'rgba(245, 158, 11, 0.20)',
    borderColor: colors.accent,
    borderWidth: 1,
  },
  emberOuterLapsed: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: 1,
  },
  emberCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  emberCoreGrace: {
    backgroundColor: colors.accentSoft,
  },
  emberCoreLapsed: {
    backgroundColor: colors.textFaint,
  },
  streakNumber: {
    ...typography.displaySm,
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
    fontWeight: '600',
  },
  streakUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textMuted,
  },
  statGroupSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  bestNumber: {
    ...typography.title,
    fontSize: 18,
    lineHeight: 22,
    color: colors.text,
    fontWeight: '600',
  },
  statLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  graceDotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    height: 20,
  },
  graceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  graceDotBanked: {
    backgroundColor: colors.accent,
  },
  statusMessage: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingTop: 2,
  },
});
