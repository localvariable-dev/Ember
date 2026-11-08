/**
 * Ember Database Interfaces
 * Master Plan Part 4 §5.1, Part 6 §7.1 & §8.2
 * Shared interface definitions for production and test database adapters.
 */

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): RunResult;
  all<T>(sql: string, params?: unknown[]): T[];
  first<T>(sql: string, params?: unknown[]): T | null;
  tx<T>(fn: () => T): T;
  close?(): void;
}
