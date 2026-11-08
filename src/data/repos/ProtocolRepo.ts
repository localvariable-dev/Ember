/**
 * Protocol Repository
 * Master Plan Part 4 §5.2, §5.4
 * SQLite persistence for the audio_protocols catalogue.
 */

import type { ProtocolId } from '../../domain/constants';
import type { Db } from '../db';
import type { AudioProtocol, Tier } from '../types';

interface RawProtocolRow {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  planned_ms: number;
  tier: Tier;
  supports_modes: number;
  sigh_in_script: number;
  asset_version: number;
  sort_order: number;
}

function mapRow(r: RawProtocolRow): AudioProtocol {
  return {
    id: r.id as ProtocolId,
    title: r.title,
    subtitle: r.subtitle,
    minutes: r.minutes,
    plannedMs: r.planned_ms,
    tier: r.tier,
    supportsModes: r.supports_modes === 1,
    sighInScript: r.sigh_in_script === 1,
    assetVersion: r.asset_version,
    sortOrder: r.sort_order,
  };
}

export class ProtocolRepo {
  constructor(private db: Db) {}

  all(): AudioProtocol[] {
    const rows = this.db.all<RawProtocolRow>(
      'SELECT * FROM audio_protocols ORDER BY sort_order ASC;',
    );
    return rows.map(mapRow);
  }

  getById(id: ProtocolId): AudioProtocol | null {
    const row = this.db.first<RawProtocolRow>('SELECT * FROM audio_protocols WHERE id = ?;', [id]);
    return row ? mapRow(row) : null;
  }

  seed(protocols: AudioProtocol[]): void {
    this.db.tx(() => {
      for (const p of protocols) {
        this.db.run(
          `
          INSERT INTO audio_protocols (
            id, title, subtitle, minutes, planned_ms, tier,
            supports_modes, sigh_in_script, asset_version, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            subtitle = excluded.subtitle,
            minutes = excluded.minutes,
            planned_ms = excluded.planned_ms,
            tier = excluded.tier,
            supports_modes = excluded.supports_modes,
            sigh_in_script = excluded.sigh_in_script,
            asset_version = excluded.asset_version,
            sort_order = excluded.sort_order
          WHERE excluded.asset_version >= audio_protocols.asset_version;
          `,
          [
            p.id,
            p.title,
            p.subtitle,
            p.minutes,
            p.plannedMs,
            p.tier,
            p.supportsModes ? 1 : 0,
            p.sighInScript ? 1 : 0,
            p.assetVersion,
            p.sortOrder,
          ],
        );
      }
    });
  }
}
