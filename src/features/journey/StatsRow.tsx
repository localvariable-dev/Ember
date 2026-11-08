/**
 * StatsRow Component
 * Master Plan Part 1 §2.7
 * Renders aggregate restorative minutes and total completed sessions.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';

interface StatsRowProps {
  minutes: number;
  sessions: number;
}

export function StatsRow({ minutes, sessions }: StatsRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.statBox}>
        <Text style={styles.statValue}>{minutes}</Text>
        <Text style={styles.statLabel}>restorative minutes</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.statBox}>
        <Text style={styles.statValue}>{sessions}</Text>
        <Text style={styles.statLabel}>{sessions === 1 ? 'session' : 'sessions'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  statValue: {
    ...typography.displaySm,
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
    fontWeight: '600',
  },
  statLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
