/**
 * Ephemeral Active Session Store
 * Master Plan Part 6 §7.1 & Part 2 §3.4
 * Stores transient session playback states. SQLite handles permanent logging.
 */

import { create } from 'zustand';
import {
  INITIAL_SESSION_STATE,
  type RestMode,
  type SessionStage,
  type SessionState,
} from '../domain/sessionMachine';
import type { PerceivedState, ProtocolId } from '../domain/constants';

interface SessionStoreState extends SessionState {
  // Actions
  setSessionState: (partial: Partial<SessionState>) => void;
  setPosition: (positionMs: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setStage: (stage: SessionStage) => void;
  setPreState: (state: PerceivedState | null) => void;
  setPostState: (state: PerceivedState | null) => void;
  setMode: (mode: RestMode) => void;
  setVoice: (voiceId: string) => void;
  setAmbientBed: (bedId: string) => void;
  setSigh: (enabled: boolean) => void;
  setProtocol: (protocolId: ProtocolId) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  ...INITIAL_SESSION_STATE,

  setSessionState: (partial) => set((state) => ({ ...state, ...partial })),
  setPosition: (positionMs) => set({ positionMs }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setStage: (stage) => set({ stage }),
  setPreState: (preState) => set({ preState }),
  setPostState: (postState) => set({ postState }),
  setMode: (mode) => set({ mode }),
  setVoice: (voiceId) => set({ voiceId }),
  setAmbientBed: (ambientBedId) => set({ ambientBedId }),
  setSigh: (sigh) => set({ sigh }),
  setProtocol: (protocolId) => set({ protocolId }),
  resetSession: () => set(INITIAL_SESSION_STATE),
}));
