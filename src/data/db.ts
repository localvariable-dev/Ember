/**
 * Ember Database Abstraction (Android Native Production)
 * Master Plan Part 4 §5.1, Part 6 §7.1 & §8.2
 * Production SQLite interface using expo-sqlite for Android runtime.
 */

import type { Db, RunResult } from './dbTypes';

export type { Db, RunResult } from './dbTypes';

/**
 * Expo SQLite adapter for runtime Android execution.
 */
export class ExpoSqliteDb implements Db {
  constructor(private db: any) {}

  exec(sql: string): void {
    this.db.execSync(sql);
  }

  run(sql: string, params: unknown[] = []): RunResult {
    const res = this.db.runSync(sql, params);
    return { changes: res.changes, lastInsertRowId: res.lastInsertRowId };
  }

  all<T>(sql: string, params: unknown[] = []): T[] {
    return this.db.getAllSync(sql, params);
  }

  first<T>(sql: string, params: unknown[] = []): T | null {
    return this.db.getFirstSync(sql, params) ?? null;
  }

  tx<T>(fn: () => T): T {
    return this.db.withTransactionSync(fn);
  }

  close(): void {
    this.db.closeSync();
  }
}

/**
 * Opens production runtime Expo SQLite database with WAL and foreign keys enabled.
 */
export function openAppDatabase(dbName = 'ember.db'): Db {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite');
  const db = SQLite.openDatabaseSync(dbName);
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');
  return new ExpoSqliteDb(db);
}
