/**
 * Mock Audio Driver for Unit and Integration Testing
 * Master Plan Part 5 §6.7, Part 6 §4.11
 */

import type { AudioDriver, AudioSource, PlayerHandle, PlayerStatus } from './AudioDriver';

export class MockPlayerHandle implements PlayerHandle {
  public positionMs = 0;
  public durationMs = 300_000;
  public isPlaying = false;
  public isReleased = false;
  public volume = 1.0;
  public isLooping = false;
  public lockScreenActive = false;
  public lockScreenMeta?: { title: string; subtitle: string; artworkUri?: string };
  public seekCalls: number[] = [];
  public playCount = 0;
  public pauseCount = 0;

  private listeners = new Set<(s: PlayerStatus) => void>();

  constructor(public source: AudioSource) {}

  play(): void {
    if (this.isReleased) return;
    this.isPlaying = true;
    this.playCount++;
    this.emitStatus();
  }

  pause(): void {
    if (this.isReleased) return;
    this.isPlaying = false;
    this.pauseCount++;
    this.emitStatus();
  }

  setVolume(v: number): void {
    if (this.isReleased) return;
    this.volume = Math.max(0, Math.min(1, v));
  }

  setLoop(loop: boolean): void {
    if (this.isReleased) return;
    this.isLooping = loop;
  }

  async seekTo(ms: number): Promise<void> {
    if (this.isReleased) return;
    this.positionMs = Math.max(0, ms);
    this.seekCalls.push(ms);
    this.emitStatus();
  }

  onStatus(cb: (s: PlayerStatus) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  setLockScreen(
    active: boolean,
    meta?: { title: string; subtitle: string; artworkUri?: string },
  ): void {
    this.lockScreenActive = active;
    if (meta) {
      this.lockScreenMeta = meta;
    } else {
      delete this.lockScreenMeta;
    }
  }

  release(): void {
    this.isReleased = true;
    this.isPlaying = false;
    this.listeners.clear();
  }

  // Test simulation helpers
  emitStatus(partial?: Partial<PlayerStatus>): void {
    if (partial) {
      if (partial.positionMs !== undefined) this.positionMs = partial.positionMs;
      if (partial.durationMs !== undefined) this.durationMs = partial.durationMs;
      if (partial.isPlaying !== undefined) this.isPlaying = partial.isPlaying;
    }

    const status: PlayerStatus = {
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      isPlaying: this.isPlaying,
      didJustFinish: Boolean(partial?.didJustFinish),
    };

    for (const listener of this.listeners) {
      listener(status);
    }
  }

  simulateTick(positionMs: number, durationMs?: number, didJustFinish = false): void {
    this.positionMs = positionMs;
    if (durationMs !== undefined) this.durationMs = durationMs;
    this.emitStatus({ positionMs, durationMs: this.durationMs, didJustFinish });
  }

  tick(deltaMs: number): void {
    if (!this.isPlaying || this.isReleased) return;
    this.positionMs = Math.min(this.durationMs, this.positionMs + deltaMs);
    const didJustFinish = this.positionMs >= this.durationMs;
    if (didJustFinish && !this.isLooping) {
      this.isPlaying = false;
    }
    this.emitStatus({ didJustFinish });
  }
}

export class MockAudioDriver implements AudioDriver {
  public sessionConfigured = false;
  public shouldFailNextCreate = false;
  public nextCreateError: Error | string | null = null;
  public createdPlayers: MockPlayerHandle[] = [];

  async configureSession(): Promise<void> {
    this.sessionConfigured = true;
  }

  createPlayer(source: AudioSource): PlayerHandle {
    if (this.shouldFailNextCreate || this.nextCreateError) {
      this.shouldFailNextCreate = false;
      const err = this.nextCreateError ?? 'Simulated audio player creation failure';
      this.nextCreateError = null;
      if (typeof err === 'string') {
        throw new Error(err);
      }
      throw err;
    }

    const player = new MockPlayerHandle(source);
    this.createdPlayers.push(player);
    return player;
  }
}
