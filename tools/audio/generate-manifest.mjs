/**
 * Manifest & Seed Generator for Audio Protocols & Assets
 * Master Plan Part 4 §5.4, Part 5 §6.3 & §6.4
 * Machine-generates:
 *   - src/audio/protocols.generated.json (cues, measured sizes, SHA-256, placeholder tags)
 *   - src/audio/assetRegistry.generated.ts (typed runtime metadata)
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { buildTimeline } from './lib/timeline.mjs';

async function computeSha256(filePath) {
  if (!existsSync(filePath)) return null;
  const buf = await readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

async function isPlaceholder(filePath) {
  if (!existsSync(filePath)) return false;
  const buf = await readFile(filePath);
  return buf.includes(Buffer.from('EMBER_DEV_PLACEHOLDER_NOT_FOR_RELEASE'));
}

async function getFileSize(filePath) {
  if (!existsSync(filePath)) return 0;
  const st = await stat(filePath);
  return st.size;
}

export async function generateManifests(baseAudioDir = 'assets/audio') {
  const scriptsDir = path.resolve('tools/audio/scripts');

  const s5 = JSON.parse(await readFile(path.join(scriptsDir, 'rapid_reset_5.script.json'), 'utf8'));
  const s10 = JSON.parse(
    await readFile(path.join(scriptsDir, 'afternoon_recharge_10.script.json'), 'utf8'),
  );
  const s30 = JSON.parse(await readFile(path.join(scriptsDir, 'deep_rest_30.script.json'), 'utf8'));

  // Compute exact cue timelines from scripts
  const tl5 = buildTimeline(s5, () => 2000, 'none');
  const tl10f = buildTimeline(s10, () => 2000, 'focus');
  const tl10s = buildTimeline(s10, () => 2000, 'sleep');
  const tl30f = buildTimeline(s30, () => 2000, 'focus');
  const tl30s = buildTimeline(s30, () => 2000, 'sleep');

  const voices = ['maya_warm', 'arjun_deep'];

  // Inspect Maya & Arjun files
  const voiceTracksData = {};
  for (const v of voices) {
    voiceTracksData[v] = {
      rapid_reset_5: {
        file: path.join(baseAudioDir, 'voice', v, 'rapid_reset_5.ogg'),
        rel: `voice/${v}/rapid_reset_5.ogg`,
        sha256: await computeSha256(path.join(baseAudioDir, 'voice', v, 'rapid_reset_5.ogg')),
        bytes: await getFileSize(path.join(baseAudioDir, 'voice', v, 'rapid_reset_5.ogg')),
        placeholder: await isPlaceholder(path.join(baseAudioDir, 'voice', v, 'rapid_reset_5.ogg')),
      },
      afternoon_recharge_10_focus: {
        file: path.join(baseAudioDir, 'voice', v, 'afternoon_recharge_10.focus.ogg'),
        rel: `voice/${v}/afternoon_recharge_10.focus.ogg`,
        sha256: await computeSha256(
          path.join(baseAudioDir, 'voice', v, 'afternoon_recharge_10.focus.ogg'),
        ),
        bytes: await getFileSize(
          path.join(baseAudioDir, 'voice', v, 'afternoon_recharge_10.focus.ogg'),
        ),
        placeholder: await isPlaceholder(
          path.join(baseAudioDir, 'voice', v, 'afternoon_recharge_10.focus.ogg'),
        ),
      },
      afternoon_recharge_10_sleep: {
        file: path.join(baseAudioDir, 'voice', v, 'afternoon_recharge_10.sleep.ogg'),
        rel: `voice/${v}/afternoon_recharge_10.sleep.ogg`,
        sha256: await computeSha256(
          path.join(baseAudioDir, 'voice', v, 'afternoon_recharge_10.sleep.ogg'),
        ),
        bytes: await getFileSize(
          path.join(baseAudioDir, 'voice', v, 'afternoon_recharge_10.sleep.ogg'),
        ),
        placeholder: await isPlaceholder(
          path.join(baseAudioDir, 'voice', v, 'afternoon_recharge_10.sleep.ogg'),
        ),
      },
      deep_rest_30_focus: {
        file: path.join(baseAudioDir, 'voice', v, 'deep_rest_30.focus.ogg'),
        rel: `voice/${v}/deep_rest_30.focus.ogg`,
        sha256: await computeSha256(path.join(baseAudioDir, 'voice', v, 'deep_rest_30.focus.ogg')),
        bytes: await getFileSize(path.join(baseAudioDir, 'voice', v, 'deep_rest_30.focus.ogg')),
        placeholder: await isPlaceholder(
          path.join(baseAudioDir, 'voice', v, 'deep_rest_30.focus.ogg'),
        ),
      },
      deep_rest_30_sleep: {
        file: path.join(baseAudioDir, 'voice', v, 'deep_rest_30.sleep.ogg'),
        rel: `voice/${v}/deep_rest_30.sleep.ogg`,
        sha256: await computeSha256(path.join(baseAudioDir, 'voice', v, 'deep_rest_30.sleep.ogg')),
        bytes: await getFileSize(path.join(baseAudioDir, 'voice', v, 'deep_rest_30.sleep.ogg')),
        placeholder: await isPlaceholder(
          path.join(baseAudioDir, 'voice', v, 'deep_rest_30.sleep.ogg'),
        ),
      },
    };
  }

  // Inspect beds & chime
  const beds = [
    'rain.ogg',
    'brown_noise.ogg',
    'theta_6hz.flac',
    'ocean_drift.ogg',
    'night_forest.ogg',
    'delta_2hz.flac',
  ];
  const bedsData = {};
  for (const b of beds) {
    const p = path.join(baseAudioDir, 'beds', b);
    bedsData[b] = {
      sha256: await computeSha256(p),
      bytes: await getFileSize(p),
    };
  }

  const chimePath = path.join(baseAudioDir, 'chime_rise.wav');
  const chimeData = {
    sha256: await computeSha256(chimePath),
    bytes: await getFileSize(chimePath),
  };

  // Build canonical protocols.generated.json
  const protocolsManifest = {
    asset_version: 1,
    generated_at: new Date().toISOString(),
    protocols: [
      {
        id: 'rapid_reset_5',
        title: 'Rapid Reset',
        subtitle: '5 min · The physiological sigh & progressive ease',
        minutes: 5,
        planned_ms: 300_000,
        tier: 'free',
        supports_modes: 0,
        sigh_in_script: 1,
        sort_order: 1,
        tracks: {
          maya_warm: {
            voice_id: 'maya_warm',
            delivery: 'bundled',
            placeholder: voiceTracksData.maya_warm.rapid_reset_5.placeholder,
            filename: 'rapid_reset_5.ogg',
            sha256: voiceTracksData.maya_warm.rapid_reset_5.sha256,
            bytes: voiceTracksData.maya_warm.rapid_reset_5.bytes,
            duration_ms: 300_000,
            cues_focus: tl5.cues,
            cues_sleep: null,
          },
          arjun_deep: {
            voice_id: 'arjun_deep',
            delivery: 'bundled',
            placeholder: voiceTracksData.arjun_deep.rapid_reset_5.placeholder,
            filename: 'rapid_reset_5.ogg',
            sha256: voiceTracksData.arjun_deep.rapid_reset_5.sha256,
            bytes: voiceTracksData.arjun_deep.rapid_reset_5.bytes,
            duration_ms: 300_000,
            cues_focus: tl5.cues,
            cues_sleep: null,
          },
        },
      },
      {
        id: 'afternoon_recharge_10',
        title: 'Afternoon Recharge',
        subtitle: '10 min · Rapid recovery without afternoon brain fog',
        minutes: 10,
        planned_ms: 600_000,
        tier: 'free',
        supports_modes: 1,
        sigh_in_script: 0,
        sort_order: 2,
        tracks: {
          maya_warm: {
            voice_id: 'maya_warm',
            delivery: 'bundled',
            placeholder: voiceTracksData.maya_warm.afternoon_recharge_10_focus.placeholder,
            filename_focus: 'afternoon_recharge_10.focus.ogg',
            filename_sleep: 'afternoon_recharge_10.sleep.ogg',
            sha256_focus: voiceTracksData.maya_warm.afternoon_recharge_10_focus.sha256,
            sha256_sleep: voiceTracksData.maya_warm.afternoon_recharge_10_sleep.sha256,
            bytes_focus: voiceTracksData.maya_warm.afternoon_recharge_10_focus.bytes,
            bytes_sleep: voiceTracksData.maya_warm.afternoon_recharge_10_sleep.bytes,
            duration_ms: 600_000,
            cues_focus: tl10f.cues,
            cues_sleep: tl10s.cues,
          },
          arjun_deep: {
            voice_id: 'arjun_deep',
            delivery: 'bundled',
            placeholder: voiceTracksData.arjun_deep.afternoon_recharge_10_focus.placeholder,
            filename_focus: 'afternoon_recharge_10.focus.ogg',
            filename_sleep: 'afternoon_recharge_10.sleep.ogg',
            sha256_focus: voiceTracksData.arjun_deep.afternoon_recharge_10_focus.sha256,
            sha256_sleep: voiceTracksData.arjun_deep.afternoon_recharge_10_sleep.sha256,
            bytes_focus: voiceTracksData.arjun_deep.afternoon_recharge_10_focus.bytes,
            bytes_sleep: voiceTracksData.arjun_deep.afternoon_recharge_10_sleep.bytes,
            duration_ms: 600_000,
            cues_focus: tl10f.cues,
            cues_sleep: tl10s.cues,
          },
        },
      },
      {
        id: 'deep_rest_30',
        title: 'Deep Rest & Yoga Nidra',
        subtitle: '30 min · Deep physiological restoration & theta states',
        minutes: 30,
        planned_ms: 1_800_000,
        tier: 'pro',
        supports_modes: 1,
        sigh_in_script: 0,
        sort_order: 3,
        tracks: {
          maya_warm: {
            voice_id: 'maya_warm',
            delivery: 'bundled',
            placeholder: voiceTracksData.maya_warm.deep_rest_30_focus.placeholder,
            filename_focus: 'deep_rest_30.focus.ogg',
            filename_sleep: 'deep_rest_30.sleep.ogg',
            sha256_focus: voiceTracksData.maya_warm.deep_rest_30_focus.sha256,
            sha256_sleep: voiceTracksData.maya_warm.deep_rest_30_sleep.sha256,
            bytes_focus: voiceTracksData.maya_warm.deep_rest_30_focus.bytes,
            bytes_sleep: voiceTracksData.maya_warm.deep_rest_30_sleep.bytes,
            duration_ms: 1_800_000,
            cues_focus: tl30f.cues,
            cues_sleep: tl30s.cues,
          },
          arjun_deep: {
            voice_id: 'arjun_deep',
            delivery: 'bundled',
            placeholder: voiceTracksData.arjun_deep.deep_rest_30_focus.placeholder,
            filename_focus: 'deep_rest_30.focus.ogg',
            filename_sleep: 'deep_rest_30.sleep.ogg',
            sha256_focus: voiceTracksData.arjun_deep.deep_rest_30_focus.sha256,
            sha256_sleep: voiceTracksData.arjun_deep.deep_rest_30_sleep.sha256,
            bytes_focus: voiceTracksData.arjun_deep.deep_rest_30_focus.bytes,
            bytes_sleep: voiceTracksData.arjun_deep.deep_rest_30_sleep.bytes,
            duration_ms: 1_800_000,
            cues_focus: tl30f.cues,
            cues_sleep: tl30s.cues,
          },
        },
      },
    ],
  };

  await mkdir('src/audio', { recursive: true });
  await writeFile(
    'src/audio/protocols.generated.json',
    JSON.stringify(protocolsManifest, null, 2) + '\n',
  );
  console.log('✓ Generated src/audio/protocols.generated.json');

  // Build synchronized src/audio/assetRegistry.generated.ts
  const tsContent = `/**
 * Ember Generated Audio Asset Registry & Manifest
 * Master Plan Part 5 §6.1, §6.3, Part 4 §5.3
 * Contains canonical metadata, real/placeholder indicators, durations, and cue timelines.
 * Machine-generated by tools/audio/generate-manifest.mjs
 */

