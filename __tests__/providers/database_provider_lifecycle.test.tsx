/**
 * DatabaseProvider & AppLifecycle State Lifecycle Tests
 *
 * Verifies:
 * - DatabaseProvider initialization does not cause repeated updates
 * - AppLifecycle mounting does not produce an infinite update loop (Maximum update depth exceeded)
 * - Updating an unchanged preference does not trigger redundant writes or state updates
 * - Updating a changed preference causes exactly one meaningful state update
 * - Notification planning does not repeatedly update preferences
 * - Provider consumers receive updated preferences correctly
 */

import React, { act, useEffect, useRef } from 'react';
// @ts-expect-error react-dom/client typings are not in devDependencies
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { openTestDatabase } from '../helpers/testDb';
import { migrate } from '../../src/data/migrations';
import { DatabaseProvider, useDatabase } from '../../src/providers/DatabaseProvider';
import { PrefsRepo, SessionRepo, StreakRepo } from '../../src/data/repos';
import {
  parseDeepLinkProtocol,
  setupNotificationChannel,
  syncNotificationSchedule,
} from '../../src/services/NotificationService';
import { useSessionStore } from '../../src/stores/useSessionStore';
import type { UserPreferences } from '../../src/data/types';

// Setup minimal DOM for React 19 testing in jest-expo environment
if (typeof document === 'undefined') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
  (global as unknown as { document: Document }).document = dom.window.document;
}

// Test harness replicate of AppLifecycle from app/_layout.tsx
function TestAppLifecycle() {
  const { sessionRepo, prefsRepo, streakRepo, updatePreferences } = useDatabase();
  const setProtocol = useSessionStore((state) => state.setProtocol);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      setupNotificationChannel().catch(() => {});

      const now = Date.now();
      const currentPrefs = prefsRepo.get();
      updatePreferences({
        lastOpenAtMs: now,
        firstLaunchAtMs: currentPrefs.firstLaunchAtMs ?? now,
        lapsedSentCount: 0,
      });

      syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo }, now).catch(() => {});
    }

    let notifSub: { remove: () => void } | null = null;
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      try {
        notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const deepLink = response.notification.request.content.data?.deepLink as
            string | undefined;
          const protocol = parseDeepLinkProtocol(deepLink);
          if (
            protocol === 'rapid_reset_5' ||
            protocol === 'afternoon_recharge_10' ||
            protocol === 'deep_rest_30'
          ) {
            setProtocol(protocol);
          }
        });
      } catch (err) {
        console.warn('Failed to attach notification listener:', err);
      }
    }

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const activeNow = Date.now();
        updatePreferences({ lastOpenAtMs: activeNow });
        syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo }, activeNow).catch(() => {});
      }
    });

    return () => {
      if (typeof notifSub?.remove === 'function') {
        notifSub.remove();
      }
      if (typeof appStateSub?.remove === 'function') {
        appStateSub.remove();
      }
    };
  }, [sessionRepo, prefsRepo, streakRepo, updatePreferences, setProtocol]);

  return null;
}

