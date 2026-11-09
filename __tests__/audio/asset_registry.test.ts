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
import { BUNDLED_AUDIO_SOURCES } from '../../src/audio/assetSources';
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
        '079aec60210f0560327d5e3f8b3af21a446bbb9f4da027f035d771ec69c1402b',
      );
      expect(track?.cues.length).toBeGreaterThan(5);
    });

    it('clearly marks missing Maya 10m and 30m recordings as placeholders', () => {
      const maya10Focus = getVoiceTrackMetadata('afternoon_recharge_10', 'maya_warm', 'focus');
      expect(maya10Focus?.isPlaceholder).toBe(true);
      expect(maya10Focus?.assetKey).toBe('voice_maya_afternoon_recharge_10_focus');
      expect(BUNDLED_AUDIO_SOURCES[maya10Focus!.assetKey]).toBeDefined();

      const maya10Sleep = getVoiceTrackMetadata('afternoon_recharge_10', 'maya_warm', 'sleep');
      expect(maya10Sleep?.isPlaceholder).toBe(true);
      expect(maya10Sleep?.assetKey).toBe('voice_maya_afternoon_recharge_10_sleep');
      expect(BUNDLED_AUDIO_SOURCES[maya10Sleep!.assetKey]).toBeDefined();

      const maya30Focus = getVoiceTrackMetadata('deep_rest_30', 'maya_warm', 'focus');
      expect(maya30Focus?.isPlaceholder).toBe(true);

      const maya30Sleep = getVoiceTrackMetadata('deep_rest_30', 'maya_warm', 'sleep');
      expect(maya30Sleep?.isPlaceholder).toBe(true);
    });

    it('bundles Arjun 10m in both modes while keeping unrelated Arjun sessions placeholders', () => {
      const arjun5 = getVoiceTrackMetadata('rapid_reset_5', 'arjun_deep', 'focus');
      expect(arjun5?.isPlaceholder).toBe(true);

      const arjun10Focus = getVoiceTrackMetadata('afternoon_recharge_10', 'arjun_deep', 'focus');
      const arjun10Sleep = getVoiceTrackMetadata('afternoon_recharge_10', 'arjun_deep', 'sleep');
      expect(arjun10Focus?.isPlaceholder).toBe(false);
      expect(arjun10Sleep?.isPlaceholder).toBe(false);
      expect(arjun10Focus?.durationMs).toBe(600_000);
      expect(arjun10Sleep?.durationMs).toBe(600_000);
      expect(arjun10Focus?.assetKey).toBe('voice_arjun_afternoon_recharge_10_focus');
      expect(arjun10Sleep?.assetKey).toBe('voice_arjun_afternoon_recharge_10_sleep');
      expect(BUNDLED_AUDIO_SOURCES[arjun10Focus!.assetKey]).toBeDefined();
      expect(BUNDLED_AUDIO_SOURCES[arjun10Sleep!.assetKey]).toBeDefined();

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

  describe('Protocols Generated Manifest (JSON)', () => {
    const protocolsManifest = require('../../src/audio/protocols.generated.json');

    it('contains asset_version and all 3 canonical protocols', () => {
      expect(protocolsManifest.asset_version).toBe(1);
      expect(protocolsManifest.protocols).toHaveLength(3);

      const ids = protocolsManifest.protocols.map((p: any) => p.id);
      expect(ids).toEqual(['rapid_reset_5', 'afternoon_recharge_10', 'deep_rest_30']);
    });

    it('configures mode support and sigh primers consistently', () => {
      const p5 = protocolsManifest.protocols.find((p: any) => p.id === 'rapid_reset_5');
      expect(p5.supports_modes).toBe(0);
      expect(p5.sigh_in_script).toBe(1);
      expect(p5.tracks.maya_warm.placeholder).toBe(false);
      expect(p5.tracks.maya_warm.cues_focus).toHaveLength(9);
      expect(p5.tracks.maya_warm.cues_sleep).toBeNull();

      const p10 = protocolsManifest.protocols.find((p: any) => p.id === 'afternoon_recharge_10');
      expect(p10.supports_modes).toBe(1);
      expect(p10.sigh_in_script).toBe(0);
      expect(p10.tracks.maya_warm.placeholder).toBe(true);
      expect(p10.tracks.maya_warm.cues_focus).toHaveLength(5);
      expect(p10.tracks.maya_warm.cues_sleep).toHaveLength(5);

      const p30 = protocolsManifest.protocols.find((p: any) => p.id === 'deep_rest_30');
      expect(p30.supports_modes).toBe(1);
      expect(p30.sigh_in_script).toBe(0);
      expect(p30.tracks.maya_warm.placeholder).toBe(true);
      expect(p30.tracks.maya_warm.cues_focus).toHaveLength(8);
      expect(p30.tracks.maya_warm.cues_sleep).toHaveLength(8);
    });

    it('ensures cue timestamps match protocol duration targets', () => {
      for (const p of protocolsManifest.protocols) {
        const maya = p.tracks.maya_warm;
        const lastFocusCue = maya.cues_focus[maya.cues_focus.length - 1];
        expect(lastFocusCue.endMs).toBe(p.planned_ms);

        if (p.supports_modes === 1) {
          const lastSleepCue = maya.cues_sleep[maya.cues_sleep.length - 1];
          expect(lastSleepCue.endMs).toBe(p.planned_ms);
        }
      }
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
