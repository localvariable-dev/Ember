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
| Locale | Neutral clear English, `en-IN` friendly; avoid idioms and Western-only references |
| Speed | **0.88× – 0.90×** (passed to TTS as `speed`; if the engine ignores it, apply `atempo=0.90` in post) |
| Pause padding | Pauses are **room tone**, not digital silence: pink noise at about −56 dBFS, low-passed at 3.5 kHz, mixed under the *entire* voice track |
| Loudness | Integrated **−18 LUFS**, true peak ≤ **−1.5 dBTP**, LRA ≤ 7 LU |
| Lead-in | 1.0 s of room tone before the first word (so the first audio frame is never abrupt) |
| Rights | Use stock/included VoiceStudio voices or cloned voices **only from speakers who have provided written consent and explicit licensing**. Disclose synthetic AI narration in the store listing and in-app About view. |

**Writing rules for scripts:** second person, present tense, concrete relaxation words (jaw, shoulders, breath, palms), no medical or therapeutic claims ("cures", "treats", "heals insomnia"), no visual commands, maximum 14 words per spoken segment, silence during the final 90 s of Sleep outro (except the opening ≤ 25 s), no sudden startles ("Now!") — use "Gently…", "Whenever you're ready…".

**Spoken-word budget** (at ~0.90×, approx. 120–125 words per minute of speech):

| Protocol | Total | Speech share | Approx. words | Pauses/room tone |
|---|---|---|---|---|
| Rapid Reset 5 | 300 s | ~55 % | ~330 | ~135 s |
| Afternoon Recharge 10 | 600 s | ~45 % | ~560 | ~330 s |
| Deep Rest 30 | 1,800 s | ~30 % | ~1,050 | ~1,260 s |

---

### 6.3 Script Format & Session Structures

**Script JSON** (`tools/audio/scripts/<protocol>.script.json`). A script is a list of **blocks**. A block has one cue (drives the breathing orb and label) and either flows naturally (length = Σ clip + pauses) or is **anchored** (`durationMs` fixed; segments placed at `atMs` offsets). Anchored blocks guarantee that voice guidance and the visual breathing pacer stay in mathematical synchronization across every narrator.

```ts
interface Script {
  id: ProtocolId; targetMs: number;                  // exact output length incl. outro
  voice: { speed: number; profile: string };
  blocks: Block[];                                   // shared body (everything except the outro)
  outro?: { focus: Block[]; sleep: Block[]; durationMs: 90_000 };   // 10m & 30m protocols
}
interface Block {
  id: string;
  cue: { type: 'breath' | 'sigh' | 'body' | 'release' | 'silence' | 'outro'; label?: string; pattern?: Breath };
  durationMs?: number;                               // anchored if present
  segments: { text: string; atMs?: number; pauseAfterMs?: number }[];
}
```

**Builder timeline rules:** Clip start = block start + `atMs` (anchored) or previous clip end + `pauseAfterMs` (flow). A block's length is `durationMs` if anchored, else the sum. The build fails if content overruns the next anchor or `targetMs − 2 s`. Final trailing pad brings the output to exactly `targetMs`.

#### 6.3.1 Rapid Reset — 5:00 (free; one file; Focus-style ending)

| Block | Window | Cue | Purpose |
|---|---|---|---|
| Settle | 0:00–0:24 | body | Orient, close eyes, feel support |
| Sigh primer | 0:24–0:40 | body | Explain the physiological sigh (double inhale, long exhale) |
| Sigh 1 | 0:40–0:50 | **sigh** | Guided sigh (anchored 10 s) |
| Sigh 2 | 0:50–1:00 | **sigh** | Guided sigh (anchored 10 s) |
| Normalize | 1:00–1:08 | body | Let breath return |
| Upper-body release | 1:08–2:08 | **release** | Shoulders · jaw · hands · face · chest · belly |
| Slow breath | 2:08–3:18 | **breath 4/0/6/0** | Longer exhale; 7 cycles |
| Stillness | 3:18–4:10 | body | Notice the shift; quiet rest |
| Return | 4:10–5:00 | body | Deeper breath, fingers/toes, eyes open (final padding before chime) |

