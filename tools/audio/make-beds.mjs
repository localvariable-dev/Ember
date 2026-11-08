/**
 * Ambient Bed Generator & Synthesizer
 * Master Plan Part 5 §6.5 & §6.6
 * Generates all 6 canonical ambient beds:
 * - 4 seamless noise loops (Rain, Brown Noise, Ocean Drift, Night Forest) in Opus 96 kbps
 * - 2 phase-exact binaural loops (Theta 6 Hz, Delta 2 Hz) in 22.05 kHz lossless FLAC
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}:\n${stderr}`));
      }
    });
  });
}

function encodeWavHeader(numSamples, sampleRate = 48000, numChannels = 2) {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * blockAlign, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16 bits
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * blockAlign, 40);

  return buffer;
}

/**
 * Synthesizes 24.0 s phase-exact 6 Hz Theta binaural bed:
 * Left: 200 Hz carrier + 100 Hz octave at -6 dB
 * Right: 206 Hz carrier + 103 Hz octave at -6 dB
 * 0.125 Hz slow swell (3 complete cycles over 24s)
 */
async function generateTheta6HzFlac(outPath) {
  const sampleRate = 22050;
  const durationSec = 24.0;
  const numSamples = Math.round(durationSec * sampleRate);
  const pcmBytes = Buffer.alloc(numSamples * 4); // 2 channels * 2 bytes

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Amplitude swell: exactly 3 cycles in 24s (0.125 Hz)
    const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.125 * t);

    // Left channel: 200 Hz carrier (4800 cycles) + 100 Hz (-6dB)
    const leftSig = Math.sin(2 * Math.PI * 200 * t) + 0.5 * Math.sin(2 * Math.PI * 100 * t);

    // Right channel: 206 Hz carrier (4944 cycles) + 103 Hz (-6dB)
    const rightSig = Math.sin(2 * Math.PI * 206 * t) + 0.5 * Math.sin(2 * Math.PI * 103 * t);

    // Master gain targeting approx -26 LUFS
    const leftFinal = Math.max(-1, Math.min(1, leftSig * 0.18 * swell));
    const rightFinal = Math.max(-1, Math.min(1, rightSig * 0.18 * swell));

    pcmBytes.writeInt16LE(Math.round(leftFinal * 0x7fff), i * 4);
    pcmBytes.writeInt16LE(Math.round(rightFinal * 0x7fff), i * 4 + 2);
  }

  const wavHeader = encodeWavHeader(numSamples, sampleRate, 2);
  const tempWav = `${outPath}.tmp.wav`;
  await writeFile(tempWav, Buffer.concat([wavHeader, pcmBytes]));

  await runFfmpeg([
    '-y',
    '-i',
    tempWav,
    '-af',
    'loudnorm=I=-26:TP=-1.5:LRA=4',
    '-ar',
    '22050',
    '-sample_fmt',
    's16',
    '-c:a',
    'flac',
    outPath,
  ]);
  await unlink(tempWav).catch(() => {});
}

/**
 * Synthesizes 24.0 s phase-exact 2 Hz Delta binaural bed:
 * Left: 150 Hz carrier (3600 cycles in 24s)
 * Right: 152 Hz carrier (3648 cycles in 24s)
 */
async function generateDelta2HzFlac(outPath) {
  const sampleRate = 22050;
  const durationSec = 24.0;
  const numSamples = Math.round(durationSec * sampleRate);
  const pcmBytes = Buffer.alloc(numSamples * 4);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Amplitude swell: 2 cycles in 24s (0.0833 Hz)
    const swell = 0.8 + 0.2 * Math.cos(2 * Math.PI * (2 / 24) * t);

    // Left channel: 150 Hz
    const leftSig = Math.sin(2 * Math.PI * 150 * t);
    // Right channel: 152 Hz
    const rightSig = Math.sin(2 * Math.PI * 152 * t);

    const leftFinal = Math.max(-1, Math.min(1, leftSig * 0.2 * swell));
    const rightFinal = Math.max(-1, Math.min(1, rightSig * 0.2 * swell));

    pcmBytes.writeInt16LE(Math.round(leftFinal * 0x7fff), i * 4);
    pcmBytes.writeInt16LE(Math.round(rightFinal * 0x7fff), i * 4 + 2);
  }

  const wavHeader = encodeWavHeader(numSamples, sampleRate, 2);
  const tempWav = `${outPath}.tmp.wav`;
  await writeFile(tempWav, Buffer.concat([wavHeader, pcmBytes]));

  await runFfmpeg([
    '-y',
    '-i',
    tempWav,
    '-af',
    'loudnorm=I=-26:TP=-1.5:LRA=4',
    '-ar',
    '22050',
    '-sample_fmt',
    's16',
    '-c:a',
    'flac',
    outPath,
  ]);
  await unlink(tempWav).catch(() => {});
}

