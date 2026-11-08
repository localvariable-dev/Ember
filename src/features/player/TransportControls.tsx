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
    marginVertical: 12,
  },
  circleButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 2,
  },
});