```json
{
  "id": "rapid_reset_5",
  "targetMs": 300000,
  "voice": { "speed": 0.9, "profile": "warm-calm-young-adult" },
  "blocks": [
    { "id": "settle", "cue": { "type": "body", "label": "Settle in" }, "durationMs": 24000, "segments": [
      { "text": "Welcome. For the next five minutes, there is nothing to figure out.", "atMs": 1000 },
      { "text": "Let your eyes close, or rest your gaze softly on one spot.", "atMs": 9000 },
      { "text": "Feel the weight of your body being held by whatever is beneath you.", "atMs": 16000 } ] },
    { "id": "sigh_primer", "cue": { "type": "body", "label": "The physiological sigh" }, "durationMs": 16000, "segments": [
      { "text": "We'll begin with two physiological sighs.", "atMs": 0 },
      { "text": "A double breath in through the nose, then a long, slow breath out through the mouth.", "atMs": 4500 } ] },
    { "id": "sigh_1", "cue": { "type": "sigh", "label": "Sigh" }, "durationMs": 10000, "segments": [
      { "text": "In through the nose.", "atMs": 0 }, { "text": "A little more.", "atMs": 2200 }, { "text": "Now out, long and slow.", "atMs": 3400 } ] },
    { "id": "sigh_2", "cue": { "type": "sigh", "label": "Sigh" }, "durationMs": 10000, "segments": [
      { "text": "Again. In through the nose.", "atMs": 0 }, { "text": "A little more.", "atMs": 2200 }, { "text": "And out, all the way.", "atMs": 3400 } ] },
    { "id": "normalize", "cue": { "type": "body", "label": "Let it return" }, "durationMs": 8000, "segments": [
      { "text": "Let your breathing return to normal.", "atMs": 0 }, { "text": "Notice how your body feels.", "atMs": 4500 } ] },
    { "id": "release", "cue": { "type": "release", "label": "Squeeze and drop" }, "durationMs": 60000, "segments": [
      { "text": "Now we'll release the upper body, quickly.", "atMs": 0 },
      { "text": "Lift your shoulders toward your ears. Squeeze. And drop.", "atMs": 5000 },
      { "text": "Clench your jaw. Hold. And let it go.", "atMs": 14000 },
      { "text": "Make fists. Tight. And open your hands.", "atMs": 23000 },
      { "text": "Scrunch your whole face. And soften.", "atMs": 32000 },
      { "text": "Draw your chest up and back. And release.", "atMs": 41000 },
      { "text": "Let your belly be soft.", "atMs": 50000 } ] },
    { "id": "slow_breath", "cue": { "type": "breath", "label": "In four, out six", "pattern": { "inhaleMs": 4000, "holdMs": 0, "exhaleMs": 6000, "hold2Ms": 0 } }, "durationMs": 70000, "segments": [
      { "text": "Now let the breath slow down.", "atMs": 0 },
      { "text": "In through the nose for four. And out for six.", "atMs": 6000 },
      { "text": "A longer breath out tells your body it is safe.", "atMs": 32000 },
      { "text": "Keep going, in your own time.", "atMs": 54000 } ] },
    { "id": "stillness", "cue": { "type": "body", "label": "Rest" }, "durationMs": 52000, "segments": [
      { "text": "Let go of counting.", "atMs": 0 },
      { "text": "Notice what has shifted: the jaw, the shoulders, the breath.", "atMs": 8000 },
      { "text": "There is nothing to do. Just rest.", "atMs": 26000 },
      { "text": "Stay here a little longer.", "atMs": 42000 } ] },
    { "id": "return", "cue": { "type": "body", "label": "Coming back" }, "segments": [
      { "text": "Take one deeper breath in.", "pauseAfterMs": 3500 },
      { "text": "And sigh it out.", "pauseAfterMs": 5000 },
      { "text": "Gently begin to move your fingers and toes.", "pauseAfterMs": 6000 },
      { "text": "Whenever you're ready, open your eyes.", "pauseAfterMs": 5000 },
      { "text": "Carry this steadiness with you.", "pauseAfterMs": 0 } ] }
  ]
}
```

