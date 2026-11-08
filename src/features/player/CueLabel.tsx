/**
 * CueLabel Component
 * Master Plan Part 1 §2.5
 * Displays current active cue label with 400ms crossfade animation and accessibility live region.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, typography } from '../../design/tokens';

interface CueLabelProps {
  label: string;
}

export function CueLabel({ label }: CueLabelProps) {
  const [displayLabel, setDisplayLabel] = useState(label);
  const opacityAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (label !== displayLabel) {
      // 400ms crossfade
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timeout = setTimeout(() => {
        setDisplayLabel(label);
      }, 200);

      return () => clearTimeout(timeout);
    }
  }, [displayLabel, label, opacityAnim]);

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[styles.label, { opacity: opacityAnim }]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Cue: ${displayLabel}`}
      >
        {displayLabel}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '400',
  },
});
