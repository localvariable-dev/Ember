/**
 * SessionCard Component
 * Master Plan Part 1 §2.3
 * 88 dp tall rest protocol card with Free, Pro, Free Pass, and Selected states.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../design/tokens';
import type { ProtocolId } from '../../domain/constants';

export type CardAccessState = 'free' | 'pro' | 'free_pass' | 'locked';

export interface SessionCardItem {
  id: ProtocolId;
  durationLabel: string;
  name: string;
  description: string;
  tier: 'free' | 'pro';
}

interface SessionCardProps {
  item: SessionCardItem;
  isSelected: boolean;
  accessState: CardAccessState;
  freePassRemainingDays?: number | undefined;
  onSelect: () => void;
}

export function SessionCard({
  item,
  isSelected,
  accessState,
  freePassRemainingDays,
  onSelect,
}: SessionCardProps) {
  const isLocked = accessState === 'locked';
  const hasFreePass = accessState === 'free_pass';

  return (
    <Pressable
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${item.name}, ${item.durationLabel}. ${item.description}.${
        isLocked ? ' Requires Pro membership.' : hasFreePass ? ' Available via free pass.' : ''
      }`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.durationTag}>{item.durationLabel}</Text>
        {isLocked && (
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>🔒 PRO</Text>
          </View>
        )}
        {hasFreePass && (
          <View style={styles.freePassTag}>
            <Text style={styles.freePassText}>
              Free pass{freePassRemainingDays ? ` · ${freePassRemainingDays}d left` : ''}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 1.5,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  durationTag: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  proBadge: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  proBadgeText: {
    ...typography.badge,
    color: colors.accent,
  },
  freePassTag: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  freePassText: {
    ...typography.badge,
    color: colors.onAccent,
    fontWeight: '600',
  },
  title: {
    ...typography.cardTitle,
    color: colors.text,
  },
  description: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 2,
  },
});
