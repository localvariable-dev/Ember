/**
 * Mock Billing Adapter
 * Master Plan Part 3 §4.3, §4.7
 * Complete offline mock billing adapter with simulated latency, outcome controls, and persistence.
 */

import type { Clock } from '../domain/clock';
import { SystemClock } from '../domain/clock';
import type {
  BillingProduct,
  BillingService,
  MockConfig,
  MockOutcome,
  MockOwnedStore,
  OwnedPurchase,
  ProductId,
  PurchaseResult,
  Unsubscribe,
} from './types';

class InMemoryOwnedStore implements MockOwnedStore {
  private purchases: OwnedPurchase[] = [];

  async load(): Promise<OwnedPurchase[]> {
    return [...this.purchases];
  }

  async save(owned: OwnedPurchase[]): Promise<void> {
    this.purchases = [...owned];
  }
}

export class MockBillingAdapter implements BillingService {
  readonly id = 'mock' as const;
  private listeners = new Set<(owned: OwnedPurchase[]) => void>();
  private owned: OwnedPurchase[] = [];
  private clock: Clock;
  private store: MockOwnedStore;

  constructor(
    clock?: Clock,
    store?: MockOwnedStore,
    public cfg: MockConfig = { latencyMs: 900, nextOutcome: 'success' },
  ) {
    this.clock = clock ?? new SystemClock();
    this.store = store ?? new InMemoryOwnedStore();
  }

  async init(): Promise<void> {
    this.owned = await this.store.load();
  }

  async getProducts(): Promise<BillingProduct[]> {
    return [
      {
        id: 'ember_pro_monthly',
        kind: 'subscription',
        title: 'Monthly',
        priceMicros: 79_000_000,
        currency: 'INR',
        localizedPrice: '₹79',
        period: 'P1M',
      },
      {
        id: 'ember_pro_lifetime',
        kind: 'lifetime',
        title: 'Lifetime',
        priceMicros: 1_199_000_000,
        currency: 'INR',
        localizedPrice: '₹1,199',
      },
    ];
  }

  async purchase(productId: ProductId): Promise<PurchaseResult> {
    if (this.cfg.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.cfg.latencyMs));
    }

    const outcome: MockOutcome = this.cfg.nextOutcome;
    this.cfg.nextOutcome = 'success'; // Reset to success for next call

    if (outcome === 'cancel') {
      return { status: 'cancelled' };
    }

    if (outcome === 'fail') {
      return {
        status: 'failed',
        productId,
        error: { code: 'unknown', message: 'Mock purchase failed' },
      };
    }

    if (outcome === 'pending') {
      return {
        status: 'pending',
        productId,
      };
    }

    // Success outcome
    const now = this.clock.now();
    const isMonthly = productId === 'ember_pro_monthly';
    const expiresAtMs = isMonthly ? now + 30 * 86_400_000 : null;

    // Check if already owned
    const existing = this.owned.find((o) => o.productId === productId);
    if (
      existing &&
      (existing.expiresAtMs === null ||
        (existing.expiresAtMs !== undefined && existing.expiresAtMs > now))
    ) {
      return {
        status: 'already_owned',
        productId,
        orderId: existing.orderId,
        purchaseToken: existing.purchaseToken,
        purchasedAtMs: existing.purchasedAtMs,
        expiresAtMs: existing.expiresAtMs,
      };
    }

    const orderId = `MOCK-${now}`;
    const purchaseToken = `mock-token-${now}`;

    const res: PurchaseResult = {
      status: 'purchased',
      productId,
      orderId,
      purchaseToken,
      purchasedAtMs: now,
      expiresAtMs,
    };

    const ownedPurchase: OwnedPurchase = {
      productId,
      purchaseToken,
      orderId,
      purchasedAtMs: now,
      expiresAtMs,
    };

    this.owned = [...this.owned.filter((o) => o.productId !== productId), ownedPurchase];
    await this.store.save(this.owned);
    this.notifyListeners();

    return res;
  }

  async restore(): Promise<OwnedPurchase[]> {
    this.owned = await this.store.load();
    return [...this.owned];
  }

  onPurchasesUpdated(cb: (owned: OwnedPurchase[]) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  dispose(): void {
    this.listeners.clear();
  }

  private notifyListeners(): void {
    const list = [...this.owned];
    for (const listener of this.listeners) {
      listener(list);
    }
  }

  setNextOutcome(outcome: MockOutcome): void {
    this.cfg.nextOutcome = outcome;
  }

  /* Dev helpers for DevPanel and tests */
  async devGrant(productId: ProductId): Promise<PurchaseResult> {
    const now = this.clock.now();
    const isMonthly = productId === 'ember_pro_monthly';
    const expiresAtMs = isMonthly ? now + 30 * 86_400_000 : null;
    const purchaseToken = `dev-token-${now}`;
    const orderId = `DEV-${now}`;

    const ownedPurchase: OwnedPurchase = {
      productId,
      purchaseToken,
      orderId,
      purchasedAtMs: now,
      expiresAtMs,
    };

    this.owned = [...this.owned.filter((o) => o.productId !== productId), ownedPurchase];
    await this.store.save(this.owned);
    this.notifyListeners();

    return {
      status: 'purchased',
      productId,
      orderId,
      purchaseToken,
      purchasedAtMs: now,
      expiresAtMs,
    };
  }

  async devRevokeAll(): Promise<void> {
    this.owned = [];
    await this.store.save([]);
    this.notifyListeners();
  }
}
