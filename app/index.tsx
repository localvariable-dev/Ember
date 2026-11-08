/**
 * Sanctuary Screen (Route: "/")
 * Master Plan Part 1 §2.3 & Part 6 §7.2
 * Clean, distraction-free home surface for initiating deep rest.
 */

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../src/design/tokens';
import type { ProtocolId } from '../src/domain/constants';
import { getTimeContext } from '../src/domain/timeOfDay';
import type { Mode, RecoveryState } from '../src/data/types';
import { useDatabase } from '../src/providers/DatabaseProvider';
import { useSessionStore } from '../src/stores/useSessionStore';
import { useSheetStore } from '../src/stores/useSheetStore';

import { TopBar } from '../src/features/sanctuary/TopBar';
import { GreetingBlock } from '../src/features/sanctuary/GreetingBlock';
import { SessionCardList } from '../src/features/sanctuary/SessionCardList';
import { ModeToggle } from '../src/features/sanctuary/ModeToggle';
import { AmbientChips } from '../src/features/sanctuary/AmbientChips';
import { VoiceAndPacerRow } from '../src/features/sanctuary/VoiceAndPacerRow';
import { BeginRestButton } from '../src/features/sanctuary/BeginRestButton';
import { MorningCheckInCard } from '../src/features/player/MorningCheckInCard';
import { useSessionController } from '../src/features/player/SessionProvider';

export default function SanctuaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const controller = useSessionController();
  const [now] = useState(() => Date.now());

  const { sessionRepo, preferences, updatePreferences, isPro, activePass } = useDatabase();

  const openSheet = useSheetStore((state) => state.openSheet);
  const { resetSession, setProtocol, setMode, setVoice, setAmbientBed, setSigh } =
    useSessionStore();

  const [selectedProtocolId, setSelectedProtocolId] = useState<ProtocolId>(
    () => getTimeContext(new Date(now)).protocolId,
  );
  const [currentMode, setCurrentMode] = useState<Mode>(preferences.lastMode ?? 'focus');
  const [morningDismissed, setMorningDismissed] = useState(false);

  // Check for candidate Sleep session awaiting morning check-in
  const morningCandidate = useMemo(() => {
    if (morningDismissed) return null;
    return sessionRepo.getMorningCheckinCandidate();
  }, [sessionRepo, morningDismissed]);

  const handleRateMorning = (sessionId: string, state: RecoveryState) => {
    sessionRepo.setPostState(sessionId, state);
    setMorningDismissed(true);
  };

  const handleDismissMorning = () => {
    setMorningDismissed(true);
  };

  const hasFreePass = Boolean(activePass && activePass.status === 'available');
  const freePassRemainingDays = activePass?.expiresAtMs
    ? Math.max(0, Math.ceil((activePass.expiresAtMs - now) / 86_400_000))
    : undefined;

  const isCardLocked = (protocolId: ProtocolId) => {
    if (protocolId === 'deep_rest_30') {
      return !isPro && !hasFreePass;
    }
    return false;
  };

  const isLocked = isCardLocked(selectedProtocolId);

  const handleSelectCard = (id: ProtocolId) => {
    setSelectedProtocolId(id);
  };

  const handleModeChange = (newMode: Mode) => {
    setCurrentMode(newMode);
    updatePreferences({ lastMode: newMode });
  };

  const handleBeginRestUnlocked = async () => {
    resetSession();
    const targetMode = selectedProtocolId === 'rapid_reset_5' ? 'focus' : currentMode;
    const targetSigh =
      selectedProtocolId === 'rapid_reset_5' ? false : preferences.sighPacerDefault;

    setProtocol(selectedProtocolId);
    setMode(targetMode);
    setVoice(preferences.selectedVoiceId);
    setAmbientBed(preferences.ambientBedId);
    setSigh(targetSigh);

    try {
      await controller.startSession({
        protocolId: selectedProtocolId,
        mode: targetMode,
        voiceId: preferences.selectedVoiceId,
        ambientBedId: preferences.ambientBedId,
        sigh: targetSigh,
      });
    } catch (err) {
      console.warn('Failed to start session from Sanctuary:', err);
    }

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

        {/* Morning-After Check-in Card (if Sleep session awaiting rating within 10h) */}
        {morningCandidate && (
          <MorningCheckInCard
            candidateSession={morningCandidate}
            onRate={handleRateMorning}
            onDismiss={handleDismissMorning}
          />
        )}

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
          isLocked={isLocked}
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
    paddingTop: spacing.sm,
  },
  stickyBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
