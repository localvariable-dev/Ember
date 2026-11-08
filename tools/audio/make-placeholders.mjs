/**
 * Pure-Node Development Placeholder Audio Generator
 * Master Plan Part 5 §6.4
 * Generates lightweight development placeholder assets for protocols/voices where
 * studio recordings are not yet available.
 * Every placeholder is explicitly tagged as a placeholder in metadata.
 * Release verification strictly rejects placeholder assets.
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

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
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Creates a placeholder Opus file with low-level soothing tone and periodic pulse,
 * tagged with metadata comment indicating it is an unreleased development placeholder.
 */
async function generatePlaceholderOgg(outPath, durationSec) {
  await mkdir(path.dirname(outPath), { recursive: true });

  const filter = [
    `sine=frequency=220:duration=${durationSec}`,
    'volume=0.04',
    'loudnorm=I=-24:TP=-3:LRA=2',
  ].join(',');

  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    filter,
    '-metadata',
    'comment=EMBER_DEV_PLACEHOLDER_NOT_FOR_RELEASE',
    '-metadata',
    'title=Development Placeholder',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-c:a',
    'libopus',
    '-b:a',
    '20k',
    '-vbr',
    'on',
    outPath,
  ]);
}

export async function generatePlaceholders(baseDir = 'assets/audio/voice') {
  console.log('Generating development placeholders for missing recordings...');

  const missingSpecs = [
    // Maya 10m & 30m (studio master only present for 5m Rapid Reset)
    {
      voice: 'maya_warm',
      file: 'afternoon_recharge_10.focus.ogg',
      duration: 600,
    },
    {
      voice: 'maya_warm',
      file: 'afternoon_recharge_10.sleep.ogg',
      duration: 600,
    },
    { voice: 'maya_warm', file: 'deep_rest_30.focus.ogg', duration: 1800 },
    { voice: 'maya_warm', file: 'deep_rest_30.sleep.ogg', duration: 1800 },

    // Arjun (all recordings missing until studio capture)
    { voice: 'arjun_deep', file: 'rapid_reset_5.ogg', duration: 300 },
    {
      voice: 'arjun_deep',
      file: 'afternoon_recharge_10.focus.ogg',
      duration: 600,
    },
    {
      voice: 'arjun_deep',
      file: 'afternoon_recharge_10.sleep.ogg',
      duration: 600,
    },
    { voice: 'arjun_deep', file: 'deep_rest_30.focus.ogg', duration: 1800 },
    { voice: 'arjun_deep', file: 'deep_rest_30.sleep.ogg', duration: 1800 },
  ];

  for (const item of missingSpecs) {
    const fullPath = path.join(baseDir, item.voice, item.file);
    await generatePlaceholderOgg(fullPath, item.duration);
    console.log(`✓ Placeholder generated: ${item.voice}/${item.file} (${item.duration}s)`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('make-placeholders.mjs')) {
  generatePlaceholders()
    .then(() => console.log('✓ All development placeholders generated.'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
