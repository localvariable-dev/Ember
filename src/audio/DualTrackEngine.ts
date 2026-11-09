/**
 * Dual-Track Audio Playback Engine
 * Master Plan Part 5 §6.7, §6.8, §6.9
 * Track A (Voice) = Master session clock
 * Track B (Ambient) = Slave loop
 * Implements in-flight narrator switching with 1,500ms equal-power crossfade and safe fallback.
 */

import type { Clock } from '../domain/clock';
import { SystemClock } from '../domain/clock';
import type { AudioDriver, AudioSource, PlayerHandle } from './AudioDriver';

export interface PrepareOpts {
  voiceSource: AudioSource;
  voiceId: string;
  bedSource: AudioSource | null;
  mode: 'focus' | 'sleep';
  plannedMs: number;
  voiceVolume: number;
  ambientVolume: number;
  title?: string;
  subtitle?: string;
}

export type EngineEvent =
  | { type: 'position'; positionMs: number; durationMs: number }
  | { type: 'ended' }
  | { type: 'interrupted'; transient: boolean }
  | { type: 'resumed' }
  | { type: 'voice_switched'; voiceId: string }
  | { type: 'voice_switch_failed'; voiceId: string; error: string }
  | { type: 'bed_switched'; bedSource: AudioSource | null };

export class DualTrackEngine {
  private voicePlayer: PlayerHandle | null = null;
  private ambientPlayer: PlayerHandle | null = null;
  private chimePlayer: PlayerHandle | null = null;
  private incomingVoicePlayer: PlayerHandle | null = null;

  private voiceUnsubscribe: (() => void) | null = null;
  private crossfadeInterval: ReturnType<typeof setInterval> | null = null;
  private ambientCrossfadeInterval: ReturnType<typeof setInterval> | null = null;

  private userVoiceVolume = 0.9;
  private userAmbientVolume = 0.5;
  private currentPositionMs = 0;
  private durationMs = 0;
  private plannedMs = 300_000;
  private mode: 'focus' | 'sleep' = 'focus';
  private voiceId = 'maya_warm';
  private isPlaying = false;
  private isDisposed = false;
  private didEmitEnded = false;
  private lockTitle = 'Ember Rest';
  private lockSubtitle = 'Focus mode';

  private listeners = new Set<(e: EngineEvent) => void>();

  constructor(
    private driver: AudioDriver,
    private clock: Clock = new SystemClock(),
  ) {}

  async prepare(opts: PrepareOpts): Promise<void> {
    this.cleanupPlayers();
    this.isDisposed = false;
    this.didEmitEnded = false;

    await this.driver.configureSession();

    this.voiceId = opts.voiceId;
    this.mode = opts.mode;
    this.plannedMs = opts.plannedMs;
    this.durationMs = opts.plannedMs;
    this.userVoiceVolume = opts.voiceVolume;
    this.userAmbientVolume = opts.ambientVolume;
    this.lockTitle = opts.title ?? 'Ember Rest';
    this.lockSubtitle = opts.subtitle ?? (opts.mode === 'sleep' ? 'Sleep mode' : 'Focus mode');

    // Create voice player (Track A)
    this.voicePlayer = this.driver.createPlayer(opts.voiceSource);
    this.applyVoiceVolume();
    this.attachVoiceStatusListener(this.voicePlayer);

    // Create ambient player (Track B) if specified
    if (opts.bedSource) {
      this.ambientPlayer = this.driver.createPlayer(opts.bedSource);
      this.ambientPlayer.setLoop(true);
      this.applyAmbientVolume();
    }
  }

  private attachVoiceStatusListener(player: PlayerHandle): void {
    if (this.voiceUnsubscribe) {
      this.voiceUnsubscribe();
      this.voiceUnsubscribe = null;
    }

    this.voiceUnsubscribe = player.onStatus((status) => {
      this.currentPositionMs = status.positionMs;
      if (status.durationMs > 0) {
        this.durationMs = status.durationMs;
      }

      this.emit({
        type: 'position',
        positionMs: this.currentPositionMs,
        durationMs: this.durationMs || this.plannedMs,
      });

      // Handle Sleep Mode final 90-second ambient attenuation (pause-safe cubic ramp)
      if (this.mode === 'sleep' && this.ambientPlayer) {
        const remainingMs = this.plannedMs - this.currentPositionMs;
        if (remainingMs <= 90_000 && remainingMs > 0) {
          const fadeFactor = Math.pow(remainingMs / 90_000, 3);
          const effectiveVol = Math.pow(this.userAmbientVolume, 2) * fadeFactor;
          this.ambientPlayer.setVolume(effectiveVol);
        } else if (remainingMs <= 0) {
          this.ambientPlayer.setVolume(0);
        } else {
          this.applyAmbientVolume();
        }
      }

      if (status.didJustFinish) {
        this.isPlaying = false;
        if (!this.didEmitEnded) {
          this.didEmitEnded = true;
          this.emit({ type: 'ended' });
        }
      }
    });
  }

