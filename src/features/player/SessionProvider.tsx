/**
 * Ember Session Provider
 * Master Plan Part 6 §7.1-§7.2
 * React Context providing the active SessionController singleton to Player and Sanctuary components.
 */

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useDatabase } from '../../providers/DatabaseProvider';
import { SessionController } from './SessionController';

interface SessionContextValue {
  controller: SessionController;
}

const SessionContext = createContext<SessionContextValue | null>(null);

let activeControllerInstance: SessionController | null = null;

export function getActiveSessionController(): SessionController | null {
  return activeControllerInstance;
}

export function SessionProvider({
  children,
  testController,
}: {
  children: React.ReactNode;
  testController?: SessionController;
}) {
  const { sessionRepo, prefsRepo, streakRepo, entitlementRepo, isPro } = useDatabase();

  const controller = useMemo(() => {
    if (testController) return testController;
    return new SessionController({
      sessionRepo,
      prefsRepo,
      streakRepo,
      entitlementRepo,
    });
  }, [testController, sessionRepo, prefsRepo, streakRepo, entitlementRepo]);

  useEffect(() => {
    activeControllerInstance = controller;
    return () => {
      if (activeControllerInstance === controller) {
        activeControllerInstance = null;
      }
    };
  }, [controller]);

  // Reconcile orphaned sessions on initial mount
  useEffect(() => {
    try {
      SessionController.reconcileColdStart(sessionRepo);
    } catch (err) {
      console.warn('Failed to reconcile cold start sessions:', err);
    }
  }, [sessionRepo]);

  // AppState background/foreground handling
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const state = controller.getMachineState();
      if (nextState !== 'active') {
        // Background playback is available to Pro; free sessions pause without accruing time.
        if (state.stage === 'PREROLL' || (!isPro && state.stage === 'ACTIVE' && state.isPlaying)) {
          controller.pauseForBackground();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [controller, isPro]);

  return <SessionContext.Provider value={{ controller }}>{children}</SessionContext.Provider>;
}

export function useSessionController(): SessionController {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    if (activeControllerInstance) {
      return activeControllerInstance;
    }
    throw new Error('useSessionController must be used within a SessionProvider');
  }
  return ctx.controller;
}