#### 6.3.2 Afternoon Recharge — 10:00 (free; body 8:30 + 1:30 outro; Focus/Sleep variants)

| Block | Window | Cue | Content |
|---|---|---|---|
| Arrival & intent | 0:00–0:45 | body | "This is a recharge, not a sleep." Orient; simple intention |
| Breath slowing | 0:45–2:15 | breath 4/0/6/0 | 9 cycles, gentle guidance |
| Body scan | 2:15–7:15 | body | 12 regions × 25 s: feet · calves · thighs · hips · low back · belly · chest · hands/arms · shoulders · neck/jaw · eyes/face · scalp |
| Bright awareness | 7:15–8:30 | breath 5/0/5/0 | Body stays heavy, attention clears |
| **Outro (Focus)** | 8:30–10:00 | outro | Deepen breath, wiggle fingers/toes, stretch, eyes open. Last 10 s room tone; app triggers chime |
| **Outro (Sleep)** | 8:30–10:00 | outro | "Nothing more to do. Let yourself drift. You can sleep now." First ≤ 25 s spoken, rest room tone (ambient fades out over final 90 s) |

#### 6.3.3 Deep Rest & Yoga Nidra — 30:00 (PRO; body 28:30 + 1:30 outro; Focus/Sleep variants)

| Block | Window | Length | Cue | Content |
|---|---|---|---|---|
| Settle & Sankalpa | 0:00–2:30 | 150 s | body | Lie down, settle, state a short restorative intention three times |
| Breath awareness → long exhale | 2:30–5:30 | 180 s | breath 4/0/7/0 | Natural breath, then gradually lengthen the exhale |
| Rotation of awareness | 5:30–15:30 | 600 s | body | Systematic rotation across body points (~10 s per named region) |
| Breath counting backward | 15:30–19:30 | 240 s | breath 5/0/5/0 | Count 27 → 1 on exhales; "if you lose count, begin again, gently" |
| Opposites | 19:30–23:30 | 240 s | body | Heaviness/lightness, warmth/coolness, tension/ease — felt sensory awareness |
| Visualization | 23:30–27:00 | 210 s | body | Slow, calming imagery (a tranquil lake, an ember in a dark hearth), spacious pauses |
| Sankalpa & dissolve | 27:00–28:30 | 90 s | silence | Repeat intention, then ~75 s of near-silence |
| **Outro (Focus / Sleep)** | 28:30–30:00 | 90 s | outro | As in 10-min, scaled |

**Sum check:** 150 + 180 + 600 + 240 + 240 + 210 + 90 = **1,710 s** body; + 90 s outro = **1,800 s (30:00)**. 10-min check: 45 + 90 + 300 + 75 = **510 s** body; + 90 s = **600 s (10:00)**.

---

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

**`voices.config.json`:**

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

**`VoiceStudioAdapter.mjs`:**

```js
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

export class VoiceStudioAdapter {
  constructor(cfg, cacheDir = '.cache/tts') { this.cfg = cfg; this.cacheDir = cacheDir; }

  key(voiceId, text) {
    const v = this.cfg.voices[voiceId];
    return createHash('sha256').update(JSON.stringify([v.model, v.voice, v.speed, text])).digest('hex');
  }

  async synth(voiceId, text) {
    await mkdir(this.cacheDir, { recursive: true });
    const out = path.join(this.cacheDir, `${this.key(voiceId, text)}.wav`);
    try { await access(out); return out; } catch {}
    const v = this.cfg.voices[voiceId];
    const headers = { 'Content-Type': 'application/json' };
    const key = process.env[this.cfg.apiKeyEnv];
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(this.cfg.baseUrl + this.cfg.endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ model: v.model, input: text, voice: v.voice,
                             speed: v.speed, response_format: this.cfg.responseFormat }),
    });
    if (!res.ok) throw new Error(`TTS failed ${res.status}: ${await res.text()}`);
    await writeFile(out, Buffer.from(await res.arrayBuffer()));
    return out;
  }
}
```

