/**
 * Ember Session Lifecycle State Machine
 * Master Plan Part 2 §3.4
 * Pure reducer: reduce(state, event) => { nextState, effects[] }
 * Zero React/Expo/SQLite dependencies.
 */

import {
  COMMIT_THRESHOLD,
  PARTIAL_MIN_LISTENED_MS,
  PLANNED_MS,
  SLEEP_FADE_MS,
  FREE_PASS_CONSUME_AT,
  type ProtocolId,
  type PerceivedState,
} from './constants';

export type SessionStage = 'IDLE' | 'PREROLL' | 'ACTIVE' | 'ENDING' | 'CHECKIN' | 'DONE';

export type RestMode = 'focus' | 'sleep';

export type CommitReason =
  'focus_threshold' | 'sleep_auto_commit' | 'natural_end' | 'sleep_reconcile';

export type FinalStatus = 'completed' | 'partial' | 'abandoned';

export interface SessionState {
  stage: SessionStage;
  protocolId: ProtocolId;
  mode: RestMode;
  voiceId: string;
  ambientBedId: string;
  sigh: boolean;
  isPlaying: boolean;
  startedAtMs: number;
  plannedMs: number;
  positionMs: number;
  listenedMs: number;
  committed: boolean;
  commitReason: CommitReason | null;
  passConsumed: boolean;
  accessVia: 'free' | 'pro' | 'free_pass';
  preState: PerceivedState | null;
  postState: PerceivedState | null;
  lastHeartbeatMs: number;
}

export const INITIAL_SESSION_STATE: SessionState = {
  stage: 'IDLE',
  protocolId: 'rapid_reset_5',
  mode: 'focus',
  voiceId: 'maya',
  ambientBedId: 'off',
  sigh: false,
  isPlaying: false,
  startedAtMs: 0,
  plannedMs: 300_000,
  positionMs: 0,
  listenedMs: 0,
  committed: false,
  commitReason: null,
  passConsumed: false,
  accessVia: 'free',
  preState: null,
  postState: null,
  lastHeartbeatMs: 0,
};

export type SessionEffect =
  | {
      type: 'START_AUDIO';
      protocolId: ProtocolId;
      voiceId: string;
      ambientBedId: string;
      positionMs: number;
    }
  | { type: 'STOP_AUDIO' }
  | { type: 'PAUSE_AUDIO' }
  | { type: 'RESUME_AUDIO' }
  | { type: 'FADE_AMBIENT'; fadeFactor: number }
  | { type: 'PLAY_CHIME' }
  | { type: 'HAPTIC_END' }
  | { type: 'COMMIT_SESSION'; reason: CommitReason }
  | { type: 'CONSUME_PASS' }
  | { type: 'PERSIST_HEARTBEAT'; positionMs: number }
  | { type: 'SWITCH_VOICE'; targetVoiceId: string; positionMs: number }
  | { type: 'RECORD_CHECKIN'; postState: PerceivedState }
  | { type: 'FINALIZE_SESSION'; status: FinalStatus; listenedMs: number }
  | { type: 'NAVIGATE'; destination: 'sanctuary' | 'summary' };

export type SessionEvent =
  | {
      type: 'BEGIN';
      protocolId: ProtocolId;
      mode: RestMode;
      voiceId: string;
      ambientBedId: string;
      sigh: boolean;
      startedAtMs: number;
      accessVia?: 'free' | 'pro' | 'free_pass';
      preState?: PerceivedState;
    }
  | { type: 'PACER_DONE' }
  | { type: 'PACER_SKIP' }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'INTERRUPT' }
  | { type: 'POSITION_UPDATE'; positionMs: number; timestampMs: number }
  | { type: 'SWITCH_VOICE'; voiceId: string }
  | { type: 'VOICE_SWITCH_FAILED'; error?: string }
  | { type: 'VOICE_ENDED' }
  | { type: 'CHIME_DONE' }
  | { type: 'CHECKIN_SELECT'; state: PerceivedState }
  | { type: 'CHECKIN_SKIP' }
  | { type: 'END_CONFIRMED' };

export interface TransitionResult {
  state: SessionState;
  effects: SessionEffect[];
}

