/**
 * User Preferences Repository
 * Master Plan Part 4 §5.2, §5.3
 * SQLite persistence for the single-row user_preferences table.
 */

import type { AmbientBedId } from '../../domain/constants';
import type { Db } from '../db';
import type { Mode, UserPreferences } from '../types';

interface RawPrefsRow {
  id: 1;
  ambient_bed_id: AmbientBedId | null;
  selected_voice_id: string;
  voice_volume: number;
  ambient_volume: number;
  last_mode: Mode;
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

const DEFAULT_PREFS: UserPreferences = {
  id: 1,
  ambientBedId: null,
  selectedVoiceId: 'maya_warm',
  voiceVolume: 0.9,
  ambientVolume: 0.5,
  lastMode: 'focus',
  modeChosenOnce: false,
  sighPacerDefault: false,
  hapticsEnabled: true,
  breathHaptics: false,
  showCues: true,
  reduceMotion: 'system',
  notificationsEnabled: false,
  reminderMin: null,
  notifPromptShown: false,
  lapsedSentCount: 0,
  lastOpenAtMs: null,
  firstLaunchAtMs: null,
  thetaHintShown: false,
  firstRunCueShown: false,
  reviewPrompted: false,
  updatedAtMs: 0,
};

function mapRow(r: RawPrefsRow): UserPreferences {
  return {
    id: 1,
    ambientBedId: r.ambient_bed_id,
    selectedVoiceId: r.selected_voice_id,
    voiceVolume: r.voice_volume,
    ambientVolume: r.ambient_volume,
    lastMode: r.last_mode,
    modeChosenOnce: r.mode_chosen_once === 1,
    sighPacerDefault: r.sigh_pacer_default === 1,
    hapticsEnabled: r.haptics_enabled === 1,
    breathHaptics: r.breath_haptics === 1,
    showCues: r.show_cues === 1,
    reduceMotion: r.reduce_motion,
    notificationsEnabled: r.notifications_enabled === 1,
    reminderMin: r.reminder_min,
    notifPromptShown: r.notif_prompt_shown === 1,
    lapsedSentCount: r.lapsed_sent_count,
    lastOpenAtMs: r.last_open_at_ms,
    firstLaunchAtMs: r.first_launch_at_ms,
    thetaHintShown: r.theta_hint_shown === 1,
    firstRunCueShown: r.first_run_cue_shown === 1,
    reviewPrompted: r.review_prompted === 1,
    updatedAtMs: r.updated_at_ms,
  };
}

export class PrefsRepo {
  constructor(private db: Db) {}

  get(): UserPreferences {
    const row = this.db.first<RawPrefsRow>('SELECT * FROM user_preferences WHERE id = 1;');
    if (!row) {
      return DEFAULT_PREFS;
    }
    return mapRow(row);
  }

  patch(changes: Partial<UserPreferences>, nowMs = Date.now()): UserPreferences {
    const current = this.get();
    const updated: UserPreferences = {
      ...current,
      ...changes,
      id: 1,
      updatedAtMs: nowMs,
    };

    this.db.run(
      `
      UPDATE user_preferences SET
        ambient_bed_id = ?,
        selected_voice_id = ?,
        voice_volume = ?,
        ambient_volume = ?,
        last_mode = ?,
        mode_chosen_once = ?,
        sigh_pacer_default = ?,
        haptics_enabled = ?,
        breath_haptics = ?,
        show_cues = ?,
        reduce_motion = ?,
        notifications_enabled = ?,
        reminder_min = ?,
        notif_prompt_shown = ?,
        lapsed_sent_count = ?,
        last_open_at_ms = ?,
        first_launch_at_ms = ?,
        theta_hint_shown = ?,
        first_run_cue_shown = ?,
        review_prompted = ?,
        updated_at_ms = ?
      WHERE id = 1;
      `,
      [
        updated.ambientBedId,
        updated.selectedVoiceId,
        updated.voiceVolume,
        updated.ambientVolume,
        updated.lastMode,
        updated.modeChosenOnce ? 1 : 0,
        updated.sighPacerDefault ? 1 : 0,
        updated.hapticsEnabled ? 1 : 0,
        updated.breathHaptics ? 1 : 0,
        updated.showCues ? 1 : 0,
        updated.reduceMotion,
        updated.notificationsEnabled ? 1 : 0,
        updated.reminderMin,
        updated.notifPromptShown ? 1 : 0,
        updated.lapsedSentCount,
        updated.lastOpenAtMs,
        updated.firstLaunchAtMs,
        updated.thetaHintShown ? 1 : 0,
        updated.firstRunCueShown ? 1 : 0,
        updated.reviewPrompted ? 1 : 0,
        updated.updatedAtMs,
      ],
    );

    return updated;
  }
}