**CLI Execution:**
```bash
# Build all bundled voices:
node tools/audio/build-audio.mjs --voice all --protocol all --variant all

# Build placeholders (for development/CI without VoiceStudio):
node tools/audio/make-placeholders.mjs
node tools/audio/make-beds.mjs
node tools/audio/make-chime.mjs

# Export standalone voice pack for external distribution:
node tools/audio/build-audio.mjs --voice arjun_deep --export-pack ./dist/arjun_deep.embervoice
```

---

### 6.5 ffmpeg Mastering & Encoding Recipes

Requires ffmpeg ≥ 6 (`amix=normalize=0` required).

```bash
# 3) Normalize one clip (preserves breath onsets via start_silence=0.05; adds 10ms/20ms edge fades)
ffmpeg -y -i seg.wav -ar 48000 -ac 1 -af \
 "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,afade=t=in:d=0.01,areverse,afade=t=in:d=0.02,areverse" \
 seg_n.wav

# 5a) Room tone bed for the full duration (D = seconds)
ffmpeg -y -f lavfi -i "anoisesrc=d=D:c=pink:r=48000:a=0.0015" -af "highpass=f=80,lowpass=f=3500" -ac 1 room.wav

# 5b) Place clips and mix with room tone (duration=first matches room.wav length D exactly)
ffmpeg -y -i room.wav -i c1.wav -i c2.wav ... \
 -filter_complex "[1]adelay=1000[a1];[2]adelay=9000[a2];...;[0][a1][a2]...amix=inputs=N:normalize=0:duration=first[m]" \
 -map "[m]" -ar 48000 -ac 1 -t D mix.wav

# 6a) Two-pass loudnorm (Pass 1: measure)
ffmpeg -i mix.wav -af loudnorm=I=-18:TP=-1.5:LRA=7:print_format=json -f null -

# 6b) Pass 2 (apply measured parameters) and encode to Opus
ffmpeg -y -i mix.wav -af "loudnorm=I=-18:TP=-1.5:LRA=7:measured_I=..:measured_TP=..:measured_LRA=..:measured_thresh=..:offset=..:linear=true,apad=whole_dur=D" \
 -t D -ar 48000 -ac 1 -c:a libopus -b:a 32k -vbr on -application audio out.ogg
```

**Asset budgets (CI-enforced by `verify-assets.mjs`):**

| Asset | Format | Spec | Budget |
|---|---|---|---|
| `rapid_reset_5.ogg` (per voice) | Opus mono 32 kbps | 300 s | ≤ 1.4 MB |
| `afternoon_recharge_10.{focus,sleep}.ogg` (per voice) | Opus mono 32 kbps | 600 s each | ≤ 2.6 MB each |
| `deep_rest_30.{focus,sleep}.ogg` (per voice) | Opus mono 32 kbps | 1,800 s each | ≤ 7.6 MB each |
| Beds `rain`, `brown_noise`, `ocean_drift`, `night_forest` | Opus stereo 96 kbps | 45–60 s seamless loops | ≤ 0.8 MB each |
| Beds `theta_6hz`, `delta_2hz` | **FLAC**, 22.05 kHz stereo | **24 s** phase-exact loop | ≤ 3.5 MB each |
| `chime_rise.wav` | PCM 16-bit mono 44.1 kHz | 3.2 s | ≤ 0.3 MB |
| **Total audio bundled in APK** | | | **≤ 42 MB** |

---

### 6.6 Ambient Bed Construction (Track B assets)

- **Seamless noise loops:** Built with an **equal-power crossfade** over 2 seconds (`L = 45 s`): `loop = crossfade(tail = raw[L−2..L], head = raw[0..2]) + raw[2..L−2]`. This guarantees zero boundary pop.
- **Phase-exact binaural loops:** A crossfade would create acoustic cancellations. Binaural beds use an **exact integer number of cycles over 24.0 s**:
  - **Theta 6 Hz (24 s):** Left carrier 200 Hz (4,800 cycles), Right carrier 206 Hz (4,944 cycles), octave pair 100/103 Hz at −6 dB (2,400 / 2,472 cycles), slow swell at 0.125 Hz (3 cycles).
  - **Delta 2 Hz (24 s):** Left carrier 150 Hz (3,600 cycles), Right carrier 152 Hz (3,648 cycles).
  - **Codec:** Stored as lossless **FLAC** to preserve subtle interaural phase timing.
