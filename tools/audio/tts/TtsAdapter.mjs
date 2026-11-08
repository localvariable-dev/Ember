/**
 * TTS Adapter Base Interface & Factory
 * Master Plan Part 5 §6.4
 */

import { VoiceStudioAdapter } from './VoiceStudioAdapter.mjs';

/**
 * @typedef {Object} TtsAdapter
 * @property {(voiceId: string, text: string) => Promise<string>} synth Synthesize audio and return local file path
 * @property {(voiceId: string, text: string) => string} key Cache key generation
 */

/**
 * Factory for instantiating TTS adapters
 * @param {'voicestudio' | 'mock'} type
 * @param {object} config
 * @param {string} [cacheDir]
 * @returns {TtsAdapter}
 */
export function createTtsAdapter(type = 'voicestudio', config, cacheDir) {
  switch (type) {
    case 'voicestudio':
      return new VoiceStudioAdapter(config, cacheDir);
    default:
      throw new Error(`Unsupported TTS adapter type: ${type}`);
  }
}
