/**
 * Ember Data Models & Types
 * Master Plan Part 4 §5.3
 * TypeScript models representing persistent SQLite entities.
 */

import type { ProtocolId } from '../domain/constants';

export type Mode = 'focus' | 'sleep';
export type Tier = 'free' | 'pro';
export type SessionStatus = 'in_progress' | 'completed' | 'partial' | 'abandoned';
export type CommitReason =
  'natural_end' | 'focus_threshold' | 'sleep_auto_commit' | 'sleep_reconcile';
export type AccessVia = 'free' | 'pro' | 'free_pass';
export type RecoveryState = 1 | 2 | 3 | 4 | 5; // Self-reported perceived state (1=Wired, 2=Drained, 3=Neutral, 4=Calm, 5=Restored)

export interface Breath {
  inhaleMs: number;
  holdMs: number;
  exhaleMs: number;
  hold2Ms: number;
}

export type Cue =
  | { type: 'breath'; startMs: number; endMs: number; label: string; pattern: Breath }
  | { type: 'sigh'; startMs: number; endMs: number; label: string }
  | { type: 'body'; startMs: number; endMs: number; label: string }
  | { type: 'release'; startMs: number; endMs: number; label: string }
  | { type: 'silence'; startMs: number; endMs: number; label?: string }
  | { type: 'outro'; startMs: number; endMs: number; label?: string };

export interface AudioProtocol {
  id: ProtocolId;
  title: string;
  subtitle: string;
  minutes: number;
  plannedMs: number;
  tier: Tier;
  supportsModes: boolean;
  sighInScript: boolean;
  assetVersion: number;
  sortOrder: number;
}

export interface Voice {
  id: string;
  name: string;
  subtitle: string;
  locale: string;
  tier: Tier;
  delivery: 'bundled' | 'download' | 'imported';
  status: 'installed' | 'available' | 'downloading';
  previewAssetKey: string | null;
  packSizeBytes: number | null;
  remotePackUrl: string | null;
  sortOrder: number;
}

export interface ProtocolVoiceTrack {
  protocolId: ProtocolId;
  voiceId: string;
  voiceFocusSource: string;
  voiceSleepSource: string | null;
  voiceFocusSha256?: string | null;
  voiceSleepSha256?: string | null;
  cuesFocusJson: string;
  cuesSleepJson: string | null;
  assetVersion: number;
}

export interface AmbientBed {
  id: string;
  title: string;
  tier: Tier;
  assetKey: string;
  loopMs: number;
  isBinaural: boolean;
  sortOrder: number;
}

export interface SessionLog {
  id: string;
  protocolId: ProtocolId;
  voiceId: string;
  mode: Mode;
  ambientBedId: string | null;
  sighPacer: boolean;
  accessVia: AccessVia;
  startedAtMs: number;
  endedAtMs: number | null;
  localDay: string;
  tzOffsetMin: number;
  plannedMs: number;
  listenedMs: number;
  maxPositionMs: number;
  heartbeatAtMs: number | null;
  status: SessionStatus;
  committedAtMs: number | null;
  commitReason: CommitReason | null;
  preState: RecoveryState | null;
  postState: RecoveryState | null;
  createdAtMs: number;
}

export interface DayLedgerRow {
  localDay: string;
  kind: 'practice' | 'grace';
  committedMs: number;
  sessions: number;
}

export interface StreakStateRow {
  id: 1;
  currentStreak: number;
  longestStreak: number;
  lastCreditDay: string | null;
  graceBanked: number;
  graceProgress: number;
  graceEarnedTotal: number;
  graceUsedTotal: number;
  updatedAtMs: number;
}

export type EntitlementKind = 'subscription' | 'lifetime' | 'free_pass';
export type EntitlementSource = 'mock' | 'google_play' | 'razorpay' | 'app';
export type EntitlementStatus = 'active' | 'expired' | 'revoked' | 'available' | 'consumed';

export interface UserEntitlement {
  id: string;
  kind: EntitlementKind;
  source: EntitlementSource;
  productId: string | null;
  status: EntitlementStatus;
  grantedAtMs: number;
  expiresAtMs: number | null;
  consumedAtMs: number | null;
  consumedSessionId: string | null;
  orderId: string | null;
  purchaseToken: string | null;
  lastVerifiedAtMs: number | null;
  metaJson: string | null;
}

export interface UserPreferences {
  id: 1;
  ambientBedId: string | null;
  selectedVoiceId: string;
  voiceVolume: number;
  ambientVolume: number;
  lastMode: Mode;
  modeChosenOnce: boolean;
  sighPacerDefault: boolean;
  hapticsEnabled: boolean;
  breathHaptics: boolean;
  showCues: boolean;
  reduceMotion: 'system' | 'on' | 'off';
  notificationsEnabled: boolean;
  reminderMin: number | null;
  notifPromptShown: boolean;
  lapsedSentCount: number;
  lastOpenAtMs: number | null;
  firstLaunchAtMs: number | null;
  thetaHintShown: boolean;
  firstRunCueShown: boolean;
  reviewPrompted: boolean;
  updatedAtMs: number;
}

export interface CreateSessionParams {
  id?: string;
  protocolId: ProtocolId;
  voiceId?: string;
  mode: Mode;
  ambientBedId?: string | null;
  sighPacer?: boolean;
  accessVia?: AccessVia;
  startedAtMs: number;
  localDay: string;
  tzOffsetMin: number;
  plannedMs: number;
  preState?: RecoveryState | null;
}

export interface CommitSessionParams {
  endedAtMs?: number;
  listenedMs: number;
  maxPositionMs: number;
  commitReason: CommitReason;
  nowMs: number;
}
