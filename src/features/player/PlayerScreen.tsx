/**
 * PlayerScreen Component
 * Master Plan Part 1 §2.5, §2.6, Part 5 §6.7-§6.9
 * Complete full-screen guided rest player supporting:
 * - PREROLL (SighPacer)
 * - ACTIVE (OrbitalRing, CueLabel, RemainingTime, PreStateStrip, TransportControls, MixerSliders)
 * - ENDING (Rising harmonic chime + ambient fade)
 * - CHECKIN (PostCheckIn 5 orbs)
 * - SUMMARY (SessionSummary + Calm Delta + animated streak)
 * - DONE_SILENT (Sleep mode silent completion)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { getVoiceTrackMetadata, PROTOCOLS_METADATA } from '../../audio/assetRegistry.generated';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useSessionStore } from '../../stores/useSessionStore';
import { useSheetStore } from '../../stores/useSheetStore';
import { CueLabel } from './CueLabel';
import { MixerSliders } from './MixerSliders';
import { OrbitalRing } from './OrbitalRing';
import { PostCheckIn } from './PostCheckIn';
import { PreStateStrip } from './PreStateStrip';
import { RemainingTime } from './RemainingTime';
import { SessionSummary } from './SessionSummary';
import { SighPacer } from './SighPacer';
import { TransportControls } from './TransportControls';
import { useSessionController } from './SessionProvider';

const BED_DISPLAY_NAMES: Record<string, string> = {
  off: 'Off',
  rain: 'Rain',
  brown_noise: 'Brown',
  theta_6hz: '6Hz θ',
  ocean_drift: 'Ocean',
  night_forest: 'Forest',
  delta_2hz: '2Hz δ',
};

export function PlayerScreen() {
  const router = useRouter();
  const controller = useSessionController();
  const { voiceRepo, preferences, isPro, streak } = useDatabase();
  const openSheet = useSheetStore((state) => state.openSheet);

  const {
    stage,
    protocolId,
    mode,
    voiceId,
    ambientBedId,
    isPlaying,
    positionMs,
    plannedMs,
    preState,
    postState,
  } = useSessionStore();

  const [timerVisible, setTimerVisible] = useState(mode !== 'sleep');
  const [showSummary, setShowSummary] = useState(false);

  // Screen auto-dimming in Sleep mode
  const dimOpacity = useMemo(() => new Animated.Value(1), []);
  const dimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetDimTimer = useCallback(() => {
    // Restore brightness over 200ms
    Animated.timing(dimOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (dimTimeoutRef.current) clearTimeout(dimTimeoutRef.current);

    if (mode === 'sleep' && stage === 'ACTIVE') {
      dimTimeoutRef.current = setTimeout(() => {
        // Dim to dimMultiplier over 2000ms after 20s of inactivity
        Animated.timing(dimOpacity, {
          toValue: colors.dimMultiplier,
          duration: 2000,
          useNativeDriver: true,
        }).start();
      }, 20_000);
    }
  }, [dimOpacity, mode, stage]);

  // KeepAwake handling: Focus mode stays awake, Sleep mode allows screen sleep
  useEffect(() => {
    if (mode === 'focus') {
      activateKeepAwakeAsync().catch(() => {});
    } else {
      deactivateKeepAwake().catch(() => {});
    }

    return () => {
      deactivateKeepAwake().catch(() => {});
    };
  }, [mode]);

  // Start sleep dim timer
  useEffect(() => {
    resetDimTimer();
    return () => {
      if (dimTimeoutRef.current) clearTimeout(dimTimeoutRef.current);
    };
  }, [resetDimTimer]);

  // Close confirmation
  const handleClose = useCallback(() => {
    Alert.alert('End this session?', 'Leaving now will pause your restorative rest.', [
      { text: 'Keep resting', style: 'cancel' },
      {
        text: 'End session',
        style: 'destructive',
        onPress: () => {
          controller.endSessionEarly();
          router.back();
        },
      },
    ]);
  }, [controller, router]);

  // Android hardware back button handler
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage === 'DONE' || stage === 'DONE_SILENT') {
        router.replace('/');
        return true;
      }
      handleClose();
      return true;
    });

    return () => subscription.remove();
  }, [handleClose, router, stage]);

  // Active cues metadata
  const voiceMeta = useMemo(() => {
    return getVoiceTrackMetadata(protocolId, voiceId, mode);
  }, [mode, protocolId, voiceId]);

  const activeCue = useMemo(() => {
    if (!voiceMeta?.cues || voiceMeta.cues.length === 0) return null;
    return voiceMeta.cues.find((c) => positionMs >= c.startMs && positionMs < c.endMs) ?? null;
  }, [positionMs, voiceMeta]);

  // Bed cycling
  const handleCycleBed = () => {
    const accessibleBeds = isPro
      ? ['off', 'rain', 'brown_noise', 'theta_6hz', 'ocean_drift', 'night_forest', 'delta_2hz']
      : ['off', 'rain', 'brown_noise', 'theta_6hz'];

    const currentIdx = accessibleBeds.indexOf(ambientBedId ?? 'off');
    const nextBed = accessibleBeds[(currentIdx + 1) % accessibleBeds.length] ?? 'off';
    controller.switchBed(nextBed);
  };

  const voiceName = voiceRepo.getById(voiceId)?.name ?? 'Maya';
  const bedDisplayName = BED_DISPLAY_NAMES[ambientBedId ?? 'off'] ?? 'Off';
  const protocolTitle = PROTOCOLS_METADATA[protocolId]?.title ?? 'Guided Rest';

  // Render PREROLL Stage (Sigh Pacer)
  if (stage === 'PREROLL') {
    return (
      <SighPacer
        mode={mode}
        onDone={() => controller.startActivePlaybackFromPacer()}
        onSkip={() => controller.skipPacer()}
        onClose={handleClose}
      />
    );
  }

  // Render CHECKIN Stage
  if (stage === 'CHECKIN') {
    return (
      <PostCheckIn
        onSelectState={(selectedState) => {
          controller.recordPostCheckin(selectedState);
          setShowSummary(true);
        }}
        onSkip={() => {
          controller.skipPostCheckin();
          setShowSummary(true);
        }}
      />
    );
  }

  // Render SUMMARY Stage
  if (stage === 'DONE' || showSummary) {
    return (
      <SessionSummary
        preState={preState as any}
        postState={postState as any}
        streakCount={streak.currentStreak}
        onDone={() => {
          controller.dismissSummary();
          router.replace('/');
        }}
      />
    );
  }

  // Render DONE_SILENT Stage (Sleep mode completed silently)
  if (stage === 'DONE_SILENT') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.sleepDoneContainer}>
          <Text style={styles.sleepDoneTitle}>Deep rest completed</Text>
          <Text style={styles.sleepDoneSubtitle}>Your streak has been credited. Rest well.</Text>

          <Pressable
            style={styles.sleepDoneButton}
            onPress={() => {
              controller.dismissSummary();
              router.replace('/');
            }}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.sleepDoneButtonText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Render ACTIVE or ENDING Stage
  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable style={styles.touchConsumer} onPress={resetDimTimer}>
        <Animated.View style={[styles.playerContent, { opacity: dimOpacity }]}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <Pressable
              style={styles.closeBtn}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="End session"
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>

            <View style={styles.modeChip}>
              <Text style={styles.modeChipText}>{mode === 'sleep' ? '☾ Sleep' : '☼ Focus'}</Text>
            </View>
          </View>

          {/* Center Orbital Ring & Breathing Orb */}
          <View style={styles.centerSection}>
            <Pressable onPress={() => setTimerVisible((v) => !v)}>
              <OrbitalRing
                positionMs={positionMs}
                durationMs={plannedMs}
                currentCue={activeCue}
                isPlaying={isPlaying}
              />
            </Pressable>

            {/* Cue Label */}
            <View style={styles.cueArea}>
              <CueLabel label={activeCue?.label ?? protocolTitle} />
              <RemainingTime
                positionMs={positionMs}
                durationMs={plannedMs}
                visible={timerVisible}
                onToggleVisible={() => setTimerVisible((v) => !v)}
              />
            </View>

            {/* PreStateStrip (non-blocking in first 20s) */}
            <PreStateStrip
              positionMs={positionMs}
              selectedState={preState as any}
              onSelectState={(state) => controller.recordPreCheckin(state)}
            />
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomSection}>
            <TransportControls
              isPlaying={isPlaying}
              onTogglePlayPause={() => controller.togglePlayPause()}
            />

            <MixerSliders
              voiceVolume={preferences.voiceVolume}
              ambientVolume={preferences.ambientVolume}
              voiceDisplayName={voiceName}
              ambientDisplayName={bedDisplayName}
              onVoiceVolumeChange={(v) => controller.setVoiceVolume(v)}
              onAmbientVolumeChange={(v) => controller.setAmbientVolume(v)}
              onVoiceChipPress={() => openSheet('voice_picker', { voicePickerContext: 'player' })}
              onBedChipPress={handleCycleBed}
            />
          </View>
        </Animated.View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  touchConsumer: {
    flex: 1,
  },
  playerContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    height: 56,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  modeChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeChipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  cueArea: {
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 64,
  },
  bottomSection: {
    justifyContent: 'flex-end',
  },
  sleepDoneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.md,
  },
  sleepDoneTitle: {
    ...typography.displaySm,
    color: colors.text,
    textAlign: 'center',
  },
  sleepDoneSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sleepDoneButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  sleepDoneButtonText: {
    ...typography.label,
    color: colors.accent,
  },
});