/**
 * Synthesizes continuous brown noise loop with 2-second equal-power crossfade.
 */
async function generateBrownNoiseOgg(outPath) {
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anoisesrc=d=62:c=brown:r=48000:a=0.15',
    '-filter_complex',
    '[0:a]lowpass=f=800[flt];[flt]atrim=2:62,asetpts=PTS-STARTPTS[rest];[flt]atrim=0:2,asetpts=PTS-STARTPTS[head];[rest][head]acrossfade=d=2:c1=qsin:c2=qsin,loudnorm=I=-26:TP=-1.5:LRA=3[out]',
    '-map',
    '[out]',
    '-c:a',
    'libopus',
    '-b:a',
    '96k',
    '-vbr',
    'on',
    outPath,
  ]);
}

/**
 * Synthesizes gentle continuous rainfall acoustic texture with 2-second equal-power crossfade.
 */
async function generateRainOgg(outPath) {
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anoisesrc=d=62:c=pink:r=48000:a=0.12',
    '-filter_complex',
    '[0:a]highpass=f=400,lowpass=f=4500[flt];[flt]atrim=2:62,asetpts=PTS-STARTPTS[rest];[flt]atrim=0:2,asetpts=PTS-STARTPTS[head];[rest][head]acrossfade=d=2:c1=qsin:c2=qsin,loudnorm=I=-26:TP=-1.5:LRA=4[out]',
    '-map',
    '[out]',
    '-c:a',
    'libopus',
    '-b:a',
    '96k',
    '-vbr',
    'on',
    outPath,
  ]);
}

/**
 * Synthesizes ocean rolling surf with 10-second wave swell cycles and 2-second equal-power crossfade.
 */
async function generateOceanDriftOgg(outPath) {
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anoisesrc=d=62:c=pink:r=48000:a=0.15',
    '-filter_complex',
    "[0:a]lowpass=f=1200,volume=eval=frame:volume='0.4+0.5*sin(2*PI*t/10)'[flt];[flt]atrim=2:62,asetpts=PTS-STARTPTS[rest];[flt]atrim=0:2,asetpts=PTS-STARTPTS[head];[rest][head]acrossfade=d=2:c1=qsin:c2=qsin,loudnorm=I=-26:TP=-1.5:LRA=6[out]",
    '-map',
    '[out]',
    '-c:a',
    'libopus',
    '-b:a',
    '96k',
    '-vbr',
    'on',
    outPath,
  ]);
}

/**
 * Synthesizes night forest wilderness ambience with 2-second equal-power crossfade.
 */
async function generateNightForestOgg(outPath) {
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anoisesrc=d=62:c=brown:r=48000:a=0.08',
    '-filter_complex',
    '[0:a]highpass=f=150,lowpass=f=2500,volume=0.8[flt];[flt]atrim=2:62,asetpts=PTS-STARTPTS[rest];[flt]atrim=0:2,asetpts=PTS-STARTPTS[head];[rest][head]acrossfade=d=2:c1=qsin:c2=qsin,loudnorm=I=-26:TP=-1.5:LRA=4[out]',
    '-map',
    '[out]',
    '-c:a',
    'libopus',
    '-b:a',
    '96k',
    '-vbr',
    'on',
    outPath,
  ]);
}

export async function generateAllBeds(bedsDir = 'assets/audio/beds') {
  await mkdir(bedsDir, { recursive: true });

  console.log('Generating ambient soundscapes...');
  await generateRainOgg(path.join(bedsDir, 'rain.ogg'));
  console.log('✓ Rain loop (rain.ogg) generated');

  await generateBrownNoiseOgg(path.join(bedsDir, 'brown_noise.ogg'));
  console.log('✓ Brown noise loop (brown_noise.ogg) generated');

  await generateOceanDriftOgg(path.join(bedsDir, 'ocean_drift.ogg'));
  console.log('✓ Ocean drift loop (ocean_drift.ogg) generated');

  await generateNightForestOgg(path.join(bedsDir, 'night_forest.ogg'));
  console.log('✓ Night forest loop (night_forest.ogg) generated');

  await generateTheta6HzFlac(path.join(bedsDir, 'theta_6hz.flac'));
  console.log('✓ 6 Hz Theta binaural loop (theta_6hz.flac) generated');

  await generateDelta2HzFlac(path.join(bedsDir, 'delta_2hz.flac'));
  console.log('✓ 2 Hz Delta binaural loop (delta_2hz.flac) generated');
}

if (process.argv[1] && process.argv[1].endsWith('make-beds.mjs')) {
  generateAllBeds()
    .then(() => console.log('✓ All ambient beds generated successfully.'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