  start(): void {
    if (this.isDisposed || !this.voicePlayer) return;

    this.isPlaying = true;
    this.voicePlayer.setLockScreen(true, {
      title: this.lockTitle,
      subtitle: this.lockSubtitle,
    });

    this.voicePlayer.play();
    if (this.ambientPlayer) {
      this.ambientPlayer.play();
    }

    this.emit({ type: 'resumed' });
  }

  pause(): void {
    if (this.isDisposed || !this.voicePlayer) return;

    this.isPlaying = false;
    this.voicePlayer.pause();
    if (this.ambientPlayer) {
      this.ambientPlayer.pause();
    }
    if (this.incomingVoicePlayer) {
      this.incomingVoicePlayer.pause();
    }
  }

  resume(): void {
    if (this.isDisposed || !this.voicePlayer) return;

    this.isPlaying = true;
    this.voicePlayer.play();
    if (this.ambientPlayer) {
      this.ambientPlayer.play();
    }
    if (this.incomingVoicePlayer) {
      this.incomingVoicePlayer.play();
    }

    this.emit({ type: 'resumed' });
  }

  async seekTo(positionMs: number): Promise<void> {
    if (this.isDisposed || !this.voicePlayer) return;
    this.currentPositionMs = positionMs;
    await this.voicePlayer.seekTo(positionMs);
  }

  setVoiceVolume(v: number): void {
    this.userVoiceVolume = Math.max(0, Math.min(1, v));
    this.applyVoiceVolume();
  }

  setAmbientVolume(v: number): void {
    this.userAmbientVolume = Math.max(0, Math.min(1, v));
    this.applyAmbientVolume();
  }

  private applyVoiceVolume(): void {
    if (!this.voicePlayer) return;
    // Perceptual volume tapering (v^2)
    const tapered = Math.pow(this.userVoiceVolume, 2);
    this.voicePlayer.setVolume(tapered);
  }

  private applyAmbientVolume(): void {
    if (!this.ambientPlayer) return;
    const tapered = Math.pow(this.userAmbientVolume, 2);
    this.ambientPlayer.setVolume(tapered);
  }

  /**
   * In-Flight Narrator Switch Architecture
   * Master Plan Part 5 §6.8
   * 1,500ms equal-power crossfade, seek alignment, safe fallback on error.
   */
  async switchVoice(newVoiceSource: AudioSource, newVoiceId: string): Promise<void> {
    if (this.isDisposed || !this.voicePlayer) return;
    if (newVoiceId === this.voiceId) return;

    // 1. Asynchronously pre-load incoming voice handle
    let newPlayer: PlayerHandle;
    try {
      newPlayer = this.driver.createPlayer(newVoiceSource);
    } catch (err: any) {
      this.emit({
        type: 'voice_switch_failed',
        voiceId: newVoiceId,
        error: err?.message ?? 'Failed to load voice player',
      });
      return;
    }

    // 2. Timeline alignment: seek incoming player directly to current playback timestamp
    try {
      await newPlayer.seekTo(this.currentPositionMs);
    } catch (err: any) {
      newPlayer.release();
      this.emit({
        type: 'voice_switch_failed',
        voiceId: newVoiceId,
        error: err?.message ?? 'Failed to seek incoming voice',
      });
      return;
    }

    // 3. Controlled Crossfade over 1,500 ms
    const oldPlayer = this.voicePlayer;
    this.incomingVoicePlayer = newPlayer;

    const crossfadeDurationMs = 1500;
    const intervalMs = 50;
    const totalSteps = crossfadeDurationMs / intervalMs;
    let step = 0;

    newPlayer.setVolume(0);
    if (this.isPlaying) {
      newPlayer.play();
    }

    if (this.crossfadeInterval) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }

    await new Promise<void>((resolve) => {
      this.crossfadeInterval = setInterval(() => {
        step++;
        const progress = Math.min(1, step / totalSteps);

        // Equal-power crossfade curves:
        // gain_old = cos(pi/2 * t) * V^2
        // gain_new = sin(pi/2 * t) * V^2
        const vSquared = Math.pow(this.userVoiceVolume, 2);
        const gainOld = Math.cos((Math.PI / 2) * progress) * vSquared;
        const gainNew = Math.sin((Math.PI / 2) * progress) * vSquared;

        oldPlayer.setVolume(gainOld);
        newPlayer.setVolume(gainNew);

        if (progress >= 1) {
          if (this.crossfadeInterval) {
            clearInterval(this.crossfadeInterval);
            this.crossfadeInterval = null;
          }
          resolve();
        }
      }, intervalMs);
    });

    // 4. Handoff & Cleanup
    oldPlayer.pause();
    oldPlayer.release();

    this.voicePlayer = newPlayer;
    this.incomingVoicePlayer = null;
    this.voiceId = newVoiceId;

    this.attachVoiceStatusListener(this.voicePlayer);
    this.applyVoiceVolume();

