/**
 * PreStateStrip Component
 * Master Plan Part 1 §2.5
 * Non-blocking pre-session check-in strip during first 20s of active playback.
 * Five 28dp orbs with selection pulse and 600ms fadeout.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, stateColors, typography } from '../../design/tokens';
import type { RecoveryState } from '../../data/types';
import { hapticCardSelect } from '../../design/haptics';

interface PreStateStripProps {
  positionMs: number;
  onSelectState: (state: RecoveryState) => void;
  selectedState?: RecoveryState | null;
}

const ORB_STATES: RecoveryState[] = [1, 2, 3, 4, 5];

export function PreStateStrip({ positionMs, onSelectState, selectedState }: PreStateStripProps) {
  const [chosenState, setChosenState] = useState<RecoveryState | null>(selectedState ?? null);
  const [dismissed, setDismissed] = useState(false);

  const stripOpacity = useMemo(() => new Animated.Value(1), []);
  const pulseScale = useMemo(() => new Animated.Value(1), []);

  // Auto-fade after 20 seconds (20,000 ms) if not already chosen/dismissed
  useEffect(() => {
    if (positionMs > 20_000 && !chosenState && !dismissed) {
      Animated.timing(stripOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setDismissed(true);
      });
    }
  }, [chosenState, dismissed, positionMs, stripOpacity]);

  const handleSelect = (state: RecoveryState) => {
    if (chosenState) return; // single select
    setChosenState(state);
    hapticCardSelect();
    onSelectState(state);

    // Pulse animation on selected orb
    Animated.sequence([
      Animated.timing(pulseScale, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pulseScale, {
        toValue: 1.0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Strip fades out after 600 ms
    setTimeout(() => {
      Animated.timing(stripOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setDismissed(true);
      });
    }, 600);
  };

  if (dismissed) return null;

  return (
    <Animated.View style={[styles.container, { opacity: stripOpacity }]}>
      <Text style={styles.promptText}>How are you arriving?</Text>

      <View style={styles.orbsRow}>
        {ORB_STATES.map((state) => {
          const item = stateColors[state];
          const isSelected = chosenState === state;

          return (
            <Pressable
              key={state}
              style={styles.touchTarget}
              onPress={() => handleSelect(state)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${item.label}, ${state} of 5`}
            >
              <Animated.View
                style={[
                  styles.orb,
                  { backgroundColor: item.color },
                  isSelected && {
                    transform: [{ scale: pulseScale }],
                    borderWidth: 2,
                    borderColor: colors.text,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
    minHeight: 52,
  },
  promptText: {
    ...typography.caption,
    color: colors.textFaint,
    marginBottom: spacing.xs,
  },
  orbsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  touchTarget: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});
