/**
 * Clock Abstraction
 * Master Plan Part 2 §3.1
 * Enables deterministic testing and developer time-travel without mocking Date globally.
 */

export interface Clock {
  now(): number;
}

export class SystemClock implements Clock {
  private readonly epochAtStart = Date.now();
  private readonly monotonicAtStart = globalThis.performance?.now?.() ?? 0;

  now(): number {
    const monotonicNow = globalThis.performance?.now?.();
    return monotonicNow === undefined
      ? Date.now()
      : this.epochAtStart + (monotonicNow - this.monotonicAtStart);
  }
}

export class DevClock implements Clock {
  private offsetMs = 0;

  constructor(initialOffsetMs = 0) {
    this.offsetMs = initialOffsetMs;
  }

  setOffsetDays(days: number): void {
    this.offsetMs = days * 86_400_000;
  }

  setOffsetMs(ms: number): void {
    this.offsetMs = ms;
  }

  getOffsetDays(): number {
    return Math.round(this.offsetMs / 86_400_000);
  }

  reset(): void {
    this.offsetMs = 0;
  }

  now(): number {
    return Date.now() + this.offsetMs;
  }
}

export class TestClock implements Clock {
  constructor(private currentMs = 0) {}

  now(): number {
    return this.currentMs;
  }

  set(ms: number): void {
    this.currentMs = ms;
  }

  advance(ms: number): void {
    this.currentMs += ms;
  }
}
