/**
 * Sanctuary Screen (Route: "/")
 * Master Plan Part 1 §2.3
 * 2-tap entry into rest.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, radii, spacing, typography } from '../src/design/tokens';
import {
  hapticBeginRest,
  hapticCardSelect,
  hapticLockedCardTap,
  hapticModeToggle,
} from '../src/design/haptics';
import { getTimeContext } from '../src/domain/timeOfDay';
import type { ProtocolId } from '../src/domain/constants';
import { useSheetStore } from '../src/stores/useSheetStore';
import { useSessionStore } from '../src/stores/useSessionStore';

interface ProtocolCard {
  id: ProtocolId;
  durationLabel: string;
  name: string;
  description: string;
  isPro: boolean;
}

const CARDS: ProtocolCard[] = [
  {
    id: 'rapid_reset_5',
    durationLabel: '5 min',
    name: 'Rapid Reset',
    description: 'Acute stress · pre-meeting release',
    isPro: false,
  },
  {
    id: 'afternoon_recharge_10',
    durationLabel: '10 min',
    name: 'Afternoon Recharge',
    description: 'Post-lunch circadian focus restore',
    isPro: false,
  },
  {
    id: 'deep_rest_30',
    durationLabel: '30 min',
    name: 'Deep Rest & Yoga Nidra',
    description: 'Parasympathetic recovery · sleep wind-down',
    isPro: true,
  },
];

export default function SanctuaryScreen() {
  const router = useRouter();
  const timeContext = getTimeContext(new Date());

  const [selectedCardId, setSelectedCardId] = useState<ProtocolId>(timeContext.protocolId);
  const [mode, setMode] = useState<'focus' | 'sleep'>('focus');

  const openSheet = useSheetStore((state) => state.openSheet);
  const { setProtocol, setMode: setSessionMode } = useSessionStore();

  const handleSelectCard = (card: ProtocolCard) => {
    if (card.isPro) {
      hapticLockedCardTap();
      openSheet('paywall', { paywallVariant: 'card_tap' });
      return;
    }
    hapticCardSelect();
    setSelectedCardId(card.id);
  };

  const handleBeginRest = () => {
    hapticBeginRest();
    setProtocol(selectedCardId);
    setSessionMode(mode);
    router.push('/player');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar with Streak Pill */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.streakPill}
            onPress={() => openSheet('journey')}
            accessibilityRole="button"
            accessibilityLabel="View streak journey"
          >
            <View style={styles.emberDot} />
            <Text style={styles.streakText}>4 days</Text>
          </Pressable>
        </View>

        {/* Greeting Block */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingHeadline}>{timeContext.greeting}</Text>
          <Text style={styles.greetingContext}>{timeContext.contextLine}</Text>
        </View>

        {/* 3-Tier Session Cards */}
        <View style={styles.cardList}>
          {CARDS.map((card) => {
            const isSelected = selectedCardId === card.id;
            return (
              <Pressable
                key={card.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => handleSelectCard(card)}
                accessibilityRole="button"
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.durationTag}>{card.durationLabel}</Text>
                  {card.isPro && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardTitle}>{card.name}</Text>
                <Text style={styles.cardDescription}>{card.description}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Mode Toggle (visible for 10m & 30m cards) */}
        {selectedCardId !== 'rapid_reset_5' && (
          <View style={styles.modeToggleContainer}>
            <View style={styles.modeTogglePill}>
              <Pressable
                style={[styles.modeOption, mode === 'focus' && styles.modeOptionActive]}
                onPress={() => {
                  hapticModeToggle();
                  setMode('focus');
                }}
              >
                <Text style={[styles.modeText, mode === 'focus' && styles.modeTextActive]}>
                  ☼ Focus
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modeOption, mode === 'sleep' && styles.modeOptionActive]}
                onPress={() => {
                  hapticModeToggle();
                  setMode('sleep');
                }}
              >
                <Text style={[styles.modeText, mode === 'sleep' && styles.modeTextActive]}>
                  ☾ Sleep
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Bottom space for sticky CTA */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sticky Bottom Container for Begin Rest CTA */}
      <View style={styles.stickyCtaContainer}>
        <Pressable style={styles.beginButton} onPress={handleBeginRest} accessibilityRole="button">
          <Text style={styles.beginButtonText}>Begin Rest</Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    height: layout.topBarHeight,
    justifyContent: 'center',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
    minHeight: 36,
    gap: spacing.sm,
  },
  emberDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  streakText: {
    ...typography.caption,
    color: colors.text,
  },
  greetingBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  greetingHeadline: {
    ...typography.display,
  },
  greetingContext: {
    ...typography.body,
    color: colors.textMuted,
  },
  cardList: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
    minHeight: layout.sessionCardHeight,
    justifyContent: 'center',
  },
  cardSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  durationTag: {
    ...typography.caption,
    color: colors.accent,
  },
  proBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  proBadgeText: {
    ...typography.badge,
    color: colors.onAccent,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.text,
  },
  cardDescription: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  modeToggleContainer: {
    marginTop: spacing.base,
    alignItems: 'center',
  },
  modeTogglePill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  modeOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radii.pill,
  },
  modeOptionActive: {
    backgroundColor: colors.surfaceRaised,
  },
  modeText: {
    ...typography.label,
    color: colors.textMuted,
  },
  modeTextActive: {
    color: colors.text,
  },
  bottomSpacer: {
    height: 100,
  },
  stickyCtaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.base,
    backgroundColor: 'transparent',
  },
  beginButton: {
    height: layout.stickyCtaHeight,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginButtonText: {
    ...typography.title,
    color: colors.onAccent,
  },
});
