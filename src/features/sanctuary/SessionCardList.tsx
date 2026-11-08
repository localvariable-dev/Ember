/**
 * SessionCardList Component
 * Master Plan Part 1 §2.3
 * Displays the 3 canonical session cards (5m, 10m, 30m) with 12 dp gap.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../design/tokens';
import type { ProtocolId } from '../../domain/constants';
import type { CardAccessState, SessionCardItem } from './SessionCard';
import { SessionCard } from './SessionCard';

export const CANONICAL_CARDS: readonly SessionCardItem[] = [
  {
    id: 'rapid_reset_5',
    durationLabel: '5 min',
    name: 'Rapid Reset',
    description: 'Acute stress · pre-meeting release',
    tier: 'free',
  },
  {
    id: 'afternoon_recharge_10',
    durationLabel: '10 min',
    name: 'Afternoon Recharge',
    description: 'Post-lunch circadian focus restore',
    tier: 'free',
  },
  {
    id: 'deep_rest_30',
    durationLabel: '30 min',
    name: 'Deep Rest & Yoga Nidra',
    description: 'Parasympathetic recovery · sleep wind-down',
    tier: 'pro',
  },
] as const;

interface SessionCardListProps {
  selectedId: ProtocolId;
  isPro: boolean;
  hasFreePass: boolean;
  freePassRemainingDays?: number | undefined;
  onSelectCard: (id: ProtocolId) => void;
}

export function SessionCardList({
  selectedId,
  isPro,
  hasFreePass,
  freePassRemainingDays,
  onSelectCard,
}: SessionCardListProps) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Session protocols">
      {CANONICAL_CARDS.map((item) => {
        const isSelected = selectedId === item.id;

        let accessState: CardAccessState = 'free';
        if (item.tier === 'pro') {
          if (isPro) {
            accessState = 'pro';
          } else if (hasFreePass) {
            accessState = 'free_pass';
          } else {
            accessState = 'locked';
          }
        }

        return (
          <SessionCard
            key={item.id}
            item={item}
            isSelected={isSelected}
            accessState={accessState}
            freePassRemainingDays={freePassRemainingDays}
            onSelect={() => onSelectCard(item.id)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