import type { AmbientBedId, ProtocolId } from '../domain/constants';
import type { Mode } from '../data/types';
import type {
  AmbientBedMetadata,
  ChimeMetadata,
  CueTimelineItem,
  ProtocolAudioMetadata,
  VoiceTrackMetadata,
} from './assetRegistry';

export const CHIME_METADATA: ChimeMetadata = {
  assetKey: 'chime_rise',
  filename: 'chime_rise.wav',
  durationMs: 3200,
  sha256: '${chimeData.sha256}',
};

export const PROTOCOLS_METADATA: Record<ProtocolId, ProtocolAudioMetadata> = {
  rapid_reset_5: {
    id: 'rapid_reset_5',
    title: 'Rapid Reset',
    durationMinutes: 5,
    plannedMs: 300_000,
    tier: 'free',
    supportsModes: false,
    hasSighPrimer: true,
  },
  afternoon_recharge_10: {
    id: 'afternoon_recharge_10',
    title: 'Afternoon Recharge',
    durationMinutes: 10,
    plannedMs: 600_000,
    tier: 'free',
    supportsModes: true,
    hasSighPrimer: false,
  },
  deep_rest_30: {
    id: 'deep_rest_30',
    title: 'Deep Rest & Yoga Nidra',
    durationMinutes: 30,
    plannedMs: 1_800_000,
    tier: 'pro',
    supportsModes: true,
    hasSighPrimer: false,
  },
};

