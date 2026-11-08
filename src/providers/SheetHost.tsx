/**
 * Root Sheet Host
 * Master Plan Part 1 §2.2 & Part 6 §7.2
 * Mounts Journey, Paywall, and VoicePicker modal bottom sheets above all routes.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSheetStore } from '../stores/useSheetStore';
import { colors, radii, spacing, typography } from '../design/tokens';

export function SheetHost() {
  const { activeSheet, closeSheet, payload } = useSheetStore();

  if (activeSheet === 'none') {
    return null;
  }

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'journey':
        return (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Your Rest Journey</Text>
            <Text style={styles.sheetSubtitle}>
              Consistency over perfection. Grace Days protect your habit.
            </Text>
            <Pressable style={styles.closeButton} onPress={closeSheet}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        );

      case 'paywall':
        return (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Deep Rest &amp; Yoga Nidra</Text>
            <Text style={styles.sheetSubtitle}>
              Unlock 30-minute restorative sessions, advanced soundscapes, and full Calm Delta
              insights.
            </Text>
            {payload.paywallVariant ? (
              <Text style={styles.variantTag}>Mode: {payload.paywallVariant}</Text>
            ) : null}
            <Pressable style={styles.closeButton} onPress={closeSheet}>
              <Text style={styles.closeButtonText}>Dismiss</Text>
            </Pressable>
          </View>
        );

      case 'voice_picker':
        return (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Narrator Voice</Text>
            <Text style={styles.sheetSubtitle}>Switch narrator seamlessly during playback.</Text>
            <Pressable style={styles.closeButton} onPress={closeSheet}>
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </View>
        );

      case 'dev':
        return (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Developer Panel</Text>
            <Text style={styles.sheetSubtitle}>
              Time-travel and entitlement state controls for testing.
            </Text>
            <Pressable style={styles.closeButton} onPress={closeSheet}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal transparent animationType="fade" visible={true} onRequestClose={closeSheet}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        <View style={styles.sheetContainer}>{renderSheetContent()}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    minHeight: 280,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  sheetContent: {
    gap: spacing.md,
  },
  sheetTitle: {
    ...typography.title,
    color: colors.text,
  },
  sheetSubtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  variantTag: {
    ...typography.caption,
    color: colors.accent,
  },
  closeButton: {
    marginTop: spacing.base,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeButtonText: {
    ...typography.label,
    color: colors.text,
  },
});
