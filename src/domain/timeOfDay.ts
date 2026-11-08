/**
 * Time-of-Day Context & Protocol Suggestions
 * Master Plan Part 2 §3.7
 * Helpful defaults, not biological mandates. Manual user selection overrides these.
 */

import type { ProtocolId } from './constants';

export interface TimeContext {
  protocolId: ProtocolId;
  greeting: string;
  contextLine: string;
}

/**
 * Maps current local time to the suggested default protocol card.
 */
export function defaultProtocol(now: Date): ProtocolId {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m >= 240 && m < 780) return 'rapid_reset_5'; // 04:00–12:59
  if (m >= 780 && m < 1200) return 'afternoon_recharge_10'; // 13:00–19:59
  return 'deep_rest_30'; // 20:00–03:59
}

/**
 * Returns dynamic time-of-day greeting and contextual line for Sanctuary screen.
 */
export function getTimeContext(now: Date): TimeContext {
  const m = now.getHours() * 60 + now.getMinutes();

  if (m >= 240 && m < 780) {
    // 04:00 - 12:59
    const greeting = m < 720 ? 'Good morning.' : 'Good afternoon.';
    return {
      protocolId: 'rapid_reset_5',
      greeting,
      contextLine: 'A five-minute reset for stress and focus.',
    };
  }

  if (m >= 780 && m < 1200) {
    // 13:00 - 19:59
    const greeting = m < 1020 ? 'Good afternoon.' : 'Good evening.';
    return {
      protocolId: 'afternoon_recharge_10',
      greeting,
      contextLine: 'The afternoon dip is here. Ten minutes to recharge.',
    };
  }

  // 20:00 - 03:59
  const greeting = m >= 1200 && m < 1260 ? 'Good evening.' : 'Winding down?';
  return {
    protocolId: 'deep_rest_30',
    greeting,
    contextLine: 'Decompress and prepare your nervous system for deep rest.',
  };
}
