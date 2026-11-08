---

## 5. Data Models & Local Database Schema

### 5.1 Conventions

- Engine: **SQLite via `expo-sqlite`** (synchronous API: `openDatabaseSync`, `execSync`, `runSync`, `getAllSync`, `getFirstSync`, `withTransactionSync`). DB file `ember.db`. `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;` at open.
- Timestamps: UTC epoch **milliseconds** as `INTEGER`. Day keys: local `TEXT 'YYYY-MM-DD'`.
- `tz_offset_min` = **minutes east of UTC** at event time (`-new Date().getTimezoneOffset()`; IST = `330`).
- IDs: `TEXT` UUID v4 (`expo-crypto` `randomUUID()`), except fixed IDs for protocols/beds/voices.
- Migrations: `PRAGMA user_version` + ordered array of SQL strings applied inside one transaction each. **Never edit a shipped migration; add a new one.**
- A thin `Db` interface (`exec`, `run`, `all<T>`, `first<T>`, `tx<T>(fn)`) abstracts `expo-sqlite`; unit tests use a `better-sqlite3`-backed implementation so SQL is tested in Node/CI.

### 5.2 DDL — Migration 1 (`src/data/migrations.ts`)

```sql
-- AudioProtocols: seeded from bundled protocols.generated.json (upsert by id + asset_version)
CREATE TABLE audio_protocols (
  id                    TEXT PRIMARY KEY,                       -- 'rapid_reset_5' | 'afternoon_recharge_10' | 'deep_rest_30'
  title                 TEXT NOT NULL,
  subtitle              TEXT NOT NULL,
  minutes               INTEGER NOT NULL,
  planned_ms            INTEGER NOT NULL,
  tier                  TEXT NOT NULL CHECK (tier IN ('free','pro')),
  supports_modes        INTEGER NOT NULL CHECK (supports_modes IN (0,1)),
  sigh_in_script        INTEGER NOT NULL DEFAULT 0 CHECK (sigh_in_script IN (0,1)),
  asset_version         INTEGER NOT NULL,
  sort_order            INTEGER NOT NULL
);

-- Voice Catalog: seeded from voices.generated.json + user-imported packs
CREATE TABLE voices (
  id                    TEXT PRIMARY KEY,                       -- e.g. 'maya_warm', 'arjun_deep', 'kiran_soft'
  name                  TEXT NOT NULL,                          -- 'Maya', 'Arjun'
  subtitle              TEXT NOT NULL,                          -- 'Warm & grounded · en-IN'
  locale                TEXT NOT NULL DEFAULT 'en-IN',
  tier                  TEXT NOT NULL CHECK (tier IN ('free','pro')),
  delivery              TEXT NOT NULL CHECK (delivery IN ('bundled','download','imported')),
  status                TEXT NOT NULL CHECK (status IN ('installed','available','downloading')),
  preview_asset_key     TEXT,                                   -- bundled require() key or file:// URI
  pack_size_bytes       INTEGER,
  remote_pack_url       TEXT,                                   -- optional static URL for downloadable packs
  sort_order            INTEGER NOT NULL DEFAULT 0
);

-- Per-(Protocol, Voice) Audio & Measured Cue Timelines
CREATE TABLE protocol_voice_tracks (
  protocol_id           TEXT NOT NULL REFERENCES audio_protocols(id) ON DELETE CASCADE,
  voice_id              TEXT NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
  voice_focus_source    TEXT NOT NULL,                          -- assetRegistry key OR 'file:///...' URI
  voice_sleep_source    TEXT,                                   -- NULL when supports_modes = 0
  voice_focus_sha256    TEXT,
  voice_sleep_sha256    TEXT,
  cues_focus_json       TEXT NOT NULL,                          -- Cue[] measured specifically for this voice
  cues_sleep_json       TEXT,
  asset_version         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (protocol_id, voice_id)
);

CREATE TABLE ambient_beds (
  id                    TEXT PRIMARY KEY,                       -- 'rain','brown_noise','theta_6hz','ocean_drift','night_forest','delta_2hz'
  title                 TEXT NOT NULL,
  tier                  TEXT NOT NULL CHECK (tier IN ('free','pro')),
  asset_key             TEXT NOT NULL,
  loop_ms               INTEGER NOT NULL,
  is_binaural           INTEGER NOT NULL DEFAULT 0 CHECK (is_binaural IN (0,1)),
  sort_order            INTEGER NOT NULL
);

CREATE TABLE session_logs (
  id                    TEXT PRIMARY KEY,
  protocol_id           TEXT NOT NULL REFERENCES audio_protocols(id),
  voice_id              TEXT NOT NULL DEFAULT 'maya_warm' REFERENCES voices(id),
  mode                  TEXT NOT NULL CHECK (mode IN ('focus','sleep')),
  ambient_bed_id        TEXT REFERENCES ambient_beds(id),       -- NULL = Off
  sigh_pacer            INTEGER NOT NULL DEFAULT 0 CHECK (sigh_pacer IN (0,1)),
  access_via            TEXT NOT NULL CHECK (access_via IN ('free','pro','free_pass')),
  started_at_ms         INTEGER NOT NULL,
  ended_at_ms           INTEGER,
  local_day             TEXT NOT NULL,                          -- credit day = local date of started_at (R1)
  tz_offset_min         INTEGER NOT NULL,
  planned_ms            INTEGER NOT NULL,
  listened_ms           INTEGER NOT NULL DEFAULT 0,
  max_position_ms       INTEGER NOT NULL DEFAULT 0,
  heartbeat_at_ms       INTEGER,
  status                TEXT NOT NULL CHECK (status IN ('in_progress','completed','partial','abandoned')),
  committed_at_ms       INTEGER,
  commit_reason         TEXT CHECK (commit_reason IN ('natural_end','focus_threshold','sleep_auto_commit','sleep_reconcile')),
  pre_state             INTEGER CHECK (pre_state  BETWEEN 1 AND 5),
  post_state            INTEGER CHECK (post_state BETWEEN 1 AND 5),
  created_at_ms         INTEGER NOT NULL
);
CREATE INDEX idx_sessions_day        ON session_logs(local_day);
CREATE INDEX idx_sessions_status     ON session_logs(status);
CREATE INDEX idx_sessions_proto_stat ON session_logs(protocol_id, status);
CREATE INDEX idx_sessions_started    ON session_logs(started_at_ms DESC);

-- Derived/cached per-day ledger (heatmap + grace-covered days). Rebuildable from session_logs + streak events.
CREATE TABLE day_ledger (
  local_day             TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL CHECK (kind IN ('practice','grace')),
  committed_ms          INTEGER NOT NULL DEFAULT 0,
  sessions              INTEGER NOT NULL DEFAULT 0
);

-- StreakState: exactly one row
CREATE TABLE streak_state (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  current_streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak        INTEGER NOT NULL DEFAULT 0,
  last_credit_day       TEXT,
  grace_banked          INTEGER NOT NULL DEFAULT 0 CHECK (grace_banked BETWEEN 0 AND 2),
  grace_progress        INTEGER NOT NULL DEFAULT 0 CHECK (grace_progress BETWEEN 0 AND 5),
  grace_earned_total    INTEGER NOT NULL DEFAULT 0,
  grace_used_total      INTEGER NOT NULL DEFAULT 0,
  updated_at_ms         INTEGER NOT NULL
);
INSERT INTO streak_state (id, updated_at_ms) VALUES (1, 0);

-- UserEntitlements: provider rows + free_pass rows
CREATE TABLE user_entitlements (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL CHECK (kind IN ('subscription','lifetime','free_pass')),
  source                TEXT NOT NULL CHECK (source IN ('mock','google_play','razorpay','app')),
  product_id            TEXT,                                   -- 'ember_pro_monthly' | 'ember_pro_lifetime' | NULL for passes
  status                TEXT NOT NULL CHECK (status IN ('active','expired','revoked','available','consumed')),
  granted_at_ms         INTEGER NOT NULL,
  expires_at_ms         INTEGER,                                -- NULL for lifetime
  consumed_at_ms        INTEGER,
  consumed_session_id   TEXT,
  order_id              TEXT,
  purchase_token        TEXT,
  last_verified_at_ms   INTEGER,
  meta_json             TEXT
);
CREATE INDEX idx_ent_kind_status ON user_entitlements(kind, status);

-- UserPreferences: exactly one row
CREATE TABLE user_preferences (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  ambient_bed_id        TEXT,                                   -- NULL = Off
  selected_voice_id     TEXT NOT NULL DEFAULT 'maya_warm' REFERENCES voices(id),
  voice_volume          REAL    NOT NULL DEFAULT 0.90 CHECK (voice_volume   BETWEEN 0 AND 1),
  ambient_volume        REAL    NOT NULL DEFAULT 0.50 CHECK (ambient_volume BETWEEN 0 AND 1),
  last_mode             TEXT    NOT NULL DEFAULT 'focus' CHECK (last_mode IN ('focus','sleep')),
  mode_chosen_once      INTEGER NOT NULL DEFAULT 0,
  sigh_pacer_default    INTEGER NOT NULL DEFAULT 0,
  haptics_enabled       INTEGER NOT NULL DEFAULT 1,
  breath_haptics        INTEGER NOT NULL DEFAULT 0,
  show_cues             INTEGER NOT NULL DEFAULT 1,
  reduce_motion         TEXT    NOT NULL DEFAULT 'system' CHECK (reduce_motion IN ('system','on','off')),
  notifications_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_min          INTEGER,                                -- minutes since midnight; NULL = learned
  notif_prompt_shown    INTEGER NOT NULL DEFAULT 0,
  lapsed_sent_count     INTEGER NOT NULL DEFAULT 0,
  last_open_at_ms       INTEGER,
  first_launch_at_ms    INTEGER,
  theta_hint_shown      INTEGER NOT NULL DEFAULT 0,
  first_run_cue_shown   INTEGER NOT NULL DEFAULT 0,
  review_prompted       INTEGER NOT NULL DEFAULT 0,
  updated_at_ms         INTEGER NOT NULL
);
INSERT INTO user_preferences (id, updated_at_ms) VALUES (1, 0);
```

