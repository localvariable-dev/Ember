/**
 * Ember Database Abstraction (Web Preview Adapter)
 * Master Plan Part 4 §5.1, Part 6 §7.1 & §8.2
 *
 * Clearly isolated web-preview adapter sufficient to render and navigate the Sanctuary UI
 * without pretending that persistence is functional.
 * Real SQLite persistence is preserved for Android via src/data/db.ts.
 */

import type { Db, RunResult } from './dbTypes';

export type { Db, RunResult } from './dbTypes';

interface RawPrefsRow {
  id: 1;
  ambient_bed_id: string | null;
  selected_voice_id: string;
  voice_volume: number;
  ambient_volume: number;
  last_mode: 'focus' | 'sleep';
  mode_chosen_once: number;
  sigh_pacer_default: number;
  haptics_enabled: number;
  breath_haptics: number;
  show_cues: number;
  reduce_motion: 'system' | 'on' | 'off';
  notifications_enabled: number;
  reminder_min: number | null;
  notif_prompt_shown: number;
  lapsed_sent_count: number;
  last_open_at_ms: number | null;
  first_launch_at_ms: number | null;
  theta_hint_shown: number;
  first_run_cue_shown: number;
  review_prompted: number;
  updated_at_ms: number;
}

const CANONICAL_PROTOCOLS = [
  {
    id: 'rapid_reset_5',
    title: 'Rapid Reset',
    subtitle: '5 min · Acute stress & pre-meeting release',
    minutes: 5,
    planned_ms: 300000,
    tier: 'free',
    supports_modes: 0,
    sigh_in_script: 1,
    asset_version: 1,
    sort_order: 1,
  },
  {
    id: 'afternoon_recharge_10',
    title: 'Afternoon Recharge',
    subtitle: '10 min · Circadian dip & baseline dopamine',
    minutes: 10,
    planned_ms: 600000,
    tier: 'free',
    supports_modes: 1,
    sigh_in_script: 0,
    asset_version: 1,
    sort_order: 2,
  },
  {
    id: 'deep_rest_30',
    title: 'Deep Rest & Yoga Nidra',
    subtitle: '30 min · Parasympathetic reset & sleep debt',
    minutes: 30,
    planned_ms: 1800000,
    tier: 'pro',
    supports_modes: 1,
    sigh_in_script: 0,
    asset_version: 1,
    sort_order: 3,
  },
];

const CANONICAL_VOICES = [
  {
    id: 'maya_warm',
    name: 'Maya',
    subtitle: 'Warm & Grounding · Mumbai',
    locale: 'en-IN',
    tier: 'free',
    delivery: 'bundled',
    status: 'installed',
    preview_asset_key: 'voice/maya_warm/preview.ogg',
    pack_size_bytes: null,
    remote_pack_url: null,
    sort_order: 1,
  },
  {
    id: 'arjun_deep',
    name: 'Arjun',
    subtitle: 'Deep & Resonant · Bengaluru',
    locale: 'en-IN',
    tier: 'free',
    delivery: 'bundled',
    status: 'installed',
    preview_asset_key: 'voice/arjun_deep/preview.ogg',
    pack_size_bytes: null,
    remote_pack_url: null,
    sort_order: 2,
  },
];

