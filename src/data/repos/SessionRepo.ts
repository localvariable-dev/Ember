/**
 * Session Repository & Atomic Commit Orchestrator
 * Master Plan Part 4 §5.2, §5.6, Part 2 §3.3-§3.5
 * SQLite persistence and transactional commit guarantees for Ember rest sessions.
 */

import { MORNING_CHECKIN_WINDOW_MS, type ProtocolId } from '../../domain/constants';
import { addDays } from '../../domain/dayKey';
import { applyCredit, qualifiesForFreePass, type CreditResult } from '../../domain/streakEngine';
import type { Db } from '../db';
import { QUERIES } from '../queries';
import type {
  AccessVia,
  CommitReason,
  CommitSessionParams,
  CreateSessionParams,
  Mode,
  RecoveryState,
  SessionLog,
  SessionStatus,
} from '../types';
import { generateUuid } from '../uuid';
import { EntitlementRepo } from './EntitlementRepo';
import { LedgerRepo } from './LedgerRepo';
import { StreakRepo } from './StreakRepo';

interface RawSessionRow {
  id: string;
  protocol_id: string;
  voice_id: string;
  mode: Mode;
  ambient_bed_id: string | null;
  sigh_pacer: number;
  access_via: AccessVia;
  started_at_ms: number;
  ended_at_ms: number | null;
  local_day: string;
  tz_offset_min: number;
  planned_ms: number;
  listened_ms: number;
  max_position_ms: number;
  heartbeat_at_ms: number | null;
  status: SessionStatus;
  committed_at_ms: number | null;
  commit_reason: CommitReason | null;
  pre_state: RecoveryState | null;
  post_state: RecoveryState | null;
  created_at_ms: number;
}

function mapRow(r: RawSessionRow): SessionLog {
  return {
    id: r.id,
    protocolId: r.protocol_id as ProtocolId,
    voiceId: r.voice_id,
    mode: r.mode,
    ambientBedId: r.ambient_bed_id,
    sighPacer: r.sigh_pacer === 1,
    accessVia: r.access_via,
    startedAtMs: r.started_at_ms,
    endedAtMs: r.ended_at_ms,
    localDay: r.local_day,
    tzOffsetMin: r.tz_offset_min,
    plannedMs: r.planned_ms,
    listenedMs: r.listened_ms,
    maxPositionMs: r.max_position_ms,
    heartbeatAtMs: r.heartbeat_at_ms,
    status: r.status,
    committedAtMs: r.committed_at_ms,
    commitReason: r.commit_reason,
    preState: r.pre_state,
    postState: r.post_state,
    createdAtMs: r.created_at_ms,
  };
}

export interface CommitTransactionResult {
  alreadyCommitted: boolean;
  creditResult?: CreditResult;
  passGranted?: boolean;
  session?: SessionLog;
}

export class SessionRepo {
  private streakRepo: StreakRepo;
  private ledgerRepo: LedgerRepo;
  private entitlementRepo: EntitlementRepo;

  constructor(private db: Db) {
    this.streakRepo = new StreakRepo(db);
    this.ledgerRepo = new LedgerRepo(db);
    this.entitlementRepo = new EntitlementRepo(db);
  }

  create(params: CreateSessionParams): SessionLog {
    const id = params.id ?? generateUuid();
    const voiceId = params.voiceId ?? 'maya_warm';
    const accessVia = params.accessVia ?? 'free';
    const sighPacer = params.sighPacer ? 1 : 0;
    const createdAtMs = params.startedAtMs;

    this.db.run(
      `
      INSERT INTO session_logs (
        id, protocol_id, voice_id, mode, ambient_bed_id, sigh_pacer, access_via,
        started_at_ms, ended_at_ms, local_day, tz_offset_min, planned_ms,
        listened_ms, max_position_ms, heartbeat_at_ms, status, committed_at_ms,
        commit_reason, pre_state, post_state, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, 0, ?, 'in_progress', NULL, NULL, ?, NULL, ?);
      `,
      [
        id,
        params.protocolId,
        voiceId,
        params.mode,
        params.ambientBedId ?? null,
        sighPacer,
        accessVia,
        params.startedAtMs,
        params.localDay,
        params.tzOffsetMin,
        params.plannedMs,
        params.startedAtMs, // initial heartbeat = started_at
        params.preState ?? null,
        createdAtMs,
      ],
    );

    const created = this.getById(id);
    if (!created) {
      throw new Error(`Failed to retrieve newly created session: ${id}`);
    }
    return created;
  }

  heartbeat(id: string, positionMs: number, nowMs = Date.now()): void {
    this.db.run(
      `
      UPDATE session_logs SET
        heartbeat_at_ms = ?,
        max_position_ms = MAX(max_position_ms, ?)
      WHERE id = ?;
      `,
      [nowMs, positionMs, id],
    );
  }

  setPreState(id: string, state: RecoveryState): void {
    this.db.run(`UPDATE session_logs SET pre_state = ? WHERE id = ?;`, [state, id]);
  }

  setPostState(id: string, state: RecoveryState): void {
    this.db.run(`UPDATE session_logs SET post_state = ? WHERE id = ?;`, [state, id]);
  }

  getById(id: string): SessionLog | null {
    const row = this.db.first<RawSessionRow>('SELECT * FROM session_logs WHERE id = ?;', [id]);
    return row ? mapRow(row) : null;
  }

