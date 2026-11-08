/**
 * VoicePickerSheet Component
 * Master Plan Part 1 §2.3, Part 4 §5.4.1
 * Modal sheet allowing the user to select an installed narrator voice or upgrade to Pro.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { hapticCardSelect, hapticLockedCardTap } from '../../design/haptics';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';
import { getActiveSessionController } from '../player/SessionProvider';

export function VoicePickerSheet() {
  const { preferences, updatePreferences, voiceRepo, isPro } = useDatabase();
  const { closeSheet, openSheet } = useSheetStore();

  const voices = voiceRepo.all();

  const handleSelectVoice = (voiceId: string, isProVoice: boolean) => {
    if (isProVoice && !isPro) {
      hapticLockedCardTap();
      closeSheet();
      openSheet('paywall', { paywallVariant: 'voice_locked' });
      return;
    }

    hapticCardSelect();
    updatePreferences({ selectedVoiceId: voiceId });

    // In-flight narrator switch if a session is actively playing
    const activeCtrl = getActiveSessionController();
    if (activeCtrl && activeCtrl.getActiveSessionId()) {
      activeCtrl.switchVoice(voiceId);
    }

    closeSheet();
  };

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle}>Narrator Voice</Text>
        <Pressable
          style={styles.closeBtn}
          onPress={closeSheet}
          accessibilityRole="button"
          accessibilityLabel="Close voice picker"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Change voice narrator anytime. Works offline across all sessions.
      </Text>

      <View style={styles.voiceList}>
        {voices.map((v) => {
          const isSelected = preferences.selectedVoiceId === v.id;
          const isVoicePro = v.tier === 'pro';
          const isLocked = isVoicePro && !isPro;

          return (
            <Pressable
              key={v.id}
              style={[styles.voiceCard, isSelected && styles.voiceCardSelected]}
              onPress={() => handleSelectVoice(v.id, isVoicePro)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${v.name}, ${v.subtitle}.${isLocked ? ' Requires Pro.' : ''}`}
            >
              <View style={styles.voiceInfo}>
                <View style={styles.voiceNameRow}>
                  <Text style={styles.voiceName}>{v.name}</Text>
                  {isVoicePro && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.voiceSubtitle}>{v.subtitle}</Text>
              </View>

              <View style={styles.checkArea}>
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
                {isLocked && <Text style={styles.lockGlyph}>🔒</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={styles.importLink}
        onPress={() => alert('Sideload .embervoice pack: Place in application documents.')}
      >
        <Text style={styles.importLinkText}>+ Add Voice Pack (.embervoice)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    borderColor: colors.border,
    borderTopWidth: 1,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    ...typography.title,
    color: colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  voiceList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  voiceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
    minHeight: 64,
  },
  voiceCardSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  voiceInfo: {
    gap: 2,
  },
  voiceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  voiceName: {
    ...typography.cardTitle,
    color: colors.text,
  },
  proBadge: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  proBadgeText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
  },
  voiceSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  checkArea: {
    minWidth: 24,
    alignItems: 'center',
  },
  checkMark: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: '700',
  },
  lockGlyph: {
    fontSize: 14,
  },
  importLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  importLinkText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 13,
  },
});
