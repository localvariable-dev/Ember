/**
 * Ember Database & Repositories Provider
 * Master Plan Part 1 §2.2, Part 3 §4.1, Part 4 §5.1, Part 6 §7.2
 * Provides SQLite repositories, reactive preference/streak/entitlement states, and PaywallProvider.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Db } from '../data/db';
import { openAppDatabase } from '../data/db';
import { migrate } from '../data/migrations';
import {
  EntitlementRepo,
  LedgerRepo,
  PrefsRepo,
  ProtocolRepo,
  SessionRepo,
  StreakRepo,
  VoiceRepo,
} from '../data/repos';
import type { UserEntitlement, UserPreferences } from '../data/types';
import type { StreakState } from '../domain/streakEngine';
import type { BillingService, EntitlementService } from '../billing';
import { createBillingService, EntitlementServiceImpl, PaywallProvider } from '../billing';

let globalDb: Db | null = null;

export function getAppDb(): Db {
  if (!globalDb) {
    const dbInstance = openAppDatabase('ember.db');
    migrate(dbInstance);
    globalDb = dbInstance;
  }
  return globalDb;
}

export function setAppDbForTesting(db: Db | null): void {
  globalDb = db;
}

export interface DatabaseContextValue {
  db: Db;
  sessionRepo: SessionRepo;
  streakRepo: StreakRepo;
  ledgerRepo: LedgerRepo;
  entitlementRepo: EntitlementRepo;
  prefsRepo: PrefsRepo;
  protocolRepo: ProtocolRepo;
  voiceRepo: VoiceRepo;
  entitlementService: EntitlementService;
  billingService: BillingService;
  preferences: UserPreferences;
  streak: StreakState;
  isPro: boolean;
  activePass: UserEntitlement | null;
  updatePreferences: (changes: Partial<UserPreferences>) => UserPreferences;
  refreshState: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export interface DatabaseProviderProps {
  children: React.ReactNode;
  testDb?: Db;
  testBillingService?: BillingService;
  testEntitlementService?: EntitlementService;
}

export function DatabaseProvider({
  children,
  testDb,
  testBillingService,
  testEntitlementService,
}: DatabaseProviderProps) {
  const db = useMemo(() => testDb ?? getAppDb(), [testDb]);

  const repos = useMemo(() => {
    return {
      sessionRepo: new SessionRepo(db),
      streakRepo: new StreakRepo(db),
      ledgerRepo: new LedgerRepo(db),
      entitlementRepo: new EntitlementRepo(db),
      prefsRepo: new PrefsRepo(db),
      protocolRepo: new ProtocolRepo(db),
      voiceRepo: new VoiceRepo(db),
    };
  }, [db]);

  const entitlementService = useMemo(
    () => testEntitlementService ?? new EntitlementServiceImpl(repos.entitlementRepo),
    [testEntitlementService, repos.entitlementRepo],
  );

  const billingService = useMemo(
    () => testBillingService ?? createBillingService(),
    [testBillingService],
  );

  const [preferences, setPreferences] = useState<UserPreferences>(() => repos.prefsRepo.get());
  const [streak, setStreak] = useState<StreakState>(() => repos.streakRepo.get());
  const [isPro, setIsPro] = useState<boolean>(
    () => entitlementService.getSnapshot().level === 'pro',
  );
  const [activePass, setActivePass] = useState<UserEntitlement | null>(() =>
    repos.entitlementRepo.getActivePass(),
  );

  useEffect(() => {
    // Keep isPro and activePass reactive to EntitlementService changes
    const unsub = entitlementService.subscribe((snapshot) => {
      setIsPro(snapshot.level === 'pro');
      setActivePass(snapshot.passAvailable ? repos.entitlementRepo.getActivePass() : null);
    });
    return unsub;
  }, [entitlementService, repos.entitlementRepo]);

  const refreshState = useCallback(() => {
    const nextPrefs = repos.prefsRepo.get();
    const nextStreak = repos.streakRepo.get();
    const snapshot = entitlementService.getSnapshot();
    const nextPro = snapshot.level === 'pro';
    const nextPass = repos.entitlementRepo.getActivePass();

    setPreferences(nextPrefs);
    setStreak(nextStreak);
    setIsPro(nextPro);
    setActivePass(nextPass);
  }, [repos, entitlementService]);

  const updatePreferences = useCallback(
    (changes: Partial<UserPreferences>): UserPreferences => {
      const current = repos.prefsRepo.get();
      let hasChanges = false;
      for (const key of Object.keys(changes) as (keyof UserPreferences)[]) {
        if (key === 'updatedAtMs' || key === 'id') continue;
        if (changes[key] !== undefined && changes[key] !== current[key]) {
          hasChanges = true;
          break;
        }
      }

      if (!hasChanges) {
        return current;
      }

      const updated = repos.prefsRepo.patch(changes);
      setPreferences(updated);
      return updated;
    },
    [repos.prefsRepo],
  );

  const value = useMemo<DatabaseContextValue>(
    () => ({
      db,
      ...repos,
      entitlementService,
      billingService,
      preferences,
      streak,
      isPro,
      activePass,
      updatePreferences,
      refreshState,
    }),
    [
      db,
      repos,
      entitlementService,
      billingService,
      preferences,
      streak,
      isPro,
      activePass,
      updatePreferences,
      refreshState,
    ],
  );

  return (
    <DatabaseContext.Provider value={value}>
      <PaywallProvider billingService={billingService} entitlementService={entitlementService}>
        {children}
      </PaywallProvider>
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return ctx;
}