const CANONICAL_BEDS = [
  {
    id: 'rain',
    title: 'Gentle Rain',
    tier: 'free',
    asset_key: 'beds/rain.ogg',
    loop_ms: 60000,
    is_binaural: 0,
    sort_order: 1,
  },
  {
    id: 'brown_noise',
    title: 'Warm Brown Noise',
    tier: 'free',
    asset_key: 'beds/brown_noise.ogg',
    loop_ms: 60000,
    is_binaural: 0,
    sort_order: 2,
  },
  {
    id: 'ocean_drift',
    title: 'Ocean Drift',
    tier: 'free',
    asset_key: 'beds/ocean_drift.ogg',
    loop_ms: 60000,
    is_binaural: 0,
    sort_order: 3,
  },
  {
    id: 'night_forest',
    title: 'Night Forest',
    tier: 'free',
    asset_key: 'beds/night_forest.ogg',
    loop_ms: 60000,
    is_binaural: 0,
    sort_order: 4,
  },
  {
    id: 'theta_6hz',
    title: 'Theta 6 Hz Waves',
    tier: 'pro',
    asset_key: 'beds/theta_6hz.flac',
    loop_ms: 24000,
    is_binaural: 1,
    sort_order: 5,
  },
  {
    id: 'delta_2hz',
    title: 'Delta 2 Hz Waves',
    tier: 'pro',
    asset_key: 'beds/delta_2hz.flac',
    loop_ms: 24000,
    is_binaural: 1,
    sort_order: 6,
  },
];

export class WebPreviewDb implements Db {
  private prefs: RawPrefsRow = {
    id: 1,
    ambient_bed_id: null,
    selected_voice_id: 'maya_warm',
    voice_volume: 0.9,
    ambient_volume: 0.5,
    last_mode: 'focus',
    mode_chosen_once: 0,
    sigh_pacer_default: 0,
    haptics_enabled: 1,
    breath_haptics: 0,
    show_cues: 1,
    reduce_motion: 'system',
    notifications_enabled: 0,
    reminder_min: null,
    notif_prompt_shown: 0,
    lapsed_sent_count: 0,
    last_open_at_ms: null,
    first_launch_at_ms: Date.now(),
    theta_hint_shown: 0,
    first_run_cue_shown: 0,
    review_prompted: 0,
    updated_at_ms: Date.now(),
  };

  private streak = {
    id: 1,
    current_streak: 0,
    longest_streak: 0,
    last_credit_day: null as string | null,
    grace_banked: 2,
    grace_progress: 0,
    grace_earned_total: 0,
    grace_used_total: 0,
    updated_at_ms: Date.now(),
  };

  constructor() {
    if (typeof console !== 'undefined' && console.info) {
      console.info(
        '[Ember Web Preview] Running in web preview mode with in-memory adapter. Production SQLite runs on Android.',
      );
    }
  }

  exec(_sql: string): void {
    // No-op for schema creation/PRAGMAs in web preview
  }

