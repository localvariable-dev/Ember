/**
 * User Entitlements Repository
 * Master Plan Part 4 §5.2, Part 3 §4.1-§4.6, Part 2 §3.5
 * SQLite persistence for Pro subscriptions, Lifetime access, and Free Passes.
 */

import { FREE_PASS_VALID_DAYS } from '../../domain/constants';
import type { Db } from '../db';
import type { UserEntitlement } from '../types';

interface RawEntitlementRow {
  id: string;
  kind: 'subscription' | 'lifetime' | 'free_pass';
  source: 'mock' | 'google_play' | 'razorpay' | 'app';
  product_id: string | null;
  status: 'active' | 'expired' | 'revoked' | 'available' | 'consumed';
  granted_at_ms: number;
  expires_at_ms: number | null;
  consumed_at_ms: number | null;
  consumed_session_id: string | null;
  order_id: string | null;
  purchase_token: string | null;
  last_verified_at_ms: number | null;
  meta_json: string | null;
}

function mapRow(r: RawEntitlementRow): UserEntitlement {
  return {
    id: r.id,
    kind: r.kind,
    source: r.source,
    productId: r.product_id,
    status: r.status,
    grantedAtMs: r.granted_at_ms,
    expiresAtMs: r.expires_at_ms,
    consumedAtMs: r.consumed_at_ms,
    consumedSessionId: r.consumed_session_id,
    orderId: r.order_id,
    purchaseToken: r.purchase_token,
    lastVerifiedAtMs: r.last_verified_at_ms,
    metaJson: r.meta_json,
  };
}

export class EntitlementRepo {
  constructor(private db: Db) {}

  all(): UserEntitlement[] {
    const rows = this.db.all<RawEntitlementRow>(
      'SELECT * FROM user_entitlements ORDER BY granted_at_ms DESC;',
    );
    return rows.map(mapRow);
  }

  getById(id: string): UserEntitlement | null {
    const row = this.db.first<RawEntitlementRow>('SELECT * FROM user_entitlements WHERE id = ?;', [
      id,
    ]);
    return row ? mapRow(row) : null;
  }

  hasActivePro(nowMs = Date.now()): boolean {
    const lifetime = this.db.first<{ id: string }>(
      `SELECT id FROM user_entitlements WHERE kind = 'lifetime' AND status = 'active' LIMIT 1;`,
    );
    if (lifetime) return true;

    const sub = this.db.first<{ id: string }>(
      `SELECT id FROM user_entitlements
       WHERE kind = 'subscription'
         AND status = 'active'
         AND (expires_at_ms IS NULL OR expires_at_ms > ?)
       LIMIT 1;`,
      [nowMs],
    );
    return sub !== null;
  }

  getActivePass(nowMs = Date.now()): UserEntitlement | null {
    this.expireStalePasses(nowMs);
    const row = this.db.first<RawEntitlementRow>(
      `SELECT * FROM user_entitlements
       WHERE kind = 'free_pass'
         AND status = 'available'
         AND (expires_at_ms IS NULL OR expires_at_ms > ?)
       ORDER BY granted_at_ms DESC
       LIMIT 1;`,
      [nowMs],
    );
    return row ? mapRow(row) : null;
  }

  hasAvailablePass(nowMs = Date.now()): boolean {
    return this.getActivePass(nowMs) !== null;
  }

  expireStalePasses(nowMs = Date.now()): number {
    const res = this.db.run(
      `
      UPDATE user_entitlements
      SET status = 'expired'
      WHERE kind = 'free_pass'
        AND status = 'available'
        AND expires_at_ms IS NOT NULL
        AND expires_at_ms <= ?;
      `,
      [nowMs],
    );
    return res.changes;
  }

