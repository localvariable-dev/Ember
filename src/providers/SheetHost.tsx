/**
 * Root Sheet Host
 * Master Plan Part 1 §2.2 & Part 6 §7.2
 * Mounts Journey, Paywall, VoicePicker, and AmbientPicker sheets above all routes.
 * Strictly guarantees only one sheet is open at any time.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSheetStore } from '../stores/useSheetStore';
import { colors, radii, spacing, typography } from '../design/tokens';
import { JourneySheet } from '../features/journey/JourneySheet';
import { PaywallSheet } from '../features/paywall/PaywallSheet';
import { VoicePickerSheet } from '../features/sanctuary/VoicePickerSheet';
import { AmbientPickerSheet } from '../features/sanctuary/AmbientPickerSheet';

function DevSheet() {
  const closeSheet = useSheetStore((state) => state.closeSheet);
  return (
    <View style={styles.devSheetContainer}>
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
}

export function SheetHost() {
  const { activeSheet, closeSheet } = useSheetStore();

  if (activeSheet === 'none') {
    return null;
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={true}
      onRequestClose={closeSheet}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeSheet}
          accessibilityLabel="Dismiss sheet backdrop"
        />
        {activeSheet === 'journey' && <JourneySheet />}
        {activeSheet === 'paywall' && <PaywallSheet />}
        {activeSheet === 'voice_picker' && <VoicePickerSheet />}
        {activeSheet === 'ambient_picker' && <AmbientPickerSheet />}
        {activeSheet === 'dev' && <DevSheet />}
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
  devSheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    minHeight: 280,
    gap: spacing.md,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  sheetTitle: {
    ...typography.title,
    color: colors.text,
  },
  sheetSubtitle: {
    ...typography.body,
    color: colors.textMuted,
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
