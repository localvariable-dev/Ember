/**
 * Entitlement Types & Resolution Rules
 * Master Plan Part 3 §4.1, §4.3, §4.6
 * Defines pure resolution logic, gating contracts, and entitlement snapshots.
 */

import type { ProtocolId } from '../domain/constants';
import type { UserEntitlement } from '../data/types';
import type { OwnedPurchase, PurchaseResult, Unsubscribe } from './types';

export const OFFLINE_GRACE_DAYS = 3;
export const OFFLINE_GRACE_MS = OFFLINE_GRACE_DAYS * 86_400_000; // 259_200_000 ms

export type AccessLevel = 'pro' | 'free_pass' | 'free';

export interface EntitlementSnapshot {
  level: AccessLevel;
  plan: 'none' | 'monthly' | 'lifetime';
  proExpiresAtMs: number | null; // null for lifetime or none
  passAvailable: boolean;
  passExpiresAtMs: number | null;
  passConsumedAtMs: number | null;
  passGrantedCount: number;
  lastVerifiedAtMs: number | null;
}

export type PaywallVariant =
  | 'default'
  | 'post_taste'
  | 'pass_expired'
  | 'pro_expired'
  | 'bed_locked'
  | 'voice_locked'
  | 'insights';

export type GateDecision =
  | { allowed: true; via: 'free' | 'pro' | 'free_pass' }
  | { allowed: false; reason: 'pro_required'; paywallVariant: PaywallVariant };

export interface EntitlementService {
  init(): Promise<void>;
  getSnapshot(): EntitlementSnapshot;
  subscribe(cb: (s: EntitlementSnapshot) => void): Unsubscribe;
  canStartProtocol(id: ProtocolId): GateDecision;
  canUseBed(bedId: string): GateDecision;
  canUseVoice(voiceId: string): GateDecision;
  canViewProInsights(): GateDecision;
  grantFreePass(): Promise<boolean>; // false if rules forbid
  consumeFreePass(sessionId: string): Promise<void>; // idempotent
  applyPurchase(r: PurchaseResult): Promise<void>;
  applyOwned(
    owned: OwnedPurchase[],
    targetSource?: 'mock' | 'google_play' | 'razorpay' | undefined,
  ): Promise<void>; // restore / updates; replaces provider-sourced rows
  expireStale(): Promise<void>; // run on foreground
}

/**
 * Pure resolution function: resolves user entitlement snapshot from rows and current time.
 * Evaluates tiers: Lifetime Pro > Monthly Subscription (with 3-day offline grace) > Free Pass > Free.
 */
export function resolveEntitlement(
  rows: UserEntitlement[],
  nowMs = Date.now(),
): EntitlementSnapshot {
  let passAvailable = false;
  let passExpiresAtMs: number | null = null;
  let passConsumedAtMs: number | null = null;
  let passGrantedCount = 0;
  let lastVerifiedAtMs: number | null = null;

  let activeLifetimeRow: UserEntitlement | null = null;
  let activeSubRow: UserEntitlement | null = null;
  let availablePassRow: UserEntitlement | null = null;

  for (const row of rows) {
    if (row.lastVerifiedAtMs) {
      if (lastVerifiedAtMs === null || row.lastVerifiedAtMs > lastVerifiedAtMs) {
        lastVerifiedAtMs = row.lastVerifiedAtMs;
      }
    }

    if (row.kind === 'free_pass') {
      passGrantedCount++;
      if (row.status === 'consumed' && row.consumedAtMs) {
        if (passConsumedAtMs === null || row.consumedAtMs > passConsumedAtMs) {
          passConsumedAtMs = row.consumedAtMs;
        }
      }
      if (row.status === 'available') {
        const isValid = row.expiresAtMs === null || nowMs < row.expiresAtMs;
        if (isValid) {
          passAvailable = true;
          passExpiresAtMs = row.expiresAtMs;
          availablePassRow = row;
        }
      }
    } else if (row.kind === 'lifetime') {
      if (row.status === 'active') {
        activeLifetimeRow = row;
      }
    } else if (row.kind === 'subscription') {
      if (row.status === 'active') {
        const isValidWithGrace =
          row.expiresAtMs === null || nowMs < row.expiresAtMs + OFFLINE_GRACE_MS;
        if (isValidWithGrace) {
          // If multiple subscriptions exist, pick the latest expiry
          if (
            !activeSubRow ||
            (row.expiresAtMs ?? Infinity) > (activeSubRow.expiresAtMs ?? -Infinity)
          ) {
            activeSubRow = row;
          }
        }
      }
    }
  }

  // 1. Lifetime Pro active
  if (activeLifetimeRow) {
    return {
      level: 'pro',
      plan: 'lifetime',
      proExpiresAtMs: null,
      passAvailable,
      passExpiresAtMs,
      passConsumedAtMs,
      passGrantedCount,
      lastVerifiedAtMs,
    };
  }

  // 2. Subscription Pro active (within expires_at + 3-day offline grace)
  if (activeSubRow) {
    return {
      level: 'pro',
      plan: 'monthly',
      proExpiresAtMs: activeSubRow.expiresAtMs,
      passAvailable,
      passExpiresAtMs,
      passConsumedAtMs,
      passGrantedCount,
      lastVerifiedAtMs,
    };
  }

  // 3. Free Pass available
  if (availablePassRow) {
    return {
      level: 'free_pass',
      plan: 'none',
      proExpiresAtMs: null,
      passAvailable: true,
      passExpiresAtMs: availablePassRow.expiresAtMs,
      passConsumedAtMs,
      passGrantedCount,
      lastVerifiedAtMs,
    };
  }

  // 4. Free tier
  return {
    level: 'free',
    plan: 'none',
    proExpiresAtMs: null,
    passAvailable,
    passExpiresAtMs,
    passConsumedAtMs,
    passGrantedCount,
    lastVerifiedAtMs,
  };
}
