/**
 * Ember Session Controller & Orchestrator
 * Master Plan Part 2 §3.4, Part 5 §6.7-§6.9, Part 6 §7.1-§7.2
 * Orchestrates DualTrackEngine, sessionMachine, SQLite repositories, and Ephemeral Session Store.
 */

import type { Clock } from '../../domain/clock';
import { SystemClock } from '../../domain/clock';
import {
  COMMIT_THRESHOLD,
  PARTIAL_MIN_LISTENED_MS,
  PLANNED_MS,
  type AmbientBedId,
  type PerceivedState,
  type ProtocolId,
} from '../../domain/constants';
import { dayKeyFromMs } from '../../domain/dayKey';
import {
  INITIAL_SESSION_STATE,
  reduceSession,
  type SessionEffect,
  type SessionEvent,
  type SessionState,
} from '../../domain/sessionMachine';
import {
  PROTOCOLS_METADATA,
  getAmbientBedMetadata,
  getVoiceTrackMetadata,
} from '../../audio/assetRegistry.generated';
import { resolveAudioSource } from '../../audio/assetSources';
import type { AudioDriver } from '../../audio/AudioDriver';
import { DualTrackEngine } from '../../audio/DualTrackEngine';
import { ExpoAudioDriver } from '../../audio/ExpoAudioDriver';
import type { EntitlementRepo } from '../../data/repos/EntitlementRepo';
import type { PrefsRepo } from '../../data/repos/PrefsRepo';
import type { SessionRepo } from '../../data/repos/SessionRepo';
import type { StreakRepo } from '../../data/repos/StreakRepo';
import type { RecoveryState } from '../../data/types';
import { generateUuid } from '../../data/uuid';
import { hapticCardSelect, hapticFocusSessionEnd, hapticModeToggle } from '../../design/haptics';
import { useSessionStore } from '../../stores/useSessionStore';
import { syncNotificationSchedule } from '../../services/NotificationService';

export interface Repositories {
  sessionRepo: SessionRepo;
  prefsRepo: PrefsRepo;
  streakRepo: StreakRepo;
  entitlementRepo: EntitlementRepo;
}

export interface StartSessionOptions {
  protocolId: ProtocolId;
  mode: 'focus' | 'sleep';
  voiceId: string;
  ambientBedId: string | null;
  sigh: boolean;
  preState?: RecoveryState | null;
}

export class SessionController {
  private engine: DualTrackEngine;
  private machineState: SessionState = { ...INITIAL_SESSION_STATE };
  private activeSessionId: string | null = null;
  private cleanupEngineListener: (() => void) | null = null;
  private voiceSwitchInProgress = false;

  constructor(
    private repos: Repositories,
    private driver: AudioDriver = new ExpoAudioDriver(),
    private clock: Clock = new SystemClock(),
  ) {
    this.engine = new DualTrackEngine(this.driver, this.clock);
    this.setupEngineListener();
  }

  private setupEngineListener(): void {
    if (this.cleanupEngineListener) {
      this.cleanupEngineListener();
    }

    this.cleanupEngineListener = this.engine.on((event) => {
      switch (event.type) {
        case 'position':
          this.handlePositionUpdate(event.positionMs);
          break;

        case 'ended':
          this.handlePlaybackEnded();
          break;

        case 'interrupted':
          this.send({ type: 'INTERRUPT' });
          break;

        case 'resumed':
          if (!this.machineState.isPlaying && this.machineState.stage === 'ACTIVE') {
            this.send({ type: 'PLAY' });
          }
          break;

        case 'voice_switched':
          this.voiceSwitchInProgress = false;
          if (this.activeSessionId) {
            this.repos.sessionRepo.updateVoice(this.activeSessionId, event.voiceId);
          }
          this.repos.prefsRepo.patch({ selectedVoiceId: event.voiceId });
          useSessionStore.getState().setVoice(event.voiceId);
          break;

        case 'voice_switch_failed':
          this.voiceSwitchInProgress = false;
          this.send({ type: 'VOICE_SWITCH_FAILED', error: event.error });
          break;

        case 'bed_switched':
          break;
      }
    });
  }

