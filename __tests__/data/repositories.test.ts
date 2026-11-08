/**
 * Repository CRUD Tests
 * Master Plan Part 4 §5.3
 * Tests CRUD operations, edge cases, and constraints across all domain repositories.
 */

import { openTestDatabase } from '../../src/data/db';
import { migrate } from '../../src/data/migrations';
import {
  EntitlementRepo,
  LedgerRepo,
  PrefsRepo,
  ProtocolRepo,
  StreakRepo,
  VoiceRepo,
} from '../../src/data/repos';

describe('Repository CRUD Operations', () => {
  let db: ReturnType<typeof openTestDatabase>;

  beforeEach(() => {
    db = openTestDatabase(':memory:');
    migrate(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('StreakRepo', () => {
    it('retrieves initial zero streak and persists updates', () => {
      const repo = new StreakRepo(db);

      const initial = repo.get();
      expect(initial.currentStreak).toBe(0);
      expect(initial.longestStreak).toBe(0);
      expect(initial.lastCreditDay).toBeNull();
      expect(initial.graceBanked).toBe(0);

      repo.save({
        currentStreak: 5,
        longestStreak: 5,
        lastCreditDay: '2026-06-15',
        graceBanked: 1,
        graceProgress: 0,
        graceEarnedTotal: 1,
        graceUsedTotal: 0,
      });

      const updated = repo.get();
      expect(updated.currentStreak).toBe(5);
      expect(updated.longestStreak).toBe(5);
      expect(updated.lastCreditDay).toBe('2026-06-15');
      expect(updated.graceBanked).toBe(1);
    });
  });

  describe('LedgerRepo', () => {
    it('records practice days and accumulates minutes and sessions', () => {
      const repo = new LedgerRepo(db);

      repo.upsertPractice('2026-06-15', 300_000);
      let row = repo.getByDay('2026-06-15');
      expect(row).toEqual({
        localDay: '2026-06-15',
        kind: 'practice',
        committedMs: 300_000,
        sessions: 1,
      });

      // Second practice on same calendar day accumulates
      repo.upsertPractice('2026-06-15', 600_000);
      row = repo.getByDay('2026-06-15');
      expect(row?.committedMs).toBe(900_000);
      expect(row?.sessions).toBe(2);
    });

    it('marks grace day without overwriting an existing practice day', () => {
      const repo = new LedgerRepo(db);

      // 1. Mark grace on an empty day
      repo.markGrace('2026-06-16');
      const graceRow = repo.getByDay('2026-06-16');
      expect(graceRow?.kind).toBe('grace');

      // 2. Mark grace on an existing practice day -> must NOT overwrite practice
      repo.upsertPractice('2026-06-17', 300_000);
      repo.markGrace('2026-06-17');
      const practiceRow = repo.getByDay('2026-06-17');
      expect(practiceRow?.kind).toBe('practice');
      expect(practiceRow?.committedMs).toBe(300_000);
    });

    it('upgrades a grace-marked day to practice if the user practices on that day later', () => {
      const repo = new LedgerRepo(db);

      repo.markGrace('2026-06-18');
      expect(repo.getByDay('2026-06-18')?.kind).toBe('grace');

      repo.upsertPractice('2026-06-18', 600_000);
      const row = repo.getByDay('2026-06-18');
      expect(row?.kind).toBe('practice');
      expect(row?.committedMs).toBe(600_000);
      expect(row?.sessions).toBe(1);
    });

    it('queries date ranges accurately', () => {
      const repo = new LedgerRepo(db);

      repo.upsertPractice('2026-06-10', 300_000);
      repo.markGrace('2026-06-11');
      repo.upsertPractice('2026-06-12', 600_000);
      repo.upsertPractice('2026-06-15', 300_000);

      const range = repo.getRange('2026-06-10', '2026-06-12');
      expect(range.length).toBe(3);
      expect(range.map((r) => r.localDay)).toEqual(['2026-06-10', '2026-06-11', '2026-06-12']);
    });
  });

  describe('EntitlementRepo', () => {
    it('manages Pro lifetime and subscription resolution', () => {
      const repo = new EntitlementRepo(db);
      const now = 1_000_000;

      expect(repo.hasActivePro(now)).toBe(false);

      // Add active subscription expiring in future
      repo.upsert({
        id: 'sub_1',
        kind: 'subscription',
        source: 'mock',
        productId: 'ember_pro_monthly',
        status: 'active',
        grantedAtMs: now - 100_000,
        expiresAtMs: now + 500_000,
        consumedAtMs: null,
        consumedSessionId: null,
        orderId: 'order_1',
        purchaseToken: 'tok_1',
        lastVerifiedAtMs: now,
        metaJson: null,
      });

      expect(repo.hasActivePro(now)).toBe(true);
      // Expired in distant future
      expect(repo.hasActivePro(now + 600_000)).toBe(false);

      // Lifetime overrides expiry
      repo.upsert({
        id: 'life_1',
        kind: 'lifetime',
        source: 'google_play',
        productId: 'ember_pro_lifetime',
        status: 'active',
        grantedAtMs: now,
        expiresAtMs: null,
        consumedAtMs: null,
        consumedSessionId: null,
        orderId: 'order_life',
        purchaseToken: 'tok_life',
        lastVerifiedAtMs: now,
        metaJson: null,
      });

      expect(repo.hasActivePro(now + 10_000_000_000)).toBe(true);
    });

    it('grants and consumes Free Pass with accurate lifecycle', () => {
      const repo = new EntitlementRepo(db);
      const now = 2_000_000;

      expect(repo.hasAvailablePass(now)).toBe(false);
      expect(repo.countPassesGranted()).toBe(0);

      const pass = repo.grantFreePass('pass_123', now);
      expect(pass.id).toBe('pass_123');
      expect(pass.status).toBe('available');
      expect(pass.expiresAtMs).toBe(now + 14 * 86_400_000);
      expect(repo.countPassesGranted()).toBe(1);
      expect(repo.hasAvailablePass(now)).toBe(true);

      // Consume pass
      const consumed = repo.consumeFreePass('pass_123', 'session_abc', now + 1000);
      expect(consumed).toBe(true);

      const passAfter = repo.getById('pass_123');
      expect(passAfter?.status).toBe('consumed');
      expect(passAfter?.consumedSessionId).toBe('session_abc');
      expect(repo.hasAvailablePass(now)).toBe(false);
      // Lifetime grant count remains 1
      expect(repo.countPassesGranted()).toBe(1);
    });

    it('replaces provider rows atomically during receipt reconciliation', () => {
      const repo = new EntitlementRepo(db);
      const now = 3_000_000;

      repo.upsert({
        id: 'sub_old',
        kind: 'subscription',
        source: 'mock',
        productId: 'ember_pro_monthly',
        status: 'expired',
        grantedAtMs: now - 2_000_000,
        expiresAtMs: now - 1_000_000,
        consumedAtMs: null,
        consumedSessionId: null,
        orderId: 'ord_old',
        purchaseToken: 'tok_old',
        lastVerifiedAtMs: now - 1_000_000,
        metaJson: null,
      });

      repo.replaceProviderRows('mock', [
        {
          id: 'sub_new',
          kind: 'subscription',
          source: 'mock',
          productId: 'ember_pro_monthly',
          status: 'active',
          grantedAtMs: now,
          expiresAtMs: now + 30 * 86_400_000,
          consumedAtMs: null,
          consumedSessionId: null,
          orderId: 'ord_new',
          purchaseToken: 'tok_new',
          lastVerifiedAtMs: now,
          metaJson: null,
        },
      ]);

      expect(repo.getById('sub_old')).toBeNull();
      expect(repo.getById('sub_new')?.status).toBe('active');
    });
  });

  describe('PrefsRepo', () => {
    it('retrieves default preferences and patches fields with boolean conversions', () => {
      const repo = new PrefsRepo(db);

      const prefs = repo.get();
      expect(prefs.selectedVoiceId).toBe('maya_warm');
      expect(prefs.hapticsEnabled).toBe(true);
      expect(prefs.notificationsEnabled).toBe(false);
      expect(prefs.voiceVolume).toBe(0.9);

      const patched = repo.patch({
        voiceVolume: 0.75,
        notificationsEnabled: true,
        reminderMin: 855,
      });

      expect(patched.voiceVolume).toBe(0.75);
      expect(patched.notificationsEnabled).toBe(true);
      expect(patched.reminderMin).toBe(855);

      const reRead = repo.get();
      expect(reRead.voiceVolume).toBe(0.75);
      expect(reRead.notificationsEnabled).toBe(true);
      expect(reRead.reminderMin).toBe(855);
    });
  });

  describe('ProtocolRepo & VoiceRepo', () => {
    it('retrieves seeded protocols and ignores older asset versions', () => {
      const repo = new ProtocolRepo(db);
      const protocols = repo.all();
      expect(protocols.length).toBe(3);

      const rapid = repo.getById('rapid_reset_5');
      expect(rapid?.minutes).toBe(5);
      expect(rapid?.supportsModes).toBe(false);
      expect(rapid?.sighInScript).toBe(true);

      // Attempting to seed with older asset_version (0 vs 1) must be ignored
      repo.seed([
        {
          id: 'rapid_reset_5',
          title: 'Downgraded Title',
          subtitle: 'Sub',
          minutes: 5,
          plannedMs: 300_000,
          tier: 'free',
          supportsModes: false,
          sighInScript: true,
          assetVersion: 0,
          sortOrder: 1,
        },
      ]);

      const unchanged = repo.getById('rapid_reset_5');
      expect(unchanged?.title).toBe('Rapid Reset');
    });

    it('installs voices and imports custom voice packs', () => {
      const repo = new VoiceRepo(db);
      const voices = repo.all();
      expect(voices.length).toBe(2);

      repo.importPack(
        {
          id: 'kiran_soft',
          name: 'Kiran',
          subtitle: 'Gentle twilight whisper · en-IN',
          locale: 'en-IN',
          tier: 'pro',
          delivery: 'imported',
          status: 'installed',
          previewAssetKey: 'kiran_prev',
          packSizeBytes: 15_000_000,
          remotePackUrl: null,
          sortOrder: 3,
        },
        [
          {
            protocolId: 'rapid_reset_5',
            voiceId: 'kiran_soft',
            voiceFocusSource: 'file:///data/voices/kiran/5.ogg',
            voiceSleepSource: null,
            cuesFocusJson: '[]',
            cuesSleepJson: null,
            assetVersion: 1,
          },
        ],
      );

      const kiran = repo.getById('kiran_soft');
      expect(kiran?.name).toBe('Kiran');
      expect(kiran?.delivery).toBe('imported');

      const track = repo.getTrack('rapid_reset_5', 'kiran_soft');
      expect(track?.voiceFocusSource).toBe('file:///data/voices/kiran/5.ogg');
    });
  });
});
