/**
 * Sanctuary Screen and Navigation Unit Tests
 * Master Plan Part 1 §2.3, Part 6 §7.2
 */

import { CANONICAL_CARDS } from '../../src/features/sanctuary/SessionCardList';
import { useSheetStore } from '../../src/stores/useSheetStore';
import { useSessionStore } from '../../src/stores/useSessionStore';
import { openTestDatabase } from '../helpers/testDb';
import { migrate } from '../../src/data/migrations';
import { PrefsRepo, VoiceRepo, EntitlementRepo } from '../../src/data/repos';
import { PROTOCOL_IDS, AMBIENT_BED_IDS } from '../../src/domain/constants';

describe('Sanctuary Feature & Navigation Tests', () => {
  describe('Canonical Protocol Cards', () => {
    it('contains exactly the three canonical protocols in order', () => {
      expect(CANONICAL_CARDS).toHaveLength(3);
      expect(CANONICAL_CARDS[0]?.id).toBe('rapid_reset_5');
      expect(CANONICAL_CARDS[1]?.id).toBe('afternoon_recharge_10');
      expect(CANONICAL_CARDS[2]?.id).toBe('deep_rest_30');
    });

    it('matches domain protocol constants', () => {
      CANONICAL_CARDS.forEach((card) => {
        expect(PROTOCOL_IDS).toContain(card.id);
      });
    });

    it('has correct durations and tier entitlements', () => {
      expect(CANONICAL_CARDS[0]?.durationLabel).toBe('5 min');
      expect(CANONICAL_CARDS[0]?.tier).toBe('free');

      expect(CANONICAL_CARDS[1]?.durationLabel).toBe('10 min');
      expect(CANONICAL_CARDS[1]?.tier).toBe('free');

      expect(CANONICAL_CARDS[2]?.durationLabel).toBe('30 min');
      expect(CANONICAL_CARDS[2]?.tier).toBe('pro');
    });
  });

  describe('Ephemeral Sheet Store Behavior', () => {
    beforeEach(() => {
      useSheetStore.getState().closeSheet();
    });

    it('starts with activeSheet none and empty payload', () => {
      const state = useSheetStore.getState();
      expect(state.activeSheet).toBe('none');
      expect(state.payload).toEqual({});
    });

    it('opens journey sheet and closes it cleanly', () => {
      useSheetStore.getState().openSheet('journey');
      expect(useSheetStore.getState().activeSheet).toBe('journey');

      useSheetStore.getState().closeSheet();
      expect(useSheetStore.getState().activeSheet).toBe('none');
    });

    it('opens paywall with variant payload', () => {
      useSheetStore.getState().openSheet('paywall', { paywallVariant: 'card_tap' });
      expect(useSheetStore.getState().activeSheet).toBe('paywall');
      expect(useSheetStore.getState().payload.paywallVariant).toBe('card_tap');
    });

    it('guarantees exclusivity (opening one sheet replaces any active sheet)', () => {
      useSheetStore.getState().openSheet('journey');
      expect(useSheetStore.getState().activeSheet).toBe('journey');

      useSheetStore.getState().openSheet('voice_picker');
      expect(useSheetStore.getState().activeSheet).toBe('voice_picker');

      useSheetStore.getState().openSheet('ambient_picker');
      expect(useSheetStore.getState().activeSheet).toBe('ambient_picker');
    });
  });

  describe('Session Store Configuration', () => {
    beforeEach(() => {
      useSessionStore.getState().resetSession();
    });

    it('sets protocol, mode, voice, bed, and sigh options', () => {
      const store = useSessionStore.getState();

      store.setProtocol('afternoon_recharge_10');
      store.setMode('sleep');
      store.setVoice('arjun_deep');
      store.setAmbientBed('rain');
      store.setSigh(true);

      const updated = useSessionStore.getState();
      expect(updated.protocolId).toBe('afternoon_recharge_10');
      expect(updated.mode).toBe('sleep');
      expect(updated.voiceId).toBe('arjun_deep');
      expect(updated.ambientBedId).toBe('rain');
      expect(updated.sigh).toBe(true);
    });

    it('resets cleanly back to initial state', () => {
      const store = useSessionStore.getState();
      store.setProtocol('deep_rest_30');
      store.resetSession();

      const reset = useSessionStore.getState();
      expect(reset.protocolId).toBe('rapid_reset_5');
      expect(reset.isPlaying).toBe(false);
      expect(reset.stage).toBe('IDLE');
    });
  });

  describe('SQLite Preference & Catalogue Integration', () => {
    let db: any;
    let prefsRepo: PrefsRepo;
    let voiceRepo: VoiceRepo;
    let entitlementRepo: EntitlementRepo;

    beforeEach(() => {
      db = openTestDatabase(':memory:');
      migrate(db);
      prefsRepo = new PrefsRepo(db);
      voiceRepo = new VoiceRepo(db);
      entitlementRepo = new EntitlementRepo(db);
    });

    afterEach(() => {
      db.close();
    });

    it('seeds and loads default user preferences', () => {
      const prefs = prefsRepo.get();
      expect(prefs.selectedVoiceId).toBe('maya_warm');
      expect(prefs.ambientBedId).toBeNull();
      expect(prefs.sighPacerDefault).toBe(false);
      expect(prefs.firstRunCueShown).toBe(false);
    });

    it('persists preference updates atomically', () => {
      prefsRepo.patch({
        selectedVoiceId: 'arjun_deep',
        ambientBedId: 'theta_6hz',
        sighPacerDefault: true,
        lastMode: 'sleep',
      });

      const updated = prefsRepo.get();
      expect(updated.selectedVoiceId).toBe('arjun_deep');
      expect(updated.ambientBedId).toBe('theta_6hz');
      expect(updated.sighPacerDefault).toBe(true);
      expect(updated.lastMode).toBe('sleep');
    });

    it('contains Maya (free) and Arjun (pro) in voices catalog', () => {
      const voices = voiceRepo.all();
      expect(voices).toHaveLength(2);

      const maya = voices.find((v) => v.id === 'maya_warm');
      expect(maya).toBeDefined();
      expect(maya?.tier).toBe('free');

      const arjun = voices.find((v) => v.id === 'arjun_deep');
      expect(arjun).toBeDefined();
      expect(arjun?.tier).toBe('pro');
    });

    it('contains all 6 ambient beds in database with proper tiers', () => {
      const beds = db.all('SELECT * FROM ambient_beds ORDER BY sort_order ASC;');
      expect(beds).toHaveLength(6);

      const bedIds = beds.map((b: any) => b.id);
      expect(bedIds).toEqual(AMBIENT_BED_IDS);

      const freeBeds = beds.filter((b: any) => b.tier === 'free').map((b: any) => b.id);
      expect(freeBeds).toEqual(['rain', 'brown_noise', 'theta_6hz']);

      const proBeds = beds.filter((b: any) => b.tier === 'pro').map((b: any) => b.id);
      expect(proBeds).toEqual(['ocean_drift', 'night_forest', 'delta_2hz']);
    });

    it('correctly resolves locked vs unlocked access for Deep Rest 30', () => {
      // 1. Initial free state (no Pro, no Pass)
      expect(entitlementRepo.hasActivePro()).toBe(false);
      expect(entitlementRepo.getActivePass()).toBeNull();

      // 2. Grant lifetime Pro
      const now = Date.now();
      entitlementRepo.upsert({
        id: 'ent_life_1',
        kind: 'lifetime',
        source: 'mock',
        productId: 'ember_pro_lifetime',
        status: 'active',
        grantedAtMs: now,
        expiresAtMs: null,
        consumedAtMs: null,
        consumedSessionId: null,
        orderId: 'MOCK-ORDER-1',
        purchaseToken: 'tok_1',
        lastVerifiedAtMs: now,
        metaJson: null,
      });

      expect(entitlementRepo.hasActivePro()).toBe(true);
    });
  });
});
