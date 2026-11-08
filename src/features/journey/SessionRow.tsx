/**
 * SessionRow Component
 * Master Plan Part 1 §2.7
 * Expandable session history row with relative day, time, duration, mode glyph,
 * pre->post state transition, and Pro micro-badge.
 * Tapping expands inline to reveal narrator voice, soundscape ambient bed, and listened duration.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, stateColors, typography } from '../../design/tokens';
import type { SessionLog } from '../../data/types';

interface SessionRowProps {
  session: SessionLog;
  todayKey: string;
  yesterdayKey: string;
}

const VOICE_NAMES: Record<string, string> = {
  maya_warm: 'Maya (Warm & Grounding)',
  arjun_deep: 'Arjun (Deep & Resonant)',
};

const BED_NAMES: Record<string, string> = {
  rain: 'Gentle Rain',
  brown_noise: 'Warm Brown Noise',
  ocean_drift: 'Ocean Drift',
  night_forest: 'Night Forest',
  theta_6hz: 'Theta 6 Hz Waves',
  delta_2hz: 'Delta 2 Hz Waves',
};

function formatTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRelativeDay(localDay: string, todayKey: string, yesterdayKey: string): string {
  if (localDay === todayKey) return 'Today';
  if (localDay === yesterdayKey) return 'Yesterday';

  const [y, m, d] = localDay.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function SessionRow({ session, todayKey, yesterdayKey }: SessionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const durationMin = Math.round(session.plannedMs / 60_000);
  const listenedMin = Math.floor(session.listenedMs / 60_000);
  const modeGlyph = session.mode === 'sleep' ? '☾' : '☼';
  const relativeDay = formatRelativeDay(session.localDay, todayKey, yesterdayKey);
  const timeStr = formatTime(session.startedAtMs);

  const preItem = session.preState ? stateColors[session.preState] : null;
  const postItem = session.postState ? stateColors[session.postState] : null;

  const narratorName = VOICE_NAMES[session.voiceId] ?? session.voiceId;
  const bedName = session.ambientBedId
    ? (BED_NAMES[session.ambientBedId] ?? session.ambientBedId)
    : 'None';

  return (
    <Pressable
      style={[styles.container, expanded && styles.containerExpanded]}
      onPress={() => setExpanded(!expanded)}
      accessibilityRole="button"
      accessibilityLabel={`${relativeDay} at ${timeStr}, ${durationMin} minute session. Status: ${session.status}. Tap to ${expanded ? 'collapse' : 'expand'} details.`}
    >
      {/* Primary Summary Row */}
      <View style={styles.primaryRow}>
        <View style={styles.leftCol}>
          <View style={styles.dayTimeRow}>
            <Text style={styles.dayText}>{relativeDay}</Text>
            <Text style={styles.timeText}>{timeStr}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.durationText}>
              {durationMin} min {modeGlyph}
            </Text>

            {/* State Transition */}
            {preItem && postItem ? (
              <View style={styles.stateTransition}>
                <View style={[styles.stateDot, { backgroundColor: preItem.color }]} />
                <Text style={styles.stateArrow}>→</Text>
                <View style={[styles.stateDot, { backgroundColor: postItem.color }]} />
                <Text style={styles.stateLabel}>
                  {preItem.label} → {postItem.label}
                </Text>
              </View>
            ) : postItem ? (
              <View style={styles.stateTransition}>
                <Text style={styles.stateArrow}>— →</Text>
                <View style={[styles.stateDot, { backgroundColor: postItem.color }]} />
                <Text style={styles.stateLabel}>{postItem.label}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.rightCol}>
          {session.accessVia === 'pro' && (
            <View style={styles.proMicroBadge}>
              <Text style={styles.proMicroText}>PRO</Text>
            </View>
          )}
          <Text style={styles.expandChevron}>{expanded ? '▴' : '▾'}</Text>
        </View>
      </View>

      {/* Expanded Inline Details */}
      {expanded && (
        <View style={styles.detailsBox}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Narrator</Text>
            <Text style={styles.detailValue}>{narratorName}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Soundscape</Text>
            <Text style={styles.detailValue}>{bedName}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Listened</Text>
            <Text style={styles.detailValue}>
              {listenedMin} min ({session.status})
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  containerExpanded: {
    borderColor: colors.accentSoft,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftCol: {
    gap: 2,
    flex: 1,
  },
  dayTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  dayText: {
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  timeText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  durationText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  stateTransition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateArrow: {
    fontSize: 10,
    color: colors.textFaint,
  },
  stateLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  proMicroBadge: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  proMicroText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
  },
  expandChevron: {
    fontSize: 14,
    color: colors.textMuted,
    paddingLeft: 4,
  },
  detailsBox: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
  },
  detailValue: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
});
