/**
 * Ember Haptic Feedback Utilities
 * Master Plan Part 1 §2.1.4 & Habit Formation Specification
 * Provides subtle, intentional haptics with deduplication against rapid re-renders.
 */

import * as Haptics from 'expo-haptics';

const lastHapticTimestamps: Record<string, number> = {};

/**
 * Resets haptic timestamp cache (useful for testing).
 */
export function clearHapticThrottleCache(): void {
  for (const k of Object.keys(lastHapticTimestamps)) {
    delete lastHapticTimestamps[k];
  }
}

/**
 * Executes a haptic call only if haptics are enabled by user preferences.
 * Defaults to true if enabled flag is omitted.
 */
async function runHaptic(action: () => Promise<void>, enabled: boolean = true): Promise<void> {
  if (!enabled) return;
  try {
    await action();
  } catch {
    // Gracefully handle devices without haptic actuators
  }
}

/**
 * Deduplicates haptic triggers by key within minIntervalMs window.
 */
function runDeduplicatedHaptic(
  key: string,
  minIntervalMs: number,
  action: () => Promise<void>,
  enabled: boolean = true,
): Promise<void> | void {
  if (!enabled) return;
  const now = Date.now();
  const last = lastHapticTimestamps[key] ?? 0;
  if (now - last < minIntervalMs) return;
  lastHapticTimestamps[key] = now;
  return runHaptic(action, enabled);
}

// Card, Chip and Sheet Interactions
export const hapticCardSelect = (enabled: boolean = true) =>
  runDeduplicatedHaptic('card_select', 100, () => Haptics.selectionAsync(), enabled);

export const hapticModeToggle = (enabled: boolean = true) =>
  runDeduplicatedHaptic('mode_toggle', 120, () => Haptics.selectionAsync(), enabled);

export const hapticChipSelect = (enabled: boolean = true) =>
  runDeduplicatedHaptic('chip_select', 100, () => Haptics.selectionAsync(), enabled);

export const hapticBeginRest = (enabled: boolean = true) =>
  runDeduplicatedHaptic(
    'begin_rest',
    300,
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    enabled,
  );

export const hapticSessionEnter = (enabled: boolean = true) => hapticBeginRest(enabled);

export const hapticNavBack = (enabled: boolean = true) =>
  runDeduplicatedHaptic('nav_back', 150, () => Haptics.selectionAsync(), enabled);

// Playback Controls
export const hapticPlaybackStart = (enabled: boolean = true) =>
  runDeduplicatedHaptic(
    'playback_start',
    200,
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    enabled,
  );

export const hapticPlaybackPause = (enabled: boolean = true) =>
  runDeduplicatedHaptic('playback_pause', 200, () => Haptics.selectionAsync(), enabled);

// Picker / Option Selections
export const hapticVoiceSelect = (enabled: boolean = true) =>
  runDeduplicatedHaptic('voice_select', 100, () => Haptics.selectionAsync(), enabled);

export const hapticAmbientSelect = (enabled: boolean = true) =>
  runDeduplicatedHaptic('ambient_select', 100, () => Haptics.selectionAsync(), enabled);

export const hapticMoodSelect = (enabled: boolean = true) =>
  runDeduplicatedHaptic('mood_select', 120, () => Haptics.selectionAsync(), enabled);

// Lock & Sigh Pacer Feedback
export const hapticLockedCardTap = (enabled: boolean = true) =>
  // Gentle; never an aggressive error buzz
  runDeduplicatedHaptic(
    'locked_card',
    200,
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    enabled,
  );

export const hapticSighInhale1 = (enabled: boolean = true) =>
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);

export const hapticSighInhale2 = (enabled: boolean = true) =>
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);

export const hapticSighExhalePulse = (enabled: boolean = true) =>
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);

// Session End and Goal Celebrations
export const hapticSessionComplete = async (enabled: boolean = true): Promise<void> => {
  if (!enabled) return;
  const now = Date.now();
  if (now - (lastHapticTimestamps['session_complete'] ?? 0) < 500) return;
  lastHapticTimestamps['session_complete'] = now;

  await runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);
  setTimeout(() => {
    void runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), enabled);
  }, 150);
};

export const hapticFocusSessionEnd = (enabled: boolean = true) => hapticSessionComplete(enabled);

export const hapticDailyGoalComplete = (enabled: boolean = true) =>
  runDeduplicatedHaptic(
    'daily_goal_complete',
    500,
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    enabled,
  );

export const hapticMilestoneAchieved = async (enabled: boolean = true): Promise<void> => {
  if (!enabled) return;
  const now = Date.now();
  if (now - (lastHapticTimestamps['milestone_achieved'] ?? 0) < 600) return;
  lastHapticTimestamps['milestone_achieved'] = now;

  // Gentle three-pulse ripple
  await runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);
  setTimeout(() => {
    void runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), enabled);
  }, 120);
  setTimeout(() => {
    void runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);
  }, 260);
};

export const hapticCheckInSelect = (enabled: boolean = true) =>
  runDeduplicatedHaptic('check_in_select', 100, () => Haptics.selectionAsync(), enabled);

export const hapticGraceBanked = (enabled: boolean = true) =>
  runDeduplicatedHaptic(
    'grace_banked',
    400,
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    enabled,
  );

export const hapticPurchaseSuccess = (enabled: boolean = true) =>
  runDeduplicatedHaptic(
    'purchase_success',
    500,
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    enabled,
  );

export const hapticSheetSnap = (enabled: boolean = true) =>
  runDeduplicatedHaptic('sheet_snap', 150, () => Haptics.selectionAsync(), enabled);
