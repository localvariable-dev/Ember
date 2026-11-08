/**
 * Player Screen (Route: "/player")
 * Master Plan Part 1 §2.4 & Part 6 §7.2
 * Fullscreen guided rest player.
 */

import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../src/design/tokens';
import { hapticModeToggle } from '../src/design/haptics';
import { useSheetStore } from '../src/stores/useSheetStore';
import { useSessionStore } from '../src/stores/useSessionStore';
import { useDatabase } from '../src/providers/DatabaseProvider';

const PROTOCOL_NAMES: Record<string, string> = {
  rapid_reset_5: 'Rapid Reset',
  afternoon_recharge_10: 'Afternoon Recharge',
  deep_rest_30: 'Deep Rest & Yoga Nidra',
};

const PROTOCOL_DURATIONS: Record<string, string> = {
  rapid_reset_5: '05:00',
  afternoon_recharge_10: '10:00',
  deep_rest_30: '30:00',
};

export default function PlayerScreen() {
  const router = useRouter();
  const openSheet = useSheetStore((state) => state.openSheet);
  const { mode, voiceId, protocolId, isPlaying, setPlaying } = useSessionStore();
  const { voiceRepo } = useDatabase();

  const voiceName = voiceRepo.getById(voiceId)?.name ?? 'Maya';
  const protocolTitle = PROTOCOL_NAMES[protocolId] ?? 'Guided Rest';
  const durationText = PROTOCOL_DURATIONS[protocolId] ?? '10:00';

  const handleClose = () => {
    Alert.alert('End Session?', 'Leaving now will pause your restorative rest.', [
      { text: 'Keep Resting', style: 'cancel' },
      {
        text: 'End Session',
        style: 'destructive',
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="End session"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <Pressable
          style={styles.voiceChip}
          onPress={() => openSheet('voice_picker', { voicePickerContext: 'player' })}
          accessibilityRole="button"
          accessibilityLabel="Switch narrator voice"
        >
          <Text style={styles.voiceText}>Narrator: {voiceName}</Text>
        </Pressable>
      </View>

      {/* Protocol title */}
      <View style={styles.titleContainer}>
        <Text style={styles.protocolTitle}>{protocolTitle}</Text>
      </View>

      {/* Center Breathing Ring / Timer Container */}
      <View style={styles.centerContainer}>
        <View style={styles.orbitalRingPlaceholder}>
          <Text style={styles.timerText}>{durationText}</Text>
          <Text style={styles.cueText}>Inhale gently through nose</Text>
        </View>
        <Text style={styles.modeIndicator}>
          {mode === 'sleep' ? '☾ Sleep Mode · Auto-commit active' : '☼ Focus Mode'}
        </Text>
      </View>

      {/* Bottom Transport Controls */}
      <View style={styles.controlsContainer}>
        <Pressable
          style={styles.playButton}
          onPress={() => {
            hapticModeToggle();
            setPlaying(!isPlaying);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.playButtonText}>{isPlaying ? '❚❚ Pause' : '▶ Resume'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.sm,
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
  closeText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  voiceChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  voiceText: {
    ...typography.caption,
    color: colors.accent,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  protocolTitle: {
    ...typography.title,
    color: colors.text,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  orbitalRingPlaceholder: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  timerText: {
    ...typography.timer,
  },
  cueText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  modeIndicator: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
  controlsContainer: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  playButton: {
    width: 160,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 16,
  },
});