  async startSession(opts: StartSessionOptions): Promise<string> {
    const sessionId = generateUuid();
    this.activeSessionId = sessionId;

    const now = this.clock.now();
    const tzOffset = -new Date(now).getTimezoneOffset();
    const localDay = dayKeyFromMs(now);
    const plannedMs = PLANNED_MS[opts.protocolId] ?? 300_000;

    const isPro = this.repos.entitlementRepo.hasActivePro();
    const activePass = this.repos.entitlementRepo.getActivePass();
    const accessVia = isPro ? 'pro' : activePass ? 'free_pass' : 'free';

    // 1. Create SQLite session log
    this.repos.sessionRepo.create({
      id: sessionId,
      protocolId: opts.protocolId,
      voiceId: opts.voiceId,
      mode: opts.mode,
      ambientBedId: opts.ambientBedId === 'off' ? null : (opts.ambientBedId as any),
      sighPacer: opts.sigh,
      accessVia,
      startedAtMs: now,
      localDay,
      tzOffsetMin: tzOffset,
      plannedMs,
      preState: opts.preState ?? null,
    });

    // 2. Resolve audio sources
    const voiceMeta = getVoiceTrackMetadata(opts.protocolId, opts.voiceId, opts.mode);
    const voiceSource = resolveAudioSource(voiceMeta?.assetKey);
    if (!voiceSource) {
      throw new Error(`Voice asset source not found for ${opts.protocolId} / ${opts.voiceId}`);
    }

    const bedMeta =
      opts.ambientBedId && opts.ambientBedId !== 'off'
        ? getAmbientBedMetadata(opts.ambientBedId as any)
        : null;
    const bedSource = bedMeta ? resolveAudioSource(bedMeta.assetKey) : null;

    const prefs = this.repos.prefsRepo.get();

    // 3. Prepare DualTrackEngine
    await this.engine.prepare({
      voiceSource,
      voiceId: opts.voiceId,
      bedSource,
      mode: opts.mode,
      plannedMs,
      voiceVolume: prefs.voiceVolume,
      ambientVolume: prefs.ambientVolume,
      title: PROTOCOLS_METADATA[opts.protocolId]?.title ?? 'Ember Rest',
      subtitle: opts.mode === 'sleep' ? 'Sleep mode' : 'Focus mode',
    });

    // 4. Dispatch state machine BEGIN
    const beginEvent: SessionEvent = {
      type: 'BEGIN',
      protocolId: opts.protocolId,
      mode: opts.mode,
      voiceId: opts.voiceId,
      ambientBedId: opts.ambientBedId ?? 'off',
      sigh: opts.sigh,
      startedAtMs: now,
      accessVia,
      ...(opts.preState ? { preState: opts.preState as PerceivedState } : {}),
    };
    this.send(beginEvent);

    return sessionId;
  }

  startActivePlaybackFromPacer(): void {
    this.send({ type: 'PACER_DONE' });
  }

  skipPacer(): void {
    this.send({ type: 'PACER_SKIP' });
  }

  play(): void {
    hapticModeToggle();
    this.send({ type: 'PLAY' });
  }

  pause(): void {
    hapticModeToggle();
    this.send({ type: 'PAUSE' });
  }