### 5.3 TypeScript Models (`src/data/types.ts`)

```ts
export type Mode = 'focus' | 'sleep';
export type Tier = 'free' | 'pro';
export type SessionStatus = 'in_progress' | 'completed' | 'partial' | 'abandoned';
export type CommitReason = 'natural_end' | 'focus_threshold' | 'sleep_auto_commit' | 'sleep_reconcile';
export type AccessVia = 'free' | 'pro' | 'free_pass';
export type RecoveryState = 1 | 2 | 3 | 4 | 5;

export interface AudioProtocol {
  id: ProtocolId; title: string; subtitle: string; minutes: 5 | 10 | 30; plannedMs: number; tier: Tier;
  supportsModes: boolean; sighInScript: boolean; assetVersion: number; sortOrder: number;
}
export interface Voice {
  id: string; name: string; subtitle: string; locale: string; tier: Tier;
  delivery: 'bundled' | 'download' | 'imported'; status: 'installed' | 'available' | 'downloading';
  previewAssetKey: string | null; packSizeBytes: number | null; remotePackUrl: string | null; sortOrder: number;
}
export interface ProtocolVoiceTrack {
  protocolId: ProtocolId; voiceId: string; voiceFocusSource: string; voiceSleepSource: string | null;
  voiceFocusSha256?: string; voiceSleepSha256?: string | null;
  cuesFocus: Cue[]; cuesSleep: Cue[] | null; assetVersion: number;
}
export interface AmbientBed { id: string; title: string; tier: Tier; assetKey: string; loopMs: number; isBinaural: boolean; sortOrder: number }

export interface SessionLog {
  id: string; protocolId: ProtocolId; voiceId: string; mode: Mode; ambientBedId: string | null; sighPacer: boolean; accessVia: AccessVia;
  startedAtMs: number; endedAtMs: number | null; localDay: string; tzOffsetMin: number;
  plannedMs: number; listenedMs: number; maxPositionMs: number; heartbeatAtMs: number | null;
  status: SessionStatus; committedAtMs: number | null; commitReason: CommitReason | null;
  preState: RecoveryState | null; postState: RecoveryState | null; createdAtMs: number;
}
export interface DayLedgerRow { localDay: string; kind: 'practice' | 'grace'; committedMs: number; sessions: number }

export type EntitlementKind = 'subscription' | 'lifetime' | 'free_pass';
export interface UserEntitlement {
  id: string; kind: EntitlementKind; source: 'mock' | 'google_play' | 'razorpay' | 'app';
  productId: ProductId | null; status: 'active' | 'expired' | 'revoked' | 'available' | 'consumed';
  grantedAtMs: number; expiresAtMs: number | null; consumedAtMs: number | null; consumedSessionId: string | null;
  orderId: string | null; purchaseToken: string | null; lastVerifiedAtMs: number | null; metaJson: string | null;
}

export interface UserPreferences {
  ambientBedId: string | null; selectedVoiceId: string; voiceVolume: number; ambientVolume: number; lastMode: Mode; modeChosenOnce: boolean;
  sighPacerDefault: boolean; hapticsEnabled: boolean; breathHaptics: boolean; showCues: boolean;
  reduceMotion: 'system' | 'on' | 'off'; notificationsEnabled: boolean; reminderMin: number | null;
  notifPromptShown: boolean; lapsedSentCount: number; lastOpenAtMs: number | null; firstLaunchAtMs: number | null;
  thetaHintShown: boolean; firstRunCueShown: boolean; reviewPrompted: boolean;
}
```

