/**
 * Voice Repository
 * Master Plan Part 4 §5.2, §5.4.1
 * SQLite persistence for narrator voice catalog and protocol tracks.
 */

import type { ProtocolId } from '../../domain/constants';
import type { Db } from '../db';
import type { ProtocolVoiceTrack, Tier, Voice } from '../types';

interface RawVoiceRow {
  id: string;
  name: string;
  subtitle: string;
  locale: string;
  tier: Tier;
  delivery: 'bundled' | 'download' | 'imported';
  status: 'installed' | 'available' | 'downloading';
  preview_asset_key: string | null;
  pack_size_bytes: number | null;
  remote_pack_url: string | null;
  sort_order: number;
}

interface RawTrackRow {
  protocol_id: string;
  voice_id: string;
  voice_focus_source: string;
  voice_sleep_source: string | null;
  voice_focus_sha256: string | null;
  voice_sleep_sha256: string | null;
  cues_focus_json: string;
  cues_sleep_json: string | null;
  asset_version: number;
}

function mapVoice(r: RawVoiceRow): Voice {
  return {
    id: r.id,
    name: r.name,
    subtitle: r.subtitle,
    locale: r.locale,
    tier: r.tier,
    delivery: r.delivery,
    status: r.status,
    previewAssetKey: r.preview_asset_key,
    packSizeBytes: r.pack_size_bytes,
    remotePackUrl: r.remote_pack_url,
    sortOrder: r.sort_order,
  };
}

function mapTrack(r: RawTrackRow): ProtocolVoiceTrack {
  return {
    protocolId: r.protocol_id as ProtocolId,
    voiceId: r.voice_id,
    voiceFocusSource: r.voice_focus_source,
    voiceSleepSource: r.voice_sleep_source,
    voiceFocusSha256: r.voice_focus_sha256,
    voiceSleepSha256: r.voice_sleep_sha256,
    cuesFocusJson: r.cues_focus_json,
    cuesSleepJson: r.cues_sleep_json,
    assetVersion: r.asset_version,
  };
}

export class VoiceRepo {
  constructor(private db: Db) {}

  all(): Voice[] {
    const rows = this.db.all<RawVoiceRow>('SELECT * FROM voices ORDER BY sort_order ASC;');
    return rows.map(mapVoice);
  }

  getById(id: string): Voice | null {
    const row = this.db.first<RawVoiceRow>('SELECT * FROM voices WHERE id = ?;', [id]);
    return row ? mapVoice(row) : null;
  }

  install(id: string): void {
    this.db.run(`UPDATE voices SET status = 'installed' WHERE id = ?;`, [id]);
  }

  getTrack(protocolId: ProtocolId, voiceId: string): ProtocolVoiceTrack | null {
    const row = this.db.first<RawTrackRow>(
      `SELECT * FROM protocol_voice_tracks WHERE protocol_id = ? AND voice_id = ?;`,
      [protocolId, voiceId],
    );
    return row ? mapTrack(row) : null;
  }

  getTracksForProtocol(protocolId: ProtocolId): ProtocolVoiceTrack[] {
    const rows = this.db.all<RawTrackRow>(
      `SELECT * FROM protocol_voice_tracks WHERE protocol_id = ?;`,
      [protocolId],
    );
    return rows.map(mapTrack);
  }

  importPack(voice: Voice, tracks: ProtocolVoiceTrack[]): void {
    this.db.tx(() => {
      this.db.run(
        `
        INSERT INTO voices (
          id, name, subtitle, locale, tier, delivery, status,
          preview_asset_key, pack_size_bytes, remote_pack_url, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          subtitle = excluded.subtitle,
          locale = excluded.locale,
          tier = excluded.tier,
          delivery = excluded.delivery,
          status = excluded.status,
          preview_asset_key = excluded.preview_asset_key,
          pack_size_bytes = excluded.pack_size_bytes,
          remote_pack_url = excluded.remote_pack_url,
          sort_order = excluded.sort_order;
        `,
        [
          voice.id,
          voice.name,
          voice.subtitle,
          voice.locale,
          voice.tier,
          voice.delivery,
          voice.status,
          voice.previewAssetKey,
          voice.packSizeBytes,
          voice.remotePackUrl,
          voice.sortOrder,
        ],
      );

      for (const t of tracks) {
        this.db.run(
          `
          INSERT INTO protocol_voice_tracks (
            protocol_id, voice_id, voice_focus_source, voice_sleep_source,
            voice_focus_sha256, voice_sleep_sha256, cues_focus_json, cues_sleep_json, asset_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(protocol_id, voice_id) DO UPDATE SET
            voice_focus_source = excluded.voice_focus_source,
            voice_sleep_source = excluded.voice_sleep_source,
            voice_focus_sha256 = excluded.voice_focus_sha256,
            voice_sleep_sha256 = excluded.voice_sleep_sha256,
            cues_focus_json = excluded.cues_focus_json,
            cues_sleep_json = excluded.cues_sleep_json,
            asset_version = excluded.asset_version;
          `,
          [
            t.protocolId,
            t.voiceId,
            t.voiceFocusSource,
            t.voiceSleepSource,
            t.voiceFocusSha256 ?? null,
            t.voiceSleepSha256 ?? null,
            t.cuesFocusJson,
            t.cuesSleepJson,
            t.assetVersion,
          ],
        );
      }
    });
  }

  seed(voices: Voice[], tracks: ProtocolVoiceTrack[] = []): void {
    this.db.tx(() => {
      for (const v of voices) {
        this.db.run(
          `
          INSERT INTO voices (
            id, name, subtitle, locale, tier, delivery, status,
            preview_asset_key, pack_size_bytes, remote_pack_url, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            subtitle = excluded.subtitle,
            locale = excluded.locale,
            tier = excluded.tier,
            delivery = excluded.delivery,
            status = excluded.status,
            preview_asset_key = excluded.preview_asset_key,
            pack_size_bytes = excluded.pack_size_bytes,
            remote_pack_url = excluded.remote_pack_url,
            sort_order = excluded.sort_order;
          `,
          [
            v.id,
            v.name,
            v.subtitle,
            v.locale,
            v.tier,
            v.delivery,
            v.status,
            v.previewAssetKey,
            v.packSizeBytes,
            v.remotePackUrl,
            v.sortOrder,
          ],
        );
      }

      for (const t of tracks) {
        this.db.run(
          `
          INSERT INTO protocol_voice_tracks (
            protocol_id, voice_id, voice_focus_source, voice_sleep_source,
            voice_focus_sha256, voice_sleep_sha256, cues_focus_json, cues_sleep_json, asset_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(protocol_id, voice_id) DO UPDATE SET
            voice_focus_source = excluded.voice_focus_source,
            voice_sleep_source = excluded.voice_sleep_source,
            voice_focus_sha256 = excluded.voice_focus_sha256,
            voice_sleep_sha256 = excluded.voice_sleep_sha256,
            cues_focus_json = excluded.cues_focus_json,
            cues_sleep_json = excluded.cues_sleep_json,
            asset_version = excluded.asset_version;
          `,
          [
            t.protocolId,
            t.voiceId,
            t.voiceFocusSource,
            t.voiceSleepSource,
            t.voiceFocusSha256 ?? null,
            t.voiceSleepSha256 ?? null,
            t.cuesFocusJson,
            t.cuesSleepJson,
            t.assetVersion,
          ],
        );
      }
    });
  }
}