export function reduceSession(s: SessionState, e: SessionEvent): TransitionResult {
  const effects: SessionEffect[] = [];

  switch (e.type) {
    case 'BEGIN': {
      if (s.stage !== 'IDLE') return { state: s, effects };
      const planned = PLANNED_MS[e.protocolId];
      const nextStage: SessionStage = e.sigh ? 'PREROLL' : 'ACTIVE';

      const next: SessionState = {
        ...s,
        stage: nextStage,
        protocolId: e.protocolId,
        mode: e.mode,
        voiceId: e.voiceId,
        ambientBedId: e.ambientBedId,
        sigh: e.sigh,
        startedAtMs: e.startedAtMs,
        plannedMs: planned,
        isPlaying: !e.sigh,
        accessVia: e.accessVia ?? 'free',
        preState: e.preState ?? null,
        lastHeartbeatMs: e.startedAtMs,
      };

      if (!e.sigh) {
        effects.push({
          type: 'START_AUDIO',
          protocolId: e.protocolId,
          voiceId: e.voiceId,
          ambientBedId: e.ambientBedId,
          positionMs: 0,
        });
      }

      return { state: next, effects };
    }

    case 'PACER_DONE':
    case 'PACER_SKIP': {
      if (s.stage !== 'PREROLL') return { state: s, effects };
      const next: SessionState = {
        ...s,
        stage: 'ACTIVE',
        isPlaying: true,
      };
      effects.push({
        type: 'START_AUDIO',
        protocolId: s.protocolId,
        voiceId: s.voiceId,
        ambientBedId: s.ambientBedId,
        positionMs: 0,
      });
      return { state: next, effects };
    }

    case 'PLAY': {
      if (s.stage !== 'ACTIVE' || s.isPlaying) return { state: s, effects };
      effects.push({ type: 'RESUME_AUDIO' });
      return { state: { ...s, isPlaying: true }, effects };
    }

    case 'PAUSE':
    case 'INTERRUPT': {
      if (s.stage !== 'ACTIVE' || !s.isPlaying) return { state: s, effects };
      effects.push({ type: 'PAUSE_AUDIO' });
      return { state: { ...s, isPlaying: false }, effects };
    }

    case 'POSITION_UPDATE': {
      if (s.stage !== 'ACTIVE') return { state: s, effects };

      const delta = Math.max(0, e.positionMs - s.positionMs);
      const nextListened = s.isPlaying ? s.listenedMs + delta : s.listenedMs;
      const next: SessionState = {
        ...s,
        positionMs: e.positionMs,
        listenedMs: nextListened,
      };

      // Periodic heartbeat check (every 5 seconds)
      if (e.timestampMs - s.lastHeartbeatMs >= 5_000) {
        next.lastHeartbeatMs = e.timestampMs;
        effects.push({
          type: 'PERSIST_HEARTBEAT',
          positionMs: e.positionMs,
        });
      }

      // Check Free Pass consumption at 20% mark
      if (
        s.accessVia === 'free_pass' &&
        !s.passConsumed &&
        e.positionMs >= s.plannedMs * FREE_PASS_CONSUME_AT
      ) {
        next.passConsumed = true;
        effects.push({ type: 'CONSUME_PASS' });
      }

      // Sleep mode ambient fade during final 90 seconds (cubic ramp)
      if (s.mode === 'sleep' && e.positionMs >= s.plannedMs - SLEEP_FADE_MS) {
        const remaining = Math.max(0, s.plannedMs - e.positionMs);
        const t = remaining / SLEEP_FADE_MS; // 1.0 down to 0.0
        const fadeFactor = Math.pow(t, 3); // cubic fade
        effects.push({ type: 'FADE_AMBIENT', fadeFactor });
      }

      // Streak commit check (idempotent)
      if (!s.committed) {
        const thresholdRatio = s.mode === 'sleep' ? COMMIT_THRESHOLD.sleep : COMMIT_THRESHOLD.focus;
        const thresholdMs = s.plannedMs * thresholdRatio;

        if (e.positionMs >= thresholdMs) {
          const reason: CommitReason = s.mode === 'sleep' ? 'sleep_auto_commit' : 'focus_threshold';
          next.committed = true;
          next.commitReason = reason;
          effects.push({ type: 'COMMIT_SESSION', reason });
        }
      }

      return { state: next, effects };
    }

    case 'SWITCH_VOICE': {
      if (s.stage !== 'ACTIVE' || s.voiceId === e.voiceId) {
        return { state: s, effects };
      }
      effects.push({
        type: 'SWITCH_VOICE',
        targetVoiceId: e.voiceId,
        positionMs: s.positionMs,
      });
      return { state: { ...s, voiceId: e.voiceId }, effects };
    }

    case 'VOICE_SWITCH_FAILED': {
      // Audio driver keeps current voice playback uninterrupted
      return { state: s, effects };
    }

    case 'VOICE_ENDED': {
      if (s.stage !== 'ACTIVE') return { state: s, effects };

      const next: SessionState = { ...s, isPlaying: false };

      // Ensure committed if natural end reached
      if (!s.committed) {
        next.committed = true;
        next.commitReason = 'natural_end';
        effects.push({ type: 'COMMIT_SESSION', reason: 'natural_end' });
      }

      if (s.mode === 'focus') {
        next.stage = 'ENDING';
        effects.push({ type: 'PLAY_CHIME' });
        effects.push({ type: 'HAPTIC_END' });
      } else {
        // Sleep mode: silent exit directly to DONE
        next.stage = 'DONE';
        effects.push({ type: 'STOP_AUDIO' });
      }

      return { state: next, effects };
    }

    case 'CHIME_DONE': {
      if (s.stage !== 'ENDING') return { state: s, effects };
      return {
        state: { ...s, stage: 'CHECKIN' },
        effects,
      };
    }

    case 'CHECKIN_SELECT': {
      if (s.stage !== 'CHECKIN') return { state: s, effects };
      effects.push({ type: 'RECORD_CHECKIN', postState: e.state });
      effects.push({ type: 'NAVIGATE', destination: 'summary' });
      return {
        state: { ...s, stage: 'DONE', postState: e.state },
        effects,
      };
    }

    case 'CHECKIN_SKIP': {
      if (s.stage !== 'CHECKIN') return { state: s, effects };
      effects.push({ type: 'NAVIGATE', destination: 'summary' });
      return { state: { ...s, stage: 'DONE' }, effects };
    }

    case 'END_CONFIRMED': {
      if (s.stage === 'DONE' || s.stage === 'IDLE') {
        return { state: s, effects };
      }

      effects.push({ type: 'STOP_AUDIO' });

      if (s.committed) {
        effects.push({ type: 'NAVIGATE', destination: 'summary' });
        return { state: { ...s, stage: 'DONE', isPlaying: false }, effects };
      }

      // Uncommitted early exit
      const status: FinalStatus = s.listenedMs >= PARTIAL_MIN_LISTENED_MS ? 'partial' : 'abandoned';
      effects.push({
        type: 'FINALIZE_SESSION',
        status,
        listenedMs: s.listenedMs,
      });
      effects.push({ type: 'NAVIGATE', destination: 'sanctuary' });

      return {
        state: { ...s, stage: 'DONE', isPlaying: false },
        effects,
      };
    }

    default:
      return { state: s, effects };
  }
}
