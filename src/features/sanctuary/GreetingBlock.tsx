/**
 * GreetingBlock Component
 * Master Plan Part 1 §2.3
 * Displays circadian greeting headline (Fraunces 34/40) and selected card context line (Inter 16/24).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../design/tokens';
import type { ProtocolId } from '../../domain/constants';
import { getTimeContext } from '../../domain/timeOfDay';

interface GreetingBlockProps {
  selectedProtocolId: ProtocolId;
}

const CONTEXT_LINES: Record<ProtocolId, string> = {
  rapid_reset_5: 'Two sighs and a release. Five minutes.',
  afternoon_recharge_10: 'The afternoon dip is here. Ten minutes.',
  deep_rest_30: 'The night is long enough for this.',
};

export function GreetingBlock({ selectedProtocolId }: GreetingBlockProps) {
  const timeContext = getTimeContext(new Date());
  const contextLine = CONTEXT_LINES[selectedProtocolId] ?? timeContext.contextLine;

  return (
    <View style={styles.block}>
      <Text style={styles.headline}>{timeContext.greeting}</Text>
      <Text style={styles.contextLine}>{contextLine}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  headline: {
    ...typography.display,
    color: colors.text,
  },
  contextLine: {
    ...typography.body,
    color: colors.textMuted,
  },
});
