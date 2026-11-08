---

## 6. Audio Pipeline & Dual-Layer Playback Spec (Multi-Voice Support)

### 6.1 End-to-End Overview

```
 authoring (human)           offline generation (dev machine)                     app (runtime)
┌────────────────┐   ┌──────────────────────────────────────────────┐   ┌────────────────────────────────┐
│ scripts/*.json │──►│ VoiceStudio (local, OpenAI-style audio API)   │   │ assetRegistry.generated.ts     │
│ blocks+timing  │   │   └─ per-segment TTS, speed 0.90, cached     │   │ protocols.generated.json (cues)│
└────────────────┘   │ ffmpeg: trim → place on timeline → room tone │──►│ DualTrackEngine                │
                     │   → loudnorm → Opus/OGG (voice) | FLAC (theta)│   │  Track A: voice (master clock) │
 beds: synthesized /  │ cue timeline from MEASURED clip lengths      │   │  Track B: ambient loop (slave) │
 CC0-licensed loops ─►│ verify: duration ±50 ms, LUFS, peaks, sizes  │   │ Voice Pack Importer (.embervoice)│
                     └──────────────────────────────────────────────┘   └────────────────────────────────┘
        CI never runs VoiceStudio. Generated audio is committed; CI only checks that assets exist, match SHA-256, and fit size budgets.
```

### 6.2 Narrator Profile & Authoring Rules

| Parameter | Value |
|---|---|
| Voice character | Warm, young-adult, calm; low-mid pitch; unhurried; no theatrical whisper, no ASMR breathiness |
| Locale (hypothesis to confirm among available voices) | Neutral clear English, `en-IN` friendly; avoid idioms and Western-only references |
| Speed | **0.90×** (passed to TTS as `speed`; if the engine ignores it, apply `atempo=0.90` in post) |
| Pause padding | Pauses are **room tone**, not digital silence: pink noise at about −56 dBFS, low-passed at 3.5 kHz, mixed under the *entire* voice track |
| Loudness | Integrated **−18 LUFS**, true peak ≤ **−1.5 dBTP**, LRA ≤ 7 LU |
| Lead-in | 1.0 s of room tone before the first word (so the first audio frame is never abrupt) |
| Rights | Use a stock/included VoiceStudio voice, or a voice clone **only from a speaker who has given written consent and a license**. Never clone a real person without consent. Disclose synthetic narration in the store listing and in-app About. |

### 6.3 Script Format & Session Structures

**Script JSON** (`tools/audio/scripts/<protocol>.script.json`). A script is a list of **blocks**. A block has one cue (drives the orb/label) and either flows naturally (length = Σ clip + pauses) or is **anchored** (`durationMs` fixed; segments placed at `atMs` offsets). Anchored blocks guarantee that voice and orb stay in lock-step for breath/sigh work.

### 6.4 Offline Generation Pipeline & Multi-Voice Config (`tools/audio/`)

```
tools/audio/
  voices.config.json              # multi-voice metadata (Maya, Arjun, etc.)
  tts/TtsAdapter.mjs              # interface (JSDoc) + factory
  tts/VoiceStudioAdapter.mjs      # OpenAI-style /v1/audio/speech client with hash cache
  scripts/*.script.json           # 3 scripts (+ outro blocks)
  build-audio.mjs                 # orchestrator CLI (--voice <id>, --export-pack)
  lib/timeline.mjs                # block → clip placement → cues (pure, unit-tested)
  lib/ffmpeg.mjs                  # command builders (pure string builders, unit-tested)
  make-placeholders.mjs           # pure-Node WAV generator, ÷60 duration; no ffmpeg/VoiceStudio needed
  make-beds.mjs                   # synthesizes brown/theta/delta beds; loop-crossfade helper
  make-chime.mjs                  # pure-Node rising harmonic chime WAV
  verify-assets.mjs               # existence, SHA-256, sizes, JSON schema (runs in CI without ffmpeg)
```

**`voices.config.json`**:
```json
{
  "baseUrl": "http://127.0.0.1:8000",
  "endpoint": "/v1/audio/speech",
  "responseFormat": "wav",
  "apiKeyEnv": "VOICESTUDIO_API_KEY",
  "voices": {
    "maya_warm": {
      "name": "Maya",
      "subtitle": "Warm & unhurried · en-IN",
      "locale": "en-IN",
      "tier": "free",
      "delivery": "bundled",
      "model": "tts-1-hd",
      "voice": "maya_v1",
      "speed": 0.90
    },
    "arjun_deep": {
      "name": "Arjun",
      "subtitle": "Deep & steady evening voice · en-IN",
      "locale": "en-IN",
      "tier": "pro",
      "delivery": "bundled",
      "model": "tts-1-hd",
      "voice": "arjun_v1",
      "speed": 0.88
    }
  }
}
```

