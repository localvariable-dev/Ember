/**
 * Ember Database & Repositories Provider
 * Master Plan Part 1 §2.2, Part 4 §5.1, Part 6 §7.2
 * Provides SQLite repositories and reactive preference/streak states to all UI components.
 */

import React, { createContext, useContext, useMemo, useState } from 'react';
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

interface DatabaseContextValue {
  db: Db;
  sessionRepo: SessionRepo;
  streakRepo: StreakRepo;
  ledgerRepo: LedgerRepo;
  entitlementRepo: EntitlementRepo;
  prefsRepo: PrefsRepo;
  protocolRepo: ProtocolRepo;
  voiceRepo: VoiceRepo;
  preferences: UserPreferences;
  streak: StreakState;
  isPro: boolean;
  activePass: UserEntitlement | null;
  updatePreferences: (changes: Partial<UserPreferences>) => UserPreferences;
  refreshState: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children, testDb }: { children: React.ReactNode; testDb?: Db }) {
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

  const [preferences, setPreferences] = useState<UserPreferences>(() => repos.prefsRepo.get());
  const [streak, setStreak] = useState<StreakState>(() => repos.streakRepo.get());
  const [isPro, setIsPro] = useState<boolean>(() => repos.entitlementRepo.hasActivePro());
  const [activePass, setActivePass] = useState<UserEntitlement | null>(() =>
    repos.entitlementRepo.getActivePass(),
  );

  const refreshState = () => {
    setPreferences(repos.prefsRepo.get());
    setStreak(repos.streakRepo.get());
    setIsPro(repos.entitlementRepo.hasActivePro());
    setActivePass(repos.entitlementRepo.getActivePass());
  };

  const updatePreferences = (changes: Partial<UserPreferences>): UserPreferences => {
    const updated = repos.prefsRepo.patch(changes);
    setPreferences(updated);
    return updated;
  };

  const value: DatabaseContextValue = {
    db,
    ...repos,
    preferences,
    streak,
    isPro,
    activePass,
    updatePreferences,
    refreshState,
  };

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return ctx;
}
