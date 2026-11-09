/**
 * TransportControls Component
 * Master Plan Part 1 §2.5
 * 72dp outline circular play/pause button with amber stroke and haptic feedback.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../design/tokens';
import { hapticModeToggle } from '../../design/haptics';

interface TransportControlsProps {
  isPlaying: boolean;
  onTogglePlayPause: () => void;
}

export function TransportControls({ isPlaying, onTogglePlayPause }: TransportControlsProps) {
  const handlePress = () => {
    hapticModeToggle();
    onTogglePlayPause();
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.circleButton}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause rest session' : 'Resume rest session'}
      >
        <Text style={styles.glyph}>{isPlaying ? '❚❚' : '▶'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  circleButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.72)',
    backgroundColor: 'rgba(245,158,11,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 3,
  },
  glyph: {
    color: colors.accent,
    fontSize: 27,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 2,
  },
});
