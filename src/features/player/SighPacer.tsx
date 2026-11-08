/**
 * SighPacer Component
 * Master Plan Part 1 §2.4 (Player Stage: PREROLL)
 * Optional pre-session ritual: 60.0s = 6 cycles × 10.0s physiological sigh guidance.
 * Foreground-only ritual. Quick-start is preserved via Skip button.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radii, spacing, typography } from '../../design/tokens';
import {
  hapticCardSelect,
  hapticSighExhalePulse,
  hapticSighInhale1,
  hapticSighInhale2,
} from '../../design/haptics';

interface SighPacerProps {
  mode: 'focus' | 'sleep';
  onDone: () => void;
  onSkip: () => void;
  onClose: () => void;
}

const CYCLE_DURATION_MS = 10_000;
const TOTAL_CYCLES = 6;
const TOTAL_DURATION_MS = 60_000;

export function SighPacer({ mode, onDone, onSkip, onClose }: SighPacerProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cycleIndex, setCycleIndex] = useState(0); // 0 to 5
  const [cueText, setCueText] = useState('Inhale through the nose');
  const [elapsedMs, setElapsedMs] = useState(0);

  const orbScale = useMemo(() => new Animated.Value(0.55), []);
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    startTimeRef.current = Date.now();

    // 60-second linear progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: TOTAL_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // 50ms tick interval for cycle tracking
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const diff = now - startTimeRef.current;
      setElapsedMs(diff);

      if (diff >= TOTAL_DURATION_MS) {
        if (timerRef.current) clearInterval(timerRef.current);
        onDone();
        return;
      }

      const cycle = Math.min(TOTAL_CYCLES - 1, Math.floor(diff / CYCLE_DURATION_MS));
      setCycleIndex(cycle);

      const cycleMs = diff % CYCLE_DURATION_MS;

      // Timeline per cycle:
      // 0.0–2.0s: Inhale 1 (nose) 0.55 -> 0.85
      // 2.0–2.2s: Micro-pause hold 0.85
      // 2.2–3.4s: Inhale 2 (sniff) 0.85 -> 1.00
      // 3.4–9.4s: Exhale (mouth) 1.00 -> 0.55
      // 9.4–10.0s: Rest hold 0.55
      if (cycleMs < 2000) {
        if (cycleMs < 50) hapticSighInhale1();
        setCueText('Inhale through the nose');
        if (!reduceMotion) {
          const t = cycleMs / 2000;
          orbScale.setValue(0.55 + 0.3 * t);
        }
      } else if (cycleMs < 2200) {
        setCueText('Inhale through the nose');
        if (!reduceMotion) orbScale.setValue(0.85);
      } else if (cycleMs < 3400) {
        if (cycleMs >= 2200 && cycleMs < 2250) hapticSighInhale2();
        setCueText('A little more');
        if (!reduceMotion) {
          const t = (cycleMs - 2200) / 1200;
          orbScale.setValue(0.85 + 0.15 * t);
        }
      } else if (cycleMs < 9400) {
        if ((cycleMs - 3400) % 1000 < 50) hapticSighExhalePulse();
        setCueText('Slowly out through the mouth');
        if (!reduceMotion) {
          const t = (cycleMs - 3400) / 6000;
          orbScale.setValue(1.0 - 0.45 * t);
        }
      } else {
        setCueText('Rest');
        if (!reduceMotion) orbScale.setValue(0.55);
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onDone, orbScale, progressAnim, reduceMotion]);

  const handleSkip = () => {
    hapticCardSelect();
    if (timerRef.current) clearInterval(timerRef.current);
    onSkip();
  };

  const ringSize = 280;
  const strokeWidth = 2;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progressFraction = Math.min(1, elapsedMs / TOTAL_DURATION_MS);
  const strokeDashoffset = circumference * (1 - progressFraction);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="End session"
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>

        <View style={styles.modeChip}>
          <Text style={styles.modeChipText}>{mode === 'sleep' ? '☾ Sleep' : '☼ Focus'}</Text>
        </View>
      </View>

      {/* Center Ring & Breathing Orb */}
      <View style={styles.centerSection}>
        <View style={styles.ringWrapper}>
          <Svg width={ringSize} height={ringSize} style={styles.svgOverlay}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={colors.border}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
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
              rotation="-90"
              origin={`${ringSize / 2}, ${ringSize / 2}`}
            />
          </Svg>

          {/* Breathing Orb */}
          {!reduceMotion ? (
            <Animated.View
              style={[
                styles.breathingOrb,
                {
                  transform: [{ scale: orbScale }],
                },
              ]}
            >
              <View style={styles.innerOrbGlow} />
              <View style={styles.coreDot} />
            </Animated.View>
          ) : (
            <View style={styles.staticOrb}>
              <View style={styles.coreDot} />
            </View>
          )}
        </View>

        {/* Cues & Counter */}
        <View style={styles.cueContainer}>
          <Text style={styles.cueLabel}>{cueText}</Text>
          <Text style={styles.cycleCounter}>
            {cycleIndex + 1} of {TOTAL_CYCLES}
          </Text>
          <Text style={styles.explainer}>Double inhale · long exhale</Text>
        </View>
      </View>

      {/* Bottom Skip Action */}
      <View style={styles.bottomSection}>
        <Pressable
          style={styles.skipButton}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip sigh pacer and begin guided rest immediately"
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  modeChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeChipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrapper: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgOverlay: {
    position: 'absolute',
  },
  breathingOrb: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerOrbGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    position: 'absolute',
  },
  staticOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentSoft,
  },
  cueContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  cueLabel: {
    ...typography.body,
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    minHeight: 28,
  },
  cycleCounter: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  explainer: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.xs,
  },
  bottomSection: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
  },
});