describe('DatabaseProvider & AppLifecycle State Lifecycle', () => {
  let db: ReturnType<typeof openTestDatabase>;

  beforeEach(() => {
    db = openTestDatabase(':memory:');
    migrate(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('PrefsRepo Idempotence & Guarding', () => {
    it('updating an unchanged preference does not trigger redundant writes', () => {
      const prefsRepo = new PrefsRepo(db);
      const initial = prefsRepo.get();
      expect(initial.lastMode).toBe('focus');

      // Patch with identical value
      const patched = prefsRepo.patch({ lastMode: 'focus' }, initial.updatedAtMs + 5000);
      expect(patched.updatedAtMs).toBe(initial.updatedAtMs);

      // Verify DB row updatedAtMs was not mutated
      const row = db.first<{ updated_at_ms: number }>(
        'SELECT updated_at_ms FROM user_preferences WHERE id = 1;',
      );
      expect(row?.updated_at_ms).toBe(initial.updatedAtMs);
    });

    it('updating a changed preference executes the update and updates timestamp', () => {
      const prefsRepo = new PrefsRepo(db);
      const initial = prefsRepo.get();

      const newTimestamp = initial.updatedAtMs + 10_000;
      const patched = prefsRepo.patch({ lastMode: 'sleep' }, newTimestamp);
      expect(patched.lastMode).toBe('sleep');
      expect(patched.updatedAtMs).toBe(newTimestamp);

      const row = db.first<{ last_mode: string; updated_at_ms: number }>(
        'SELECT last_mode, updated_at_ms FROM user_preferences WHERE id = 1;',
      );
      expect(row?.last_mode).toBe('sleep');
      expect(row?.updated_at_ms).toBe(newTimestamp);
    });
  });

  describe('DatabaseProvider React Hook Stability & Render Cycle', () => {
    it('initializes without repeated updates and provides stable callback references', async () => {
      let renderCount = 0;
      let lastUpdatePreferencesFn: ((changes: Partial<UserPreferences>) => UserPreferences) | null =
        null;
      let lastPreferences: UserPreferences | null = null;

      function Consumer() {
        const { preferences, updatePreferences } = useDatabase();
        useEffect(() => {
          renderCount++;
          lastUpdatePreferencesFn = updatePreferences;
          lastPreferences = preferences;
        });
        return null;
      }

      const container = document.createElement('div');
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <DatabaseProvider testDb={db}>
            <Consumer />
          </DatabaseProvider>,
        );
      });

      // Exactly 1 render on mount
      expect(renderCount).toBe(1);
      const firstUpdateFn = lastUpdatePreferencesFn;

      // Calling updatePreferences with identical values should NOT trigger re-render
      await act(async () => {
        const res = lastUpdatePreferencesFn!({ lastMode: 'focus' });
        expect(res).toStrictEqual(lastPreferences);
      });

      expect(renderCount).toBe(1);
      expect(lastUpdatePreferencesFn).toBe(firstUpdateFn); // Stable reference!

      // Calling updatePreferences with a new value triggers exactly 1 re-render
      await act(async () => {
        lastUpdatePreferencesFn!({ lastMode: 'sleep' });
      });

      expect(renderCount).toBe(2);
      expect(lastPreferences!.lastMode).toBe('sleep');
      expect(lastUpdatePreferencesFn).toBe(firstUpdateFn); // Stable reference across renders!

      await act(async () => {
        root.unmount();
      });
    });

    it('mounting AppLifecycle does not produce an infinite update loop', async () => {
      let lifecycleConsumerRenders = 0;

      function LifecycleConsumer() {
        useDatabase();
        useEffect(() => {
          lifecycleConsumerRenders++;
        });
        return null;
      }

      const container = document.createElement('div');
      const root = createRoot(container);

      // Mount DatabaseProvider with AppLifecycle and Consumer
      await act(async () => {
        root.render(
          <DatabaseProvider testDb={db}>
            <TestAppLifecycle />
            <LifecycleConsumer />
          </DatabaseProvider>,
        );
      });

      // AppLifecycle runs its initialization once:
      // Render 1: Initial mount
      // Render 2: Launch preference update (lastOpenAtMs)
      // Must NOT continue looping!
      expect(lifecycleConsumerRenders).toBeLessThanOrEqual(2);

      const prefsRepo = new PrefsRepo(db);
      const stored = prefsRepo.get();
      expect(stored.lastOpenAtMs).not.toBeNull();
      expect(stored.firstLaunchAtMs).not.toBeNull();
      expect(stored.lapsedSentCount).toBe(0);

      await act(async () => {
        root.unmount();
      });
    });

    it('notification planning does not repeatedly update preferences', async () => {
      const prefsRepo = new PrefsRepo(db);
      const initial = prefsRepo.get();
      const sessionRepo = new SessionRepo(db);
      const streakRepo = new StreakRepo(db);

      await syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo }, Date.now());
      const afterFirstSync = prefsRepo.get();
      expect(afterFirstSync.updatedAtMs).toBe(initial.updatedAtMs);

      await syncNotificationSchedule({ sessionRepo, prefsRepo, streakRepo }, Date.now());
      const afterSecondSync = prefsRepo.get();
      expect(afterSecondSync.updatedAtMs).toBe(initial.updatedAtMs);
    });

    it('provider consumers receive updated preferences correctly', async () => {
      let capturedPrefs: UserPreferences | null = null;
      let updateFn: ((changes: Partial<UserPreferences>) => UserPreferences) | null = null;

      function Consumer() {
        const { preferences, updatePreferences } = useDatabase();
        useEffect(() => {
          capturedPrefs = preferences;
          updateFn = updatePreferences;
        });
        return null;
      }

      const container = document.createElement('div');
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <DatabaseProvider testDb={db}>
            <Consumer />
          </DatabaseProvider>,
        );
      });

      expect(capturedPrefs!.notificationsEnabled).toBe(false);
      expect(capturedPrefs!.voiceVolume).toBe(0.9);

      await act(async () => {
        updateFn!({ notificationsEnabled: true, voiceVolume: 0.8 });
      });

      expect(capturedPrefs!.notificationsEnabled).toBe(true);
      expect(capturedPrefs!.voiceVolume).toBe(0.8);

      // Verify persisted to DB
      const prefsRepo = new PrefsRepo(db);
      const stored = prefsRepo.get();
      expect(stored.notificationsEnabled).toBe(true);
      expect(stored.voiceVolume).toBe(0.8);

      await act(async () => {
        root.unmount();
      });
    });
  });
});
