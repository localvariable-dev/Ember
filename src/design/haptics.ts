/**
 * Ember Haptic Feedback Utilities
 * Master Plan Part 1 §2.1.4
 */

import * as Haptics from 'expo-haptics';

let lastSheetSnapTime = 0;

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

export const hapticCardSelect = (enabled: boolean = true) =>
  runHaptic(() => Haptics.selectionAsync(), enabled);

export const hapticModeToggle = (enabled: boolean = true) =>
  runHaptic(() => Haptics.selectionAsync(), enabled);

export const hapticChipSelect = (enabled: boolean = true) =>
  runHaptic(() => Haptics.selectionAsync(), enabled);

export const hapticBeginRest = (enabled: boolean = true) =>
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), enabled);

export const hapticLockedCardTap = (enabled: boolean = true) =>
  // Gentle; never an aggressive error buzz
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);

export const hapticSighInhale1 = (enabled: boolean = true) =>
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);

export const hapticSighInhale2 = (enabled: boolean = true) =>
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);

export const hapticSighExhalePulse = (enabled: boolean = true) =>
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);

export const hapticFocusSessionEnd = async (enabled: boolean = true): Promise<void> => {
  if (!enabled) return;
  await runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), enabled);
  setTimeout(() => {
    void runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), enabled);
  }, 150);
};

export const hapticCheckInSelect = (enabled: boolean = true) =>
  runHaptic(() => Haptics.selectionAsync(), enabled);

export const hapticGraceBanked = (enabled: boolean = true) =>
  runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), enabled);

export const hapticPurchaseSuccess = (enabled: boolean = true) =>
  runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), enabled);

export const hapticSheetSnap = (enabled: boolean = true) => {
  const now = Date.now();
  if (now - lastSheetSnapTime < 150) return;
  lastSheetSnapTime = now;
  return runHaptic(() => Haptics.selectionAsync(), enabled);
};
