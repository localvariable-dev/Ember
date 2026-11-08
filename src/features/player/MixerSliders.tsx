/**
 * MixerSliders Component
 * Master Plan Part 1 §2.5
 * Independent Voice and Ambient sliders with perceptual tapering (v^2).
 * VoiceChip: opens Voice Picker sheet.
 * BedChip: cycles ambient beds.
 */

import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { hapticCardSelect } from '../../design/haptics';

interface MixerSlidersProps {
  voiceVolume: number; // 0 to 1
  ambientVolume: number; // 0 to 1
  voiceDisplayName: string;
  ambientDisplayName: string;
  onVoiceVolumeChange: (vol: number) => void;
  onAmbientVolumeChange: (vol: number) => void;
  onVoiceChipPress: () => void;
  onBedChipPress: () => void;
}

interface SliderRowProps {
  label: string;
  icon: string;
  chipLabel: string;
  value: number; // 0 to 1
  onValueChange: (val: number) => void;
  onChipPress: () => void;
  accessibilityLabel: string;
}

function SliderRow({
  label,
  icon,
  chipLabel,
  value,
  onValueChange,
  onChipPress,
  accessibilityLabel,
}: SliderRowProps) {
  const [trackWidth, setTrackWidth] = React.useState(160);

  const handleTouch = (evt: GestureResponderEvent) => {
    const x = evt.nativeEvent.locationX;
    const clampedRatio = Math.max(0, Math.min(1, x / trackWidth));
    onValueChange(clampedRatio);
  };

  return (
    <View style={styles.sliderRow}>
      {/* Icon & Label */}
      <View style={styles.labelCol}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.labelText}>{label}</Text>
      </View>

      {/* Slider Track (48dp touch target) */}
      <Pressable
        style={styles.sliderTouchTarget}
        onPress={handleTouch}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      >
        <View style={styles.trackBackground}>
          <View style={[styles.trackFill, { width: `${Math.round(value * 100)}%` }]} />
        </View>
        <View style={[styles.thumb, { left: `${Math.round(value * 100)}%` }]} />
      </Pressable>

      {/* Selector Chip */}
      <Pressable
        style={styles.chip}
        onPress={() => {
          hapticCardSelect();
          onChipPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Change ${label}: currently ${chipLabel}`}
      >
        <Text style={styles.chipText}>[ {chipLabel} ]</Text>
      </Pressable>
    </View>
  );
}

export function MixerSliders({
  voiceVolume,
  ambientVolume,
  voiceDisplayName,
  ambientDisplayName,
  onVoiceVolumeChange,
  onAmbientVolumeChange,
  onVoiceChipPress,
  onBedChipPress,
}: MixerSlidersProps) {
  return (
    <View style={styles.container}>
      <SliderRow
        label="Voice"
        icon="🎙"
        chipLabel={voiceDisplayName}
        value={voiceVolume}
        onValueChange={onVoiceVolumeChange}
        onChipPress={onVoiceChipPress}
        accessibilityLabel={`Voice volume ${Math.round(voiceVolume * 100)}%`}
      />

      <SliderRow
        label="Ambient"
        icon="〰"
        chipLabel={ambientDisplayName}
        value={ambientVolume}
        onValueChange={onAmbientVolumeChange}
        onChipPress={onBedChipPress}
        accessibilityLabel={`Ambient volume ${Math.round(ambientVolume * 100)}%`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  labelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    gap: 6,
  },
  icon: {
    fontSize: 14,
    color: colors.textMuted,
  },
  labelText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 13,
  },
  sliderTouchTarget: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
    position: 'relative',
  },
  trackBackground: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  thumb: {
    position: 'absolute',
    top: 17,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    marginLeft: -7,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 72,
    alignItems: 'center',
  },
  chipText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '500',
  },
});
