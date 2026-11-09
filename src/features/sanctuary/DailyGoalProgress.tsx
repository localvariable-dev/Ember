/**
 * DailyGoalProgress Component
 * Master Plan Habit Formation Specification
 *
 * Displays daily rest goal status (1 completed session per day default):
 * - Clean progress indicator (0/1 or 1/1)
 * - Celebratory whisper when today's goal is met
 * - Calm, restorative tone with zero pressure
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import type { DailyGoalStatus } from '../../domain/dailyGoal';

interface DailyGoalProgressProps {
  status: DailyGoalStatus;
}

export function DailyGoalProgress({ status }: DailyGoalProgressProps) {
  const { isGoalMet, completedSessions, targetSessions } = status;

  return (
    <View style={[styles.container, isGoalMet && styles.containerCompleted]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={[styles.goalDot, isGoalMet && styles.goalDotCompleted]} />
          <Text style={styles.goalTitle}>Daily Rest Goal</Text>
        </View>
        <Text style={[styles.progressCount, isGoalMet && styles.progressCountCompleted]}>
          {completedSessions >= targetSessions
            ? `${targetSessions}/${targetSessions} Complete`
            : `${completedSessions}/${targetSessions}`}
        </Text>
      </View>

      {/* Progress Track */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: isGoalMet ? '100%' : '0%' },
            isGoalMet && styles.fillCompleted,
          ]}
        />
      </View>

      {/* Context Whisper */}
      <Text style={styles.whisperText}>
        {isGoalMet
          ? completedSessions === 1
            ? 'You made space for yourself today. Further rest is always welcome.'
            : 'Today’s goal completed. Further moments of quiet are always welcome.'
          : 'One intentional session per day to protect your calm.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs + 2,
  },
  containerCompleted: {
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
    borderColor: 'rgba(245, 158, 11, 0.22)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textFaint,
  },
  goalDotCompleted: {
    backgroundColor: colors.accent,
  },
  goalTitle: {
    ...typography.caption,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  progressCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
  },
  progressCountCompleted: {
    color: colors.accentSoft,
    fontWeight: '600',
  },
  track: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginVertical: 2,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  fillCompleted: {
    backgroundColor: colors.accent,
  },
  whisperText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
