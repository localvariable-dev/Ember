/**
 * AudioDriver Interface & Player Handle Definitions
 * Master Plan Part 5 §6.7
 * Abstracts playback implementations (ExpoAudioDriver, MockAudioDriver, NativeDriver).
 */

export type AudioSource = number | { uri: string };

export interface PlayerStatus {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  didJustFinish: boolean;
}

export interface PlayerHandle {
  play(): void;
  pause(): void;
  setVolume(v: number): void;
  setLoop(loop: boolean): void;
  seekTo(ms: number): Promise<void>;
  onStatus(cb: (s: PlayerStatus) => void): () => void;
  setLockScreen(
    active: boolean,
    meta?: { title: string; subtitle: string; artworkUri?: string },
  ): void;
  release(): void;
}

export interface AudioDriver {
  configureSession(): Promise<void>;
  createPlayer(source: AudioSource): PlayerHandle;
}
