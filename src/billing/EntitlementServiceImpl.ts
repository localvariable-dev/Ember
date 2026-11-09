/**
 * Entitlement Service Implementation
 * Master Plan Part 3 §4.1, §4.3, §4.6
 * Programmatic authority for feature gating, free passes, and SQLite entitlement cache.
 */

import type { Clock } from '../domain/clock';
import { SystemClock } from '../domain/clock';
import type { ProtocolId } from '../domain/constants';
import type { EntitlementRepo } from '../data/repos/EntitlementRepo';
import type { UserEntitlement } from '../data/types';
import { generateUuid } from '../data/uuid';
import type {
  EntitlementService,
  EntitlementSnapshot,
  GateDecision,
  PaywallVariant,
} from './entitlementTypes';
import { OFFLINE_GRACE_MS, resolveEntitlement } from './entitlementTypes';
import type { OwnedPurchase, PurchaseResult, Unsubscribe } from './types';

const FREE_PROTOCOLS: readonly ProtocolId[] = ['rapid_reset_5', 'afternoon_recharge_10'];
const FREE_BEDS = new Set(['rain', 'brown_noise', 'theta_6hz']);
const FREE_VOICES = new Set(['maya_warm']);

export class EntitlementServiceImpl implements EntitlementService {
  private snapshot: EntitlementSnapshot;
  private listeners = new Set<(s: EntitlementSnapshot) => void>();
  private clock: Clock;

  constructor(
    private repo: EntitlementRepo,
    clock?: Clock,
  ) {
    this.clock = clock ?? new SystemClock();
    // Initialize snapshot from existing database state
    this.snapshot = resolveEntitlement(this.repo.all(), this.clock.now());
  }

  async init(): Promise<void> {
    await this.ensureTrial();
    await this.expireStale();
    this.refresh();
  }

  async ensureTrial(): Promise<boolean> {
    const hasPriorEntitlement = this.repo.all().some((row) => row.productId !== 'ember_pro_trial');
    if (hasPriorEntitlement) return false;
    const changed = this.repo.grantTrial(generateUuid(), this.clock.now());
    if (changed) this.refresh();
    return changed;
  }

  getSnapshot(): EntitlementSnapshot {
    return this.snapshot;
  }

  subscribe(cb: (s: EntitlementSnapshot) => void): Unsubscribe {
    this.listeners.add(cb);
    cb(this.snapshot);
    return () => {
      this.listeners.delete(cb);
    };
  }

  canStartProtocol(id: ProtocolId): GateDecision {
    // 5-min Rapid Reset & 10-min Afternoon Recharge are 100% Free
    if (FREE_PROTOCOLS.includes(id)) {
      return { allowed: true, via: 'free' };
    }

    // 30-min Deep Rest requires Pro or active Free Pass
    if (this.snapshot.level === 'pro') {
      return { allowed: true, via: 'pro' };
    }

    if (this.snapshot.level === 'free_pass') {
      return { allowed: true, via: 'free_pass' };
    }

    // Access denied: Determine specific contextual paywall variant per Part 3 §4.6
    const nowMs = this.clock.now();
    const rows = this.repo.all();
    let variant: PaywallVariant = 'default';

    const hasConsumedPass = rows.some((r) => r.kind === 'free_pass' && r.status === 'consumed');
    const hasExpiredPass = rows.some(
      (r) =>
        r.kind === 'free_pass' &&
        (r.status === 'expired' ||
          (r.status === 'available' && r.expiresAtMs && r.expiresAtMs <= nowMs)),
    );
    const hasExpiredSub = rows.some(
      (r) =>
        r.kind === 'subscription' &&
        (r.status === 'expired' ||
          (r.productId === 'ember_pro_trial'
            ? r.expiresAtMs !== null && nowMs >= r.expiresAtMs
            : r.source === 'app' && r.productId === 'ember_pro_admin'
              ? r.expiresAtMs !== null && nowMs >= r.expiresAtMs
              : r.expiresAtMs !== null && nowMs >= r.expiresAtMs + OFFLINE_GRACE_MS)),
    );

    if (hasConsumedPass) {
      variant = 'post_taste';
    } else if (hasExpiredPass) {
      variant = 'pass_expired';
    } else if (hasExpiredSub) {
      variant = 'pro_expired';
    }

    return { allowed: false, reason: 'pro_required', paywallVariant: variant };
  }

  canUseBed(bedId: string | null): GateDecision {
    if (!bedId || FREE_BEDS.has(bedId)) {
      return { allowed: true, via: 'free' };
    }

    // Premium ambient beds require Pro (Free Pass does NOT unlock Pro beds)
    if (this.snapshot.level === 'pro') {
      return { allowed: true, via: 'pro' };
    }

    return { allowed: false, reason: 'pro_required', paywallVariant: 'bed_locked' };
  }