Repositories (`src/data/repos/*.ts`), each taking a `Db`: `SessionRepo` (`create`, `heartbeat`, `commit`, `finalize`, `listRecent`, `listAll`, `setPre`, `setPost`, `findInProgress`), `StreakRepo` (`get`, `save`), `LedgerRepo` (`range`, `upsertPractice`, `markGrace`), `EntitlementRepo` (`all`, `upsert`, `replaceProviderRows`, `countPassesGranted`), `PrefsRepo` (`get`, `patch`), `ProtocolRepo` (`all`, `get`, `seed`), `VoiceRepo` (`all`, `install`, `importPack`).

### 5.4 Audio Protocol Seed & Cue Schema

```ts
export type Breath = { inhaleMs: number; holdMs: number; exhaleMs: number; hold2Ms: number };
export type Cue =
  | { type: 'breath';  startMs: number; endMs: number; label: string; pattern: Breath }          // repeats until endMs
  | { type: 'sigh';    startMs: number; endMs: number; label: string }                           // double inhale + long exhale (2.0/0.2/1.2/6.0/0.6 s)
  | { type: 'body';    startMs: number; endMs: number; label: string }                           // orb holds 0.7, slow shimmer
  | { type: 'release'; startMs: number; endMs: number; label: string }                           // fast contract (squeeze & drop)
  | { type: 'silence'; startMs: number; endMs: number; label?: string }
  | { type: 'outro';   startMs: number; endMs: number; label?: string };
```

