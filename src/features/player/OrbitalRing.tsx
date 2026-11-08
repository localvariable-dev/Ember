/**
 * OrbitalRing Component
 * Master Plan Part 1 §2.5
 * Outer: Session progress arc (2dp, amber) on hairline track.
 * Middle: Breathing orb (amber glow scaled to active cue breath pattern).
 * Inner: Core dot (6dp, accentSoft).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { CueTimelineItem } from '../../audio/assetRegistry';
import { colors } from '../../design/tokens';

interface OrbitalRingProps {
  positionMs: number;
  durationMs: number;
  currentCue: CueTimelineItem | null;
  isPlaying: boolean;
}

export function OrbitalRing({ positionMs, durationMs, currentCue, isPlaying }: OrbitalRingProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const orbScale = useMemo(() => new Animated.Value(0.7), []);
  const shimmerAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Compute breathing orb scale based on cue type and position
  const targetScale = useMemo(() => {
    if (!currentCue || !isPlaying) return 0.7;

    const elapsedInCue = Math.max(0, positionMs - currentCue.startMs);

    if (currentCue.type === 'breath' && currentCue.pattern) {
      const { inhaleMs, holdMs, exhaleMs, hold2Ms } = currentCue.pattern;
      const totalCycle = inhaleMs + holdMs + exhaleMs + hold2Ms;
      if (totalCycle <= 0) return 0.7;

      const cycleMs = elapsedInCue % totalCycle;

      if (cycleMs < inhaleMs) {
        // Inhale: 0.55 -> 1.00
        const t = cycleMs / inhaleMs;
        return 0.55 + 0.45 * Math.sin((t * Math.PI) / 2);
      } else if (cycleMs < inhaleMs + holdMs) {
        // Hold full: 1.00
        return 1.0;
      } else if (cycleMs < inhaleMs + holdMs + exhaleMs) {
        // Exhale: 1.00 -> 0.55
        const t = (cycleMs - (inhaleMs + holdMs)) / exhaleMs;
        return 1.0 - 0.45 * Math.sin((t * Math.PI) / 2);
      } else {
        // Hold empty: 0.55
        return 0.55;
      }
    }

    if (currentCue.type === 'sigh') {
      // 10s physiological sigh cycle
      const cycleMs = elapsedInCue % 10_000;
      if (cycleMs < 2000) return 0.55 + 0.3 * (cycleMs / 2000);
      if (cycleMs < 2200) return 0.85;
      if (cycleMs < 3400) return 0.85 + 0.15 * ((cycleMs - 2200) / 1200);
      if (cycleMs < 9400) return 1.0 - 0.45 * ((cycleMs - 3400) / 6000);
      return 0.55;
    }

    // Default body / silence / release / outro: slow subtle shimmer around 0.7
    return 0.7;
  }, [currentCue, isPlaying, positionMs]);

  useEffect(() => {
    if (reduceMotion) return;

    if (currentCue?.type === 'breath' || currentCue?.type === 'sigh') {
      Animated.timing(orbScale, {
        toValue: targetScale,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // Subtle 6s shimmer for body/silence
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [currentCue?.type, orbScale, reduceMotion, shimmerAnim, targetScale]);

  const ringSize = 280;
  const strokeWidth = 2;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progressFraction = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  const strokeDashoffset = circumference * (1 - progressFraction);

  const shimmerScale = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.66, 0.74],
  });

  const effectiveScale =
    currentCue?.type === 'breath' || currentCue?.type === 'sigh' ? orbScale : shimmerScale;

  return (
    <View style={styles.container}>
      <Svg width={ringSize} height={ringSize} style={styles.svg}>
        {/* Background hairline track */}
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Arc */}
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          stroke={colors.accent}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </Svg>

      {/* Middle: Breathing Orb */}
      {!reduceMotion ? (
        <Animated.View
          style={[
            styles.breathingOrb,
            {
              transform: [{ scale: effectiveScale }],
            },
          ]}
        >
          <View style={styles.innerGlow} />
          <View style={styles.coreDot} />
        </Animated.View>
      ) : (
        <View style={styles.staticOrb}>
          <View style={styles.coreDot} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  breathingOrb: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerGlow: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    position: 'absolute',
  },
  staticOrb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentSoft,
  },
});
