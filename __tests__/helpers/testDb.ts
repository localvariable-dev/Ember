/**
 * Test Database Helper
 * Master Plan Part 4 §5.1 & §5.2
 *
 * Isolated better-sqlite3 runner for Node.js/Jest unit and integration tests.
 * This file is located under __tests__/helpers/ and is NEVER imported or bundled
 * in the production application runtime.
 */

import Database from 'better-sqlite3';
import type { Db, RunResult } from '../../src/data/dbTypes';

export class BetterSqliteDb implements Db {
  constructor(private db: InstanceType<typeof Database>) {
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
      lastInsertRowId: Number(info.lastInsertRowid),
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
 * Opens Node/test SQLite database using better-sqlite3.
 * Used exclusively by unit and integration tests.
 */
export function openTestDatabase(filePath = ':memory:'): BetterSqliteDb {
  const db = new Database(filePath);
  return new BetterSqliteDb(db);
}
