/**
 * TopBar Component
 * Master Plan Part 1 §2.3 & Habit Formation Specification
 *
 * 56 dp top bar holding:
 * - Interactive StreakPill (left)
 * - Subtle 3-day Pro trial pill (right, when active)
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../design/tokens';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';
import { hapticCardSelect } from '../../design/haptics';
import { StreakPill } from './StreakPill';

export function TopBar() {
  const { entitlementService, preferences } = useDatabase();
  const openSheet = useSheetStore((state) => state.openSheet);
  const [now] = useState(() => Date.now());

  const snapshot = entitlementService.getSnapshot();
  const isTrial = snapshot.plan === 'trial' && snapshot.trialExpiresAtMs != null;

  const hoursRemaining = useMemo(() => {
    if (!isTrial || !snapshot.trialExpiresAtMs) return 0;
    const diff = snapshot.trialExpiresAtMs - now;
    return Math.max(1, Math.ceil(diff / 3_600_000));
  }, [isTrial, now, snapshot.trialExpiresAtMs]);

  const handleTrialPress = () => {
    hapticCardSelect(preferences.hapticsEnabled);
    openSheet('journey');
  };

  return (
    <View style={styles.topBar}>
      <StreakPill />

      {isTrial && (
        <Pressable
          style={({ pressed }) => [styles.trialPill, pressed && styles.trialPillPressed]}
          onPress={handleTrialPress}
          accessibilityRole="button"
          accessibilityLabel={`3-Day Pro Trial Active, ${hoursRemaining} hours remaining.`}
          accessibilityHint="Opens journey membership details"
        >
          <Text style={styles.trialSparkle}>✦</Text>
          <Text style={styles.trialText}>Pro Trial · {hoursRemaining}h</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: layout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    borderRadius: radii.pill,
  },
  trialPillPressed: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  trialSparkle: {
    color: colors.accentSoft,
    fontSize: 10,
  },
  trialText: {
    ...typography.caption,
    color: colors.accentSoft,
    fontSize: 12,
    fontWeight: '500',
  },
});