export const AMBIENT_BEDS_METADATA: Record<AmbientBedId, AmbientBedMetadata> = {
  rain: {
    id: 'rain',
    title: 'Rain',
    tier: 'free',
    assetKey: 'bed_rain',
    filename: 'rain.ogg',
    loopMs: 60_000,
    isBinaural: false,
    format: 'opus',
    sha256: '${bedsData['rain.ogg'].sha256}',
  },
  brown_noise: {
    id: 'brown_noise',
    title: 'Brown Noise',
    tier: 'free',
    assetKey: 'bed_brown_noise',
    filename: 'brown_noise.ogg',
    loopMs: 60_000,
    isBinaural: false,
    format: 'opus',
    sha256: '${bedsData['brown_noise.ogg'].sha256}',
  },
  theta_6hz: {
    id: 'theta_6hz',
    title: '6 Hz Theta',
    tier: 'free',
    assetKey: 'bed_theta_6hz',
    filename: 'theta_6hz.flac',
    loopMs: 24_000,
    isBinaural: true,
    format: 'flac',
    sha256: '${bedsData['theta_6hz.flac'].sha256}',
  },
  ocean_drift: {
    id: 'ocean_drift',
    title: 'Ocean Drift',
    tier: 'pro',
    assetKey: 'bed_ocean_drift',
    filename: 'ocean_drift.ogg',
    loopMs: 60_000,
    isBinaural: false,
    format: 'opus',
    sha256: '${bedsData['ocean_drift.ogg'].sha256}',
  },
  night_forest: {
    id: 'night_forest',
    title: 'Night Forest',
    tier: 'pro',
    assetKey: 'bed_night_forest',
    filename: 'night_forest.ogg',
    loopMs: 60_000,
    isBinaural: false,
    format: 'opus',
    sha256: '${bedsData['night_forest.ogg'].sha256}',
  },
  delta_2hz: {
    id: 'delta_2hz',
    title: '2 Hz Delta',
    tier: 'pro',
    assetKey: 'bed_delta_2hz',
    filename: 'delta_2hz.flac',
    loopMs: 24_000,
    isBinaural: true,
    format: 'flac',
    sha256: '${bedsData['delta_2hz.flac'].sha256}',
  },
};

