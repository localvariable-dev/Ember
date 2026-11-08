/**
 * Mock Billing Adapter & Factory Tests
 * Master Plan Part 3 §4.1, §4.3, §4.7
 */

import { MockBillingAdapter } from '../../src/billing/MockBillingAdapter';
import { createBillingService } from '../../src/billing/createBillingService';
import { TestClock } from '../../src/domain/clock';

describe('MockBillingAdapter & BillingService Factory', () => {
  const baseTime = 1700000000000;
  let clock: TestClock;
  let adapter: MockBillingAdapter;

  beforeEach(async () => {
    clock = new TestClock(baseTime);
    adapter = new MockBillingAdapter(clock, undefined, { latencyMs: 0, nextOutcome: 'success' });
    await adapter.init();
  });

  describe('Factory createBillingService()', () => {
    it('creates MockBillingAdapter when mode is mock or unset', () => {
      const s1 = createBillingService('mock');
      expect(s1.id).toBe('mock');

      const s2 = createBillingService(undefined);
      expect(s2.id).toBe('mock');
    });

    it('rejects Razorpay under Google Play policy for digital goods', () => {
      expect(() => createBillingService('razorpay')).toThrow(
        /Razorpay is not permitted for Play-distributed digital goods/,
      );
    });

    it('creates PlayBillingAdapter when mode is google_play', () => {
      const playService = createBillingService('google_play');
      expect(playService.id).toBe('google_play');
    });
  });

  describe('Catalogue & Pricing', () => {
    it('returns the 2 canonical products with INR currency and micro-units', async () => {
      const products = await adapter.getProducts();
      expect(products).toHaveLength(2);

      const monthly = products.find((p) => p.id === 'ember_pro_monthly');
      expect(monthly).toBeDefined();
      expect(monthly?.kind).toBe('subscription');
      expect(monthly?.currency).toBe('INR');
      expect(monthly?.priceMicros).toBe(79_000_000);
      expect(monthly?.localizedPrice).toBe('₹79');
      expect(monthly?.period).toBe('P1M');

      const lifetime = products.find((p) => p.id === 'ember_pro_lifetime');
      expect(lifetime).toBeDefined();
      expect(lifetime?.kind).toBe('lifetime');
      expect(lifetime?.currency).toBe('INR');
      expect(lifetime?.priceMicros).toBe(1_199_000_000);
      expect(lifetime?.localizedPrice).toBe('₹1,199');
    });
  });

  describe('Purchase Outcomes', () => {
    it('processes successful monthly purchase with 30-day expiration', async () => {
      const res = await adapter.purchase('ember_pro_monthly');
      expect(res.status).toBe('purchased');
      expect(res.productId).toBe('ember_pro_monthly');
      expect(res.orderId).toContain('MOCK-');
      expect(res.purchaseToken).toContain('mock-token-');
      expect(res.purchasedAtMs).toBe(baseTime);
      expect(res.expiresAtMs).toBe(baseTime + 30 * 86_400_000);

      // Verify restore returns the owned purchase
      const restored = await adapter.restore();
      expect(restored).toHaveLength(1);
      expect(restored[0]?.productId).toBe('ember_pro_monthly');
    });

    it('processes successful lifetime purchase with null expiration', async () => {
      const res = await adapter.purchase('ember_pro_lifetime');
      expect(res.status).toBe('purchased');
      expect(res.productId).toBe('ember_pro_lifetime');
      expect(res.expiresAtMs).toBeNull();
    });

    it('handles already_owned status for subsequent purchases of the same product', async () => {
      await adapter.purchase('ember_pro_lifetime');
      const second = await adapter.purchase('ember_pro_lifetime');
      expect(second.status).toBe('already_owned');
      expect(second.productId).toBe('ember_pro_lifetime');
    });

    it('handles cancelled outcome', async () => {
      adapter.setNextOutcome('cancel');
      const res = await adapter.purchase('ember_pro_monthly');
      expect(res.status).toBe('cancelled');
    });

    it('handles failed outcome', async () => {
      adapter.setNextOutcome('fail');
      const res = await adapter.purchase('ember_pro_monthly');
      expect(res.status).toBe('failed');
      expect(res.error?.code).toBe('unknown');
    });

    it('handles pending outcome', async () => {
      adapter.setNextOutcome('pending');
      const res = await adapter.purchase('ember_pro_monthly');
      expect(res.status).toBe('pending');
      expect(res.productId).toBe('ember_pro_monthly');
    });
  });

  describe('Listeners & Dev Helpers', () => {
    it('notifies onPurchasesUpdated listeners on purchases and dev grants', async () => {
      let notifiedCount = 0;
      const unsub = adapter.onPurchasesUpdated((owned) => {
        notifiedCount = owned.length;
      });

      await adapter.devGrant('ember_pro_monthly');
      expect(notifiedCount).toBe(1);

      await adapter.devRevokeAll();
      expect(notifiedCount).toBe(0);

      unsub();
    });
  });
});
