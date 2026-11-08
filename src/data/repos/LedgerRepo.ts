/**
 * Day Ledger Repository
 * Master Plan Part 4 §5.2, §5.6
 * SQLite persistence for daily practice and Rest Grace records.
 */

import type { DayKey } from '../../domain/dayKey';
import type { Db } from '../db';
import { QUERIES } from '../queries';
import type { DayLedgerRow } from '../types';

interface RawLedgerRow {
  local_day: string;
  kind: 'practice' | 'grace';
  committed_ms: number;
  sessions: number;
}

function mapRow(r: RawLedgerRow): DayLedgerRow {
  return {
    localDay: r.local_day,
    kind: r.kind,
    committedMs: r.committed_ms,
    sessions: r.sessions,
  };
}

export class LedgerRepo {
  constructor(private db: Db) {}

  getRange(startDay: DayKey, endDay: DayKey): DayLedgerRow[] {
    const rows = this.db.all<RawLedgerRow>(QUERIES.GET_DAY_LEDGER_RANGE, [startDay, endDay]);
    return rows.map(mapRow);
  }

  getByDay(localDay: DayKey): DayLedgerRow | null {
    const row = this.db.first<RawLedgerRow>('SELECT * FROM day_ledger WHERE local_day = ?;', [
      localDay,
    ]);
    return row ? mapRow(row) : null;
  }

  upsertPractice(localDay: DayKey, committedMs: number): void {
    const existing = this.getByDay(localDay);

    if (!existing) {
      this.db.run(
        `INSERT INTO day_ledger (local_day, kind, committed_ms, sessions) VALUES (?, 'practice', ?, 1);`,
        [localDay, committedMs],
      );
      return;
    }

    if (existing.kind === 'grace') {
      // Practice overwrites previous grace record for that calendar day
      this.db.run(
        `UPDATE day_ledger SET kind = 'practice', committed_ms = ?, sessions = 1 WHERE local_day = ?;`,
        [committedMs, localDay],
      );
    } else {
      // Accumulate additional restorative minutes and session count for today
      this.db.run(
        `UPDATE day_ledger SET committed_ms = committed_ms + ?, sessions = sessions + 1 WHERE local_day = ?;`,
        [committedMs, localDay],
      );
    }
  }

  markGrace(localDay: DayKey): void {
    // INSERT OR IGNORE guarantees grace never overwrites an existing practice row (Part 4 §5.6)
    this.db.run(
      `INSERT OR IGNORE INTO day_ledger (local_day, kind, committed_ms, sessions) VALUES (?, 'grace', 0, 0);`,
      [localDay],
    );
  }
}
