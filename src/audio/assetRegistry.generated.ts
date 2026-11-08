/**
 * Ember Generated Audio Asset Registry & Manifest
 * Master Plan Part 5 §6.1, §6.3, Part 4 §5.3
 * Contains canonical metadata, real/placeholder indicators, durations, and cue timelines.
 */

import type { AmbientBedId, ProtocolId } from '../domain/constants';
import type { Mode } from '../data/types';
import type {
  AmbientBedMetadata,
  ChimeMetadata,
  CueTimelineItem,
  ProtocolAudioMetadata,
  VoiceTrackMetadata,
} from './assetRegistry';

export const CHIME_METADATA: ChimeMetadata = {
  assetKey: 'chime_rise',
  filename: 'chime_rise.wav',
  durationMs: 3200,
};

export const PROTOCOLS_METADATA: Record<ProtocolId, ProtocolAudioMetadata> = {
  rapid_reset_5: {
    id: 'rapid_reset_5',
    title: 'Rapid Reset',
    durationMinutes: 5,
    plannedMs: 300_000,
    tier: 'free',
    supportsModes: false,
    hasSighPrimer: true,
  },
  afternoon_recharge_10: {
    id: 'afternoon_recharge_10',
    title: 'Afternoon Recharge',
    durationMinutes: 10,
    plannedMs: 600_000,
    tier: 'free',
    supportsModes: true,
    hasSighPrimer: false,
  },
  deep_rest_30: {
    id: 'deep_rest_30',
    title: 'Deep Rest & Yoga Nidra',
    durationMinutes: 30,
    plannedMs: 1_800_000,
    tier: 'pro',
    supportsModes: true,
    hasSighPrimer: false,
  },
};

export const AMBIENT_BEDS_METADATA: Record<AmbientBedId, AmbientBedMetadata> = {
  rain: {
    id: 'rain',
    title: 'Rain',
    tier: 'free',
    assetKey: 'bed_rain',
    filename: 'rain.ogg',
    loopMs: 60_000,
    isBinaural: false,
    format: 'opus',
  },
  brown_noise: {
    id: 'brown_noise',
    title: 'Brown Noise',
    tier: 'free',
    assetKey: 'bed_brown_noise',
    filename: 'brown_noise.ogg',
    loopMs: 60_000,
    isBinaural: false,
    format: 'opus',
  },
  theta_6hz: {
    id: 'theta_6hz',
    title: '6 Hz Theta',
    tier: 'free',
    assetKey: 'bed_theta_6hz',
    filename: 'theta_6hz.flac',
    loopMs: 24_000,
    isBinaural: true,
    format: 'flac',
  },
  ocean_drift: {
    id: 'ocean_drift',
    title: 'Ocean Drift',
    tier: 'pro',
    assetKey: 'bed_ocean_drift',
    filename: 'ocean_drift.ogg',
    loopMs: 60_000,
    isBinaural: false,
    format: 'opus',
  },
  night_forest: {
    id: 'night_forest',
    title: 'Night Forest',
    tier: 'pro',
    assetKey: 'bed_night_forest',
    filename: 'night_forest.ogg',
    loopMs: 60_000,
    isBinaural: false,
    format: 'opus',
  },
  delta_2hz: {
    id: 'delta_2hz',
    title: '2 Hz Delta',
    tier: 'pro',
    assetKey: 'bed_delta_2hz',
    filename: 'delta_2hz.flac',
    loopMs: 24_000,
    isBinaural: true,
    format: 'flac',
  },
};

// Cues from Rapid Reset 5m script specification
const RAPID_RESET_5_CUES: CueTimelineItem[] = [
  { type: 'body', label: 'Settle in', startMs: 0, endMs: 24_000 },
  { type: 'body', label: 'The physiological sigh', startMs: 24_000, endMs: 40_000 },
  { type: 'sigh', label: 'Sigh', startMs: 40_000, endMs: 50_000 },
  { type: 'sigh', label: 'Sigh', startMs: 50_000, endMs: 60_000 },
  { type: 'body', label: 'Let it return', startMs: 60_000, endMs: 68_000 },
  { type: 'release', label: 'Squeeze and drop', startMs: 68_000, endMs: 128_000 },
  {
    type: 'breath',
    label: 'In four, out six',
    startMs: 128_000,
    endMs: 198_000,
    pattern: { inhaleMs: 4000, holdMs: 0, exhaleMs: 6000, hold2Ms: 0 },
  },
  { type: 'body', label: 'Rest', startMs: 198_000, endMs: 250_000 },
  { type: 'body', label: 'Coming back', startMs: 250_000, endMs: 300_000 },
];

