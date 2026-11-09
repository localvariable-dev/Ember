/**
 * StreakPill Component
 * Master Plan Part 1 §2.3
 * 32 dp tall pill displaying the ember ring and active streak count.
 * Tap opens the Journey sheet.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';
import { projectStreak } from '../../domain/streakEngine';
import { dayKeyFromMs } from '../../domain/dayKey';

export function StreakPill() {
  const { streak } = useDatabase();
  const openSheet = useSheetStore((state) => state.openSheet);

  const [now] = useState(() => Date.now());
  const today = useMemo(() => dayKeyFromMs(now), [now]);
  const projection = projectStreak(streak, today);

  const isLapsed = projection.status === 'lapsed';
  const isHeldByGrace = projection.status === 'held_by_grace';
  const isDoneToday = projection.status === 'done_today';

  // Ember dot color based on state
  let dotColor: string = colors.accent;
  if (isDoneToday) {
    dotColor = colors.accentSoft;
  } else if (isHeldByGrace) {
    dotColor = 'rgba(245, 158, 11, 0.6)';
  } else if (isLapsed && streak.currentStreak === 0) {
    dotColor = colors.textFaint;
  }

  const streakNumber = isLapsed ? 0 : streak.currentStreak;
  const streakLabel = `${streakNumber} ${streakNumber === 1 ? 'day' : 'days'}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      onPress={() => openSheet('journey')}
      accessibilityRole="button"
      accessibilityLabel={`Streak: ${streakLabel}. Tap to view rest journey.`}
      accessibilityHint="Opens journey sheet"
    >
      <View style={styles.ringContainer}>
        <View style={[styles.emberDot, { backgroundColor: dotColor }]} />
        {isHeldByGrace && <View style={styles.graceRing} />}
      </View>
      <Text style={styles.label}>{streakLabel}</Text>
      <View style={styles.divider} />
      <Text style={styles.affordance}>{streakNumber === 0 ? 'Begin' : 'View streak'}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111416',
    borderColor: 'rgba(233,160,75,0.30)',
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 44,
    paddingHorizontal: spacing.base,
    alignSelf: 'flex-start',
    gap: spacing.sm,
  },
  pillPressed: {
    backgroundColor: 'rgba(233,160,75,0.12)',
    borderColor: colors.accent,
    transform: [{ scale: 0.98 }],
  },
  ringContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emberDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  graceRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    opacity: 0.5,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 2,
  },
  affordance: {
    ...typography.caption,
    color: '#E9A04B',
    fontSize: 12,
  },
  chevron: {
    color: '#E9A04B',
    fontSize: 21,
    lineHeight: 22,
    marginLeft: -4,
  },
});