  findInProgress(): SessionLog[] {
    const rows = this.db.all<RawSessionRow>(QUERIES.GET_IN_PROGRESS_SESSIONS);
    return rows.map(mapRow);
  }

  listRecent(limit = 20): SessionLog[] {
    const rows = this.db.all<RawSessionRow>(
      `SELECT * FROM session_logs ORDER BY started_at_ms DESC LIMIT ?;`,
      [limit],
    );
    return rows.map(mapRow);
  }

  listAll(): SessionLog[] {
    const rows = this.db.all<RawSessionRow>(
      `SELECT * FROM session_logs ORDER BY started_at_ms DESC;`,
    );
    return rows.map(mapRow);
  }

  getStats(): { minutes: number; sessions: number } {
    const row = this.db.first<{ minutes: number; sessions: number }>(QUERIES.GET_RESTORATIVE_STATS);
    return {
      minutes: row?.minutes ?? 0,
      sessions: row?.sessions ?? 0,
    };
  }

  getMorningCheckinCandidate(
    withinMs = MORNING_CHECKIN_WINDOW_MS,
    nowMs = Date.now(),
  ): SessionLog | null {
    const threshold = nowMs - withinMs;
    const row = this.db.first<RawSessionRow>(QUERIES.GET_MORNING_CHECKIN_CANDIDATE, [threshold]);
    return row ? mapRow(row) : null;
  }

  getQualifyingDaysSince(cutoffDay: string): string[] {
    const rows = this.db.all<{ local_day: string }>(QUERIES.GET_QUALIFYING_SHORT_DAYS, [cutoffDay]);
    return rows.map((r) => r.local_day);
  }

  /**
   * Finalizes an uncommitted session (early exit, abort, or partial progress).
   * Guarded by committed_at_ms IS NULL: cannot overwrite a committed session.
   */
  finalize(
    id: string,
    status: 'partial' | 'abandoned',
    listenedMs: number,
    endedAtMs = Date.now(),
  ): void {
    this.db.run(
      `
      UPDATE session_logs SET
        status = ?,
        listened_ms = ?,
        ended_at_ms = ?
      WHERE id = ? AND committed_at_ms IS NULL;
      `,
      [status, listenedMs, endedAtMs, id],
    );
  }

  /**
   * Atomic, idempotent session completion transaction.
   * Master Plan Part 4 §5.6 & Part 2 §3.3-§3.5
   *
   * Updates inside a single transaction:
   * 1. session_logs (status='completed', committed_at_ms=now, commit_reason)
   * 2. streak_state (applyCredit)
   * 3. day_ledger (upsert practice + covered grace days)
   * 4. user_entitlements (evaluates Free Pass grant)
   *
   * Idempotency guarantee:
   * If committed_at_ms is already set, aborts without side effects.
   */
  commitSession(id: string, params: CommitSessionParams): CommitTransactionResult {
    return this.db.tx(() => {
      // 1. Guard against duplicate commit using atomic row update
      const updateRes = this.db.run(
        `
        UPDATE session_logs SET
          status = 'completed',
          committed_at_ms = ?,
          commit_reason = ?,
          listened_ms = ?,
          max_position_ms = ?,
          ended_at_ms = ?
        WHERE id = ? AND committed_at_ms IS NULL;
        `,
        [
          params.nowMs,
          params.commitReason,
          params.listenedMs,
          params.maxPositionMs,
          params.endedAtMs ?? params.nowMs,
          id,
        ],
      );

      if (updateRes.changes === 0) {
        // Session already committed or does not exist — no duplicate credit
        return { alreadyCommitted: true };
      }

      // 2. Fetch session details
      const session = this.getById(id);
      if (!session) {
        throw new Error(`Committed session could not be retrieved: ${id}`);
      }

      // 3. Read streak state & apply credit for session.localDay (START date)
      const currentStreak = this.streakRepo.get();
      const creditResult = applyCredit(currentStreak, session.localDay);
      this.streakRepo.save(creditResult.next, params.nowMs);

      // 4. Update day ledger: upsert practice record
      this.ledgerRepo.upsertPractice(session.localDay, session.listenedMs);

      // 5. Update day ledger for any Grace-covered days
      for (const coveredDay of creditResult.coveredDays) {
        this.ledgerRepo.markGrace(coveredDay);
      }

      // 6. Free Pass ("3-Day Streak Taste") evaluation (§3.5)
      // Only 5-min or 10-min sessions qualify
      let passGranted = false;
      const isShortProtocol =
        session.protocolId === 'rapid_reset_5' || session.protocolId === 'afternoon_recharge_10';

      if (isShortProtocol) {
        const isPro = this.entitlementRepo.hasActivePro(params.nowMs);
        const lifetimePassCount = this.entitlementRepo.countPassesGranted();
        const hasAvailablePass = this.entitlementRepo.hasAvailablePass(params.nowMs);

        if (!isPro && lifetimePassCount < 1 && !hasAvailablePass) {
          // Check last 7 local calendar days for consecutive practice
          const cutoffDay = addDays(session.localDay, -6);
          const qualifyingDays = this.getQualifyingDaysSince(cutoffDay);
          const daysSet = new Set(qualifyingDays);

          if (qualifiesForFreePass(daysSet, session.localDay)) {
            this.entitlementRepo.grantFreePass(generateUuid(), params.nowMs);
            passGranted = true;
          }
        }
      }

      return {
        alreadyCommitted: false,
        creditResult,
        passGranted,
        session,
      };
    });
  }
}
