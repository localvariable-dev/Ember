import { SystemClock } from '../../src/domain/clock';

describe('SystemClock', () => {
  it('does not jump when the device wall clock changes during a session', () => {
    const originalNow = Date.now;
    let wallTime = 1_700_000_000_000;
    Date.now = () => wallTime;
    try {
      const clock = new SystemClock();
      const before = clock.now();
      wallTime += 3_600_000;
      const after = clock.now();

      expect(after - before).toBeLessThan(1000);
      expect(after).toBeGreaterThanOrEqual(before);
    } finally {
      Date.now = originalNow;
    }
  });
});
