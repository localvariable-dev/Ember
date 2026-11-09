/**
 * Paywall Flow, Presentation & Decoupling Tests
 * Master Plan Part 1 §2.8 & Part 3 §4.1–§4.5
 */

import { openTestDatabase } from '../helpers/testDb';
import { migrate } from '../../src/data/migrations';
import { EntitlementRepo } from '../../src/data/repos/EntitlementRepo';
import { MockBillingAdapter } from '../../src/billing/MockBillingAdapter';
import { EntitlementServiceImpl } from '../../src/billing/EntitlementServiceImpl';
import { TestClock } from '../../src/domain/clock';

describe('Paywall Flow & Dynamic Anchoring Calculations', () => {
  const baseTime = 1700000000000;
  let db: ReturnType<typeof openTestDatabase>;
  let repo: EntitlementRepo;
  let clock: TestClock;
  let entitlementService: EntitlementServiceImpl;
  let billingService: MockBillingAdapter;

  beforeEach(async () => {
    db = openTestDatabase();
    migrate(db);
    repo = new EntitlementRepo(db);
    clock = new TestClock(baseTime);
    entitlementService = new EntitlementServiceImpl(repo, clock);
    billingService = new MockBillingAdapter(clock, undefined, {
      latencyMs: 0,
      nextOutcome: 'success',
    });
    await billingService.init();
    await entitlementService.init();
  });

  describe('Runtime Dynamic Anchoring Copy Math', () => {
    it('accurately derives the 15-month comparison and ₹2.60/day figures from BillingProduct data', async () => {
      const products = await billingService.getProducts();
      const monthly = products.find((p) => p.id === 'ember_pro_monthly')!;
      const lifetime = products.find((p) => p.id === 'ember_pro_lifetime')!;

      // 1. Ratio math: 1,199,000,000 / 79,000,000 = ~15.177 months
      const monthsRatio = Math.round((lifetime.priceMicros / monthly.priceMicros) * 10) / 10;
      expect(monthsRatio).toBe(15.2);
      const lifetimeLine2 = `Equal to about ${Math.round(monthsRatio)} months of Monthly.`;
      expect(lifetimeLine2).toBe('Equal to about 15 months of Monthly.');

      // 2. Daily math: 79 / 30 = ₹2.633...
      const dailyPrice = (monthly.priceMicros / (30 * 1_000_000)).toFixed(2);
      expect(dailyPrice).toBe('2.63');
    });
  });

  describe('Decoupled Controller & Entitlement Update Flow', () => {
    it('updates entitlement state from free to pro upon successful purchase', async () => {
      // Advance clock past the 72-hour trial to test the expired/free state
      clock.advance(72 * 60 * 60 * 1000 + 1);
      await entitlementService.expireStale();
      expect(entitlementService.getSnapshot().level).toBe('free');

      // Execute purchase through billing service
      const res = await billingService.purchase('ember_pro_lifetime');
      expect(res.status).toBe('purchased');

      // Controller applies purchase to entitlement service
      await entitlementService.applyPurchase(res);

      expect(entitlementService.getSnapshot().level).toBe('pro');
      expect(entitlementService.getSnapshot().plan).toBe('lifetime');

      // Verify Deep Rest 30 is now unlocked
      const gate = entitlementService.canStartProtocol('deep_rest_30');
      expect(gate).toEqual({ allowed: true, via: 'pro' });
    });

    it('restoration updates snapshot if active purchase exists', async () => {
      // Simulate prior purchase in store
      await billingService.devGrant('ember_pro_monthly');

      // Advance clock past the 72-hour trial so local db is free
      clock.advance(72 * 60 * 60 * 1000 + 1);
      await entitlementService.expireStale();
      expect(entitlementService.getSnapshot().level).toBe('free');

      // Trigger restore
      const owned = await billingService.restore();
      await entitlementService.applyOwned(owned);

      expect(entitlementService.getSnapshot().level).toBe('pro');
      expect(entitlementService.getSnapshot().plan).toBe('monthly');
    });

    it('offline behavior: maintains pro access offline within 3-day grace', async () => {
      // User has monthly subscription
      await entitlementService.applyPurchase({
        status: 'purchased',
        productId: 'ember_pro_monthly',
        orderId: 'MOCK-SUB-OFFLINE',
        purchaseToken: 'tok-off',
        purchasedAtMs: baseTime,
        expiresAtMs: baseTime + 30 * 86_400_000,
      });

      expect(entitlementService.getSnapshot().level).toBe('pro');

      // Advance time by 31 days (1 day past expiry, within 3-day grace)
      clock.advance(31 * 86_400_000);

      // Must remain pro offline
      expect(entitlementService.canStartProtocol('deep_rest_30')).toEqual({
        allowed: true,
        via: 'pro',
      });

      // Advance time by another 3 days (total 34 days, past 3-day grace)
      clock.advance(3 * 86_400_000);
      await entitlementService.expireStale();

      // Grace expired, reverts to free without deleting data
      expect(entitlementService.canStartProtocol('deep_rest_30')).toEqual({
        allowed: false,
        reason: 'pro_required',
        paywallVariant: 'pro_expired',
      });

      // Free sessions remain 100% accessible
      expect(entitlementService.canStartProtocol('rapid_reset_5')).toEqual({
        allowed: true,
        via: 'free',
      });
      expect(entitlementService.canStartProtocol('afternoon_recharge_10')).toEqual({
        allowed: true,
        via: 'free',
      });
    });
  });
});