- **Mix level:** Mastered to **−26 LUFS** integrated (−8 LUFS below voice). At default slider 0.50, the bed sits ~14 dB beneath narration.

---

### 6.7 Runtime: Dual-Track Playback Engine (`src/audio/`)

**Architecture:** Voice is the master clock; ambient audio is the slave. JS timers are never used for playback tracking. Seeking or pausing voice freezes progress and orb animations automatically.

```ts
// src/audio/AudioDriver.ts
export type AudioSource = number | { uri: string }; // number for static require(), uri for downloaded/imported packs

export interface PlayerStatus {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  didJustFinish: boolean;
}

export interface PlayerHandle {
  play(): void;
  pause(): void;
  setVolume(v: number): void;
  setLoop(loop: boolean): void;
  seekTo(ms: number): Promise<void>;
  onStatus(cb: (s: PlayerStatus) => void): () => void;
  setLockScreen(active: boolean, meta?: { title: string; subtitle: string; artworkUri?: string }): void;
  release(): void;
}

export interface AudioDriver {
  configureSession(): Promise<void>;
  createPlayer(source: AudioSource): PlayerHandle;
}
```

```ts
// src/audio/DualTrackEngine.ts
export interface PrepareOpts {
  voiceSource: AudioSource;
  voiceId: string;
  bedSource: AudioSource | null;
  mode: Mode;
  plannedMs: number;
  voiceVolume: number;
  ambientVolume: number;
}

export type EngineEvent =
  | { type: 'position'; positionMs: number; durationMs: number }
  | { type: 'ended' }
  | { type: 'interrupted'; transient: boolean }
  | { type: 'resumed' }
  | { type: 'voice_switched'; voiceId: string }
  | { type: 'voice_switch_failed'; voiceId: string; error: string };

export class DualTrackEngine {
  constructor(private driver: AudioDriver, private clock: Clock) {}

  async prepare(opts: PrepareOpts): Promise<void>;
  start(): void;
  pause(): void;
  resume(): void;
  setVoiceVolume(v: number): void;
  setAmbientVolume(v: number): void;
  switchBed(newBedSource: AudioSource | null): Promise<void>;
  switchVoice(newVoiceSource: AudioSource, newVoiceId: string): Promise<void>;
  on(cb: (e: EngineEvent) => void): () => void;
  dispose(): void;
}
```

---

### 6.8 In-Flight Narrator Switching Architecture (Mandatory Requirement)

Users can change narrators from the VoiceChip (`[ Maya ]` / `[ Arjun ]`) during active playback without restarting the session or desynchronizing cues.

```
       Current Voice Player (playing @ positionMs T)
       ─────────────────────┐
                            ├─── 1,500ms Equal-Power Crossfade ───► New Active Voice Player
       ─────────────────────┘                                      (started @ identical positionMs T)
       Incoming Voice Player (pre-loaded & sought to T)
```

**Step-by-Step Execution Protocol:**
1. **Request:** The UI calls `DualTrackEngine.switchVoice(newVoiceSource, newVoiceId)`.
2. **Asynchronous Pre-loading:**
   - The engine instantiates a secondary voice handle via `driver.createPlayer(newVoiceSource)`.
   - If loading fails (e.g. missing asset or disk read error), the engine catches the exception, logs it, emits `{ type: 'voice_switch_failed', voiceId: newVoiceId, error: err.message }`, and leaves the current narrator playing without any audible blip.
3. **Timeline Alignment:**
   - The incoming player seeks directly to the current `positionMs` of the playing voice track: `await newPlayer.seekTo(currentPositionMs)`.
   - Because all voice assets for a given protocol adhere to the exact same anchored blocks (§6.3), cue synchronization is preserved down to the millisecond.
4. **Controlled Crossfade:**
   - The incoming player starts at volume 0: `newPlayer.setVolume(0)`.
   - `newPlayer.play()`.
   - Over 1,500 ms (or timed to the nearest phrase boundary gap if within 2 s), volume ramps smoothly:
     $$\text{gain}_{\text{old}} = \cos\left(\frac{\pi}{2} \cdot t\right) \cdot V_{\text{user}}^2$$
     $$\text{gain}_{\text{new}} = \sin\left(\frac{\pi}{2} \cdot t\right) \cdot V_{\text{user}}^2$$
