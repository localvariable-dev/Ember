/**
 * Entitlement Service & Resolution Rules Tests
 * Master Plan Part 3 §4.1–§4.6, Part 4 §5.2
 */

import { openTestDatabase } from '../helpers/testDb';
import { migrate } from '../../src/data/migrations';
import { EntitlementRepo } from '../../src/data/repos/EntitlementRepo';
import type { UserEntitlement } from '../../src/data/types';
import { EntitlementServiceImpl, OFFLINE_GRACE_DAYS, resolveEntitlement } from '../../src/billing';
import { TestClock } from '../../src/domain/clock';

describe('Entitlement Resolution & Service', () => {
  const baseTime = 1700000000000;

  describe('Pure resolveEntitlement()', () => {
    it('returns level free for an empty entitlements list', () => {
      const snapshot = resolveEntitlement([], baseTime);
      expect(snapshot.level).toBe('free');
      expect(snapshot.plan).toBe('none');
      expect(snapshot.proExpiresAtMs).toBeNull();
      expect(snapshot.passAvailable).toBe(false);
    });

    it('returns level pro and plan lifetime for an active lifetime entitlement', () => {
      const rows: UserEntitlement[] = [
        {
          id: 'ent-1',
          kind: 'lifetime',
          source: 'mock',
          productId: 'ember_pro_lifetime',
          status: 'active',
          grantedAtMs: baseTime - 10000,
          expiresAtMs: null,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: 'MOCK-1',
          purchaseToken: 'tok-1',
          lastVerifiedAtMs: baseTime - 10000,
          metaJson: null,
        },
      ];

      const snapshot = resolveEntitlement(rows, baseTime);
      expect(snapshot.level).toBe('pro');
      expect(snapshot.plan).toBe('lifetime');
      expect(snapshot.proExpiresAtMs).toBeNull();
    });

    it('returns level pro and plan monthly for an active subscription before expiry', () => {
      const expiresAt = baseTime + 10 * 86_400_000;
      const rows: UserEntitlement[] = [
        {
          id: 'ent-sub',
          kind: 'subscription',
          source: 'mock',
          productId: 'ember_pro_monthly',
          status: 'active',
          grantedAtMs: baseTime - 5 * 86_400_000,
          expiresAtMs: expiresAt,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: 'MOCK-2',
          purchaseToken: 'tok-2',
          lastVerifiedAtMs: baseTime - 5 * 86_400_000,
          metaJson: null,
        },
      ];

      const snapshot = resolveEntitlement(rows, baseTime);
      expect(snapshot.level).toBe('pro');
      expect(snapshot.plan).toBe('monthly');
      expect(snapshot.proExpiresAtMs).toBe(expiresAt);
    });

    it('honors active subscription during the 3-day offline grace period', () => {
      const expiresAt = baseTime - 1 * 86_400_000; // expired 1 day ago
      // But now is within 3 days grace (OFFLINE_GRACE_MS)
      const rows: UserEntitlement[] = [
        {
          id: 'ent-sub',
          kind: 'subscription',
          source: 'mock',
          productId: 'ember_pro_monthly',
          status: 'active',
          grantedAtMs: baseTime - 31 * 86_400_000,
          expiresAtMs: expiresAt,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: 'MOCK-2',
          purchaseToken: 'tok-2',
          lastVerifiedAtMs: baseTime - 31 * 86_400_000,
          metaJson: null,
        },
      ];

      const snapshot = resolveEntitlement(rows, baseTime);
      expect(snapshot.level).toBe('pro');
      expect(snapshot.plan).toBe('monthly');
      expect(snapshot.proExpiresAtMs).toBe(expiresAt);
    });

    it('defaults to free after the 3-day offline grace period has passed', () => {
      const expiresAt = baseTime - (OFFLINE_GRACE_DAYS + 1) * 86_400_000; // expired 4 days ago
      const rows: UserEntitlement[] = [
        {
          id: 'ent-sub',
          kind: 'subscription',
          source: 'mock',
          productId: 'ember_pro_monthly',
          status: 'active',
          grantedAtMs: baseTime - 35 * 86_400_000,
          expiresAtMs: expiresAt,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: 'MOCK-2',
          purchaseToken: 'tok-2',
          lastVerifiedAtMs: baseTime - 35 * 86_400_000,
          metaJson: null,
        },
      ];

      const snapshot = resolveEntitlement(rows, baseTime);
      expect(snapshot.level).toBe('free');
      expect(snapshot.plan).toBe('none');
    });

    it('returns level free_pass when an unexpired free pass is available', () => {
      const passExpiresAt = baseTime + 7 * 86_400_000;
      const rows: UserEntitlement[] = [
        {
          id: 'pass-1',
          kind: 'free_pass',
          source: 'app',
          productId: null,
          status: 'available',
          grantedAtMs: baseTime - 86_400_000,
          expiresAtMs: passExpiresAt,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: null,
          purchaseToken: null,
          lastVerifiedAtMs: baseTime,
          metaJson: null,
        },
      ];

      const snapshot = resolveEntitlement(rows, baseTime);
      expect(snapshot.level).toBe('free_pass');
      expect(snapshot.passAvailable).toBe(true);
      expect(snapshot.passExpiresAtMs).toBe(passExpiresAt);
    });

    it('precedence: Pro always wins over active Free Pass', () => {
      const rows: UserEntitlement[] = [
        {
          id: 'pass-1',
          kind: 'free_pass',
          source: 'app',
          productId: null,
          status: 'available',
          grantedAtMs: baseTime,
          expiresAtMs: baseTime + 7 * 86_400_000,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: null,
          purchaseToken: null,
          lastVerifiedAtMs: baseTime,
          metaJson: null,
        },
        {
          id: 'life-1',
          kind: 'lifetime',
          source: 'mock',
          productId: 'ember_pro_lifetime',
          status: 'active',
          grantedAtMs: baseTime,
          expiresAtMs: null,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: 'MOCK-1',
          purchaseToken: 'tok-1',
          lastVerifiedAtMs: baseTime,
          metaJson: null,
        },
      ];

      const snapshot = resolveEntitlement(rows, baseTime);
      expect(snapshot.level).toBe('pro');
      expect(snapshot.plan).toBe('lifetime');
      expect(snapshot.passAvailable).toBe(true); // Coexists in background
    });
  });

  describe('EntitlementServiceImpl Integration', () => {
    let db: ReturnType<typeof openTestDatabase>;
    let repo: EntitlementRepo;
    let clock: TestClock;
    let service: EntitlementServiceImpl;

    beforeEach(() => {
      db = openTestDatabase();
      migrate(db);
      repo = new EntitlementRepo(db);
      clock = new TestClock(baseTime);
      service = new EntitlementServiceImpl(repo, clock);
    });

    it('initializes from SQLite and broadcasts snapshot to subscribers', async () => {
      let currentLevel = '';
      service.subscribe((s) => {
        currentLevel = s.level;
      });

      expect(currentLevel).toBe('free');

      await service.applyPurchase({
        status: 'purchased',
        productId: 'ember_pro_lifetime',
        orderId: 'MOCK-100',
        purchaseToken: 'tok-100',
        purchasedAtMs: baseTime,
      });

      expect(currentLevel).toBe('pro');
      expect(service.getSnapshot().plan).toBe('lifetime');
    });

    it('grants a persisted 72-hour trial exactly once and expires it without subscription grace', async () => {
      await service.init();
      const trial = repo.all().find((row) => row.productId === 'ember_pro_trial');
      expect(trial?.expiresAtMs).toBe(baseTime + 72 * 60 * 60 * 1000);
      expect(service.getSnapshot()).toMatchObject({ level: 'pro', plan: 'trial' });

      clock.advance(72 * 60 * 60 * 1000);
      await service.expireStale();
      expect(service.getSnapshot().level).toBe('free');
      expect(repo.hasActivePro(clock.now())).toBe(false);
      expect(repo.all().filter((row) => row.productId === 'ember_pro_trial')).toHaveLength(1);

      await service.init();
      expect(repo.all().filter((row) => row.productId === 'ember_pro_trial')).toHaveLength(1);
    });

    it('gives lifetime and purchased Pro precedence over trial and keeps a free pass independent', async () => {
      await service.init();
      repo.grantFreePass('independent-pass', baseTime);
      await service.expireStale();
      await service.applyPurchase({
        status: 'purchased',
        productId: 'ember_pro_lifetime',
        orderId: 'MOCK-LIFE',
        purchaseToken: 'life-token',
        purchasedAtMs: baseTime,
      });
      expect(service.getSnapshot()).toMatchObject({
        level: 'pro',
        plan: 'lifetime',
        passAvailable: true,
        trialExpiresAtMs: null,
      });
    });

    it('gates protocols correctly (5m and 10m free, 30m requires Pro or Pass)', () => {
      expect(service.canStartProtocol('rapid_reset_5')).toEqual({ allowed: true, via: 'free' });
      expect(service.canStartProtocol('afternoon_recharge_10')).toEqual({
        allowed: true,
        via: 'free',
      });

      // Free user attempting 30m
      const gate30 = service.canStartProtocol('deep_rest_30');
      expect(gate30.allowed).toBe(false);
      if (!gate30.allowed) {
        expect(gate30.reason).toBe('pro_required');
        expect(gate30.paywallVariant).toBe('default');
      }
    });

    it('contextual paywall variants: post_taste, pass_expired, pro_expired', async () => {
      // 1. Grant pass and consume it
      await service.grantFreePass();
      await service.consumeFreePass('session-abc');
      const gateAfterConsumed = service.canStartProtocol('deep_rest_30');
      expect(gateAfterConsumed.allowed).toBe(false);
      if (!gateAfterConsumed.allowed) {
        expect(gateAfterConsumed.paywallVariant).toBe('post_taste');
      }

      // 2. Pro expired variant
      db.run('DELETE FROM user_entitlements;');
      await service.applyPurchase({
        status: 'purchased',
        productId: 'ember_pro_monthly',
        orderId: 'MOCK-EXPIRED',
        purchaseToken: 'tok-exp',
        purchasedAtMs: baseTime - 40 * 86_400_000,
        expiresAtMs: baseTime - 10 * 86_400_000, // past grace
      });
      await service.expireStale();

      const gateAfterSubExpired = service.canStartProtocol('deep_rest_30');
      expect(gateAfterSubExpired.allowed).toBe(false);
      if (!gateAfterSubExpired.allowed) {
        expect(gateAfterSubExpired.paywallVariant).toBe('pro_expired');
      }
    });

    it('ambient bed and voice gating: free beds/voices pass; pro beds/voices require Pro (not Pass)', async () => {
      // Free voice and beds
      expect(service.canUseBed('rain')).toEqual({ allowed: true, via: 'free' });
      expect(service.canUseBed('brown_noise')).toEqual({ allowed: true, via: 'free' });
      expect(service.canUseBed('theta_6hz')).toEqual({ allowed: true, via: 'free' });
      expect(service.canUseVoice('maya_warm')).toEqual({ allowed: true, via: 'free' });

      // Premium bed & voice with free user
      expect(service.canUseBed('ocean_drift')).toEqual({
        allowed: false,
        reason: 'pro_required',
        paywallVariant: 'bed_locked',
      });
      expect(service.canUseVoice('arjun_deep')).toEqual({
        allowed: false,
        reason: 'pro_required',
        paywallVariant: 'voice_locked',
      });

      // Free pass does NOT unlock premium voices or beds
      await service.grantFreePass();
      expect(service.canStartProtocol('deep_rest_30')).toEqual({
        allowed: true,
        via: 'free_pass',
      });
      expect(service.canUseBed('ocean_drift')).toEqual({
        allowed: false,
        reason: 'pro_required',
        paywallVariant: 'bed_locked',
      });
      expect(service.canUseVoice('arjun_deep')).toEqual({
        allowed: false,
        reason: 'pro_required',
        paywallVariant: 'voice_locked',
      });

      // Upgrading to Pro unlocks everything
      await service.applyPurchase({
        status: 'purchased',
        productId: 'ember_pro_lifetime',
      });
      expect(service.canUseBed('ocean_drift')).toEqual({ allowed: true, via: 'pro' });
      expect(service.canUseVoice('arjun_deep')).toEqual({ allowed: true, via: 'pro' });
      expect(service.canViewProInsights()).toEqual({ allowed: true, via: 'pro' });
    });

    it('enforces lifetime cap of 1 free pass per user', async () => {
      const first = await service.grantFreePass();
      expect(first).toBe(true);

      // Attempting a second pass must fail
      const second = await service.grantFreePass();
      expect(second).toBe(false);
    });

    it('applyOwned() reconciles restored purchases and revokes missing ones', async () => {
      // User buys monthly
      await service.applyPurchase({
        status: 'purchased',
        productId: 'ember_pro_monthly',
        orderId: 'MOCK-SUB-1',
        purchaseToken: 'tok-sub-1',
        purchasedAtMs: baseTime,
        expiresAtMs: baseTime + 30 * 86_400_000,
      });
      expect(service.getSnapshot().level).toBe('pro');

      // Sync returns empty (e.g. refunded or revoked)
      await service.applyOwned([]);
      expect(service.getSnapshot().level).toBe('free');
      expect(service.getSnapshot().plan).toBe('none');
    });
  });
});
