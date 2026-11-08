/**
 * VoiceStudio Adapter
 * Master Plan Part 5 §6.4
 * Dedicated adapter for OpenAI-style /v1/audio/speech endpoints with hash caching.
 * Does not run in CI or assume unverified endpoints are reachable.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

export class VoiceStudioAdapter {
  constructor(cfg, cacheDir = '.cache/tts') {
    this.cfg = cfg;
    this.cacheDir = cacheDir;
  }

  key(voiceId, text) {
    const v = this.cfg.voices[voiceId];
    if (!v) {
      throw new Error(`Unknown voice ID in TTS config: ${voiceId}`);
    }
    return createHash('sha256')
      .update(JSON.stringify([v.model, v.voice, v.speed, text]))
      .digest('hex');
  }

  async synth(voiceId, text) {
    await mkdir(this.cacheDir, { recursive: true });
    const out = path.join(this.cacheDir, `${this.key(voiceId, text)}.wav`);

    try {
      await access(out);
      return out;
    } catch {
      // Not cached yet
    }

    const v = this.cfg.voices[voiceId];
    if (!v) {
      throw new Error(`Voice '${voiceId}' not found in voices configuration.`);
    }

    const headers = { 'Content-Type': 'application/json' };
    const key = process.env[this.cfg.apiKeyEnv];
    if (key) {
      headers.Authorization = `Bearer ${key}`;
    }

    const targetUrl = new URL(this.cfg.endpoint, this.cfg.baseUrl).toString();

    let res;
    try {
      res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: v.model,
          input: text,
          voice: v.voice,
          speed: v.speed,
          response_format: this.cfg.responseFormat,
        }),
      });
    } catch (err) {
      throw new Error(`VoiceStudio connection error at ${targetUrl}: ${err.message}`);
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`VoiceStudio TTS failed with HTTP ${res.status}: ${errBody}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(out, buffer);
    return out;
  }
}
