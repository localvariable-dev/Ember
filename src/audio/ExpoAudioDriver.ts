/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Expo Audio Native Driver Implementation
 * Master Plan Part 5 §6.7 & §6.9
 * Concrete AudioDriver using Expo SDK 58 expo-audio module.
 */

import type { AudioStatus } from 'expo-audio';
import type { AudioDriver, AudioSource, PlayerHandle, PlayerStatus } from './AudioDriver';

function getExpoAudio(): typeof import('expo-audio') {
  return require('expo-audio');
}

class ExpoPlayerHandle implements PlayerHandle {
  private player: any;
  private isReleased = false;

  constructor(source: AudioSource) {
    const { createAudioPlayer } = getExpoAudio();
    this.player = createAudioPlayer(source, { updateInterval: 250 });
  }

  play(): void {
    if (this.isReleased) return;
    this.player.play();
  }

  pause(): void {
    if (this.isReleased) return;
    this.player.pause();
  }

  setVolume(v: number): void {
    if (this.isReleased) return;
    const clamped = Math.max(0, Math.min(1, v));
    this.player.volume = clamped;
  }

  setLoop(loop: boolean): void {
    if (this.isReleased) return;
    this.player.loop = loop;
  }

  async seekTo(ms: number): Promise<void> {
    if (this.isReleased) return;
    const seconds = Math.max(0, ms / 1000);
    await this.player.seekTo(seconds);
  }

  onStatus(cb: (s: PlayerStatus) => void): () => void {
    if (this.isReleased) return () => {};

    const sub = this.player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      const positionMs = Math.round((status.currentTime ?? 0) * 1000);
      const durationMs = Math.round((status.duration ?? 0) * 1000);

      cb({
        positionMs,
        durationMs,
        isPlaying: Boolean(status.playing),
        didJustFinish: Boolean(status.didJustFinish),
      });
    });

    return () => {
      sub.remove();
    };
  }

  setLockScreen(
    active: boolean,
    meta?: { title: string; subtitle: string; artworkUri?: string },
  ): void {
    if (this.isReleased) return;

    if (active && meta) {
      this.player.setActiveForLockScreen(
        true,
        {
          title: meta.title,
          artist: 'Ember',
          albumTitle: meta.subtitle,
          ...(meta.artworkUri ? { artworkUrl: meta.artworkUri } : {}),
        },
        {
          showSeekBackward: false,
          showSeekForward: false,
        },
      );
    } else {
      this.player.setActiveForLockScreen(false);
    }
  }

  release(): void {
    if (this.isReleased) return;
    this.isReleased = true;
    try {
      this.player.pause();
      this.player.release();
    } catch {
      // Ignored if already cleaned up natively
    }
  }
}

export class ExpoAudioDriver implements AudioDriver {
  private sessionConfigured = false;

  async configureSession(): Promise<void> {
    if (this.sessionConfigured) return;
    try {
      const { setAudioModeAsync } = getExpoAudio();
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      this.sessionConfigured = true;
    } catch (err) {
      console.warn('Failed to configure audio session:', err);
    }
  }

  createPlayer(source: AudioSource): PlayerHandle {
    return new ExpoPlayerHandle(source);
  }
}
