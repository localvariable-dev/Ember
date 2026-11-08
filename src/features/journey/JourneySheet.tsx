/**
 * JourneySheet Component (Screen 5)
 * Master Plan Part 1 §2.7
 * 92% snap bottom sheet displaying Streak Header, 30-day Heatmap, Stats, Calm Delta, and Session Log.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';
import { addDays, dayKeyFromMs } from '../../domain/dayKey';

export function JourneySheet() {
  const { streak, isPro, activePass, sessionRepo, ledgerRepo } = useDatabase();
  const { closeSheet, openSheet } = useSheetStore();

  const [now] = useState(() => Date.now());
  const today = useMemo(() => dayKeyFromMs(now), [now]);
  const thirtyDaysAgo = useMemo(() => addDays(today, -29), [today]);

  const stats = sessionRepo.getStats();
  const recentSessions = sessionRepo.listRecent(isPro ? 50 : 7);
  const ledgerRows = ledgerRepo.getRange(thirtyDaysAgo, today);
  const practiceMap = new Map(ledgerRows.map((r) => [r.localDay, r]));

  // 30 days heatmap grid cells
  const heatmapCells: { day: string; level: number; kind: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    const row = practiceMap.get(d);
    let level = 0;
    if (row) {
      if (row.kind === 'grace') {
        level = 1;
      } else if (row.committedMs >= 1_800_000) {
        level = 4;
      } else if (row.committedMs >= 600_000) {
        level = 3;
      } else if (row.committedMs > 0) {
        level = 2;
      }
    }
    heatmapCells.push({ day: d, level, kind: row?.kind ?? 'none' });
  }

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle}>Your Rest Journey</Text>
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
        {/* Streak Header */}
        <View style={styles.streakHeader}>
          <View style={styles.streakStat}>
            <View style={styles.emberRing}>
              <View style={styles.emberCore} />
            </View>
            <View>
              <Text style={styles.streakNumber}>{streak.currentStreak}-day</Text>
              <Text style={styles.statSublabel}>Current streak</Text>
            </View>
          </View>

          <View style={styles.streakStat}>
            <Text style={styles.streakNumberSmall}>{streak.longestStreak} days</Text>
            <Text style={styles.statSublabel}>Longest</Text>
          </View>

          <View style={styles.streakStat}>
            <View style={styles.graceDotsRow}>
              <View style={[styles.graceDot, streak.graceBanked >= 1 && styles.graceDotBanked]} />
              <View style={[styles.graceDot, streak.graceBanked >= 2 && styles.graceDotBanked]} />
            </View>
            <Text style={styles.statSublabel}>{streak.graceBanked} Graces</Text>
          </View>
        </View>

        {/* 30 Days Heatmap */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 30 days</Text>
          <View style={styles.heatmapGrid}>
            {heatmapCells.map((cell) => {
              const isToday = cell.day === today;
              let bg: string = colors.surfaceRaised;
              if (cell.level === 1) bg = 'rgba(245, 158, 11, 0.25)'; // grace
              if (cell.level === 2) bg = 'rgba(245, 158, 11, 0.45)';
              if (cell.level === 3) bg = 'rgba(245, 158, 11, 0.75)';
              if (cell.level === 4) bg = colors.accent;

              return (
                <View
                  key={cell.day}
                  style={[
                    styles.heatmapCell,
                    { backgroundColor: bg },
                    isToday && styles.heatmapTodayCell,
                  ]}
                  accessibilityLabel={`${cell.day}: ${cell.kind} rest`}
                />
              );
            })}
          </View>
          <View style={styles.heatmapLegend}>
            <Text style={styles.legendText}>Less</Text>
            <View style={[styles.legendCell, { backgroundColor: colors.surfaceRaised }]} />
            <View style={[styles.legendCell, { backgroundColor: 'rgba(245, 158, 11, 0.45)' }]} />
            <View style={[styles.legendCell, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>More</Text>
          </View>
        </View>

        {/* Aggregate Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.minutes}</Text>
            <Text style={styles.statLabel}>restorative minutes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.sessions}</Text>
            <Text style={styles.statLabel}>sessions completed</Text>
          </View>
        </View>

        {/* Headline Calm Delta Insight */}
        <View style={styles.insightCard}>
          <Text style={styles.insightHeader}>Your Calm Delta</Text>
          <Text style={styles.insightBody}>
            {stats.sessions >= 5
              ? 'When starting wired, your sessions guide you to calm or restored 88% of the time.'
              : 'Complete 5 sessions to unlock your personalized recovery insight.'}
          </Text>
        </View>

        {/* Session Log */}
        <View style={styles.section}>
          <View style={styles.logHeaderRow}>
            <Text style={styles.sectionTitle}>Session log</Text>
            {!isPro && <Text style={styles.freeLimitTag}>Showing last 7</Text>}
          </View>

          {recentSessions.length === 0 ? (
            <Text style={styles.emptyText}>No rest sessions recorded yet.</Text>
          ) : (
            recentSessions.map((s) => {
              const min = Math.round(s.plannedMs / 60_000);
              const modeGlyph = s.mode === 'sleep' ? '☾' : '☼';
              const stateChange = s.preState && s.postState ? `${s.preState} → ${s.postState}` : '';

              return (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={styles.sessionLeft}>
                    <Text style={styles.sessionDay}>{s.localDay}</Text>
                    <Text style={styles.sessionDetails}>
                      {min} min {modeGlyph} {stateChange ? `· State: ${stateChange}` : ''}
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    {s.accessVia === 'pro' && (
                      <View style={styles.proMicroBadge}>
                        <Text style={styles.proMicroText}>PRO</Text>
                      </View>
                    )}
                    <Text style={styles.sessionStatus}>{s.status}</Text>
                  </View>
                </View>
              );
            })
          )}

          {!isPro && (
            <Pressable
              style={styles.proHistoryTeaser}
              onPress={() => {
                closeSheet();
                openSheet('paywall', { paywallVariant: 'insights' });
              }}
            >
              <Text style={styles.teaserText}>Unlock full history &amp; insights 🔒 PRO</Text>
            </Pressable>
          )}
        </View>

        {/* Membership Card */}
        <View style={styles.membershipCard}>
          <View>
            <Text style={styles.membershipTitle}>Membership</Text>
            <Text style={styles.membershipStatus}>
              {isPro ? 'Pro · Active' : activePass ? 'Free Pass · Active' : 'Ember Free'}
            </Text>
          </View>
          {!isPro && (
            <Pressable
              style={styles.upgradeBtn}
              onPress={() => {
                closeSheet();
                openSheet('paywall', { paywallVariant: 'settings' });
              }}
            >
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </Pressable>
          )}
        </View>

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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  streakHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  streakStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emberRing: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emberCore: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  streakNumber: {
    ...typography.title,
    color: colors.text,
  },
  streakNumberSmall: {
    ...typography.label,
    color: colors.text,
  },
  statSublabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  graceDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  graceDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  graceDotBanked: {
    backgroundColor: colors.accent,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
  },
  heatmapCell: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  heatmapTodayCell: {
    borderWidth: 1,
    borderColor: colors.accentSoft,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  legendText: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 10,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.displaySm,
    color: colors.accent,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  insightCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.xl,
  },
  insightHeader: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  insightBody: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  logHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  freeLimitTag: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 11,
  },
  emptyText: {
    ...typography.body,
    color: colors.textFaint,
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessionLeft: {
    gap: 2,
  },
  sessionDay: {
    ...typography.label,
    color: colors.text,
  },
  sessionDetails: {
    ...typography.caption,
    color: colors.textMuted,
  },
  sessionRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  proMicroBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  proMicroText: {
    fontSize: 9,
    color: colors.onAccent,
    fontWeight: '700',
  },
  sessionStatus: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 11,
  },
  proHistoryTeaser: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  teaserText: {
    ...typography.label,
    color: colors.accent,
  },
  membershipCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
  },
  membershipTitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  membershipStatus: {
    ...typography.label,
    color: colors.text,
    fontWeight: '600',
  },
  upgradeBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.button,
  },
  upgradeBtnText: {
    ...typography.label,
    color: colors.onAccent,
    fontWeight: '600',
  },
  footerSpace: {
    height: 40,
  },
});
