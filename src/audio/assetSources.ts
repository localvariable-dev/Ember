/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Bundled Audio Sources Map
 * Master Plan Part 5 §6.7, Part 4 §5.4
 * Maps asset keys to static require() numbers for Metro bundler.
 */

import type { AudioSource } from './AudioDriver';

export const BUNDLED_AUDIO_SOURCES: Record<string, number> = {
  // Voice Maya
  voice_maya_rapid_reset_5: require('../../assets/audio/voice/maya_warm/rapid_reset_5.ogg'),
  voice_maya_afternoon_recharge_10_focus: require('../../assets/audio/voice/maya_warm/afternoon_recharge_10.focus.ogg'),
  voice_maya_afternoon_recharge_10_sleep: require('../../assets/audio/voice/maya_warm/afternoon_recharge_10.sleep.ogg'),
  voice_maya_deep_rest_30_focus: require('../../assets/audio/voice/maya_warm/deep_rest_30.focus.ogg'),
  voice_maya_deep_rest_30_sleep: require('../../assets/audio/voice/maya_warm/deep_rest_30.sleep.ogg'),

  // Voice Arjun
  voice_arjun_rapid_reset_5: require('../../assets/audio/voice/arjun_deep/rapid_reset_5.ogg'),
  voice_arjun_afternoon_recharge_10_focus: require('../../assets/audio/voice/arjun_deep/afternoon_recharge_10.focus.ogg'),
  voice_arjun_afternoon_recharge_10_sleep: require('../../assets/audio/voice/arjun_deep/afternoon_recharge_10.sleep.ogg'),
  voice_arjun_deep_rest_30_focus: require('../../assets/audio/voice/arjun_deep/deep_rest_30.focus.ogg'),
  voice_arjun_deep_rest_30_sleep: require('../../assets/audio/voice/arjun_deep/deep_rest_30.sleep.ogg'),

  // Ambient Beds
  bed_rain: require('../../assets/audio/beds/rain.ogg'),
  bed_brown_noise: require('../../assets/audio/beds/brown_noise.ogg'),
  bed_theta_6hz: require('../../assets/audio/beds/theta_6hz.flac'),
  bed_ocean_drift: require('../../assets/audio/beds/ocean_drift.ogg'),
  bed_night_forest: require('../../assets/audio/beds/night_forest.ogg'),
  bed_delta_2hz: require('../../assets/audio/beds/delta_2hz.flac'),

  // Chime
  chime_rise: require('../../assets/audio/chime_rise.wav'),
};

/**
 * Resolves an assetKey (or file:// URI) to an AudioSource compatible with AudioDriver.
 */
export function resolveAudioSource(assetKey: string | null | undefined): AudioSource | null {
  if (!assetKey || assetKey === 'off') return null;

  // Bundled static require
  const bundled = BUNDLED_AUDIO_SOURCES[assetKey];
  if (bundled !== undefined) {
    return bundled;
  }

  // File or network URI
  if (
    assetKey.startsWith('file://') ||
    assetKey.startsWith('http://') ||
    assetKey.startsWith('https://')
  ) {
    return { uri: assetKey };
  }

  return { uri: assetKey };
}
