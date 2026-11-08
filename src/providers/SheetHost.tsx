/**
 * Root Sheet Host
 * Master Plan Part 1 §2.2 & Part 6 §7.2
 * Mounts Journey, Paywall, VoicePicker, and AmbientPicker sheets above all routes.
 * Strictly guarantees only one sheet is open at any time.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSheetStore } from '../stores/useSheetStore';
import { colors } from '../design/tokens';
import { JourneySheet } from '../features/journey/JourneySheet';
import { PaywallSheet } from '../features/paywall/PaywallSheet';
import { VoicePickerSheet } from '../features/sanctuary/VoicePickerSheet';
import { AmbientPickerSheet } from '../features/sanctuary/AmbientPickerSheet';
import { DevPanel } from '../features/dev/DevPanel';

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
        {activeSheet === 'dev' && <DevPanel />}
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
});
