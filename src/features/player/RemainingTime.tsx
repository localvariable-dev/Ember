/**
 * RemainingTime Component
 * Master Plan Part 1 §2.5
 * Displays countdown timer in tabular-nums.
 * Hidden by default in Sleep mode; tap toggles visibility.
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, typography } from '../../design/tokens';

interface RemainingTimeProps {
  positionMs: number;
  durationMs: number;
  visible: boolean;
  onToggleVisible: () => void;
}

export function RemainingTime({
  positionMs,
  durationMs,
  visible,
  onToggleVisible,
}: RemainingTimeProps) {
  if (!visible) {
    return (
      <Pressable
        style={styles.touchArea}
        onPress={onToggleVisible}
        accessibilityRole="button"
        accessibilityLabel="Show remaining time"
      >
        <Text style={styles.hiddenPlaceholder}>···</Text>
      </Pressable>
    );
  }

  const remainingMs = Math.max(0, durationMs - positionMs);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} left`;

  return (
    <Pressable
      style={styles.touchArea}
      onPress={onToggleVisible}
      accessibilityRole="button"
      accessibilityLabel={`Remaining time: ${formatted}. Tap to hide.`}
    >
      <Text style={styles.timerText}>{formatted}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  timerText: {
    ...typography.timer,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textMuted,
    letterSpacing: -0.5,
  },
  hiddenPlaceholder: {
    fontSize: 24,
    lineHeight: 28,
    color: colors.textFaint,
    letterSpacing: 2,
  },
});
