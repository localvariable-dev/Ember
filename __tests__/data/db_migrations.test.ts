/**
 * Database & Migrations Tests
 * Master Plan Part 4 §5.1, §5.2
 * Tests fresh database creation, migration ordering, user_version tracking,
 * repeated migration safety, rollback on failure, and foreign key enforcement.
 */

import { openTestDatabase } from '../../src/data/db';
import { migrate, MIGRATIONS } from '../../src/data/migrations';

describe('Database & Migrations', () => {
  it('starts at user_version 0 and migrates to latest version', () => {
    const db = openTestDatabase(':memory:');

    const v0 = db.first<{ user_version: number }>('PRAGMA user_version;')!.user_version;
    expect(v0).toBe(0);

    const result = migrate(db);
    expect(result.previousVersion).toBe(0);
    expect(result.newVersion).toBe(MIGRATIONS.length);

    const v1 = db.first<{ user_version: number }>('PRAGMA user_version;')!.user_version;
    expect(v1).toBe(MIGRATIONS.length);
  });

  it('creates all required schema tables and initial singleton rows', () => {
    const db = openTestDatabase(':memory:');
    migrate(db);

    const tables = db
      .all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';",
      )
      .map((t) => t.name);

    expect(tables).toContain('audio_protocols');
    expect(tables).toContain('voices');
    expect(tables).toContain('ambient_beds');
    expect(tables).toContain('protocol_voice_tracks');
    expect(tables).toContain('session_logs');
    expect(tables).toContain('day_ledger');
    expect(tables).toContain('streak_state');
    expect(tables).toContain('user_entitlements');
    expect(tables).toContain('user_preferences');

    // Singletons
    const streak = db.first<{ id: number }>('SELECT id FROM streak_state WHERE id = 1;');
    expect(streak?.id).toBe(1);

    const prefs = db.first<{ id: number }>('SELECT id FROM user_preferences WHERE id = 1;');
    expect(prefs?.id).toBe(1);
  });

  it('seeds initial protocol, voice, and ambient bed catalogues with accurate metadata', () => {
    const db = openTestDatabase(':memory:');
    migrate(db);

    // Audio protocols
    const protocols = db.all<{ id: string; minutes: number; tier: string }>(
      'SELECT id, minutes, tier FROM audio_protocols ORDER BY sort_order ASC;',
    );
    expect(protocols).toEqual([
      { id: 'rapid_reset_5', minutes: 5, tier: 'free' },
      { id: 'afternoon_recharge_10', minutes: 10, tier: 'free' },
      { id: 'deep_rest_30', minutes: 30, tier: 'pro' },
    ]);

    // Voices
    const voices = db.all<{ id: string; name: string; tier: string; status: string }>(
      'SELECT id, name, tier, status FROM voices ORDER BY sort_order ASC;',
    );
    expect(voices).toEqual([
      { id: 'maya_warm', name: 'Maya', tier: 'free', status: 'installed' },
      { id: 'arjun_deep', name: 'Arjun', tier: 'pro', status: 'installed' },
    ]);

    // Ambient beds
    const beds = db.all<{ id: string; tier: string; is_binaural: number }>(
      'SELECT id, tier, is_binaural FROM ambient_beds ORDER BY sort_order ASC;',
    );
    expect(beds.length).toBe(6);
    expect(beds.find((b) => b.id === 'rain')?.tier).toBe('free');
    expect(beds.find((b) => b.id === 'theta_6hz')?.tier).toBe('free');
    expect(beds.find((b) => b.id === 'theta_6hz')?.is_binaural).toBe(1);
    expect(beds.find((b) => b.id === 'delta_2hz')?.tier).toBe('pro');
  });

  it('is completely safe when migration is repeated (idempotency)', () => {
    const db = openTestDatabase(':memory:');

    const firstRun = migrate(db);
    expect(firstRun.previousVersion).toBe(0);
    expect(firstRun.newVersion).toBe(2);

    // Run again
    const secondRun = migrate(db);
    expect(secondRun.previousVersion).toBe(2);
    expect(secondRun.newVersion).toBe(2);

    // Singletons still exist with single row
    const streakCount = db.first<{ count: number }>(
      'SELECT COUNT(*) as count FROM streak_state;',
    )!.count;
    expect(streakCount).toBe(1);
  });

  it('upgrades an existing database from migration 1 to migration 2 preserving user data', () => {
    const db = openTestDatabase(':memory:');
    // Run only migration 1
    MIGRATIONS[0]!.up(db);
    db.exec('PRAGMA user_version = 1;');

    // Manually force theta_6hz to 'pro' as in previous v1 commit
    db.run(`UPDATE ambient_beds SET tier = 'pro' WHERE id = 'theta_6hz';`);

    // Insert user session to verify preservation
    db.run(`
      INSERT INTO session_logs (
        id, protocol_id, voice_id, mode, access_via, started_at_ms,
        local_day, tz_offset_min, planned_ms, status, created_at_ms
      ) VALUES ('user_session_1', 'rapid_reset_5', 'maya_warm', 'focus', 'free', 1000, '2026-06-15', 330, 300000, 'completed', 1000);
    `);

    // Run migrate(db)
    const upgradeResult = migrate(db);
    expect(upgradeResult.previousVersion).toBe(1);
    expect(upgradeResult.newVersion).toBe(2);

    // Assert theta_6hz upgraded to free
    const bed = db.first<{ tier: string }>('SELECT tier FROM ambient_beds WHERE id = ?;', [
      'theta_6hz',
    ]);
    expect(bed?.tier).toBe('free');

    // Assert historical user session preserved intact
    const session = db.first<{ id: string; status: string }>(
      'SELECT id, status FROM session_logs WHERE id = ?;',
      ['user_session_1'],
    );
    expect(session?.id).toBe('user_session_1');
    expect(session?.status).toBe('completed');
  });

  it('rolls back and preserves user_version if a migration transaction throws an error', () => {
    const db = openTestDatabase(':memory:');

    // Attempt an invalid transaction
    expect(() => {
      db.tx(() => {
        db.exec('CREATE TABLE temp_test (id INT PRIMARY KEY);');
        db.exec('PRAGMA user_version = 999;');
        throw new Error('Simulated migration crash');
      });
    }).toThrow('Simulated migration crash');

    // Verify user_version was NOT committed to 999
    const ver = db.first<{ user_version: number }>('PRAGMA user_version;')!.user_version;
    expect(ver).toBe(0);

    // Verify temp_test table was rolled back
    const tableExists = db.first(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='temp_test';",
    );
    expect(tableExists).toBeNull();
  });

  it('enforces foreign key constraints strictly', () => {
    const db = openTestDatabase(':memory:');
    migrate(db);

    // Attempting to insert a session with a nonexistent protocol must fail FK check
    expect(() => {
      db.run(
        `
        INSERT INTO session_logs (
          id, protocol_id, voice_id, mode, access_via, started_at_ms,
          local_day, tz_offset_min, planned_ms, status, created_at_ms
        ) VALUES ('s1', 'nonexistent_protocol', 'maya_warm', 'focus', 'free', 1000, '2026-06-15', 330, 300000, 'in_progress', 1000);
        `,
      );
    }).toThrow(/FOREIGN KEY/i);

    // Attempting to insert a session with a nonexistent voice must fail FK check
    expect(() => {
      db.run(
        `
        INSERT INTO session_logs (
          id, protocol_id, voice_id, mode, access_via, started_at_ms,
          local_day, tz_offset_min, planned_ms, status, created_at_ms
        ) VALUES ('s2', 'rapid_reset_5', 'nonexistent_voice', 'focus', 'free', 1000, '2026-06-15', 330, 300000, 'in_progress', 1000);
        `,
      );
    }).toThrow(/FOREIGN KEY/i);
  });
});
