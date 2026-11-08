/**
 * Ember Database Abstraction
 * Master Plan Part 4 §5.1, Part 6 §7.1 & §8.2
 * Synchronous SQLite interface for expo-sqlite (runtime) and better-sqlite3 (test/CI).
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
 * better-sqlite3 adapter for Node/Jest unit testing in CI.
 */
export class BetterSqliteDb implements Db {
  constructor(private db: any) {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  run(sql: string, params: unknown[] = []): RunResult {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return {
      changes: info.changes,
      lastInsertRowId: Number(info.lastInsertRowId),
    };
  }

  all<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  first<T>(sql: string, params: unknown[] = []): T | null {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return (row as T) ?? null;
  }

  tx<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Opens runtime Expo SQLite database with WAL and foreign keys enabled.
 */
export function openAppDatabase(dbName = 'ember.db'): Db {
  // Lazy require to avoid importing native modules in Node test runner
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite');
  const db = SQLite.openDatabaseSync(dbName);
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');
  return new ExpoSqliteDb(db);
}

/**
 * Opens Node/test SQLite database using better-sqlite3.
 */
export function openTestDatabase(filePath = ':memory:'): BetterSqliteDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const db = new Database(filePath);
  return new BetterSqliteDb(db);
}