    this.emit({ type: 'voice_switched', voiceId: newVoiceId });
  }

  /**
   * Switches ambient bed mid-session with a 2,000ms equal-power crossfade.
   */
  async switchBed(newBedSource: AudioSource | null): Promise<void> {
    if (this.isDisposed) return;

    if (this.ambientCrossfadeInterval) {
      clearInterval(this.ambientCrossfadeInterval);
      this.ambientCrossfadeInterval = null;
    }

    if (!newBedSource) {
      // Fade out current bed
      if (this.ambientPlayer) {
        const oldBed = this.ambientPlayer;
        this.ambientPlayer = null;
        oldBed.pause();
        oldBed.release();
      }
      this.emit({ type: 'bed_switched', bedSource: null });
      return;
    }

    let newBed: PlayerHandle;
    try {
      newBed = this.driver.createPlayer(newBedSource);
      newBed.setLoop(true);
    } catch {
      return;
    }

    const oldBed = this.ambientPlayer;
    this.ambientPlayer = newBed;
    newBed.setVolume(0);
    if (this.isPlaying) {
      newBed.play();
    }

    const durationMs = 2000;
    const intervalMs = 50;
    const totalSteps = durationMs / intervalMs;
    let step = 0;

    await new Promise<void>((resolve) => {
      this.ambientCrossfadeInterval = setInterval(() => {
        step++;
        const progress = Math.min(1, step / totalSteps);
        const vSquared = Math.pow(this.userAmbientVolume, 2);

        if (oldBed) {
          oldBed.setVolume(Math.cos((Math.PI / 2) * progress) * vSquared);
        }
        newBed.setVolume(Math.sin((Math.PI / 2) * progress) * vSquared);

        if (progress >= 1) {
          if (this.ambientCrossfadeInterval) {
            clearInterval(this.ambientCrossfadeInterval);
            this.ambientCrossfadeInterval = null;
          }
          if (oldBed) {
            oldBed.pause();
            oldBed.release();
          }
          resolve();
        }
      }, intervalMs);
    });

    this.emit({ type: 'bed_switched', bedSource: newBedSource });
  }

  /**
   * Plays the Focus Mode ending chime (chime_rise.wav) while fading ambient over 6s.
   */
  async playEndingChime(chimeSource: AudioSource): Promise<void> {
    if (this.isDisposed) return;

    try {
      this.chimePlayer = this.driver.createPlayer(chimeSource);
      this.chimePlayer.setVolume(0.8);
      this.chimePlayer.play();
    } catch (err) {
      console.warn('Failed to play ending chime:', err);
    }

    // Fade ambient over 6s
    if (this.ambientPlayer) {
      const startAmbient = this.userAmbientVolume;
      const fadeDuration = 6000;
      const intervalMs = 100;
      const steps = fadeDuration / intervalMs;
      let step = 0;

      const fadeTimer = setInterval(() => {
        step++;
        const factor = Math.max(0, 1 - step / steps);
        if (this.ambientPlayer) {
          this.ambientPlayer.setVolume(Math.pow(startAmbient, 2) * factor);
        }
        if (factor <= 0) {
          clearInterval(fadeTimer);
          if (this.ambientPlayer) {
            this.ambientPlayer.pause();
          }
        }
      }, intervalMs);
    }
  }

  // Audio-focus / Interruption Handlers
  handleAudioInterruption(isTransient: boolean): void {
    if (!this.isPlaying) return;
    this.pause();
    this.emit({ type: 'interrupted', transient: isTransient });
  }

  handleAudioBecomingNoisy(): void {
    if (!this.isPlaying) return;
    this.pause();
    this.emit({ type: 'interrupted', transient: false });
  }

  on(cb: (e: EngineEvent) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(e: EngineEvent): void {
    for (const listener of this.listeners) {
      listener(e);
    }
  }

  getCurrentPositionMs(): number {
    return this.currentPositionMs;
  }

  getDurationMs(): number {
    return this.durationMs || this.plannedMs;
  }

  getVoiceId(): string {
    return this.voiceId;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private cleanupPlayers(): void {
    this.isPlaying = false;

    if (this.crossfadeInterval) {
      clearInterval(this.crossfadeInterval);
      this.crossfadeInterval = null;
    }
    if (this.ambientCrossfadeInterval) {
      clearInterval(this.ambientCrossfadeInterval);
      this.ambientCrossfadeInterval = null;
    }

    if (this.voiceUnsubscribe) {
      this.voiceUnsubscribe();
      this.voiceUnsubscribe = null;
    }

    if (this.voicePlayer) {
      this.voicePlayer.release();
      this.voicePlayer = null;
    }
    if (this.ambientPlayer) {
      this.ambientPlayer.release();
      this.ambientPlayer = null;
    }
    if (this.incomingVoicePlayer) {
      this.incomingVoicePlayer.release();
      this.incomingVoicePlayer = null;
    }
    if (this.chimePlayer) {
      this.chimePlayer.release();
      this.chimePlayer = null;
    }
  }

  dispose(): void {
    this.isDisposed = true;
    this.cleanupPlayers();
    this.listeners.clear();
  }
}
