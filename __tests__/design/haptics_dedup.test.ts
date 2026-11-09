import * as Haptics from 'expo-haptics';
import {
  clearHapticThrottleCache,
  hapticCardSelect,
  hapticDailyGoalComplete,
  hapticMilestoneAchieved,
  hapticNavBack,
  hapticPlaybackPause,
  hapticPlaybackStart,
  hapticSessionComplete,
  hapticSessionEnter,
  hapticAmbientSelect,
  hapticVoiceSelect,
  hapticMoodSelect,
} from '../../src/design/haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

describe('Haptics Utilities & Deduplication', () => {
  beforeEach(() => {
    clearHapticThrottleCache();
    jest.clearAllMocks();
  });

  it('triggers selectionAsync for navigation and picker selections', () => {
    hapticNavBack();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

    hapticAmbientSelect();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);

    hapticVoiceSelect();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);

    hapticMoodSelect();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(4);
  });

  it('triggers impactAsync for session enter and playback toggles', () => {
    hapticSessionEnter();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

    hapticPlaybackStart();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

    hapticPlaybackPause();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('deduplicates rapid calls within the throttle window', () => {
    // Calling card select rapidly
    hapticCardSelect();
    hapticCardSelect();
    hapticCardSelect();
    // Only 1 should fire because of 100ms throttle
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('respects the enabled flag when user has disabled haptics', () => {
    hapticCardSelect(false);
    hapticSessionEnter(false);
    hapticDailyGoalComplete(false);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('triggers notification feedback for daily goal completion', () => {
    hapticDailyGoalComplete();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('triggers staged pulses for session completion and milestones', async () => {
    jest.useFakeTimers();

    await hapticSessionComplete();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

    // Fast forward for the second pulse
    jest.advanceTimersByTime(200);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

    // Milestone celebration
    await hapticMilestoneAchieved();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

    jest.advanceTimersByTime(300);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(5); // 2 from session complete + 3 from milestone

    jest.useRealTimers();
  });
});
