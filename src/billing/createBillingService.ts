/**
 * Billing Service Factory
 * Master Plan Part 3 §4.1, §4.3, §4.8
 * Selects the active billing adapter based on EXPO_PUBLIC_BILLING_MODE.
 */

import type { Clock } from '../domain/clock';
import { MockBillingAdapter } from './MockBillingAdapter';
import { PlayBillingAdapter } from './PlayBillingAdapter';
import type { BillingService, MockOwnedStore } from './types';

export function createBillingService(
  envMode?: string,
  clock?: Clock,
  store?: MockOwnedStore,
): BillingService {
  const mode = envMode || process.env.EXPO_PUBLIC_BILLING_MODE || 'mock';

  switch (mode) {
    case 'mock':
      return new MockBillingAdapter(clock, store);
    case 'google_play':
      return new PlayBillingAdapter();
    case 'razorpay':
      throw new Error(
        'Razorpay is not permitted for Play-distributed digital goods under Google Play Payments policy.',
      );
    default:
      return new MockBillingAdapter(clock, store);
  }
}