5. **Handoff & Cleanup:**
   - Once crossfade completes, the old voice player is paused and `release()`ed.
   - The new voice player is assigned as the master timeline clock.
   - Engine emits `{ type: 'voice_switched', voiceId: newVoiceId }`.
   - `SessionController` updates the active `session_logs.voice_id` and `user_preferences.selected_voice_id`.

---

### 6.9 Android Background Playback, Wake Lock & Lock-Screen Controls

| Requirement | Implementation |
|---|---|
| Screen-off / Background playback | Foreground service with `FOREGROUND_SERVICE_MEDIA_PLAYBACK` + `WAKE_LOCK`. Configured via `AudioDriver.configureSession()`. |
| Lock-screen media controls | Standard Android media notification: protocol title, "Focus mode" / "Sleep mode" subtitle, amber artwork, play/pause action. Seek bar and track-skip buttons are intentionally disabled. |
| Audio-focus interruptions | Incoming phone call or navigation prompt pauses audio. If transient (< 60 s), audio automatically resumes when focus returns. Permanent loss stops playback cleanly. |
| Audio Becoming Noisy | Unplugging wired headphones or disconnecting Bluetooth triggers immediate pause to avoid accidental speaker blasting in quiet rooms. |
| Sleep Mode 85% Auto-Commit | When `positionMs >= 0.85 * plannedMs`, streak credit commits silently in SQLite. Screen remains dim; no alarm/chime sounds. |
| Final 90-second Sleep Fade | In Sleep mode, ambient volume attenuates over the final 90 seconds using a pause-safe cubic curve: $\text{fade} = \left(\frac{\text{remaining}}{90000}\right)^3$. Derived directly from `positionMs`. |
| Focus Mode Chime | At natural voice outro finish, engine plays `chime_rise.wav` (3.2 s rising harmonic chime) at −20 LUFS + haptic pulse (§2.1.4), fading ambient over 6 s. |

---

### 6.10 Plan B: Native Dual-Player Module (`modules/ember-audio`)

If device testing reveals that `expo-audio` suffers from audio-focus contention between Track A and Track B on specific OEM Android builds, execute **Plan B (Phase 4b)**.

**Plan B Gate Criteria (M1–M8 tested on physical devices):**
- **M1:** Voice + ambient play simultaneously without ducking.
- **M2:** Lock screen for 5 min; playback continues cleanly.
- **M3:** Pause/resume from lock-screen notification works in sync.
- **M4:** Incoming call pauses audio; clears on hangup.
- **M5:** Headphone disconnect immediately pauses.
- **M6:** Independent real-time volume sliders without zipper noise.
- **M7:** 24-min Sleep run screen-off: 85% auto-commit succeeds, 90s fade completes.
- **M8:** Ambient loops seamlessly without clicks or phase jumps.

**Native Architecture (`modules/ember-audio` in Kotlin):**
- Hosts two `androidx.media3` ExoPlayer instances in a single `MediaSessionService`.
- Voice player: `handleAudioFocus = true`, owns `MediaSession`.
- Ambient player: `handleAudioFocus = false`, `REPEAT_MODE_ALL`, native volume ramping.
- JS surface implements the identical `AudioDriver` and `PlayerHandle` interfaces, enabled via `EXPO_PUBLIC_AUDIO_DRIVER=native`.

---

### 6.11 Audio QA Checklist (Pre-Release)

- Voice clarity on budget phone speakers and earbuds.
- Zero audible clipping, digital clicks, or compression pumping.
- Natural room-tone pause length (never feels like an app crash).
- Outro in Sleep mode is completely soothing; Focus chime is gentle at 30% volume.
- Ambient loops are seamless on headphones across 3 consecutive cycles.
- In-flight narrator switching between Maya and Arjun operates without stutters or duplicated speech.
- Battery drain during 30-min screen-off Sleep session is ≤ 3%.
- Synthetic narration disclosure clearly stated in store listing and About section.
