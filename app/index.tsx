/**
 * Sanctuary Screen (Route: "/")
 * Master Plan Part 1 §2.3
 * 2-tap entry into rest. Complete responsive layout with sticky CTA and SQLite persistence.
 */

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../src/design/tokens';
import { hapticCardSelect, hapticLockedCardTap } from '../src/design/haptics';
import { getTimeContext } from '../src/domain/timeOfDay';
import type { ProtocolId } from '../src/domain/constants';
import type { Mode } from '../src/data/types';
import { useDatabase } from '../src/providers/DatabaseProvider';
import { useSheetStore } from '../src/stores/useSheetStore';
import { useSessionStore } from '../src/stores/useSessionStore';
import { TopBar } from '../src/features/sanctuary/TopBar';
import { GreetingBlock } from '../src/features/sanctuary/GreetingBlock';
import { SessionCardList } from '../src/features/sanctuary/SessionCardList';
import { ModeToggle } from '../src/features/sanctuary/ModeToggle';
import { AmbientChips } from '../src/features/sanctuary/AmbientChips';
import { VoiceAndPacerRow } from '../src/features/sanctuary/VoiceAndPacerRow';
import { BeginRestButton } from '../src/features/sanctuary/BeginRestButton';

export default function SanctuaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [now] = useState(() => Date.now());
  const timeContext = useMemo(() => getTimeContext(new Date(now)), [now]);

  const { preferences, updatePreferences, isPro, activePass } = useDatabase();
  const openSheet = useSheetStore((state) => state.openSheet);
  const { resetSession, setProtocol, setMode, setVoice, setAmbientBed, setSigh } =
    useSessionStore();

  // Selected session protocol
  const [selectedProtocolId, setSelectedProtocolId] = useState<ProtocolId>(timeContext.protocolId);

  // Selected mode (Focus / Sleep)
  const [currentMode, setCurrentMode] = useState<Mode>(
    preferences.lastMode ?? (timeContext.greeting === 'Good evening' ? 'sleep' : 'focus'),
  );

  const hasFreePass = Boolean(activePass && activePass.status === 'available');
  const freePassRemainingDays = activePass?.expiresAtMs
    ? Math.max(0, Math.ceil((activePass.expiresAtMs - now) / 86_400_000))
    : undefined;

  const isCurrentCardLocked = selectedProtocolId === 'deep_rest_30' && !isPro && !hasFreePass;

  const handleSelectCard = (protocolId: ProtocolId) => {
    setSelectedProtocolId(protocolId);

    const isLocked = protocolId === 'deep_rest_30' && !isPro && !hasFreePass;
    if (isLocked) {
      hapticLockedCardTap();
      openSheet('paywall', { paywallVariant: 'card_tap' });
    } else {
      hapticCardSelect();
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setCurrentMode(newMode);
    updatePreferences({ lastMode: newMode });
  };

  const handleBeginRestUnlocked = () => {
    resetSession();
    setProtocol(selectedProtocolId);
    setMode(selectedProtocolId === 'rapid_reset_5' ? 'focus' : currentMode);
    setVoice(preferences.selectedVoiceId);
    setAmbientBed(preferences.ambientBedId);
    setSigh(selectedProtocolId === 'rapid_reset_5' ? true : preferences.sighPacerDefault);

    router.push('/player');
  };

  const handleBeginRestLocked = () => {
    openSheet('paywall', { paywallVariant: 'card_tap' });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 130 + Math.max(insets.bottom, spacing.base) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* TopBar with Streak Pill */}
        <TopBar />

        {/* Greeting & Context Line */}
        <GreetingBlock selectedProtocolId={selectedProtocolId} />

        {/* 3-Tier Canonical Session Card List */}
        <SessionCardList
          selectedId={selectedProtocolId}
          isPro={isPro}
          hasFreePass={hasFreePass}
          freePassRemainingDays={freePassRemainingDays}
          onSelectCard={handleSelectCard}
        />

        {/* Mode Toggle (Focus / Sleep for 10m & 30m sessions) */}
        {selectedProtocolId !== 'rapid_reset_5' && (
          <ModeToggle mode={currentMode} onModeChange={handleModeChange} />
        )}

        {/* Soundscape Ambient Chips */}
        <AmbientChips
          selectedBedId={preferences.ambientBedId}
          onSelectBed={(bedId) => updatePreferences({ ambientBedId: bedId })}
        />

        {/* Voice and Sigh Pacer Row */}
        <VoiceAndPacerRow selectedProtocolId={selectedProtocolId} />
      </ScrollView>

      {/* Sticky Bottom Container for 72 dp CTA */}
      <View
        style={[
          styles.stickyBottomContainer,
          { paddingBottom: Math.max(insets.bottom, spacing.base) },
        ]}
      >
        <BeginRestButton
          isLocked={isCurrentCardLocked}
          onPressUnlocked={handleBeginRestUnlocked}
          onPressLocked={handleBeginRestLocked}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.xs,
  },
  stickyBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.base,
    shadowColor: colors.bg,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 8,
  },
});
