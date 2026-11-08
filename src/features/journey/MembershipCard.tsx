/**
 * MembershipCard Component
 * Master Plan Part 1 §2.7
 *
 * Displays active membership tier, Voice Picker link, non-medical disclaimer,
 * and hidden 7-tap developer panel activation.
 */

import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { useSheetStore } from '../../stores/useSheetStore';
import type { UserEntitlement } from '../../data/types';

interface MembershipCardProps {
  isPro: boolean;
  activePass: UserEntitlement | null;
  activeVoiceId: string;
}

const VOICE_DISPLAY_NAMES: Record<string, string> = {
  maya_warm: 'Maya (Warm & Grounding)',
  arjun_deep: 'Arjun (Deep & Resonant)',
};

export function MembershipCard({ isPro, activePass, activeVoiceId }: MembershipCardProps) {
  const openSheet = useSheetStore((state) => state.openSheet);
  const [tapCount, setTapCount] = useState(0);
  const [now] = useState(() => Date.now());
  const tapResetTimer = useRef<NodeJS.Timeout | null>(null);

  const voiceName = VOICE_DISPLAY_NAMES[activeVoiceId] ?? activeVoiceId;

  // Determine membership label and action
  let tierTitle = 'Ember Free';
  let tierSubtitle = '5m & 10m sessions with full offline support.';
  let showUpgrade = true;

  if (isPro) {
    tierTitle = 'Ember Pro';
    tierSubtitle = 'Full catalog, custom voices & deep analytics unlocked.';
    showUpgrade = false;
  } else if (activePass && activePass.status === 'available') {
    const daysLeft = activePass.expiresAtMs
      ? Math.max(0, Math.ceil((activePass.expiresAtMs - now) / 86_400_000))
      : 14;
    tierTitle = 'Free Pass Active';
    tierSubtitle = `30m Deep Rest unlocked (expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}).`;
    showUpgrade = true;
  }

  // 7-tap developer panel trigger
  const handleVersionTap = () => {
    if (tapResetTimer.current) {
      clearTimeout(tapResetTimer.current);
    }

    const nextCount = tapCount + 1;
    if (nextCount >= 7) {
      setTapCount(0);
      openSheet('dev');
    } else {
      setTapCount(nextCount);
      tapResetTimer.current = setTimeout(() => {
        setTapCount(0);
      }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      {/* Tier Status Row */}
      <View style={styles.tierRow}>
        <View style={styles.tierInfo}>
          <Text style={styles.tierTitle}>{tierTitle}</Text>
          <Text style={styles.tierSubtitle}>{tierSubtitle}</Text>
        </View>

        {showUpgrade && (
          <Pressable
            style={styles.upgradeButton}
            onPress={() => openSheet('paywall', { paywallVariant: 'default' })}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Ember Pro"
          >
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      {/* Voice Picker Link */}
      <Pressable
        style={styles.voiceRow}
        onPress={() => openSheet('voice_picker', { voicePickerContext: 'sanctuary' })}
        accessibilityRole="button"
        accessibilityLabel={`Current narrator voice: ${voiceName}. Tap to change voice.`}
      >
        <View>
          <Text style={styles.rowLabel}>Narrator Voice</Text>
          <Text style={styles.rowValue}>{voiceName}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.divider} />

      {/* Non-Medical Disclaimer */}
      <Text style={styles.disclaimerText}>
        Ember is a relaxation tool, not a medical device, and is not a treatment for any condition.
      </Text>

      {/* Version & Hidden Dev Trigger */}
      <Pressable
        onPress={handleVersionTap}
        style={styles.versionRow}
        accessibilityRole="button"
        accessibilityLabel="Version 1.0.0"
      >
        <Text style={styles.versionText}>Ember v1.0.0 (offline build)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tierInfo: {
    flex: 1,
    gap: 2,
  },
  tierTitle: {
    ...typography.title,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  tierSubtitle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  upgradeButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  upgradeButtonText: {
    ...typography.label,
    fontSize: 12,
    fontWeight: '600',
    color: colors.bg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rowLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
  },
  rowValue: {
    ...typography.body,
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    marginTop: 1,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
  },
  disclaimerText: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textFaint,
    fontStyle: 'italic',
  },
  versionRow: {
    alignItems: 'center',
    paddingTop: 4,
  },
  versionText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textFaint,
  },
});
