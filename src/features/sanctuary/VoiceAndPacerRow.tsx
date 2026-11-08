/**
 * VoiceAndPacerRow Component
 * Master Plan Part 1 §2.3
 * 48 dp row with VoiceChip narrator selector and Sigh Pacer toggle.
 */

import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { hapticModeToggle } from '../../design/haptics';
import type { ProtocolId } from '../../domain/constants';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';

interface VoiceAndPacerRowProps {
  selectedProtocolId: ProtocolId;
}

export function VoiceAndPacerRow({ selectedProtocolId }: VoiceAndPacerRowProps) {
  const { preferences, updatePreferences, voiceRepo } = useDatabase();
  const openSheet = useSheetStore((state) => state.openSheet);

  const is5Min = selectedProtocolId === 'rapid_reset_5';
  const voice = voiceRepo.getById(preferences.selectedVoiceId);
  const voiceDisplayName = voice?.name ?? 'Maya';

  const handleTogglePacer = (val: boolean) => {
    hapticModeToggle();
    updatePreferences({ sighPacerDefault: val });
  };

  return (
    <View style={styles.container}>
      {/* Left: VoiceChip */}
      <Pressable
        style={styles.voiceChip}
        onPress={() => openSheet('voice_picker')}
        accessibilityRole="button"
        accessibilityLabel={`Narrator voice: ${voiceDisplayName}. Tap to change narrator.`}
      >
        <Text style={styles.voiceLabel}>Voice:</Text>
        <Text style={styles.voiceName}>{voiceDisplayName}</Text>
      </Pressable>

      <Text style={styles.separator}>·</Text>

      {/* Right: Sigh Pacer */}
      <View style={styles.pacerContainer}>
        {is5Min ? (
          <Text style={styles.pacerDisabledCaption}>Includes two sighs</Text>
        ) : (
          <View style={styles.pacerActiveRow}>
            <Text style={styles.pacerLabel}>Sigh pacer</Text>
            <Switch
              value={preferences.sighPacerDefault}
              onValueChange={handleTogglePacer}
              trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
              thumbColor={preferences.sighPacerDefault ? colors.onAccent : colors.textMuted}
              accessibilityLabel="Enable pre-session physiological sigh pacer"
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    justifyContent: 'space-between',
  },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  voiceLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  voiceName: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  separator: {
    ...typography.caption,
    color: colors.border,
  },
  pacerContainer: {
    justifyContent: 'center',
  },
  pacerDisabledCaption: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  pacerActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pacerLabel: {
    ...typography.caption,
    color: colors.text,
  },
});