  canUseVoice(voiceId: string): GateDecision {
    if (FREE_VOICES.has(voiceId)) {
      return { allowed: true, via: 'free' };
    }

    // Premium voices require Pro (Free Pass does NOT unlock Pro voices)
    if (this.snapshot.level === 'pro') {
      return { allowed: true, via: 'pro' };
    }

    return { allowed: false, reason: 'pro_required', paywallVariant: 'voice_locked' };
  }

  canViewProInsights(): GateDecision {
    if (this.snapshot.level === 'pro') {
      return { allowed: true, via: 'pro' };
    }

    return { allowed: false, reason: 'pro_required', paywallVariant: 'insights' };
  }

  async grantFreePass(): Promise<boolean> {
    // Lifetime cap of 1 pass per user
    if (this.repo.countPassesGranted() >= 1) {
      return false;
    }

    // Do not grant pass if user already has Pro
    if (this.snapshot.level === 'pro') {
      return false;
    }

    this.repo.grantFreePass(generateUuid(), this.clock.now());
    this.refresh();
    return true;
  }

  async consumeFreePass(sessionId: string): Promise<void> {
    const success = this.repo.consumePassForSession(sessionId, this.clock.now());
    if (success) {
      this.refresh();
    }
  }

  async applyPurchase(r: PurchaseResult): Promise<void> {
    if (r.status !== 'purchased' && r.status !== 'already_owned') {
      return;
    }

    const now = this.clock.now();
    const isLifetime = r.productId === 'ember_pro_lifetime';
    const isMonthly = r.productId === 'ember_pro_monthly';

    if (!isLifetime && !isMonthly) {
      return;
    }

    const kind = isLifetime ? ('lifetime' as const) : ('subscription' as const);
    const expiresAtMs = isLifetime ? null : (r.expiresAtMs ?? now + 30 * 86_400_000);
    const source = r.orderId?.startsWith('MOCK') ? ('mock' as const) : ('google_play' as const);

    const ent: UserEntitlement = {
      id: generateUuid(),
      kind,
      source,
      productId: r.productId ?? null,
      status: 'active',
      grantedAtMs: r.purchasedAtMs ?? now,
      expiresAtMs,
      consumedAtMs: null,
      consumedSessionId: null,
      orderId: r.orderId ?? null,
      purchaseToken: r.purchaseToken ?? null,
      lastVerifiedAtMs: now,
      metaJson: null,
    };

    this.repo.upsert(ent);
    this.refresh();
  }

  async applyOwned(
    owned: OwnedPurchase[],
    targetSource?: 'mock' | 'google_play' | 'razorpay',
  ): Promise<void> {
    const now = this.clock.now();

    if (owned.length === 0 && !targetSource) {
      this.repo.replaceAllProviderRows([]);
      this.refresh();
      return;
    }

    const isMock = owned.some(
      (p) =>
        p.orderId?.startsWith('MOCK') ||
        p.orderId?.startsWith('DEV') ||
        p.purchaseToken.startsWith('mock-') ||
        p.purchaseToken.startsWith('dev-'),
    );
    const source: 'mock' | 'google_play' | 'razorpay' =
      targetSource ?? (isMock ? 'mock' : 'google_play');

    const rows: UserEntitlement[] = owned.map((p) => {
      const isLifetime = p.productId === 'ember_pro_lifetime';
      const kind = isLifetime ? ('lifetime' as const) : ('subscription' as const);
      const expiresAtMs = isLifetime
        ? null
        : (p.expiresAtMs ?? (p.purchasedAtMs ?? now) + 30 * 86_400_000);

      const rowSource =
        p.orderId?.startsWith('MOCK') ||
        p.orderId?.startsWith('DEV') ||
        p.purchaseToken.startsWith('mock-') ||
        p.purchaseToken.startsWith('dev-')
          ? 'mock'
          : source;

      return {
        id: generateUuid(),
        kind,
        source: rowSource,
        productId: p.productId,
        status: 'active',
        grantedAtMs: p.purchasedAtMs ?? now,
        expiresAtMs,
        consumedAtMs: null,
        consumedSessionId: null,
        orderId: p.orderId ?? null,
        purchaseToken: p.purchaseToken,
        lastVerifiedAtMs: now,
        metaJson: null,
      };
    });

    if (targetSource) {
      this.repo.replaceProviderRows(targetSource, rows);
    } else {
      this.repo.replaceAllProviderRows(rows);
    }
    this.refresh();
  }

  async expireStale(): Promise<void> {
    const now = this.clock.now();
    this.repo.expireStalePasses(now);
    this.repo.expireStaleSubscriptions(now, OFFLINE_GRACE_MS);
    this.refresh();
  }

  private refresh(): void {
    const nextSnapshot = resolveEntitlement(this.repo.all(), this.clock.now());
    this.snapshot = nextSnapshot;
    for (const listener of this.listeners) {
      listener(nextSnapshot);
    }
  }
}
