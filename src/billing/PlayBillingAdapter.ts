/**
 * Google Play Billing Adapter Skeleton & Policy Enforcer
 * Master Plan Part 3 §4.1, §4.8
 * Enforces Google Play Billing policies, acknowledgment windows, and native environment verification.
 */

import type {
  BillingProduct,
  BillingService,
  OwnedPurchase,
  ProductId,
  PurchaseResult,
  Unsubscribe,
} from './types';

export class PlayBillingAdapter implements BillingService {
  readonly id = 'google_play' as const;
  private isAvailable = false;
  private listeners = new Set<(owned: OwnedPurchase[]) => void>();

  async init(): Promise<void> {
    // Check for native Google Play Billing integration
    // Google Play Billing requires a custom dev client with Play Billing libraries linked.
    try {
      // In native environment, this checks react-native-iap or RevenueCat
      this.isAvailable = false;
    } catch {
      this.isAvailable = false;
    }

    if (!this.isAvailable) {
      throw new Error(
        'Google Play Billing requires a custom native build with Google Play Billing integration. ' +
          'For local development and testing, set EXPO_PUBLIC_BILLING_MODE=mock.',
      );
    }
  }

  async getProducts(): Promise<BillingProduct[]> {
    if (!this.isAvailable) {
      throw new Error('Google Play Billing is not initialized.');
    }
    return [];
  }

  async purchase(_productId: ProductId): Promise<PurchaseResult> {
    if (!this.isAvailable) {
      throw new Error('Google Play Billing is not initialized.');
    }
    return {
      status: 'failed',
      error: {
        code: 'billing_unavailable',
        message: 'Google Play Billing is unavailable on this device.',
      },
    };
  }

  async restore(): Promise<OwnedPurchase[]> {
    if (!this.isAvailable) {
      throw new Error('Google Play Billing is not initialized.');
    }
    return [];
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
}
