/**
 * SoftNotificationPrompt Component
 * Master Plan Part 2 §3.6
 *
 * Displays a calm, polite pre-prompt after the first completed session:
 * "Want one gentle reminder a day? You choose the time."
 * Never pesters again if declined.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';

interface SoftNotificationPromptProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function SoftNotificationPrompt({ onAccept, onDecline }: SoftNotificationPromptProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <View style={styles.emberRing} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Want one gentle reminder a day?</Text>
        <Text style={styles.subtitle}>
          You choose the time. Silent, quiet-hour safe, and never nagging.
        </Text>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.declineButton}
          onPress={onDecline}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={styles.declineButtonText}>Not now</Text>
        </Pressable>
        <Pressable
          style={styles.acceptButton}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel="Enable gentle daily reminder"
        >
          <Text style={styles.acceptButtonText}>Enable</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    padding: spacing.md,
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emberRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  textContainer: {
    gap: 4,
  },
  title: {
    ...typography.title,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
  },
  declineButton: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  declineButtonText: {
    ...typography.label,
    fontSize: 13,
    color: colors.textFaint,
  },
  acceptButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  acceptButtonText: {
    ...typography.label,
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg,
  },
});
