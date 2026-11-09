import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { fontFamilies } from '../design/tokens';

interface StartupExperienceProps {
  exiting: boolean;
  onExitComplete: () => void;
}

export function StartupExperience({ exiting, onExitComplete }: StartupExperienceProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useMemo(() => new Animated.Value(0), []);
  const pulse = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : 420,
      useNativeDriver: true,
    }).start();
  }, [opacity, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || exiting) return;
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    breathing.start();
    return () => breathing.stop();
  }, [exiting, pulse, reduceMotion]);

  useEffect(() => {
    if (!exiting) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: reduceMotion ? 0 : 360,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onExitComplete();
    });
  }, [exiting, onExitComplete, opacity, reduceMotion]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.52] });

  return (
    <Animated.View
      style={[styles.screen, { opacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Opening Ember"
    >
      <Animated.View style={[styles.mark, { transform: [{ scale }] }]}>
        <Animated.View style={[styles.halo, { opacity: haloOpacity }]} />
        <Svg width={86} height={86} viewBox="0 0 86 86" accessibilityLabel="Ember symbol">
          <Circle
            cx="43"
            cy="43"
            r="39"
            fill="#1C1B19"
            stroke="rgba(233,160,75,0.26)"
            strokeWidth="1"
          />
          <Path
            d="M43 18c-2 10-13 15-13 27a13 13 0 0 0 26 0c0-7-4-11-8-16 0 7-3 10-5 12 1-9-2-16 0-23Z"
            fill="#E9A04B"
          />
          <Path
            d="M43 39c-2 5-6 8-6 13a6 6 0 0 0 12 0c0-4-3-7-6-13Z"
            fill="#F5D49B"
            opacity=".86"
          />
        </Svg>
      </Animated.View>
      <Text style={styles.wordmark}>EMBER</Text>
      <Text style={styles.subtitle}>NSDR & DEEP REST</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151719',
  },
  mark: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  halo: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(233,160,75,0.18)',
    shadowColor: '#E9A04B',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 4,
  },
  wordmark: {
    color: '#F4F1EC',
    fontFamily: fontFamilies.interMedium,
    fontSize: 17,
    letterSpacing: 5,
    marginLeft: 5,
  },
  subtitle: {
    color: 'rgba(244,241,236,0.56)',
    fontFamily: fontFamilies.interRegular,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 9,
  },
});
