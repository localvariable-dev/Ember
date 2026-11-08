/**
 * Billing & Store Interfaces
 * Master Plan Part 3 §4.1, §4.2, §4.3
 * Single Source of Truth for billing products, status, and adapter contracts.
 */

import type { ProductId } from '../data/types';

export type { ProductId };
export type Unsubscribe = () => void;

export interface BillingProduct {
  id: ProductId;
  kind: 'subscription' | 'lifetime';
  title: string;
  priceMicros: number; // 79_000_000 for ₹79
  currency: 'INR';
  localizedPrice: string; // '₹79'
  period?: 'P1M' | undefined;
}

export type PurchaseStatus = 'purchased' | 'cancelled' | 'pending' | 'failed' | 'already_owned';

export interface PurchaseError {
  code: 'network' | 'billing_unavailable' | 'item_unavailable' | 'unknown';
  message: string;
}

export interface PurchaseResult {
  status: PurchaseStatus;
  productId?: ProductId | undefined;
  orderId?: string | undefined;
  purchaseToken?: string | undefined;
  purchasedAtMs?: number | undefined;
  expiresAtMs?: number | null | undefined; // null for lifetime
  error?: PurchaseError | undefined;
}

export interface OwnedPurchase {
  productId: ProductId;
  purchaseToken: string;
  orderId?: string | undefined;
  purchasedAtMs?: number | undefined;
  expiresAtMs?: number | null | undefined;
}

/** Adapter boundary. Everything provider-specific lives behind this. */
export interface BillingService {
  readonly id: 'mock' | 'google_play' | 'razorpay';
  init(): Promise<void>;
  getProducts(): Promise<BillingProduct[]>;
  purchase(productId: ProductId): Promise<PurchaseResult>;
  restore(): Promise<OwnedPurchase[]>;
  /** For purchases completing outside the flow (pending→purchased, renewals, refunds). */
  onPurchasesUpdated(cb: (owned: OwnedPurchase[]) => void): Unsubscribe;
  dispose(): void;
}

export type MockOutcome = 'success' | 'cancel' | 'fail' | 'pending';

export interface MockConfig {
  latencyMs: number;
  nextOutcome: MockOutcome;
}

export interface MockOwnedStore {
  load(): Promise<OwnedPurchase[]>;
  save(owned: OwnedPurchase[]): Promise<void>;
}