const AFTERNOON_RECHARGE_FOCUS_CUES: CueTimelineItem[] = [
  { type: 'body', label: 'Arrival & intent', startMs: 0, endMs: 45_000 },
  {
    type: 'breath',
    label: 'Slow breath',
    startMs: 45_000,
    endMs: 135_000,
    pattern: { inhaleMs: 4000, holdMs: 0, exhaleMs: 6000, hold2Ms: 0 },
  },
  { type: 'body', label: 'Body rotation', startMs: 135_000, endMs: 435_000 },
  {
    type: 'breath',
    label: 'Bright awareness',
    startMs: 435_000,
    endMs: 510_000,
    pattern: { inhaleMs: 5000, holdMs: 0, exhaleMs: 5000, hold2Ms: 0 },
  },
  { type: 'outro', label: 'Rise and awaken', startMs: 510_000, endMs: 600_000 },
];

const AFTERNOON_RECHARGE_SLEEP_CUES: CueTimelineItem[] = [
  { type: 'body', label: 'Arrival & intent', startMs: 0, endMs: 45_000 },
  {
    type: 'breath',
    label: 'Slow breath',
    startMs: 45_000,
    endMs: 135_000,
    pattern: { inhaleMs: 4000, holdMs: 0, exhaleMs: 6000, hold2Ms: 0 },
  },
  { type: 'body', label: 'Body rotation', startMs: 135_000, endMs: 435_000 },
  {
    type: 'breath',
    label: 'Bright awareness',
    startMs: 435_000,
    endMs: 510_000,
    pattern: { inhaleMs: 5000, holdMs: 0, exhaleMs: 5000, hold2Ms: 0 },
  },
  { type: 'outro', label: 'Drifting to sleep', startMs: 510_000, endMs: 600_000 },
];

const DEEP_REST_30_FOCUS_CUES: CueTimelineItem[] = [
  { type: 'body', label: 'Settle & intention', startMs: 0, endMs: 150_000 },
  {
    type: 'breath',
    label: 'Lengthen exhale',
    startMs: 150_000,
    endMs: 330_000,
    pattern: { inhaleMs: 4000, holdMs: 0, exhaleMs: 7000, hold2Ms: 0 },
  },
  { type: 'body', label: 'Rotation of consciousness', startMs: 330_000, endMs: 930_000 },
  {
    type: 'breath',
    label: 'Breath counting',
    startMs: 930_000,
    endMs: 1_170_000,
    pattern: { inhaleMs: 5000, holdMs: 0, exhaleMs: 5000, hold2Ms: 0 },
  },
  { type: 'body', label: 'Sensation of opposites', startMs: 1_170_000, endMs: 1_410_000 },
  { type: 'body', label: 'Visualization', startMs: 1_410_000, endMs: 1_620_000 },
  { type: 'silence', label: 'Deep stillness', startMs: 1_620_000, endMs: 1_710_000 },
  { type: 'outro', label: 'Gentle awakening', startMs: 1_710_000, endMs: 1_800_000 },
];

const DEEP_REST_30_SLEEP_CUES: CueTimelineItem[] = [
  { type: 'body', label: 'Settle & intention', startMs: 0, endMs: 150_000 },
  {
    type: 'breath',
    label: 'Lengthen exhale',
    startMs: 150_000,
    endMs: 330_000,
    pattern: { inhaleMs: 4000, holdMs: 0, exhaleMs: 7000, hold2Ms: 0 },
  },
  { type: 'body', label: 'Rotation of consciousness', startMs: 330_000, endMs: 930_000 },
  {
    type: 'breath',
    label: 'Breath counting',
    startMs: 930_000,
    endMs: 1_170_000,
    pattern: { inhaleMs: 5000, holdMs: 0, exhaleMs: 5000, hold2Ms: 0 },
  },
  { type: 'body', label: 'Sensation of opposites', startMs: 1_170_000, endMs: 1_410_000 },
  { type: 'body', label: 'Visualization', startMs: 1_410_000, endMs: 1_620_000 },
  { type: 'silence', label: 'Deep stillness', startMs: 1_620_000, endMs: 1_710_000 },
  { type: 'outro', label: 'Sleep transition', startMs: 1_710_000, endMs: 1_800_000 },
];