  togglePlayPause(): void {
    if (this.machineState.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  recordPreCheckin(state: RecoveryState): void {
    hapticCardSelect();
    this.send({ type: 'PRE_CHECKIN_SELECT', state: state as PerceivedState });
  }

  recordPostCheckin(state: RecoveryState): void {
    hapticCardSelect();
    this.send({ type: 'CHECKIN_SELECT', state: state as PerceivedState });
  }

  skipPostCheckin(): void {
    this.send({ type: 'CHECKIN_SKIP' });
  }

  /**
   * In-Flight Narrator Switch Architecture
   * Master Plan Part 5 §6.8
   * Users can change narrators during active playback without restarting the session.
   */
  async switchVoice(newVoiceId: string): Promise<boolean> {
    if (this.voiceSwitchInProgress || newVoiceId === this.machineState.voiceId) {
      return false;
    }

    const voiceMeta = getVoiceTrackMetadata(
      this.machineState.protocolId,
      newVoiceId,
      this.machineState.mode,
    );
    const newSource = resolveAudioSource(voiceMeta?.assetKey);
    if (!newSource) {
      return false;
    }

    this.voiceSwitchInProgress = true;
    this.send({ type: 'SWITCH_VOICE', voiceId: newVoiceId });

    try {
      await this.engine.switchVoice(newSource, newVoiceId);
      return true;
    } catch {
      this.voiceSwitchInProgress = false;
      this.send({ type: 'VOICE_SWITCH_FAILED', error: 'Switch failed' });
      return false;
    }
  }

  async switchBed(newBedId: string | null): Promise<void> {
    const bedId = newBedId === 'off' ? null : newBedId;
    const bedMeta = bedId ? getAmbientBedMetadata(bedId as any) : null;
    const bedSource = bedMeta ? resolveAudioSource(bedMeta.assetKey) : null;

    await this.engine.switchBed(bedSource);

    const targetBedId = bedId === 'off' ? null : (bedId as AmbientBedId);
    this.repos.prefsRepo.patch({ ambientBedId: targetBedId });
    useSessionStore.getState().setAmbientBed(bedId);
  }

  setVoiceVolume(v: number): void {
    this.engine.setVoiceVolume(v);
    this.repos.prefsRepo.patch({ voiceVolume: v });
  }

  setAmbientVolume(v: number): void {
    this.engine.setAmbientVolume(v);
    this.repos.prefsRepo.patch({ ambientVolume: v });
  }

  endSessionEarly(): void {
    this.send({ type: 'END_CONFIRMED' });
  }

  dismissSummary(): void {
    this.send({ type: 'DISMISS' });
    this.cleanupSession();
  }

  private handlePositionUpdate(positionMs: number): void {
    const now = this.clock.now();
    this.send({
      type: 'POSITION_UPDATE',
      positionMs,
      timestampMs: now,
    });
  }

  private handlePlaybackEnded(): void {
    this.send({ type: 'VOICE_ENDED' });
  }

  private send(event: SessionEvent): void {
    const result = reduceSession(this.machineState, event);
    this.machineState = result.state;

    // Synchronize ephemeral Zustand store
    useSessionStore.getState().setSessionState({
      stage: result.state.stage,
      protocolId: result.state.protocolId,
      mode: result.state.mode,
      voiceId: result.state.voiceId,
      ambientBedId: result.state.ambientBedId,
      sigh: result.state.sigh,
      isPlaying: result.state.isPlaying,
      startedAtMs: result.state.startedAtMs,
      plannedMs: result.state.plannedMs,
      positionMs: result.state.positionMs,
      listenedMs: result.state.listenedMs,
      committed: result.state.committed,
      commitReason: result.state.commitReason,
      passConsumed: result.state.passConsumed,
      accessVia: result.state.accessVia,
      preState: result.state.preState,
      postState: result.state.postState,
    });

    // Execute state machine side-effects
    for (const effect of result.effects) {
      this.executeEffect(effect);
    }
  }

  private executeEffect(effect: SessionEffect): void {
    const now = this.clock.now();

    switch (effect.type) {
      case 'START_AUDIO':
        this.engine.start();
        break;

      case 'PAUSE_AUDIO':
        this.engine.pause();
        break;

      case 'RESUME_AUDIO':
        this.engine.resume();
        break;

      case 'STOP_AUDIO':
        this.engine.pause();
        break;

      case 'PERSIST_HEARTBEAT':
        if (this.activeSessionId) {
          this.repos.sessionRepo.heartbeat(this.activeSessionId, effect.positionMs, now);
        }
        break;

      case 'COMMIT_SESSION':
        if (this.activeSessionId) {
          this.repos.sessionRepo.commitSession(this.activeSessionId, {
            nowMs: now,
            commitReason: effect.reason,
            endedAtMs: now,
            maxPositionMs: this.machineState.positionMs,
            listenedMs: this.machineState.listenedMs,
          });
          syncNotificationSchedule(this.repos, now).catch(() => {});
        }
        break;

      case 'CONSUME_PASS':
        if (this.activeSessionId) {
          this.repos.entitlementRepo.consumePassForSession(this.activeSessionId, now);
        }
        break;

      case 'PLAY_CHIME': {
        const chimeSource = resolveAudioSource('chime_rise');
        if (chimeSource) {
          this.engine.playEndingChime(chimeSource).then(() => {
            // After chime duration (~3.2s), advance state machine to CHECKIN
            setTimeout(() => {
              this.send({ type: 'CHIME_DONE' });
            }, 3200);
          });
        } else {
          this.send({ type: 'CHIME_DONE' });
        }
        break;
      }

      case 'HAPTIC_END':
        hapticFocusSessionEnd();
        break;

      case 'RECORD_PRE_CHECKIN':
        if (this.activeSessionId) {
          this.repos.sessionRepo.setPreState(
            this.activeSessionId,
            effect.preState as RecoveryState,
          );
        }
        break;

      case 'RECORD_CHECKIN':
        if (this.activeSessionId) {
          this.repos.sessionRepo.setPostState(
            this.activeSessionId,
            effect.postState as RecoveryState,
          );
        }
        break;

      case 'FINALIZE_SESSION':
        if (
          this.activeSessionId &&
          (effect.status === 'partial' || effect.status === 'abandoned')
        ) {
          this.repos.sessionRepo.finalize(
            this.activeSessionId,
            effect.status,
            effect.listenedMs,
            now,
          );
        }
        break;

      case 'NAVIGATE':
        // Navigation destination handled in UI components
        break;

      case 'FADE_AMBIENT':
      case 'SWITCH_VOICE':
        // Handled directly via engine methods
        break;
    }
  }

  cleanupSession(): void {
    this.engine.dispose();
    this.activeSessionId = null;
    this.voiceSwitchInProgress = false;
    this.machineState = { ...INITIAL_SESSION_STATE };
    useSessionStore.getState().resetSession();
  }

  getEngine(): DualTrackEngine {
    return this.engine;
  }

  getMachineState(): SessionState {
    return this.machineState;
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Cold start reconciliation: Checks for uncommitted sessions that were interrupted by app death.
   * Auto-commits Sleep mode sessions reaching >= 85%, or finalizes partial/abandoned sessions.
   */
  static reconcileColdStart(sessionRepo: SessionRepo, clock: Clock = new SystemClock()): number {
    const inProgress = sessionRepo.findInProgress();
    let reconciledCount = 0;
    const now = clock.now();

    for (const session of inProgress) {
      if (session.committedAtMs != null) continue;

      if (
        session.mode === 'sleep' &&
        session.maxPositionMs >= session.plannedMs * COMMIT_THRESHOLD.sleep
      ) {
        sessionRepo.commitSession(session.id, {
          nowMs: now,
          commitReason: 'sleep_reconcile',
          endedAtMs: now,
          maxPositionMs: session.maxPositionMs,
          listenedMs: session.listenedMs,
        });
        reconciledCount++;
      } else if (session.listenedMs >= PARTIAL_MIN_LISTENED_MS) {
        sessionRepo.finalize(session.id, 'partial', session.listenedMs, now);
        reconciledCount++;
      } else {
        sessionRepo.finalize(session.id, 'abandoned', session.listenedMs, now);
        reconciledCount++;
      }
    }

    return reconciledCount;
  }
}
