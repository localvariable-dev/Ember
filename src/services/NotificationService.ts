/**
 * Local Notification Service
 * Master Plan Part 2 §3.6, Part 1 §2.3
 *
 * Implements inexact daily rest notifications with Android 'gentle' channel.
 * Strictly battery-safe: zero exact alarms, zero network dependencies.
 * Guarded against non-Android environments (Web, Jest, iOS).
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  planNextNotification,
  type PlannedNotification,
  type PlannerInput,
} from '../domain/notificationPlanner';
import { projectStreak } from '../domain/streakEngine';
import { dayKeyFromMs } from '../domain/dayKey';
import type { SessionRepo } from '../data/repos/SessionRepo';
import type { PrefsRepo } from '../data/repos/PrefsRepo';
import type { StreakRepo } from '../data/repos/StreakRepo';

export const NOTIFICATION_CHANNEL_ID = 'gentle';
const ANDROID_IMPORTANCE_DEFAULT = 3; // AndroidImportance.DEFAULT

/**
 * Configure default notification handler for foreground presentation.
 */
if ((Platform.OS === 'android' || Platform.OS === 'ios') && process.env.NODE_ENV !== 'test') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('[NotificationService] setNotificationHandler failed:', err);
  }
}

/**
 * Ensures the Android 'gentle' notification channel is registered.
 * Channel specifications:
 * - Importance: DEFAULT
 * - Sound: none (silent)
 * - Vibration: none
 * - Amber LED: #F59E0B
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Gentle Reminders',
      description: 'Daily quiet rest reminder',
      importance: ANDROID_IMPORTANCE_DEFAULT,
      sound: null,
      enableVibrate: false,
      vibrationPattern: null,
      lightColor: '#F59E0B',
      enableLights: true,
      showBadge: false,
    });
  } catch (err) {
    console.warn('[NotificationService] Failed to create notification channel:', err);
  }
}

/**
 * Requests system notification permission (Android 13+ POST_NOTIFICATIONS).
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[NotificationService] Permission request failed:', err);
    return false;
  }
}

export interface SyncNotificationRepos {
  sessionRepo: SessionRepo;
  prefsRepo: PrefsRepo;
  streakRepo: StreakRepo;
}

/**
 * Computes median commit minute of day from the last 14 days' sessions.
 * Returns null if fewer than 3 sessions exist.
 */
export function computeMedianCommitMinute(recentMinutes: number[]): number | null {
  if (recentMinutes.length < 3) return null;
  const sorted = [...recentMinutes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid]!;
  }
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Re-plans the single pending daily rest reminder based on current state.
 * Cancels any existing scheduled notification and enqueues the new one-shot inexact trigger.
 */
export async function syncNotificationSchedule(
  repos: SyncNotificationRepos,
  nowMs = Date.now(),
): Promise<PlannedNotification | null> {
  const prefs = repos.prefsRepo.get();
  const streak = repos.streakRepo.get();
  const today = dayKeyFromMs(nowMs);

  const creditedToday = streak.lastCreditDay === today;
  const recentMinutes = repos.sessionRepo.getRecentCommitMinutes(14, nowMs);
  const medianCommitMin = computeMedianCommitMinute(recentMinutes);
  const sleepSessionsLast7d = repos.sessionRepo.getSleepSessionCount(7, nowMs);

  const lastActiveMs = prefs.lastOpenAtMs ?? prefs.firstLaunchAtMs ?? nowMs;
  const daysSinceLastOpen = Math.max(0, Math.floor((nowMs - lastActiveMs) / 86_400_000));

  const projection = projectStreak(streak, today);
  const isHeldByGrace = projection.status === 'held_by_grace';

  const input: PlannerInput = {
    now: nowMs,
    enabled: prefs.notificationsEnabled,
    reminderMin: prefs.reminderMin,
    medianCommitMin,
    creditedToday,
    sleepSessionsLast7d,
    daysSinceLastOpen,
    lapsedSentCount: prefs.lapsedSentCount,
    currentStreak: streak.currentStreak,
    isHeldByGrace,
  };

  const planned = planNextNotification(input);

  if (Platform.OS === 'android') {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      if (planned) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: planned.title,
            body: planned.body,
            data: { deepLink: planned.deepLink, kind: planned.kind },
            sound: false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(planned.fireAtMs),
            channelId: NOTIFICATION_CHANNEL_ID,
          },
        });
      }
    } catch (err) {
      console.warn('[NotificationService] Scheduling notification failed:', err);
    }
  }

  return planned;
}

/**
 * Extracts protocol ID from deep link URL e.g. 'ember://begin?protocol=rapid_reset_5'
 */
export function parseDeepLinkProtocol(deepLink?: string | null): string | null {
  if (!deepLink) return null;
  const match = deepLink.match(/protocol=([a-zA-Z0-9_]+)/);
  return match ? match[1]! : null;
}