export const VOICE_TRACKS_METADATA: VoiceTrackMetadata[] = [
  // Maya Rapid Reset (Candidate recording from Main.wav - verified studio master)
  {
    protocolId: 'rapid_reset_5',
    voiceId: 'maya_warm',
    mode: 'focus',
    assetKey: 'voice_maya_rapid_reset_5',
    filename: 'rapid_reset_5.ogg',
    durationMs: 300_000,
    sha256: '5370a4127a1838ef9353ff419cefe60520fc8d7379766bb94f3ba79b977e1806',
    isPlaceholder: false,
    assetVersion: 1,
    cues: RAPID_RESET_5_CUES,
  },
  // Maya Afternoon Recharge 10m Focus (development placeholder)
  {
    protocolId: 'afternoon_recharge_10',
    voiceId: 'maya_warm',
    mode: 'focus',
    assetKey: 'voice_maya_afternoon_recharge_10_focus',
    filename: 'afternoon_recharge_10.focus.ogg',
    durationMs: 600_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: AFTERNOON_RECHARGE_FOCUS_CUES,
  },
  // Maya Afternoon Recharge 10m Sleep (development placeholder)
  {
    protocolId: 'afternoon_recharge_10',
    voiceId: 'maya_warm',
    mode: 'sleep',
    assetKey: 'voice_maya_afternoon_recharge_10_sleep',
    filename: 'afternoon_recharge_10.sleep.ogg',
    durationMs: 600_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: AFTERNOON_RECHARGE_SLEEP_CUES,
  },
  // Maya Deep Rest 30m Focus (development placeholder)
  {
    protocolId: 'deep_rest_30',
    voiceId: 'maya_warm',
    mode: 'focus',
    assetKey: 'voice_maya_deep_rest_30_focus',
    filename: 'deep_rest_30.focus.ogg',
    durationMs: 1_800_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: DEEP_REST_30_FOCUS_CUES,
  },
  // Maya Deep Rest 30m Sleep (development placeholder)
  {
    protocolId: 'deep_rest_30',
    voiceId: 'maya_warm',
    mode: 'sleep',
    assetKey: 'voice_maya_deep_rest_30_sleep',
    filename: 'deep_rest_30.sleep.ogg',
    durationMs: 1_800_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: DEEP_REST_30_SLEEP_CUES,
  },

  // Arjun tracks (all development placeholders pending studio session)
  {
    protocolId: 'rapid_reset_5',
    voiceId: 'arjun_deep',
    mode: 'focus',
    assetKey: 'voice_arjun_rapid_reset_5',
    filename: 'rapid_reset_5.ogg',
    durationMs: 300_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: RAPID_RESET_5_CUES,
  },
  {
    protocolId: 'afternoon_recharge_10',
    voiceId: 'arjun_deep',
    mode: 'focus',
    assetKey: 'voice_arjun_afternoon_recharge_10_focus',
    filename: 'afternoon_recharge_10.focus.ogg',
    durationMs: 600_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: AFTERNOON_RECHARGE_FOCUS_CUES,
  },
  {
    protocolId: 'afternoon_recharge_10',
    voiceId: 'arjun_deep',
    mode: 'sleep',
    assetKey: 'voice_arjun_afternoon_recharge_10_sleep',
    filename: 'afternoon_recharge_10.sleep.ogg',
    durationMs: 600_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: AFTERNOON_RECHARGE_SLEEP_CUES,
  },
  {
    protocolId: 'deep_rest_30',
    voiceId: 'arjun_deep',
    mode: 'focus',
    assetKey: 'voice_arjun_deep_rest_30_focus',
    filename: 'deep_rest_30.focus.ogg',
    durationMs: 1_800_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: DEEP_REST_30_FOCUS_CUES,
  },
  {
    protocolId: 'deep_rest_30',
    voiceId: 'arjun_deep',
    mode: 'sleep',
    assetKey: 'voice_arjun_deep_rest_30_sleep',
    filename: 'deep_rest_30.sleep.ogg',
    durationMs: 1_800_000,
    isPlaceholder: true,
    assetVersion: 1,
    cues: DEEP_REST_30_SLEEP_CUES,
  },
];

export function getVoiceTrackMetadata(
  protocolId: ProtocolId,
  voiceId: string,
  mode: Mode = 'focus',
): VoiceTrackMetadata | null {
  // For 5m protocol, mode is always focus
  const effectiveMode = protocolId === 'rapid_reset_5' ? 'focus' : mode;
  return (
    VOICE_TRACKS_METADATA.find(
      (t) =>
        t.protocolId === protocolId &&
        t.voiceId === voiceId &&
        t.mode === effectiveMode,
    ) ?? null
  );
}

export function getAmbientBedMetadata(bedId: AmbientBedId): AmbientBedMetadata | null {
  return AMBIENT_BEDS_METADATA[bedId] ?? null;
}

export function getProtocolAudioMetadata(
  protocolId: ProtocolId,
): ProtocolAudioMetadata | null {
  return PROTOCOLS_METADATA[protocolId] ?? null;
}