Seed file `src/audio/protocols.generated.json` is **machine-produced** by the audio pipeline (§6.4) — never hand-edited — and contains for each protocol and voice: durations, SHA-256 of each asset, and the cue arrays computed from *measured* clip lengths. App startup upserts rows where `asset_version` is newer. Ambient beds and voices are declared in `src/audio/voices.generated.json` and `src/audio/beds.ts` (static) and seeded by the same upsert.

### 5.5 Query Library (`src/data/queries.ts`)

```sql
-- Heatmap + ledger window (30 local days)
SELECT local_day, kind, committed_ms FROM day_ledger WHERE local_day BETWEEN ? AND ? ORDER BY local_day;

-- Restorative minutes + completed count (COALESCE handles fresh installs)
SELECT
  COALESCE(CAST(SUM(CASE WHEN status IN ('completed','partial') THEN listened_ms ELSE 0 END) / 60000 AS INTEGER), 0) AS minutes,
  COALESCE(SUM(status = 'completed'), 0) AS sessions
FROM session_logs;

-- Free-pass qualification input: distinct days with a committed 5- or 10-min session in the last 7 days
SELECT DISTINCT local_day FROM session_logs
WHERE status='completed' AND protocol_id IN ('rapid_reset_5','afternoon_recharge_10') AND local_day >= ?;

-- Calm Delta groups (headline insight)
SELECT protocol_id, pre_state, COUNT(*) AS n,
       AVG(post_state = 5)  AS pct_restored,
       AVG(post_state >= 4) AS pct_calm_plus
FROM session_logs
WHERE status='completed' AND pre_state IS NOT NULL AND post_state IS NOT NULL
GROUP BY protocol_id, pre_state HAVING n >= 5;

-- Pro: mean delta by protocol x voice x mode
SELECT protocol_id, voice_id, mode, COUNT(*) AS n, AVG(post_state - pre_state) AS mean_delta
FROM session_logs WHERE status='completed' AND pre_state IS NOT NULL AND post_state IS NOT NULL
GROUP BY protocol_id, voice_id, mode;

-- Pro: weekly mean delta (last 8 weeks; Monday-based week start so weeks never split across years)
SELECT date(local_day, 'weekday 1', '-7 days') AS wk, COUNT(*) AS n, AVG(post_state - pre_state) AS mean_delta
FROM session_logs WHERE status='completed' AND pre_state IS NOT NULL AND post_state IS NOT NULL AND local_day >= ?
GROUP BY wk ORDER BY wk;

-- Pro: best time-of-day band (local start hour)
SELECT CASE
         WHEN h BETWEEN 5  AND 10 THEN '05-10' WHEN h BETWEEN 11 AND 14 THEN '11-14'
         WHEN h BETWEEN 15 AND 18 THEN '15-18' WHEN h BETWEEN 19 AND 22 THEN '19-22' ELSE '23-04' END AS band,
       COUNT(*) AS n, AVG(post_state - pre_state) AS mean_delta
FROM (SELECT post_state, pre_state,
             CAST(strftime('%H', started_at_ms/1000 + tz_offset_min*60, 'unixepoch') AS INTEGER) AS h
      FROM session_logs WHERE status='completed' AND pre_state IS NOT NULL AND post_state IS NOT NULL)
GROUP BY band HAVING n >= 3 ORDER BY mean_delta DESC;

-- Morning-after check-in candidate (Sleep session awaiting post_state, within 10 h)
SELECT id FROM session_logs
WHERE mode='sleep' AND status='completed' AND post_state IS NULL AND committed_at_ms >= ?
ORDER BY committed_at_ms DESC LIMIT 1;

-- Launch reconcile
SELECT * FROM session_logs WHERE status='in_progress';

-- Learned reminder time input (last 14 days of commits)
SELECT started_at_ms, tz_offset_min FROM session_logs
WHERE status='completed' AND started_at_ms >= ? ORDER BY started_at_ms DESC;
```

### 5.6 Commit Transaction (pseudo-SQL order, one `withTransactionSync`)

1. `UPDATE session_logs SET status='completed', committed_at_ms=?, commit_reason=?, listened_ms=?, max_position_ms=? WHERE id=? AND committed_at_ms IS NULL` → if 0 rows changed, **abort** (already committed).
2. Read `streak_state` → `applyCredit(state, session.local_day)` → write back.
3. Upsert `day_ledger` (`practice`, `committed_ms += listened_ms`, `sessions += 1`); for each `coveredDays` upsert `kind='grace'` (never overwrites an existing `practice` row).
4. If protocol ∈ {5-min, 10-min}: load last-7-day qualifying days → grant free pass per §3.5 (insert `user_entitlements` row `kind='free_pass', source='app', status='available'`).
5. Return `{ credit, graceEarned, reset, passGranted }` for the Summary UI; after commit, trigger notification re-planning (outside the transaction).

Unit tests: replay a fixed event log through repos on `better-sqlite3` and assert `streak_state`, `day_ledger`, and `user_entitlements` end states; run the same log twice to prove idempotency.