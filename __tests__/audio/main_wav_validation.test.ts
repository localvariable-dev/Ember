/**
 * Main.wav Technical Metadata & Preservation Validation Tests
 * Master Plan Part 5 §6.1, §6.2, §6.5
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

describe('Main.wav Technical Validation & Preservation', () => {
  const mainWavPath = path.resolve(__dirname, '../../Voices/Main.wav');
  const EXPECTED_MAIN_WAV_SHA256 =
    '4a1f411ba472cb0f66687ea6e1f6dbef666370f884bd31677586fa0d6a868991';
  const EXPECTED_MAIN_WAV_SIZE = 14_388_120;

  it('preserves the original Main.wav file at Voices/Main.wav', () => {
    expect(existsSync(mainWavPath)).toBe(true);

    const st = statSync(mainWavPath);
    expect(st.size).toBe(EXPECTED_MAIN_WAV_SIZE);

    const buf = readFileSync(mainWavPath);
    const hash = createHash('sha256').update(buf).digest('hex');
    expect(hash).toBe(EXPECTED_MAIN_WAV_SHA256);
  });

  it('validates WAV header structure of Main.wav', () => {
    const buf = readFileSync(mainWavPath);

    // RIFF chunk descriptor
    expect(buf.toString('utf8', 0, 4)).toBe('RIFF');
    expect(buf.toString('utf8', 8, 12)).toBe('WAVE');

    // fmt subchunk
    expect(buf.toString('utf8', 12, 16)).toBe('fmt ');
    const audioFormat = buf.readUInt16LE(20);
    expect(audioFormat).toBe(1); // Linear PCM

    const numChannels = buf.readUInt16LE(22);
    expect(numChannels).toBe(1); // Mono

    const sampleRate = buf.readUInt32LE(24);
    expect(sampleRate).toBe(24_000); // 24 kHz

    const bitsPerSample = buf.readUInt16LE(34);
    expect(bitsPerSample).toBe(16); // 16-bit
  });

  it('validates encoded rapid_reset_5.ogg Android playback asset', () => {
    const oggPath = path.resolve(__dirname, '../../assets/audio/voice/maya_warm/rapid_reset_5.ogg');
    expect(existsSync(oggPath)).toBe(true);

    const st = statSync(oggPath);
    // Budget check: <= 1.4 MB (1,468,006 bytes)
    expect(st.size).toBeLessThanOrEqual(1.4 * 1024 * 1024);
    expect(st.size).toBeGreaterThan(500 * 1024); // Reasonable size for 5m at 32 kbps

    const buf = readFileSync(oggPath);
    // Verify OGG container magic bytes
    expect(buf.toString('utf8', 0, 4)).toBe('OggS');

    // Verify SHA-256 matches registered hash
    const hash = createHash('sha256').update(buf).digest('hex');
    expect(hash).toBe('079aec60210f0560327d5e3f8b3af21a446bbb9f4da027f035d771ec69c1402b');
  });
});
