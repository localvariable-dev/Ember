/**
 * Ember Audio Asset Registry
 * Master Plan Part 5 §6.1, §6.3, Part 4 §5.3
 * Unified audio asset definitions, cue timelines, technical metadata, and SHA-256 validation.
 */

import type { AmbientBedId, ProtocolId } from '../domain/constants';
import type { Mode, Tier } from '../data/types';
import * as Crypto from 'expo-crypto';

export interface CueTimelineItem {
  type: 'breath' | 'sigh' | 'body' | 'release' | 'silence' | 'outro';
  label?: string;
  startMs: number;
  endMs: number;
  pattern?: {
    inhaleMs: number;
    holdMs: number;
    exhaleMs: number;
    hold2Ms: number;
  };
}

export interface VoiceTrackMetadata {
  protocolId: ProtocolId;
  voiceId: string;
  mode: Mode;
  assetKey: string;
  filename: string;
  durationMs: number;
  sha256?: string;
  isPlaceholder: boolean;
  assetVersion: number;
  cues: CueTimelineItem[];
}

export interface AmbientBedMetadata {
  id: AmbientBedId;
  title: string;
  tier: Tier;
  assetKey: string;
  filename: string;
  loopMs: number;
  isBinaural: boolean;
  format: 'opus' | 'flac';
  sha256?: string;
}

export interface ChimeMetadata {
  assetKey: string;
  filename: string;
  durationMs: number;
  sha256?: string;
}

export interface ProtocolAudioMetadata {
  id: ProtocolId;
  title: string;
  durationMinutes: number;
  plannedMs: number;
  tier: Tier;
  supportsModes: boolean;
  hasSighPrimer: boolean;
}

export interface AssetVerificationResult {
  assetKey: string;
  expectedSha256: string;
  actualSha256: string;
  matches: boolean;
  sizeBytes: number;
  isPlaceholder: boolean;
}

/**
 * Validates content against an expected SHA-256 hash.
 * Works seamlessly in Node (tests/CI) and native Expo environments.
 */
export async function verifySha256(content: string, expectedHash: string): Promise<boolean> {
  let actualHash: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('node:crypto');
    actualHash = nodeCrypto.createHash('sha256').update(content).digest('hex');
  } catch {
    actualHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, content);
  }
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