  run(sql: string, params: unknown[] = []): RunResult {
    const s = sql.trim();

    if (s.includes('UPDATE user_preferences')) {
      // Handle patch update
      if (params.length >= 20) {
        this.prefs.ambient_bed_id = (params[0] as string) ?? null;
        this.prefs.selected_voice_id = (params[1] as string) ?? this.prefs.selected_voice_id;
        this.prefs.voice_volume =
          typeof params[2] === 'number' ? params[2] : this.prefs.voice_volume;
        this.prefs.ambient_volume =
          typeof params[3] === 'number' ? params[3] : this.prefs.ambient_volume;
        this.prefs.last_mode = (params[4] as 'focus' | 'sleep') ?? this.prefs.last_mode;
        this.prefs.mode_chosen_once = (params[5] as number) ?? this.prefs.mode_chosen_once;
        this.prefs.sigh_pacer_default = (params[6] as number) ?? this.prefs.sigh_pacer_default;
        this.prefs.haptics_enabled = (params[7] as number) ?? this.prefs.haptics_enabled;
        this.prefs.breath_haptics = (params[8] as number) ?? this.prefs.breath_haptics;
        this.prefs.show_cues = (params[9] as number) ?? this.prefs.show_cues;
        this.prefs.reduce_motion =
          (params[10] as 'system' | 'on' | 'off') ?? this.prefs.reduce_motion;
        this.prefs.notifications_enabled =
          (params[11] as number) ?? this.prefs.notifications_enabled;
        this.prefs.reminder_min = (params[12] as number) ?? null;
        this.prefs.notif_prompt_shown = (params[13] as number) ?? this.prefs.notif_prompt_shown;
        this.prefs.lapsed_sent_count = (params[14] as number) ?? this.prefs.lapsed_sent_count;
        this.prefs.last_open_at_ms = (params[15] as number) ?? this.prefs.last_open_at_ms;
        this.prefs.first_launch_at_ms = (params[16] as number) ?? this.prefs.first_launch_at_ms;
        this.prefs.theta_hint_shown = (params[17] as number) ?? this.prefs.theta_hint_shown;
        this.prefs.first_run_cue_shown = (params[18] as number) ?? this.prefs.first_run_cue_shown;
        this.prefs.review_prompted = (params[19] as number) ?? this.prefs.review_prompted;
        this.prefs.updated_at_ms = (params[20] as number) ?? Date.now();
      }
      return { changes: 1, lastInsertRowId: 1 };
    }

    if (s.includes('UPDATE streak_state')) {
      if (params.length >= 7) {
        this.streak.current_streak = (params[0] as number) ?? 0;
        this.streak.longest_streak = (params[1] as number) ?? 0;
        this.streak.last_credit_day = (params[2] as string) ?? null;
        this.streak.grace_banked = (params[3] as number) ?? 2;
        this.streak.grace_progress = (params[4] as number) ?? 0;
        this.streak.grace_earned_total = (params[5] as number) ?? 0;
        this.streak.grace_used_total = (params[6] as number) ?? 0;
        this.streak.updated_at_ms = (params[7] as number) ?? Date.now();
      }
      return { changes: 1, lastInsertRowId: 1 };
    }

    return { changes: 1, lastInsertRowId: 1 };
  }

  all<T>(sql: string, params: unknown[] = []): T[] {
    const s = sql.toLowerCase();

    if (s.includes('from audio_protocols')) {
      return CANONICAL_PROTOCOLS as unknown as T[];
    }
    if (s.includes('from voices')) {
      return CANONICAL_VOICES as unknown as T[];
    }
    if (s.includes('from ambient_beds')) {
      return CANONICAL_BEDS as unknown as T[];
    }
    if (s.includes('from user_entitlements')) {
      return [] as T[];
    }
    if (s.includes('from session_logs')) {
      return [] as T[];
    }
    if (s.includes('from day_ledger')) {
      return [] as T[];
    }

    return [] as T[];
  }

  first<T>(sql: string, params: unknown[] = []): T | null {
    const s = sql.toLowerCase();

    if (s.includes('pragma user_version')) {
      return { user_version: 2 } as unknown as T;
    }
    if (s.includes('from user_preferences')) {
      return { ...this.prefs } as unknown as T;
    }
    if (s.includes('from streak_state')) {
      return { ...this.streak } as unknown as T;
    }
    if (s.includes('from audio_protocols')) {
      if (params.length > 0) {
        const id = params[0];
        const match = CANONICAL_PROTOCOLS.find((p) => p.id === id);
        return (match ?? null) as unknown as T | null;
      }
      return CANONICAL_PROTOCOLS[0] as unknown as T;
    }
    if (s.includes('from voices')) {
      if (params.length > 0) {
        const id = params[0];
        const match = CANONICAL_VOICES.find((v) => v.id === id);
        return (match ?? null) as unknown as T | null;
      }
      return CANONICAL_VOICES[0] as unknown as T;
    }
    if (s.includes('from user_entitlements')) {
      return null;
    }
    if (s.includes('from session_logs')) {
      return null;
    }
    if (s.includes('from day_ledger')) {
      return null;
    }

    return null;
  }

  tx<T>(fn: () => T): T {
    return fn();
  }

  close(): void {
    // No-op
  }
}

/**
 * Opens web preview in-memory database.
 */
export function openAppDatabase(_dbName = 'ember.db'): Db {
  return new WebPreviewDb();
}
