/**
 * ModeToggle Component
 * Master Plan Part 1 §2.3
 * Two-segment pill (Focus / Sleep) for 10-min and 30-min sessions.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { hapticMoodSelect } from '../../design/haptics';
import type { Mode } from '../../data/types';

interface ModeToggleProps {
  mode: Mode;
  onModeChange: (newMode: Mode) => void;
  hapticsEnabled?: boolean;
}

export function ModeToggle({ mode, onModeChange, hapticsEnabled = true }: ModeToggleProps) {
  const handleToggle = (targetMode: Mode) => {
    if (targetMode !== mode) {
      hapticMoodSelect(hapticsEnabled);
      onModeChange(targetMode);
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.pill}
        accessibilityRole="radiogroup"
        accessibilityLabel="Rest mode selector"
      >
        <Pressable
          style={[styles.option, mode === 'focus' && styles.optionActive]}
          onPress={() => handleToggle('focus')}
          accessibilityRole="radio"
          accessibilityState={{ selected: mode === 'focus' }}
          accessibilityLabel="Focus mode. Keeps screen awake and ends with gentle rise chime."
        >
          <Text style={[styles.text, mode === 'focus' && styles.textActive]}>☼ Focus</Text>
        </Pressable>

        <Pressable
          style={[styles.option, mode === 'sleep' && styles.optionActive]}
          onPress={() => handleToggle('sleep')}
          accessibilityRole="radio"
          accessibilityState={{ selected: mode === 'sleep' }}
          accessibilityLabel="Sleep mode. Allows screen timeout and fades silently into sleep."
        >
          <Text style={[styles.text, mode === 'sleep' && styles.textActive]}>☾ Sleep</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.base,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  option: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
  },
  text: {
    ...typography.label,
    color: colors.textMuted,
  },
  textActive: {
    color: colors.text,
    fontWeight: '600',
  },
});
