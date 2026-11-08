/**
 * Audio Build Pipeline Orchestrator CLI
 * Master Plan Part 5 §6.4 & §6.5
 * Usage:
 *   node tools/audio/build-audio.mjs --voice maya_warm --protocol rapid_reset_5
 *   node tools/audio/build-audio.mjs --placeholders
 *   node tools/audio/build-audio.mjs --export-pack ./dist/arjun_deep.embervoice
 */

import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { generateAllBeds } from './make-beds.mjs';
import { generateChime } from './make-chime.mjs';
import { generatePlaceholders } from './make-placeholders.mjs';
import { generateManifests } from './generate-manifest.mjs';

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

export async function masterMainWav(
  mainWavPath = 'Voices/Main.wav',
  outOggPath = 'assets/audio/voice/maya_warm/rapid_reset_5.ogg',
) {
  if (!existsSync(mainWavPath)) {
    throw new Error(`Main.wav not found at ${mainWavPath}`);
  }

  await mkdir(path.dirname(outOggPath), { recursive: true });

  console.log(`Mastering ${mainWavPath} -> ${outOggPath}...`);
  await runCmd('ffmpeg', [
    '-y',
    '-i',
    mainWavPath,
    '-af',
    'loudnorm=I=-18:TP=-2.5:LRA=7:measured_I=-20.66:measured_TP=-1.99:measured_LRA=6.70:measured_thresh=-31.15:offset=-0.1:linear=true,apad=whole_dur=300',
    '-t',
    '300',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-c:a',
    'libopus',
    '-b:a',
    '32k',
    '-vbr',
    'on',
    '-application',
    'audio',
    outOggPath,
  ]);
  console.log(`✓ Mastered 5m Rapid Reset: ${outOggPath}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--placeholders')) {
    await generatePlaceholders();
    await generateAllBeds();
    await generateChime();
    await generateManifests();
    return;
  }

  if (args.includes('--master-main')) {
    await masterMainWav();
    await generateManifests();
    return;
  }

  if (args.includes('--manifest')) {
    await generateManifests();
    return;
  }

  console.log('Audio Build Pipeline Orchestrator');
  console.log('Use --placeholders to generate dev assets');
  console.log('Use --master-main to process Main.wav');
}

if (process.argv[1] && process.argv[1].endsWith('build-audio.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
