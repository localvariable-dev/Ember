/**
 * SessionSummary Component
 * Master Plan Part 1 §2.6
 * Shows post-session state shift, Calm Delta, animated streak ember, earned bonuses, and Done button.
 */

import React, { useEffect, useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, stateColors, typography } from '../../design/tokens';
import type { RecoveryState } from '../../data/types';
import { hapticCardSelect } from '../../design/haptics';

interface SessionSummaryProps {
  preState: RecoveryState | null;
  postState: RecoveryState | null;
  streakCount: number;
  graceEarned?: boolean;
  passUnlocked?: boolean;
  onDone: () => void;
}

export function SessionSummary({
  preState,
  postState,
  streakCount,
  graceEarned = false,
  passUnlocked = false,
  onDone,
}: SessionSummaryProps) {
  const emberScale = useMemo(() => new Animated.Value(0.8), []);
  const emberGlow = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    // Streak ember glow sweep animation
    Animated.parallel([
      Animated.spring(emberScale, {
        toValue: 1.0,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(emberGlow, {
        toValue: 1.0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [emberGlow, emberScale]);

  const preItem = preState ? stateColors[preState] : null;
  const postItem = postState ? stateColors[postState] : null;

  // Calm Delta = postState - preState
  const hasCalmDelta = preState != null && postState != null;
  const delta = hasCalmDelta ? (postState as number) - (preState as number) : 0;
  const deltaText =
    delta > 0 ? `+${delta} Calm Delta` : delta === 0 ? '0 Calm Delta' : `${delta} Calm Delta`;
  const isNegative = delta < 0;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* State Shift */}
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

        {/* Streak Counter & Ember */}
        <Animated.View
          style={[
            styles.streakRow,
            {
              transform: [{ scale: emberScale }],
            },
          ]}
        >
          <View style={styles.emberIconWrapper}>
            <View style={styles.emberOuter} />
            <View style={styles.emberCore} />
          </View>
          <Text style={styles.streakText}>Day {streakCount}</Text>
        </Animated.View>

        {/* Earned Rewards */}
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
      </View>

      {/* Done Action */}
      <View style={styles.footer}>
        <Pressable
          style={styles.doneButton}
          onPress={() => {
            hapticCardSelect();
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
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
    fontSize: 22,
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
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
  emberCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
  },
  streakText: {
    ...typography.title,
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
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