**CLI Usage for Multi-Voice Generation & Export:**
```bash
# Build all bundled voices:
node tools/audio/build-audio.mjs --voice all --protocol all --variant all

# Package a newly generated voice into a distributable .embervoice zip pack:
node tools/audio/build-audio.mjs --voice arjun_deep --export-pack ./dist/arjun_deep.embervoice
```

### 6.5 ffmpeg Mastering & Encoding Recipes

Requires ffmpeg ≥ 6 (`amix=normalize=0` is required).

```bash
# 3) Normalize one clip (leading/trailing trim with start_silence=0.05 to preserve breath onsets; add edge fades)
ffmpeg -y -i seg.wav -ar 48000 -ac 1 -af \
 "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,afade=t=in:d=0.01,areverse,afade=t=in:d=0.02,areverse" \
 seg_n.wav

# 5a) Room tone for the full duration (D = seconds)
ffmpeg -y -f lavfi -i "anoisesrc=d=D:c=pink:r=48000:a=0.0015" -af "highpass=f=80,lowpass=f=3500" -ac 1 room.wav

# 5b) Place clips (offsets in ms from timeline.mjs) and mix with room tone (duration=first matches room.wav length D)
ffmpeg -y -i room.wav -i c1.wav -i c2.wav ... \
 -filter_complex "[1]adelay=1000[a1];[2]adelay=9000[a2];...;[0][a1][a2]...amix=inputs=N:normalize=0:duration=first[m]" \
 -map "[m]" -ar 48000 -ac 1 -t D mix.wav

# 6a) Loudnorm pass 1 (measure)
ffmpeg -i mix.wav -af loudnorm=I=-18:TP=-1.5:LRA=7:print_format=json -f null -
# 6b) Pass 2 (apply measured parameters), then encode
ffmpeg -y -i mix.wav -af "loudnorm=I=-18:TP=-1.5:LRA=7:measured_I=..:measured_TP=..:measured_LRA=..:measured_thresh=..:offset=..:linear=true,apad=whole_dur=D" \
 -t D -ar 48000 -ac 1 -c:a libopus -b:a 32k -vbr on -application audio out.ogg
```

**Asset budgets (CI-enforced by `verify-assets.mjs`):**

| Asset | Format | Spec | Budget |
|---|---|---|---|
| `rapid_reset_5.ogg` | Opus mono 32 kbps | 300 s | ≤ 1.4 MB |
| `afternoon_recharge_10.{focus,sleep}.ogg` | Opus mono 32 kbps | 600 s each | ≤ 2.6 MB each |
| `deep_rest_30.{focus,sleep}.ogg` | Opus mono 32 kbps | 1,800 s each | ≤ 7.6 MB each |
| Beds `rain`, `brown_noise`, `ocean_drift`, `night_forest` | Opus stereo 96 kbps | 45–60 s seamless loops | ≤ 0.8 MB each |
| Beds `theta_6hz`, `delta_2hz` | **FLAC**, 22.05 kHz stereo | **24 s** phase-exact loop | ≤ 3.5 MB each |
| `chime_rise.wav` | PCM 16-bit mono 44.1 kHz | 3.2 s | ≤ 0.3 MB |
| **Total audio in APK** | | | **≤ 40 MB** |

### 6.6 Ambient Bed Construction (Track B assets)

- **Seamless loop rule.** Noise-like beds are built from `L + X` seconds of source (X = 2 s) with an **equal-power crossfade**: `loop = crossfade(tail = raw[L−X..L] fading out, head = raw[0..X] fading in) + raw[X..L−X]`. This makes the loop end continuous with its own beginning (`make-beds.mjs --crossfadeMs 2000`).
- **Binaural beds must be phase-exact by construction** (a crossfade would destroy the beat): choose a loop length where every component has an integer number of cycles. Theta 6 Hz: **24 s**, left carrier 200 Hz (4,800 cycles), right carrier 206 Hz (4,944 cycles); add a warm octave pair 100/103 Hz (2,400 / 2,472 cycles) at −6 dB and a slow amplitude swell at 0.125 Hz (3 cycles). Delta 2 Hz: **24 s**, 150 Hz (3,600) / 152 Hz (3,648). Lossless FLAC preserves interaural phase; lossy codecs may not.
- **Levels:** beds mastered to **−26 LUFS** integrated (voice is −18); default ambient slider 0.50 → ≈ −6 dB further, so the bed sits ~14 dB under the voice.

### 6.7 Runtime: Dual-Track Playback Engine & Voice Pack Importer (`src/audio/`)

```ts
export type AudioSource = number | { uri: string };

export interface AudioDriver {
  configureSession(): Promise<void>;
  createPlayer(source: AudioSource): PlayerHandle;
}
```

**Voice Pack Importer (`src/audio/VoicePackService.ts`):**
Users can import `.embervoice` files from local storage (e.g. shared via email or downloaded from a web link). `VoicePackService.importPack(uri)` extracts the zip to `FileSystem.documentDirectory + 'voices/<voiceId>/'`, validates checksums, upserts into the SQLite `voices` and `protocol_voice_tracks` tables, and makes the voice instantly selectable in the UI without an app update.