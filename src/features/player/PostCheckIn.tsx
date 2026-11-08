/**
 * PostCheckIn Component
 * Master Plan Part 1 §2.6 (Player Stage: CHECKIN)
 * 5 evenly spaced 56dp orbs with scaling, halo, and 700ms auto-advance to summary.
 */

import React, { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, stateColors, typography } from '../../design/tokens';
import type { RecoveryState } from '../../data/types';
import { hapticCardSelect } from '../../design/haptics';

interface PostCheckInProps {
  onSelectState: (state: RecoveryState) => void;
  onSkip: () => void;
}

const STATES: RecoveryState[] = [1, 2, 3, 4, 5];

export function PostCheckIn({ onSelectState, onSkip }: PostCheckInProps) {
  const [selectedState, setSelectedState] = useState<RecoveryState | null>(null);
  const orbScale = useMemo(() => new Animated.Value(1), []);

  const handleSelect = (state: RecoveryState) => {
    if (selectedState !== null) return;
    setSelectedState(state);
    hapticCardSelect();

    // Scale 1.0 -> 1.15 over 220ms
    Animated.timing(orbScale, {
      toValue: 1.15,
      duration: 220,
      useNativeDriver: true,
    }).start();

    // 700ms auto-advance
    setTimeout(() => {
      onSelectState(state);
    }, 700);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>How do you feel now?</Text>

        <View style={styles.orbsContainer}>
          {STATES.map((state) => {
            const item = stateColors[state];
            const isSelected = selectedState === state;
            const isDimmed = selectedState !== null && !isSelected;

            return (
              <Pressable
                key={state}
                style={[styles.orbCol, isDimmed && styles.dimmed]}
                onPress={() => handleSelect(state)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${item.label}, ${state} of 5`}
              >
                <View style={styles.orbWrapper}>
                  {isSelected && (
                    <View
                      style={[
                        styles.halo,
                        { borderColor: item.color, backgroundColor: `${item.color}33` },
                      ]}
                    />
                  )}
                  <Animated.View
                    style={[
                      styles.orb,
                      { backgroundColor: item.color },
                      isSelected && {
                        transform: [{ scale: orbScale }],
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.stateLabel, isSelected && styles.stateLabelSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.skipButton}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip post-session check-in"
        >
          <Text style={styles.skipText}>Skip</Text>
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
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  orbsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.sm,
  },
  orbCol: {
    alignItems: 'center',
    minWidth: 56,
  },
  dimmed: {
    opacity: 0.4,
  },
  orbWrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
  },
  orb: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  stateLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  stateLabelSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
  },
});
