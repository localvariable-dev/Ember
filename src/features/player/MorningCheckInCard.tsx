/**
 * MorningCheckInCard Component
 * Master Plan Part 1 §2.6
 * Non-blocking morning check-in card displayed above Greeting on Sanctuary screen
 * when a Sleep session completed within 10 hours without a post-state rating.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, stateColors, typography } from '../../design/tokens';
import type { RecoveryState, SessionLog } from '../../data/types';
import { hapticCardSelect } from '../../design/haptics';

interface MorningCheckInCardProps {
  candidateSession: SessionLog;
  onRate: (sessionId: string, state: RecoveryState) => void;
  onDismiss: (sessionId: string) => void;
}

const STATES: RecoveryState[] = [1, 2, 3, 4, 5];

export function MorningCheckInCard({
  candidateSession,
  onRate,
  onDismiss,
}: MorningCheckInCardProps) {
  const handleSelect = (state: RecoveryState) => {
    hapticCardSelect();
    onRate(candidateSession.id, state);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>How do you feel this morning?</Text>
        <Pressable
          style={styles.dismissButton}
          onPress={() => onDismiss(candidateSession.id)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss morning check-in"
        >
          <Text style={styles.dismissIcon}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.orbsRow}>
        {STATES.map((state) => {
          const item = stateColors[state];
          return (
            <Pressable
              key={state}
              style={styles.orbCol}
              onPress={() => handleSelect(state)}
              accessibilityRole="radio"
              accessibilityLabel={`${item.label}, ${state} of 5`}
            >
              <View style={[styles.orb, { backgroundColor: item.color }]} />
              <Text style={styles.orbLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  dismissButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissIcon: {
    color: colors.textFaint,
    fontSize: 14,
  },
  orbsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  orbCol: {
    alignItems: 'center',
    minWidth: 48,
  },
  orb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  orbLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
});
