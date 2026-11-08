/**
 * BeginRestButton Component
 * Master Plan Part 1 §2.3
 * 72 dp tall sticky bottom CTA with lock glyph for locked states and first-run whisper cue.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../design/tokens';
import { hapticBeginRest, hapticLockedCardTap } from '../../design/haptics';
import { useDatabase } from '../../providers/DatabaseProvider';

interface BeginRestButtonProps {
  isLocked: boolean;
  onPressUnlocked: () => void;
  onPressLocked: () => void;
}

export function BeginRestButton({
  isLocked,
  onPressUnlocked,
  onPressLocked,
}: BeginRestButtonProps) {
  const { preferences, updatePreferences } = useDatabase();
  const [showFirstRunWhisper, setShowFirstRunWhisper] = useState(!preferences.firstRunCueShown);

  useEffect(() => {
    if (showFirstRunWhisper) {
      const timer = setTimeout(() => {
        setShowFirstRunWhisper(false);
        updatePreferences({ firstRunCueShown: true });
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showFirstRunWhisper, updatePreferences]);

  const handlePress = () => {
    if (isLocked) {
      hapticLockedCardTap();
      onPressLocked();
    } else {
      hapticBeginRest();
      onPressUnlocked();
    }
  };

  const buttonText = isLocked ? '🔒 Unlock Deep Rest' : 'Begin Rest';

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.button}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={buttonText}
      >
        <Text style={styles.buttonText}>{buttonText}</Text>
      </Pressable>

      {showFirstRunWhisper && (
        <View style={styles.whisperContainer}>
          <Text style={styles.whisperText}>Tap Begin Rest.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    height: layout.stickyCtaHeight,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    ...typography.title,
    color: colors.onAccent,
    fontWeight: '700',
  },
  whisperContainer: {
    marginTop: spacing.xs,
  },
  whisperText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
