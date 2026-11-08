/**
 * AmbientPickerSheet Component
 * Master Plan Part 1 §2.3, Part 3 §4.1
 * Modal sheet allowing the user to select ambient soundscapes or unlock Pro beds.
 */

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { hapticCardSelect, hapticLockedCardTap } from '../../design/haptics';
import type { AmbientBedId } from '../../domain/constants';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';

interface BedRowItem {
  id: AmbientBedId | null;
  title: string;
  description: string;
  isPro: boolean;
  isBinaural: boolean;
}

const BED_DESCRIPTIONS: Record<string, string> = {
  rain: 'Gentle, continuous rainfall acoustic texture',
  brown_noise: 'Deep, low-frequency restorative sound',
  theta_6hz: '6 Hz Theta binaural entrainment · Best with headphones',
  ocean_drift: 'Rolling Pacific ocean surf and tidal flow',
  night_forest: 'Nocturnal wilderness ambience with distant crickets',
  delta_2hz: '2 Hz Delta binaural sleep wave entrainment',
};

export function AmbientPickerSheet() {
  const { db, preferences, updatePreferences, isPro } = useDatabase();
  const { closeSheet, openSheet } = useSheetStore();

  const bedItems = useMemo<BedRowItem[]>(() => {
    try {
      const rows = db.all<{
        id: AmbientBedId;
        title: string;
        tier: 'free' | 'pro';
        asset_key: string;
        loop_ms: number;
        is_binaural: number;
        sort_order: number;
      }>('SELECT * FROM ambient_beds ORDER BY sort_order ASC;');

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: BED_DESCRIPTIONS[r.id] ?? 'Restorative soundscape',
        isPro: r.tier === 'pro',
        isBinaural: Boolean(r.is_binaural),
      }));
    } catch {
      // Fallback if db query fails
      return [
        {
          id: 'rain',
          title: 'Rain',
          description: BED_DESCRIPTIONS.rain ?? 'Gentle rain',
          isPro: false,
          isBinaural: false,
        },
        {
          id: 'brown_noise',
          title: 'Brown Noise',
          description: BED_DESCRIPTIONS.brown_noise ?? 'Brown noise',
          isPro: false,
          isBinaural: false,
        },
        {
          id: 'theta_6hz',
          title: '6 Hz Theta',
          description: BED_DESCRIPTIONS.theta_6hz ?? '6 Hz Theta',
          isPro: false,
          isBinaural: true,
        },
        {
          id: 'ocean_drift',
          title: 'Ocean Drift',
          description: BED_DESCRIPTIONS.ocean_drift ?? 'Ocean drift',
          isPro: true,
          isBinaural: false,
        },
        {
          id: 'night_forest',
          title: 'Night Forest',
          description: BED_DESCRIPTIONS.night_forest ?? 'Night forest',
          isPro: true,
          isBinaural: false,
        },
        {
          id: 'delta_2hz',
          title: '2 Hz Delta',
          description: BED_DESCRIPTIONS.delta_2hz ?? '2 Hz Delta',
          isPro: true,
          isBinaural: true,
        },
      ];
    }
  }, [db]);

  const handleSelect = (bedId: AmbientBedId | null, isProBed: boolean) => {
    if (isProBed && !isPro) {
      hapticLockedCardTap();
      closeSheet();
      openSheet('paywall', { paywallVariant: 'bed_locked' });
      return;
    }

    hapticCardSelect();
    updatePreferences({ ambientBedId: bedId });
    closeSheet();
  };

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle}>Soundscapes</Text>
        <Pressable
          style={styles.closeBtn}
          onPress={closeSheet}
          accessibilityRole="button"
          accessibilityLabel="Close soundscape picker"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Layer gentle, continuous natural acoustics beneath your guided practice.
      </Text>

      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {/* Option: Off */}
        <Pressable
          style={[styles.bedCard, preferences.ambientBedId === null && styles.bedCardSelected]}
          onPress={() => handleSelect(null, false)}
          accessibilityRole="radio"
          accessibilityState={{ selected: preferences.ambientBedId === null }}
          accessibilityLabel="Turn off soundscape"
        >
          <View style={styles.bedInfo}>
            <Text style={styles.bedTitle}>Off</Text>
            <Text style={styles.bedDescription}>Pure voice guidance without soundscape</Text>
          </View>
          <View style={styles.checkArea}>
            {preferences.ambientBedId === null && <Text style={styles.checkMark}>✓</Text>}
          </View>
        </Pressable>

        {bedItems.map((bed) => {
          const isSelected = preferences.ambientBedId === bed.id;
          const isLocked = bed.isPro && !isPro;

          return (
            <Pressable
              key={bed.id ?? 'off'}
              style={[styles.bedCard, isSelected && styles.bedCardSelected]}
              onPress={() => handleSelect(bed.id, bed.isPro)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${bed.title}, ${bed.description}.${isLocked ? ' Requires Pro.' : ''}`}
            >
              <View style={styles.bedInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.bedTitle}>{bed.title}</Text>
                  {bed.isPro && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                  {bed.isBinaural && (
                    <View style={styles.binauralBadge}>
                      <Text style={styles.binauralBadgeText}>🎧 Binaural</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.bedDescription}>{bed.description}</Text>
              </View>

              <View style={styles.checkArea}>
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
                {isLocked && <Text style={styles.lockGlyph}>🔒</Text>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
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
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    marginTop: spacing.xs,
    marginBottom: spacing.base,
  },
  scrollList: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.sm,
    paddingBottom: spacing.base,
  },
  bedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.base,
    minHeight: 64,
  },
  bedCardSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  bedInfo: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bedTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 16,
  },
  proBadge: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  proBadgeText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  binauralBadge: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  binauralBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  bedDescription: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  checkArea: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  checkMark: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  lockGlyph: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
