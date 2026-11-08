/**
 * Ember Database Schema Migrations
 * Master Plan Part 4 §5.2
 * PRAGMA user_version-based ordered migration execution.
 * Never modify a shipped migration; add a new version instead.
 */

import type { Db } from './db';

export interface Migration {
  version: number;
  name: string;
  up(db: Db): void;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: '001_initial_schema_and_catalogs',
    up(db: Db): void {
      // 1. AudioProtocols
      db.exec(`
        CREATE TABLE IF NOT EXISTS audio_protocols (
          id                    TEXT PRIMARY KEY,
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
      `);

      // 2. Voices Catalog
      db.exec(`
        CREATE TABLE IF NOT EXISTS voices (
          id                    TEXT PRIMARY KEY,
          name                  TEXT NOT NULL,
          subtitle              TEXT NOT NULL,
          locale                TEXT NOT NULL DEFAULT 'en-IN',
          tier                  TEXT NOT NULL CHECK (tier IN ('free','pro')),
          delivery              TEXT NOT NULL CHECK (delivery IN ('bundled','download','imported')),
          status                TEXT NOT NULL CHECK (status IN ('installed','available','downloading')),
          preview_asset_key     TEXT,
          pack_size_bytes       INTEGER,
          remote_pack_url       TEXT,
          sort_order            INTEGER NOT NULL DEFAULT 0
        );
      `);

      // 3. Ambient Beds
      db.exec(`
        CREATE TABLE IF NOT EXISTS ambient_beds (
          id                    TEXT PRIMARY KEY,
          title                 TEXT NOT NULL,
          tier                  TEXT NOT NULL CHECK (tier IN ('free','pro')),
          asset_key             TEXT NOT NULL,
          loop_ms               INTEGER NOT NULL,
          is_binaural           INTEGER NOT NULL DEFAULT 0 CHECK (is_binaural IN (0,1)),
          sort_order            INTEGER NOT NULL
        );
      `);

      // 4. Per-(Protocol, Voice) Audio & Measured Cue Timelines
      db.exec(`
        CREATE TABLE IF NOT EXISTS protocol_voice_tracks (
          protocol_id           TEXT NOT NULL REFERENCES audio_protocols(id) ON DELETE CASCADE,
          voice_id              TEXT NOT NULL REFERENCES voices(id) ON DELETE CASCADE,
          voice_focus_source    TEXT NOT NULL,
          voice_sleep_source    TEXT,
          voice_focus_sha256    TEXT,
          voice_sleep_sha256    TEXT,
          cues_focus_json       TEXT NOT NULL,
          cues_sleep_json       TEXT,
          asset_version         INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (protocol_id, voice_id)
        );
      `);

      // 5. Session Logs
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_logs (
          id                    TEXT PRIMARY KEY,
          protocol_id           TEXT NOT NULL REFERENCES audio_protocols(id),
          voice_id              TEXT NOT NULL DEFAULT 'maya_warm' REFERENCES voices(id),
          mode                  TEXT NOT NULL CHECK (mode IN ('focus','sleep')),
          ambient_bed_id        TEXT REFERENCES ambient_beds(id),
          sigh_pacer            INTEGER NOT NULL DEFAULT 0 CHECK (sigh_pacer IN (0,1)),
          access_via            TEXT NOT NULL CHECK (access_via IN ('free','pro','free_pass')),
          started_at_ms         INTEGER NOT NULL,
          ended_at_ms           INTEGER,
          local_day             TEXT NOT NULL,
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
        CREATE INDEX IF NOT EXISTS idx_sessions_day        ON session_logs(local_day);
        CREATE INDEX IF NOT EXISTS idx_sessions_status     ON session_logs(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_proto_stat ON session_logs(protocol_id, status);
        CREATE INDEX IF NOT EXISTS idx_sessions_started    ON session_logs(started_at_ms DESC);
      `);

      // 6. Day Ledger
      db.exec(`
        CREATE TABLE IF NOT EXISTS day_ledger (
          local_day             TEXT PRIMARY KEY,
          kind                  TEXT NOT NULL CHECK (kind IN ('practice','grace')),
          committed_ms          INTEGER NOT NULL DEFAULT 0,
          sessions              INTEGER NOT NULL DEFAULT 0
        );
      `);

      // 7. Streak State (singleton row id=1)
      db.exec(`
        CREATE TABLE IF NOT EXISTS streak_state (
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
        INSERT OR IGNORE INTO streak_state (id, updated_at_ms) VALUES (1, 0);
      `);

      // 8. User Entitlements
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_entitlements (
          id                    TEXT PRIMARY KEY,
          kind                  TEXT NOT NULL CHECK (kind IN ('subscription','lifetime','free_pass')),
          source                TEXT NOT NULL CHECK (source IN ('mock','google_play','razorpay','app')),
          product_id            TEXT,
          status                TEXT NOT NULL CHECK (status IN ('active','expired','revoked','available','consumed')),
          granted_at_ms         INTEGER NOT NULL,
          expires_at_ms         INTEGER,
          consumed_at_ms        INTEGER,
          consumed_session_id   TEXT,
          order_id              TEXT,
          purchase_token        TEXT,
          last_verified_at_ms   INTEGER,
          meta_json             TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_ent_kind_status ON user_entitlements(kind, status);
      `);

      // 9. User Preferences
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id                    INTEGER PRIMARY KEY CHECK (id = 1),
          ambient_bed_id        TEXT REFERENCES ambient_beds(id),
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
          reminder_min          INTEGER,
          notif_prompt_shown    INTEGER NOT NULL DEFAULT 0,
          lapsed_sent_count     INTEGER NOT NULL DEFAULT 0,
          last_open_at_ms       INTEGER,
          first_launch_at_ms    INTEGER,
          theta_hint_shown      INTEGER NOT NULL DEFAULT 0,
          first_run_cue_shown   INTEGER NOT NULL DEFAULT 0,
          review_prompted       INTEGER NOT NULL DEFAULT 0,
          updated_at_ms         INTEGER NOT NULL
        );
      `);

      // 10. Seed Audio Protocols
      db.exec(`
        INSERT OR IGNORE INTO audio_protocols
          (id, title, subtitle, minutes, planned_ms, tier, supports_modes, sigh_in_script, asset_version, sort_order)
        VALUES
          ('rapid_reset_5', 'Rapid Reset', '5 min · Acute stress & pre-meeting release', 5, 300000, 'free', 0, 1, 1, 1),
          ('afternoon_recharge_10', 'Afternoon Recharge', '10 min · Circadian dip & baseline dopamine', 10, 600000, 'free', 0, 0, 1, 2),
          ('deep_rest_30', 'Deep Rest & Yoga Nidra', '30 min · Parasympathetic reset & sleep debt', 30, 1800000, 'pro', 1, 0, 1, 3);
      `);

      // 11. Seed Voices Catalog
      db.exec(`
        INSERT OR IGNORE INTO voices
          (id, name, subtitle, locale, tier, delivery, status, preview_asset_key, pack_size_bytes, remote_pack_url, sort_order)
        VALUES
          ('maya_warm', 'Maya', 'Warm & unhurried · en-IN', 'en-IN', 'free', 'bundled', 'installed', 'preview_maya', NULL, NULL, 1),
          ('arjun_deep', 'Arjun', 'Deep & steady evening voice · en-IN', 'en-IN', 'pro', 'bundled', 'installed', 'preview_arjun', NULL, NULL, 2);
      `);

      // 12. Seed Ambient Beds Catalog
      db.exec(`
        INSERT OR IGNORE INTO ambient_beds
          (id, title, tier, asset_key, loop_ms, is_binaural, sort_order)
        VALUES
          ('rain', 'Rain', 'free', 'bed_rain', 60000, 0, 1),
          ('brown_noise', 'Brown Noise', 'free', 'bed_brown_noise', 60000, 0, 2),
          ('theta_6hz', '6 Hz Theta', 'pro', 'bed_theta_6hz', 24000, 1, 3),
          ('ocean_drift', 'Ocean Drift', 'pro', 'bed_ocean_drift', 60000, 0, 4),
          ('night_forest', 'Night Forest', 'pro', 'bed_night_forest', 60000, 0, 5),
          ('delta_2hz', '2 Hz Delta', 'pro', 'bed_delta_2hz', 24000, 1, 6);
      `);

      // 13. Seed Protocol Voice Tracks
      db.exec(`
        INSERT OR IGNORE INTO protocol_voice_tracks
          (protocol_id, voice_id, voice_focus_source, voice_sleep_source, cues_focus_json, cues_sleep_json, asset_version)
        VALUES
          ('rapid_reset_5', 'maya_warm', 'rapid_reset_5.ogg', NULL, '[]', NULL, 1),
          ('afternoon_recharge_10', 'maya_warm', 'afternoon_recharge_10.ogg', NULL, '[]', NULL, 1),
          ('deep_rest_30', 'maya_warm', 'deep_rest_30.focus.ogg', 'deep_rest_30.sleep.ogg', '[]', '[]', 1),
          ('rapid_reset_5', 'arjun_deep', 'rapid_reset_5.ogg', NULL, '[]', NULL, 1),
          ('afternoon_recharge_10', 'arjun_deep', 'afternoon_recharge_10.ogg', NULL, '[]', NULL, 1),
          ('deep_rest_30', 'arjun_deep', 'deep_rest_30.focus.ogg', 'deep_rest_30.sleep.ogg', '[]', '[]', 1);
      `);

      // 14. Initialize User Preferences singleton row (requires 'maya_warm' in voices)
      db.exec(`
        INSERT OR IGNORE INTO user_preferences (id, updated_at_ms) VALUES (1, 0);
      `);
    },
  },
];

export interface MigrationResult {
  previousVersion: number;
  newVersion: number;
}

/**
 * Executes all pending migrations in ascending order inside transactions.
 * Sets PRAGMA user_version upon successful completion of each migration.
 */
export function migrate(db: Db): MigrationResult {
  const row = db.first<{ user_version: number }>('PRAGMA user_version;');
  const previousVersion = row ? row.user_version : 0;
  let currentVersion = previousVersion;

  for (const m of MIGRATIONS) {
    if (m.version > currentVersion) {
      db.tx(() => {
        m.up(db);
        db.exec(`PRAGMA user_version = ${m.version};`);
      });
      currentVersion = m.version;
    }
  }

  return { previousVersion, newVersion: currentVersion };
}
