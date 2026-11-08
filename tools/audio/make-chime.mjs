/**
 * Pure-Node Harmonic Chime Generator
 * Master Plan Part 5 §6.4 & §6.9
 * Synthesizes a 3.2 s rising harmonic chime (44.1 kHz 16-bit mono WAV) without external dependencies.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

function encodeWav(samples, sampleRate = 44100) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels (1 mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (sampleRate * 1 * 2)
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    buffer.writeInt16LE(Math.round(intSample), 44 + i * 2);
  }

  return buffer;
}

export async function generateChime(
  outPath = 'assets/audio/chime_rise.wav',
  durationSec = 3.2,
  sampleRate = 44100,
) {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(totalSamples);

  // Harmonic frequencies creating a gentle rising warmth
  // Root chord: C4 (261.63 Hz), G4 (392.0 Hz), C5 (523.25 Hz), E5 (659.25 Hz)
  const tones = [
    { freq: 261.63, delay: 0.0, weight: 0.35, decay: 1.8 },
    { freq: 392.0, delay: 0.12, weight: 0.3, decay: 2.0 },
    { freq: 523.25, delay: 0.25, weight: 0.25, decay: 2.2 },
    { freq: 659.25, delay: 0.38, weight: 0.18, decay: 2.4 },
    { freq: 783.99, delay: 0.52, weight: 0.12, decay: 2.6 },
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const tone of tones) {
      if (t >= tone.delay) {
        const localT = t - tone.delay;
        const env = Math.exp(-tone.decay * localT);
        // Slight attack ramp (8ms) to avoid clicks
        const attack = Math.min(1, localT / 0.008);
        const overtone1 = Math.sin(2 * Math.PI * tone.freq * localT);
        const overtone2 = 0.25 * Math.sin(2 * Math.PI * (tone.freq * 2.002) * localT);
        sample += tone.weight * attack * env * (overtone1 + overtone2);
      }
    }

    // Soft master envelope
    const masterAttack = Math.min(1, t / 0.01);
    const masterFadeOut = t > durationSec - 0.2 ? (durationSec - t) / 0.2 : 1;
    samples[i] = sample * 0.45 * masterAttack * masterFadeOut;
  }

  const wavBuffer = encodeWav(samples, sampleRate);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, wavBuffer);
  return outPath;
}

// Direct execution
if (process.argv[1] && process.argv[1].endsWith('make-chime.mjs')) {
  generateChime()
    .then((p) => console.log(`✓ Harmonic chime generated: ${p}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
