import React, { act } from 'react';
// @ts-expect-error react-dom/client typings
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { DailyGoalProgress } from '../../src/features/sanctuary/DailyGoalProgress';
import { StreakHeader } from '../../src/features/journey/StreakHeader';
import { SessionSummary } from '../../src/features/player/SessionSummary';
import { TopBar } from '../../src/features/sanctuary/TopBar';
import { INITIAL_STREAK, type StreakState } from '../../src/domain/streakEngine';
import { evaluateDailyGoal, getMilestoneCelebration } from '../../src/domain/dailyGoal';

// Setup minimal DOM for React 19 testing in jest-expo environment
if (typeof document === 'undefined') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
  (global as unknown as { document: Document }).document = dom.window.document;
}

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

// Mock DatabaseProvider context for TopBar
const mockGetSnapshot = jest.fn();
const mockOpenSheet = jest.fn();
const mockStreakState: StreakState = {
  currentStreak: 3,
  longestStreak: 3,
  lastCreditDay: null,
  graceBanked: 0,
  graceProgress: 0,
  graceEarnedTotal: 0,
  graceUsedTotal: 0,
};

jest.mock('../../src/providers/DatabaseProvider', () => ({
  useDatabase: () => ({
    streak: mockStreakState,
    preferences: { hapticsEnabled: true },
    entitlementService: {
      getSnapshot: mockGetSnapshot,
    },
  }),
}));

jest.mock('../../src/stores/useSheetStore', () => ({
  useSheetStore: () => mockOpenSheet,
}));

describe('Habit Formation, Motivation & Session Completion', () => {
  let container: HTMLDivElement;
  let originalError: typeof console.error;

  beforeAll(() => {
    originalError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (
        msg.includes('is unrecognized in this browser') ||
        msg.includes('incorrect casing') ||
        msg.includes('non-boolean attribute') ||
        msg.includes('does not recognize') ||
        msg.includes('Unknown event handler property')
      ) {
        return;
      }
      originalError(...args);
    };
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div');
    mockGetSnapshot.mockReturnValue({
      level: 'free',
      plan: 'none',
      trialExpiresAtMs: null,
    });
  });

  describe('DailyGoalProgress Component', () => {
    it('displays 0/1 and encourages a single session when goal is uncredited', async () => {
      const status = evaluateDailyGoal(null, INITIAL_STREAK);
      const root = createRoot(container);

      await act(async () => {
        root.render(<DailyGoalProgress status={status} />);
      });

      expect(container.textContent).toContain('Daily Rest Goal');
      expect(container.textContent).toContain('0/1');
      expect(container.textContent).toMatch(/one intentional session per day/i);
    });

    it('displays 1/1 Complete and celebratory copy when goal is met', async () => {
      const status = evaluateDailyGoal(
        { localDay: '2026-11-09', kind: 'practice', committedMs: 300_000, sessions: 1 },
        { ...INITIAL_STREAK, currentStreak: 1 },
        true,
      );
      const root = createRoot(container);

      await act(async () => {
        root.render(<DailyGoalProgress status={status} />);
      });

      expect(container.textContent).toContain('1/1 Complete');
      expect(container.textContent).toMatch(/you made space for yourself today/i);
    });
  });

  describe('StreakHeader Upcoming Milestones & Celebrations', () => {
    it('displays countdown to next milestone (e.g. 7-day milestone when streak is 4)', async () => {
      const streak: StreakState = {
        ...INITIAL_STREAK,
        currentStreak: 4,
        longestStreak: 4,
        lastCreditDay: '2026-11-09',
      };
      const root = createRoot(container);

      await act(async () => {
        root.render(<StreakHeader streak={streak} today="2026-11-09" />);
      });

      expect(container.textContent).toContain('Next Milestone');
      expect(container.textContent).toMatch(/7-Day Rest · 3 days to go/i);
    });

    it('celebrates when landing on a key milestone (e.g. 7 days)', async () => {
      const streak: StreakState = {
        ...INITIAL_STREAK,
        currentStreak: 7,
        longestStreak: 7,
        lastCreditDay: '2026-11-09',
      };
      const root = createRoot(container);

      await act(async () => {
        root.render(<StreakHeader streak={streak} today="2026-11-09" />);
      });

      expect(container.textContent).toContain('Milestone Reached: 1 Week of Rest');
      expect(container.textContent).toContain('A restorative rhythm.');
    });
  });

  describe('Polished SessionSummary Component', () => {
    it('renders protocol badge, calm delta, streak progression, motivation and suggestion', async () => {
      const onDone = jest.fn();
      const status = evaluateDailyGoal(
        { localDay: '2026-11-09', kind: 'practice', committedMs: 600_000, sessions: 1 },
        { ...INITIAL_STREAK, currentStreak: 5 },
        true,
      );
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <SessionSummary
            preState={1 as any}
            postState={4 as any}
            streakCount={5}
            protocolId="afternoon_recharge_10"
            durationMinutes={10}
            dailyGoalStatus={status}
            encouragingMessage="Another moment of rest, intentionally chosen."
            personalInsight="You've rested 40m across 4 sessions, averaging +2 in perceived calm."
            nextSuggestion="Tonight: Deep Rest for sleep when your day winds down."
            onDone={onDone}
          />,
        );
      });

      expect(container.textContent).toContain('Afternoon Recharge • 10m');
      expect(container.textContent).toContain('+3 Calm Delta');
      expect(container.textContent).toContain('Day 5 Streak');
      expect(container.textContent).toContain('Daily Rest Goal Met • 1/1');
      expect(container.textContent).toContain('Another moment of rest, intentionally chosen.');
      expect(container.textContent).toContain("You've rested 40m across 4 sessions");
      expect(container.textContent).toContain('Tonight: Deep Rest for sleep');
    });

    it('renders rich celebration card on milestone achievement', async () => {
      const celebration = getMilestoneCelebration(7);
      const onDone = jest.fn();
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <SessionSummary
            preState={2 as any}
            postState={5 as any}
            streakCount={7}
            protocolId="rapid_reset_5"
            milestoneDetails={celebration}
            onDone={onDone}
          />,
        );
      });

      expect(container.textContent).toContain('1 Week of Rest');
      expect(container.textContent).toContain('A restorative rhythm.');
      expect(container.textContent).toContain('A full week of intentional pauses');
    });
  });

  describe('TopBar with 3-Day Pro Trial Indicator', () => {
    it('shows subtle 3-Day Pro Trial pill when trial is active', async () => {
      const futureMs = Date.now() + 48 * 3_600_000;
      mockGetSnapshot.mockReturnValue({
        level: 'pro',
        plan: 'trial',
        trialExpiresAtMs: futureMs,
      });
      const root = createRoot(container);

      await act(async () => {
        root.render(<TopBar />);
      });

      expect(container.textContent).toMatch(/Pro Trial · 48h/i);
    });

    it('hides Pro trial pill for standard free or paid subscribers', async () => {
      mockGetSnapshot.mockReturnValue({
        level: 'pro',
        plan: 'lifetime',
        trialExpiresAtMs: null,
      });
      const root = createRoot(container);

      await act(async () => {
        root.render(<TopBar />);
      });

      expect(container.textContent).not.toContain('Pro Trial');
    });
  });
});
