/**
 * AmbientChips Component
 * Master Plan Part 1 §2.3
 * Single-select ambient soundscape selector with headphone hint for 6Hz Theta.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { hapticCardSelect } from '../../design/haptics';
import type { AmbientBedId } from '../../domain/constants';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSheetStore } from '../../stores/useSheetStore';

interface ChipOption {
  id: AmbientBedId | null;
  label: string;
}

const BASE_CHIPS: ChipOption[] = [
  { id: null, label: 'Off' },
  { id: 'rain', label: 'Rain' },
  { id: 'brown_noise', label: 'Brown' },
  { id: 'theta_6hz', label: '6Hz θ' },
];

const PREMIUM_LABELS: Record<string, string> = {
  ocean_drift: 'Ocean',
  night_forest: 'Forest',
  delta_2hz: '2Hz δ',
};

interface AmbientChipsProps {
  selectedBedId: AmbientBedId | null;
  onSelectBed: (bedId: AmbientBedId | null) => void;
}

export function AmbientChips({ selectedBedId, onSelectBed }: AmbientChipsProps) {
  const { preferences, updatePreferences } = useDatabase();
  const openSheet = useSheetStore((state) => state.openSheet);

  const [showHeadphoneHint, setShowHeadphoneHint] = useState(false);

  // If a premium bed is selected that is not in base chips, include it dynamically
  const isPremiumSelected =
    selectedBedId === 'ocean_drift' ||
    selectedBedId === 'night_forest' ||
    selectedBedId === 'delta_2hz';

  const chips: ChipOption[] = [...BASE_CHIPS];
  if (isPremiumSelected && selectedBedId) {
    chips.push({
      id: selectedBedId,
      label: PREMIUM_LABELS[selectedBedId] ?? 'Premium',
    });
  }

  const handleSelect = (id: AmbientBedId | null) => {
    hapticCardSelect();
    onSelectBed(id);

    // If 6Hz Theta selected for the first time, show 3s headphone hint
    if (id === 'theta_6hz' && !preferences.thetaHintShown) {
      setShowHeadphoneHint(true);
      updatePreferences({ thetaHintShown: true });
    }
  };

  useEffect(() => {
    if (showHeadphoneHint) {
      const timer = setTimeout(() => {
        setShowHeadphoneHint(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showHeadphoneHint]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Soundscape</Text>
      </View>

      <View style={styles.chipsRow}>
        {chips.map((chip) => {
          const isSelected = selectedBedId === chip.id;
          return (
            <Pressable
              key={chip.id ?? 'off'}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handleSelect(chip.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Soundscape: ${chip.label}`}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          style={styles.moreChip}
          onPress={() => openSheet('ambient_picker')}
          accessibilityRole="button"
          accessibilityLabel="Browse more ambient beds"
        >
          <Text style={styles.moreChipText}>+</Text>
        </Pressable>
      </View>

      {showHeadphoneHint && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Best with headphones</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
  },
  headerRow: {
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  chipText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
  },
  chipTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
  moreChip: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreChipText: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '500',
  },
  hintContainer: {
    marginTop: spacing.xs,
  },
  hintText: {
    ...typography.caption,
    color: colors.accentSoft,
    fontSize: 12,
  },
});