  expireStaleSubscriptions(nowMs = Date.now(), graceMs = 259_200_000): number {
    const res = this.db.run(
      `
      UPDATE user_entitlements
      SET status = 'expired'
      WHERE kind = 'subscription'
        AND status = 'active'
        AND expires_at_ms IS NOT NULL
        AND (expires_at_ms + ?) <= ?;
      `,
      [graceMs, nowMs],
    );
    return res.changes;
  }

  consumePassForSession(sessionId: string, nowMs = Date.now()): boolean {
    const pass = this.getActivePass(nowMs);
    if (!pass) return false;
    return this.consumeFreePass(pass.id, sessionId, nowMs);
  }

  countPassesGranted(): number {
    const row = this.db.first<{ count: number }>(
      `SELECT COUNT(*) as count FROM user_entitlements WHERE kind = 'free_pass';`,
    );
    return row?.count ?? 0;
  }

  grantFreePass(id: string, nowMs = Date.now()): UserEntitlement {
    const expiresAtMs = nowMs + FREE_PASS_VALID_DAYS * 86_400_000;
    this.db.run(
      `
      INSERT INTO user_entitlements (
        id, kind, source, product_id, status,
        granted_at_ms, expires_at_ms, consumed_at_ms, consumed_session_id,
        order_id, purchase_token, last_verified_at_ms, meta_json
      ) VALUES (?, 'free_pass', 'app', NULL, 'available', ?, ?, NULL, NULL, NULL, NULL, ?, NULL);
      `,
      [id, nowMs, expiresAtMs, nowMs],
    );

    return {
      id,
      kind: 'free_pass',
      source: 'app',
      productId: null,
      status: 'available',
      grantedAtMs: nowMs,
      expiresAtMs,
      consumedAtMs: null,
      consumedSessionId: null,
      orderId: null,
      purchaseToken: null,
      lastVerifiedAtMs: nowMs,
      metaJson: null,
    };
  }

  consumeFreePass(id: string, sessionId: string, nowMs = Date.now()): boolean {
    const res = this.db.run(
      `
      UPDATE user_entitlements SET
        status = 'consumed',
        consumed_at_ms = ?,
        consumed_session_id = ?
      WHERE id = ? AND status = 'available';
      `,
      [nowMs, sessionId, id],
    );
    return res.changes > 0;
  }

  upsert(ent: UserEntitlement): void {
    this.db.run(
      `
      INSERT INTO user_entitlements (
        id, kind, source, product_id, status,
        granted_at_ms, expires_at_ms, consumed_at_ms, consumed_session_id,
        order_id, purchase_token, last_verified_at_ms, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        source = excluded.source,
        product_id = excluded.product_id,
        status = excluded.status,
        granted_at_ms = excluded.granted_at_ms,
        expires_at_ms = excluded.expires_at_ms,
        consumed_at_ms = excluded.consumed_at_ms,
        consumed_session_id = excluded.consumed_session_id,
        order_id = excluded.order_id,
        purchase_token = excluded.purchase_token,
        last_verified_at_ms = excluded.last_verified_at_ms,
        meta_json = excluded.meta_json;
      `,
      [
        ent.id,
        ent.kind,
        ent.source,
        ent.productId,
        ent.status,
        ent.grantedAtMs,
        ent.expiresAtMs,
        ent.consumedAtMs,
        ent.consumedSessionId,
        ent.orderId,
        ent.purchaseToken,
        ent.lastVerifiedAtMs,
        ent.metaJson,
      ],
    );
  }

  replaceProviderRows(source: 'mock' | 'google_play' | 'razorpay', rows: UserEntitlement[]): void {
    this.db.tx(() => {
      this.db.run(`DELETE FROM user_entitlements WHERE source = ?;`, [source]);
      for (const ent of rows) {
        this.upsert(ent);
      }
    });
  }

  replaceAllProviderRows(rows: UserEntitlement[]): void {
    this.db.tx(() => {
      this.db.run(`DELETE FROM user_entitlements WHERE source != 'app';`);
      for (const ent of rows) {
        this.upsert(ent);
      }
    });
  }
}
