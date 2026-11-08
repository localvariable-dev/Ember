/**
 * Time of Day Unit Tests
 * Master Plan Part 2 §3.7
 */

import { defaultProtocol, getTimeContext } from '../../src/domain/timeOfDay';

describe('timeOfDay: defaultProtocol', () => {
  it('suggests rapid_reset_5 between 04:00 and 12:59', () => {
    const morning = new Date(2026, 5, 15, 8, 30);
    expect(defaultProtocol(morning)).toBe('rapid_reset_5');

    const boundaryStart = new Date(2026, 5, 15, 4, 0);
    expect(defaultProtocol(boundaryStart)).toBe('rapid_reset_5');

    const boundaryEnd = new Date(2026, 5, 15, 12, 59);
    expect(defaultProtocol(boundaryEnd)).toBe('rapid_reset_5');
  });

  it('suggests afternoon_recharge_10 between 13:00 and 19:59', () => {
    const postLunch = new Date(2026, 5, 15, 14, 15);
    expect(defaultProtocol(postLunch)).toBe('afternoon_recharge_10');

    const boundaryStart = new Date(2026, 5, 15, 13, 0);
    expect(defaultProtocol(boundaryStart)).toBe('afternoon_recharge_10');

    const boundaryEnd = new Date(2026, 5, 15, 19, 59);
    expect(defaultProtocol(boundaryEnd)).toBe('afternoon_recharge_10');
  });

  it('suggests deep_rest_30 between 20:00 and 03:59', () => {
    const evening = new Date(2026, 5, 15, 21, 30);
    expect(defaultProtocol(evening)).toBe('deep_rest_30');

    const night = new Date(2026, 5, 15, 2, 0);
    expect(defaultProtocol(night)).toBe('deep_rest_30');

    const boundaryStart = new Date(2026, 5, 15, 20, 0);
    expect(defaultProtocol(boundaryStart)).toBe('deep_rest_30');

    const boundaryEnd = new Date(2026, 5, 15, 3, 59);
    expect(defaultProtocol(boundaryEnd)).toBe('deep_rest_30');
  });
});

describe('timeOfDay: getTimeContext', () => {
  it('returns morning greeting before 12:00', () => {
    const d = new Date(2026, 5, 15, 9, 0);
    const ctx = getTimeContext(d);
    expect(ctx.greeting).toBe('Good morning.');
    expect(ctx.protocolId).toBe('rapid_reset_5');
  });

  it('returns afternoon greeting between 12:00 and 16:59', () => {
    const d = new Date(2026, 5, 15, 14, 0);
    const ctx = getTimeContext(d);
    expect(ctx.greeting).toBe('Good afternoon.');
    expect(ctx.protocolId).toBe('afternoon_recharge_10');
  });

  it('returns evening greeting between 17:00 and 20:59', () => {
    const d = new Date(2026, 5, 15, 18, 0);
    const ctx = getTimeContext(d);
    expect(ctx.greeting).toBe('Good evening.');
    expect(ctx.protocolId).toBe('afternoon_recharge_10');
  });

  it('returns winding down greeting after 21:00', () => {
    const d = new Date(2026, 5, 15, 22, 0);
    const ctx = getTimeContext(d);
    expect(ctx.greeting).toBe('Winding down?');
    expect(ctx.protocolId).toBe('deep_rest_30');
  });
});
