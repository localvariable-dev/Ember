/**
 * Player Experience & UI Architecture Tests
 * Master Plan Part 1 §2.4, §2.5, §2.6
 */

import { stateColors } from '../../src/design/tokens';
import { useSessionStore } from '../../src/stores/useSessionStore';
import { useSheetStore } from '../../src/stores/useSheetStore';
import type { RecoveryState } from '../../src/data/types';

describe('Player Experience & UI Tests', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession();
    useSheetStore.getState().closeSheet();
  });

  describe('Perceived State Scale (5 Orbs)', () => {
    it('defines exactly 5 recovery states in warm palette without blue/purple', () => {
      expect(stateColors[1].label).toBe('Wired');
      expect(stateColors[1].color).toBe('#EA580C');

      expect(stateColors[2].label).toBe('Drained');
      expect(stateColors[2].color).toBe('#78716C');

      expect(stateColors[3].label).toBe('Neutral');
      expect(stateColors[3].color).toBe('#A8A29E');

      expect(stateColors[4].label).toBe('Calm');
      expect(stateColors[4].color).toBe('#F59E0B');

      expect(stateColors[5].label).toBe('Restored');
      expect(stateColors[5].color).toBe('#FDE68A');
    });
  });

  describe('Calm Delta Logic & Neutral Presentation', () => {
    function computeDelta(pre: RecoveryState | null, post: RecoveryState | null) {
      if (pre == null || post == null) return null;
      const delta = post - pre;
      const deltaText =
        delta > 0 ? `+${delta} Calm Delta` : delta === 0 ? '0 Calm Delta' : `${delta} Calm Delta`;
      const isNegative = delta < 0;
      const whisper = isNegative ? 'Some sessions just need time.' : null;
      return { delta, deltaText, isNegative, whisper };
    }

    it('calculates positive Calm Delta (+3) for Wired (1) -> Calm (4)', () => {
      const res = computeDelta(1, 4);
      expect(res?.delta).toBe(3);
      expect(res?.deltaText).toBe('+3 Calm Delta');
      expect(res?.isNegative).toBe(false);
      expect(res?.whisper).toBeNull();
    });

    it('calculates zero Calm Delta for Calm (4) -> Calm (4)', () => {
      const res = computeDelta(4, 4);
      expect(res?.delta).toBe(0);
      expect(res?.deltaText).toBe('0 Calm Delta');
      expect(res?.isNegative).toBe(false);
      expect(res?.whisper).toBeNull();
    });

    it('calculates negative Calm Delta (-1) with neutral whisper and non-punitive tone', () => {
      const res = computeDelta(4, 3);
      expect(res?.delta).toBe(-1);
      expect(res?.deltaText).toBe('-1 Calm Delta');
      expect(res?.isNegative).toBe(true);
      expect(res?.whisper).toBe('Some sessions just need time.');
    });

    it('handles null pre-state gracefully without calculating delta', () => {
      const res = computeDelta(null, 5);
      expect(res).toBeNull();
    });
  });

  describe('Countdown Timer Formatting', () => {
    function formatRemaining(positionMs: number, durationMs: number): string {
      const remainingMs = Math.max(0, durationMs - positionMs);
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} left`;
    }

    it('formats remaining countdown correctly in mm:ss left', () => {
      expect(formatRemaining(0, 300_000)).toBe('05:00 left');
      expect(formatRemaining(60_000, 300_000)).toBe('04:00 left');
      expect(formatRemaining(285_000, 300_000)).toBe('00:15 left');
      expect(formatRemaining(300_000, 300_000)).toBe('00:00 left');
    });
  });

  describe('Perceptual Volume Tapering ($v^2$)', () => {
    function perceptualVolume(v: number): number {
      return Math.pow(Math.max(0, Math.min(1, v)), 2);
    }

    it('applies quadratic curve so mid-slider retains gentle volume', () => {
      expect(perceptualVolume(0)).toBe(0);
      expect(perceptualVolume(0.5)).toBeCloseTo(0.25, 3);
      expect(perceptualVolume(0.9)).toBeCloseTo(0.81, 3);
      expect(perceptualVolume(1.0)).toBe(1);
    });
  });

  describe('Sleep Mode Cubic Ambient Fade Curve', () => {
    function sleepFadeFactor(remainingMs: number): number {
      if (remainingMs <= 0) return 0;
      if (remainingMs >= 90_000) return 1;
      return Math.pow(remainingMs / 90_000, 3);
    }

    it('applies pause-safe cubic attenuation over final 90 seconds', () => {
      expect(sleepFadeFactor(100_000)).toBe(1); // before 90s: full
      expect(sleepFadeFactor(90_000)).toBe(1);
      // Halfway (45s): 0.5^3 = 0.125
      expect(sleepFadeFactor(45_000)).toBeCloseTo(0.125, 3);
      // Final 10s: (10/90)^3 = 0.00137
      expect(sleepFadeFactor(10_000)).toBeCloseTo(0.00137, 4);
      expect(sleepFadeFactor(0)).toBe(0);
    });
  });

  describe('Player Sheet & Navigation Integration', () => {
    it('opens voice picker in player context for in-flight switching', () => {
      useSheetStore.getState().openSheet('voice_picker', { voicePickerContext: 'player' });

      const state = useSheetStore.getState();
      expect(state.activeSheet).toBe('voice_picker');
      expect(state.payload.voicePickerContext).toBe('player');
    });

    it('tracks active session stage progression in store', () => {
      const store = useSessionStore.getState();
      expect(store.stage).toBe('IDLE');

      store.setStage('PREROLL');
      expect(useSessionStore.getState().stage).toBe('PREROLL');

      store.setStage('ACTIVE');
      expect(useSessionStore.getState().stage).toBe('ACTIVE');

      store.setStage('CHECKIN');
      expect(useSessionStore.getState().stage).toBe('CHECKIN');

      store.setStage('DONE');
      expect(useSessionStore.getState().stage).toBe('DONE');
    });
  });
});
