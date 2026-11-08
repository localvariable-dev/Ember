/**
 * Local DayKey utilities ('YYYY-MM-DD')
 * Master Plan Part 2 §3.3
 * Pure functions: timezone-safe, leap-year safe, and DST-safe calendar math.
 */

export type DayKey = string; // Format: 'YYYY-MM-DD'

const p2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Derives a local calendar date string 'YYYY-MM-DD' from a millisecond timestamp.
 * Computed once at session start and stored in SQLite.
 */
export const dayKeyFromMs = (ms: number): DayKey => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

/**
 * Converts a DayKey into integer UTC days since epoch.
 */
const toUtcDays = (k: DayKey): number => {
  const parts = k.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/**
 * Calculates calendar days between two DayKeys (b - a).
 * Positive if b is in the future relative to a; 0 if same day; negative if in the past.
 */
export const daysBetween = (a: DayKey, b: DayKey): number =>
  Math.round(toUtcDays(b) - toUtcDays(a));

/**
 * Adds n calendar days to a DayKey. Correctly handles leap years and month boundaries.
 */
export const addDays = (k: DayKey, n: number): DayKey => {
  const t = new Date(toUtcDays(k) * 86_400_000 + n * 86_400_000);
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
};
