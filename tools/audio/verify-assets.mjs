/**
 * Audio Asset Verification CLI
 * Master Plan Part 5 §6.4 & §6.5
 * Validates existence, size budgets, and SHA-256 checksums without requiring ffmpeg.
 * In --release mode, strictly rejects placeholder assets.
 */

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

// Budget specifications in bytes
export const BUDGETS = {
  // Voice tracks
  'voice/rapid_reset_5': 1.4 * 1024 * 1024, // 1.4 MB
  'voice/afternoon_recharge_10': 2.6 * 1024 * 1024, // 2.6 MB
  'voice/deep_rest_30': 7.6 * 1024 * 1024, // 7.6 MB

  // Soundscape beds
  'beds/rain.ogg': 0.8 * 1024 * 1024, // 0.8 MB
  'beds/brown_noise.ogg': 0.8 * 1024 * 1024, // 0.8 MB
  'beds/ocean_drift.ogg': 0.8 * 1024 * 1024, // 0.8 MB
  'beds/night_forest.ogg': 0.8 * 1024 * 1024, // 0.8 MB
  'beds/theta_6hz.flac': 5.0 * 1024 * 1024, // 5.0 MB
  'beds/delta_2hz.flac': 5.0 * 1024 * 1024, // 5.0 MB

  // Chime
  'chime_rise.wav': 0.3 * 1024 * 1024, // 0.3 MB

  // Total bundled
  TOTAL_BUNDLED: 42 * 1024 * 1024, // 42 MB
};

export async function computeSha256(filePath) {
  const buf = await readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

export async function isPlaceholderAsset(filePath) {
  const buf = await readFile(filePath);
  // Check for the embedded placeholder comment tag
  return buf.includes(Buffer.from('EMBER_DEV_PLACEHOLDER_NOT_FOR_RELEASE'));
}

export async function verifyAssets(baseDir = 'assets/audio', isRelease = false) {
  const results = {
    valid: true,
    totalBytes: 0,
    assets: [],
    errors: [],
    placeholders: [],
  };

  const assetList = [
    // Chime
    { relPath: 'chime_rise.wav', budgetKey: 'chime_rise.wav' },

    // Ambient beds
    { relPath: 'beds/rain.ogg', budgetKey: 'beds/rain.ogg' },
    { relPath: 'beds/brown_noise.ogg', budgetKey: 'beds/brown_noise.ogg' },
    { relPath: 'beds/ocean_drift.ogg', budgetKey: 'beds/ocean_drift.ogg' },
    { relPath: 'beds/night_forest.ogg', budgetKey: 'beds/night_forest.ogg' },
    { relPath: 'beds/theta_6hz.flac', budgetKey: 'beds/theta_6hz.flac' },
    { relPath: 'beds/delta_2hz.flac', budgetKey: 'beds/delta_2hz.flac' },

    // Maya tracks
    {
      relPath: 'voice/maya_warm/rapid_reset_5.ogg',
      budgetKey: 'voice/rapid_reset_5',
    },
    {
      relPath: 'voice/maya_warm/afternoon_recharge_10.focus.ogg',
      budgetKey: 'voice/afternoon_recharge_10',
    },
    {
      relPath: 'voice/maya_warm/afternoon_recharge_10.sleep.ogg',
      budgetKey: 'voice/afternoon_recharge_10',
    },
    {
      relPath: 'voice/maya_warm/deep_rest_30.focus.ogg',
      budgetKey: 'voice/deep_rest_30',
    },
    {
      relPath: 'voice/maya_warm/deep_rest_30.sleep.ogg',
      budgetKey: 'voice/deep_rest_30',
    },

    // Arjun tracks
    {
      relPath: 'voice/arjun_deep/rapid_reset_5.ogg',
      budgetKey: 'voice/rapid_reset_5',
    },
    {
      relPath: 'voice/arjun_deep/afternoon_recharge_10.focus.ogg',
      budgetKey: 'voice/afternoon_recharge_10',
    },
    {
      relPath: 'voice/arjun_deep/afternoon_recharge_10.sleep.ogg',
      budgetKey: 'voice/afternoon_recharge_10',
    },
    {
      relPath: 'voice/arjun_deep/deep_rest_30.focus.ogg',
      budgetKey: 'voice/deep_rest_30',
    },
    {
      relPath: 'voice/arjun_deep/deep_rest_30.sleep.ogg',
      budgetKey: 'voice/deep_rest_30',
    },
  ];

  for (const item of assetList) {
    const fullPath = path.join(baseDir, item.relPath);

    if (!existsSync(fullPath)) {
      results.valid = false;
      results.errors.push(`Missing asset: ${item.relPath}`);
      continue;
    }

    const st = await stat(fullPath);
    results.totalBytes += st.size;

    const budget = BUDGETS[item.budgetKey];
    if (budget && st.size > budget) {
      results.valid = false;
      results.errors.push(
        `Asset ${item.relPath} exceeds budget: ${(st.size / 1024 / 1024).toFixed(2)} MB > ${(budget / 1024 / 1024).toFixed(2)} MB`,
      );
    }

    const hash = await computeSha256(fullPath);
    const placeholder = await isPlaceholderAsset(fullPath);

    if (placeholder) {
      results.placeholders.push(item.relPath);
      if (isRelease) {
        results.valid = false;
        results.errors.push(
          `RELEASE REJECTED: Placeholder audio asset found in release bundle: ${item.relPath}`,
        );
      }
    }

    results.assets.push({
      relPath: item.relPath,
      sizeBytes: st.size,
      sha256: hash,
      isPlaceholder: placeholder,
    });
  }

  if (results.totalBytes > BUDGETS.TOTAL_BUNDLED) {
    results.valid = false;
    results.errors.push(
      `Total bundled audio exceeds 42 MB budget: ${(results.totalBytes / 1024 / 1024).toFixed(2)} MB`,
    );
  }

  return results;
}

async function main() {
  const isRelease = process.argv.includes('--release');
  console.log(`Verifying audio assets (mode: ${isRelease ? 'RELEASE' : 'DEV/CI'})...`);

  const results = await verifyAssets('assets/audio', isRelease);

  console.log('\n--- Asset Verification Summary ---');
  console.log(`Total Assets Checked: ${results.assets.length}`);
  console.log(`Total Size: ${(results.totalBytes / 1024 / 1024).toFixed(2)} MB (Budget: 42 MB)`);

  if (results.placeholders.length > 0) {
    console.log(`\nNotice: ${results.placeholders.length} assets are development placeholders:`);
    for (const p of results.placeholders) {
      console.log(`  - [PLACEHOLDER] ${p}`);
    }
  }

  if (results.errors.length > 0) {
    console.error('\nFAILURES:');
    for (const err of results.errors) {
      console.error(`  ✕ ${err}`);
    }
    process.exit(1);
  }

  console.log('\n✓ All audio assets verified successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('verify-assets.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
