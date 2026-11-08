/**
 * Asset Registry Unit Tests
 * Master Plan Part 5 §6.1, §6.3, Part 4 §5.3
 */

import {
  AMBIENT_BEDS_METADATA,
  CHIME_METADATA,
  getVoiceTrackMetadata,
  getAmbientBedMetadata,
  getProtocolAudioMetadata,
} from '../../src/audio/assetRegistry.generated';
import { verifySha256 } from '../../src/audio/assetRegistry';

describe('Asset Registry & Metadata Architecture', () => {
  describe('Canonical Protocols Metadata', () => {
    it('contains all 3 canonical protocols with exact durations and tiers', () => {
      const p5 = getProtocolAudioMetadata('rapid_reset_5');
      expect(p5).toBeDefined();
      expect(p5?.durationMinutes).toBe(5);
      expect(p5?.plannedMs).toBe(300_000);
      expect(p5?.tier).toBe('free');
      expect(p5?.supportsModes).toBe(false);
      expect(p5?.hasSighPrimer).toBe(true);

      const p10 = getProtocolAudioMetadata('afternoon_recharge_10');
      expect(p10).toBeDefined();
      expect(p10?.durationMinutes).toBe(10);
      expect(p10?.plannedMs).toBe(600_000);
      expect(p10?.tier).toBe('free');
      expect(p10?.supportsModes).toBe(true);

      const p30 = getProtocolAudioMetadata('deep_rest_30');
      expect(p30).toBeDefined();
      expect(p30?.durationMinutes).toBe(30);
      expect(p30?.plannedMs).toBe(1_800_000);
      expect(p30?.tier).toBe('pro');
      expect(p30?.supportsModes).toBe(true);
    });
  });

  describe('Voice Tracks Metadata & Placeholder Flags', () => {
    it('registers Maya Rapid Reset 5 as real studio recording with exact hash', () => {
      const track = getVoiceTrackMetadata('rapid_reset_5', 'maya_warm', 'focus');
      expect(track).toBeDefined();
      expect(track?.isPlaceholder).toBe(false);
      expect(track?.durationMs).toBe(300_000);
      expect(track?.sha256).toBe(
        '5370a4127a1838ef9353ff419cefe60520fc8d7379766bb94f3ba79b977e1806',
      );
      expect(track?.cues.length).toBeGreaterThan(5);
    });

    it('clearly marks missing Maya 10m and 30m recordings as placeholders', () => {
      const maya10Focus = getVoiceTrackMetadata('afternoon_recharge_10', 'maya_warm', 'focus');
      expect(maya10Focus?.isPlaceholder).toBe(true);

      const maya10Sleep = getVoiceTrackMetadata('afternoon_recharge_10', 'maya_warm', 'sleep');
      expect(maya10Sleep?.isPlaceholder).toBe(true);

      const maya30Focus = getVoiceTrackMetadata('deep_rest_30', 'maya_warm', 'focus');
      expect(maya30Focus?.isPlaceholder).toBe(true);

      const maya30Sleep = getVoiceTrackMetadata('deep_rest_30', 'maya_warm', 'sleep');
      expect(maya30Sleep?.isPlaceholder).toBe(true);
    });

    it('clearly marks all Arjun recordings as placeholders until studio capture', () => {
      const arjun5 = getVoiceTrackMetadata('rapid_reset_5', 'arjun_deep', 'focus');
      expect(arjun5?.isPlaceholder).toBe(true);

      const arjun10 = getVoiceTrackMetadata('afternoon_recharge_10', 'arjun_deep', 'focus');
      expect(arjun10?.isPlaceholder).toBe(true);

      const arjun30 = getVoiceTrackMetadata('deep_rest_30', 'arjun_deep', 'sleep');
      expect(arjun30?.isPlaceholder).toBe(true);
    });
  });

  describe('Ambient Beds Metadata', () => {
    it('registers all 6 canonical beds with proper formats and binaural flags', () => {
      expect(Object.keys(AMBIENT_BEDS_METADATA)).toHaveLength(6);

      const rain = getAmbientBedMetadata('rain');
      expect(rain?.tier).toBe('free');
      expect(rain?.format).toBe('opus');
      expect(rain?.isBinaural).toBe(false);

      const theta = getAmbientBedMetadata('theta_6hz');
      expect(theta?.tier).toBe('free');
      expect(theta?.format).toBe('flac');
      expect(theta?.isBinaural).toBe(true);
      expect(theta?.loopMs).toBe(24_000);

      const delta = getAmbientBedMetadata('delta_2hz');
      expect(delta?.tier).toBe('pro');
      expect(delta?.format).toBe('flac');
      expect(delta?.isBinaural).toBe(true);
      expect(delta?.loopMs).toBe(24_000);
    });
  });

  describe('Chime Metadata', () => {
    it('registers rising chime with 3.2s duration', () => {
      expect(CHIME_METADATA.assetKey).toBe('chime_rise');
      expect(CHIME_METADATA.durationMs).toBe(3200);
      expect(CHIME_METADATA.filename).toBe('chime_rise.wav');
    });
  });

  describe('SHA-256 Verification Utility', () => {
    it('verifies matching hash string case-insensitively', async () => {
      const content = 'ember-nsdr-audio-test';
      const expectedHash = '9036DFDE72F3074C474BDA826957032A7D0A2470B9D898686BB0E343A2DCEA62';
      const isValid = await verifySha256(content, expectedHash);
      expect(isValid).toBe(true);

      const isInvalid = await verifySha256(content, '00000000000000000000000000000000');
      expect(isInvalid).toBe(false);
    });
  });
});
