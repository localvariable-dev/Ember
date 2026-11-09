/**
 * JourneySheet Component (Screen 5)
 * Master Plan Part 1 §2.7, Part 2 §3.3-§3.8
 *
 * 92% snap bottom sheet displaying:
 * - Streak Header (active ember ring, longest streak, Rest Grace indicators)
 * - 30-day Retention Heatmap (7 rows x ISO week columns, Mon-start, today outline)
 * - Restorative Aggregate Stats (minutes + completed sessions)
 * - Calm Delta Card (perceived state shifts with Free headline & Pro deep analytics)
 * - Expandable Session History (last 7 for Free, unlimited for Pro)
 * - Pro Insights Teaser (Free only)
 * - Gentle Daily Reminder toggle with automatic rescheduling
 * - Membership Card (tier status, Voice Picker link, non-medical disclaimer, hidden dev panel)
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';
import { addDays, dayKeyFromMs } from '../../domain/dayKey';
import { StreakHeader } from './StreakHeader';
import { Heatmap } from './Heatmap';
import { StatsRow } from './StatsRow';
import { CalmDeltaCard } from './CalmDeltaCard';
import { SessionRow } from './SessionRow';
import { ProInsightsTeaser } from './ProInsightsTeaser';
import { MembershipCard } from './MembershipCard';
import { getPersonalProgressInsight } from '../../domain/motivation';
import {
  requestNotificationPermission,
  syncNotificationSchedule,
} from '../../services/NotificationService';

export function JourneySheet() {
  const {
    streak,
    isPro,
    activePass,
    entitlementService,
    sessionRepo,
    ledgerRepo,
    prefsRepo,
    streakRepo,
    preferences,
    updatePreferences,
  } = useDatabase();
  const { closeSheet } = useSheetStore();

  const [now] = useState(() => Date.now());
  const today = useMemo(() => dayKeyFromMs(now), [now]);
  const yesterdayKey = useMemo(() => addDays(today, -1), [today]);
  const thirtyDaysAgo = useMemo(() => addDays(today, -29), [today]);

  // Aggregate stats & queries
  const stats = useMemo(() => sessionRepo.getStats(), [sessionRepo]);
  const pairedSessions = useMemo(() => sessionRepo.getPairedSessions(), [sessionRepo]);
  const ledgerRows = useMemo(
    () => ledgerRepo.getRange(thirtyDaysAgo, today),
    [ledgerRepo, thirtyDaysAgo, today],
  );
  const sessions = useMemo(
    () => (isPro ? sessionRepo.listAll() : sessionRepo.listRecent(7)),
    [sessionRepo, isPro],
  );

  const personalInsight = useMemo(() => {
    let avgDelta: number | undefined;
    if (pairedSessions.length >= 2) {
      const deltas = pairedSessions.map((p) => p.postState - p.preState);
      avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    }
    return getPersonalProgressInsight({
      totalSessions: stats.sessions,
      totalCommittedMs: stats.minutes * 60_000,
      averageCalmDelta: avgDelta ?? null,
    });
  }, [pairedSessions, stats]);

  const handleToggleReminder = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      updatePreferences({ notificationsEnabled: granted });
      await syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo });
    } else {
      updatePreferences({ notificationsEnabled: false });
      await syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo });
    }
  };

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.grabber} />

      {/* Sheet Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle}>Journey</Text>
        <Pressable
          style={styles.closeBtn}
          onPress={closeSheet}
          accessibilityRole="button"
          accessibilityLabel="Close journey sheet"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Streak Header */}
        <StreakHeader streak={streak} today={today} />

        {/* 2. 30-Day Heatmap */}
        <Heatmap today={today} ledgerRows={ledgerRows} />

        {/* 3. Aggregate Stats */}
        <StatsRow minutes={stats.minutes} sessions={stats.sessions} />

        {/* Personal Progress Insight */}
        {personalInsight && (
          <View style={styles.insightBox}>
            <View style={styles.insightHeader}>
              <Text style={styles.insightSparkle}>✦</Text>
              <Text style={styles.insightTitle}>Personal Progress</Text>
            </View>
            <Text style={styles.insightBody}>{personalInsight}</Text>
          </View>
        )}

        {/* 4. Calm Delta Insight Card */}
        <CalmDeltaCard pairedSessions={pairedSessions} isPro={isPro} nowMs={now} />

        {/* 5. Session History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Session log</Text>
            {!isPro && sessions.length >= 7 && (
              <Text style={styles.freeLimitTag}>Showing last 7</Text>
            )}
          </View>

          {sessions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No rest sessions recorded yet.</Text>
            </View>
          ) : (
            <View style={styles.sessionList}>
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} todayKey={today} yesterdayKey={yesterdayKey} />
              ))}
            </View>
          )}

          {!isPro && <ProInsightsTeaser />}
        </View>

        {/* 6. Gentle Notification Toggle */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderTextGroup}>
            <Text style={styles.reminderTitle}>Gentle Daily Reminder</Text>
            <Text style={styles.reminderSubtitle}>
              One silent notification a day at your learned rest hour.
            </Text>
          </View>
          <Switch
            value={preferences.notificationsEnabled}
            onValueChange={handleToggleReminder}
            trackColor={{ false: colors.surfaceRaised, true: colors.accentSoft }}
            thumbColor={preferences.notificationsEnabled ? colors.accent : colors.textMuted}
            accessibilityLabel="Toggle gentle daily reminder"
          />
        </View>

        {/* 7. Membership & Voices Card */}
        <MembershipCard
          isPro={isPro}
          trialExpiresAtMs={entitlementService.getSnapshot().trialExpiresAtMs}
          activePass={activePass}
          activeVoiceId={preferences.selectedVoiceId}
        />

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    height: '92%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.sm,
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
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.title,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  historySection: {
    gap: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  freeLimitTag: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
  },
  sessionList: {
    gap: spacing.xs,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  insightBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insightSparkle: {
    color: colors.accentSoft,
    fontSize: 12,
  },
  insightTitle: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  insightBody: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  reminderTextGroup: {
    flex: 1,
    gap: 2,
  },
  reminderTitle: {
    ...typography.title,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  reminderSubtitle: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  footerSpace: {
    height: spacing.xl,
  },
});