const RAPID_RESET_5_CUES: CueTimelineItem[] = ${JSON.stringify(tl5.cues, null, 2)};

const AFTERNOON_RECHARGE_FOCUS_CUES: CueTimelineItem[] = ${JSON.stringify(tl10f.cues, null, 2)};

const AFTERNOON_RECHARGE_SLEEP_CUES: CueTimelineItem[] = ${JSON.stringify(tl10s.cues, null, 2)};

const DEEP_REST_30_FOCUS_CUES: CueTimelineItem[] = ${JSON.stringify(tl30f.cues, null, 2)};

const DEEP_REST_30_SLEEP_CUES: CueTimelineItem[] = ${JSON.stringify(tl30s.cues, null, 2)};

export const VOICE_TRACKS_METADATA: VoiceTrackMetadata[] = [
  // Maya tracks
  {
    protocolId: 'rapid_reset_5',
    voiceId: 'maya_warm',
    mode: 'focus',
    assetKey: 'voice_maya_rapid_reset_5',
    filename: 'rapid_reset_5.ogg',
    durationMs: 300_000,
    sha256: '${voiceTracksData.maya_warm.rapid_reset_5.sha256}',
    isPlaceholder: ${voiceTracksData.maya_warm.rapid_reset_5.placeholder},
    assetVersion: 1,
    cues: RAPID_RESET_5_CUES,
  },
  {
    protocolId: 'afternoon_recharge_10',
    voiceId: 'maya_warm',
    mode: 'focus',
    assetKey: 'voice_maya_afternoon_recharge_10_focus',
    filename: 'afternoon_recharge_10.focus.ogg',
    durationMs: 600_000,
    sha256: '${voiceTracksData.maya_warm.afternoon_recharge_10_focus.sha256}',
    isPlaceholder: ${voiceTracksData.maya_warm.afternoon_recharge_10_focus.placeholder},
    assetVersion: 1,
    cues: AFTERNOON_RECHARGE_FOCUS_CUES,
  },
  {
    protocolId: 'afternoon_recharge_10',
    voiceId: 'maya_warm',
    mode: 'sleep',
    assetKey: 'voice_maya_afternoon_recharge_10_sleep',
    filename: 'afternoon_recharge_10.sleep.ogg',
    durationMs: 600_000,
    sha256: '${voiceTracksData.maya_warm.afternoon_recharge_10_sleep.sha256}',
    isPlaceholder: ${voiceTracksData.maya_warm.afternoon_recharge_10_sleep.placeholder},
    assetVersion: 1,
    cues: AFTERNOON_RECHARGE_SLEEP_CUES,
  },
  {
    protocolId: 'deep_rest_30',
    voiceId: 'maya_warm',
    mode: 'focus',
    assetKey: 'voice_maya_deep_rest_30_focus',
    filename: 'deep_rest_30.focus.ogg',
    durationMs: 1_800_000,
    sha256: '${voiceTracksData.maya_warm.deep_rest_30_focus.sha256}',
    isPlaceholder: ${voiceTracksData.maya_warm.deep_rest_30_focus.placeholder},
    assetVersion: 1,
    cues: DEEP_REST_30_FOCUS_CUES,
  },
  {
    protocolId: 'deep_rest_30',
    voiceId: 'maya_warm',
    mode: 'sleep',
    assetKey: 'voice_maya_deep_rest_30_sleep',
    filename: 'deep_rest_30.sleep.ogg',
    durationMs: 1_800_000,
    sha256: '${voiceTracksData.maya_warm.deep_rest_30_sleep.sha256}',
    isPlaceholder: ${voiceTracksData.maya_warm.deep_rest_30_sleep.placeholder},
    assetVersion: 1,
    cues: DEEP_REST_30_SLEEP_CUES,
  },

  // Arjun tracks
  {
    protocolId: 'rapid_reset_5',
    voiceId: 'arjun_deep',
    mode: 'focus',
    assetKey: 'voice_arjun_rapid_reset_5',
    filename: 'rapid_reset_5.ogg',
    durationMs: 300_000,
    sha256: '${voiceTracksData.arjun_deep.rapid_reset_5.sha256}',
    isPlaceholder: ${voiceTracksData.arjun_deep.rapid_reset_5.placeholder},
    assetVersion: 1,
    cues: RAPID_RESET_5_CUES,
  },
  {
    protocolId: 'afternoon_recharge_10',
    voiceId: 'arjun_deep',
    mode: 'focus',
    assetKey: 'voice_arjun_afternoon_recharge_10_focus',
    filename: 'afternoon_recharge_10.focus.ogg',
    durationMs: 600_000,
    sha256: '${voiceTracksData.arjun_deep.afternoon_recharge_10_focus.sha256}',
    isPlaceholder: ${voiceTracksData.arjun_deep.afternoon_recharge_10_focus.placeholder},
    assetVersion: 1,
    cues: AFTERNOON_RECHARGE_FOCUS_CUES,
  },
  {
    protocolId: 'afternoon_recharge_10',
    voiceId: 'arjun_deep',
    mode: 'sleep',
    assetKey: 'voice_arjun_afternoon_recharge_10_sleep',
    filename: 'afternoon_recharge_10.sleep.ogg',
    durationMs: 600_000,
    sha256: '${voiceTracksData.arjun_deep.afternoon_recharge_10_sleep.sha256}',
    isPlaceholder: ${voiceTracksData.arjun_deep.afternoon_recharge_10_sleep.placeholder},
    assetVersion: 1,
    cues: AFTERNOON_RECHARGE_SLEEP_CUES,
  },
  {
    protocolId: 'deep_rest_30',
    voiceId: 'arjun_deep',
    mode: 'focus',
    assetKey: 'voice_arjun_deep_rest_30_focus',
    filename: 'deep_rest_30.focus.ogg',
    durationMs: 1_800_000,
    sha256: '${voiceTracksData.arjun_deep.deep_rest_30_focus.sha256}',
    isPlaceholder: ${voiceTracksData.arjun_deep.deep_rest_30_focus.placeholder},
    assetVersion: 1,
    cues: DEEP_REST_30_FOCUS_CUES,
  },
  {
    protocolId: 'deep_rest_30',
    voiceId: 'arjun_deep',
    mode: 'sleep',
    assetKey: 'voice_arjun_deep_rest_30_sleep',
    filename: 'deep_rest_30.sleep.ogg',
    durationMs: 1_800_000,
    sha256: '${voiceTracksData.arjun_deep.deep_rest_30_sleep.sha256}',
    isPlaceholder: ${voiceTracksData.arjun_deep.deep_rest_30_sleep.placeholder},
    assetVersion: 1,
    cues: DEEP_REST_30_SLEEP_CUES,
  },
];

export function getVoiceTrackMetadata(
  protocolId: ProtocolId,
  voiceId: string,
  mode: Mode = 'focus',
): VoiceTrackMetadata | null {
  const effectiveMode = protocolId === 'rapid_reset_5' ? 'focus' : mode;
  return (
    VOICE_TRACKS_METADATA.find(
      (t) =>
        t.protocolId === protocolId &&
        t.voiceId === voiceId &&
        t.mode === effectiveMode,
    ) ?? null
  );
}

export function getAmbientBedMetadata(bedId: AmbientBedId): AmbientBedMetadata | null {
  return AMBIENT_BEDS_METADATA[bedId] ?? null;
}

export function getProtocolAudioMetadata(
  protocolId: ProtocolId,
): ProtocolAudioMetadata | null {
  return PROTOCOLS_METADATA[protocolId] ?? null;
}
`;

  await writeFile('src/audio/assetRegistry.generated.ts', tsContent);
  console.log('✓ Generated src/audio/assetRegistry.generated.ts');
}

if (process.argv[1] && process.argv[1].endsWith('generate-manifest.mjs')) {
  generateManifests()
    .then(() => console.log('✓ Manifest generation complete.'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
