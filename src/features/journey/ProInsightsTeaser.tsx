/**
 * ProInsightsTeaser Component
 * Master Plan Part 1 §2.7, §2.8
 * Banner prompting free users to upgrade for full history and deep recovery insights.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { useSheetStore } from '../../stores/useSheetStore';

export function ProInsightsTeaser() {
  const openSheet = useSheetStore((state) => state.openSheet);

  return (
    <Pressable
      style={styles.container}
      onPress={() => openSheet('paywall', { paywallVariant: 'insights' })}
      accessibilityRole="button"
      accessibilityLabel="Unlock full history and insights with Pro. Opens upgrade screen."
    >
      <View style={styles.content}>
        <Text style={styles.title}>Unlock full history &amp; insights</Text>
        <Text style={styles.subtitle}>
          Explore weekly shift trends, best time-of-day windows, and unlimited session logs.
        </Text>
      </View>
      <View style={styles.proBadge}>
        <Text style={styles.proText}>PRO 🔒</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  proBadge: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  proText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
});
