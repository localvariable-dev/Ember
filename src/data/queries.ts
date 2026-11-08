/**
 * Ember Raw SQL Queries
 * Master Plan Part 4 §5.5
 * Centralized SQL statements with COALESCE safety for fresh installations.
 */

export const QUERIES = {
  // Heatmap + ledger window (30 local days)
  GET_DAY_LEDGER_RANGE: `
    SELECT local_day, kind, committed_ms, sessions
    FROM day_ledger
    WHERE local_day BETWEEN ? AND ?
    ORDER BY local_day ASC;
  `,

  // Restorative minutes + completed count (COALESCE handles fresh installs)
  GET_RESTORATIVE_STATS: `
    SELECT
      COALESCE(CAST(SUM(CASE WHEN status IN ('completed','partial') THEN listened_ms ELSE 0 END) / 60000 AS INTEGER), 0) AS minutes,
      COALESCE(SUM(status = 'completed'), 0) AS sessions
    FROM session_logs;
  `,

  // Free-pass qualification input: distinct days with a committed 5- or 10-min session in the last 7 days
  GET_QUALIFYING_SHORT_DAYS: `
    SELECT DISTINCT local_day
    FROM session_logs
    WHERE status='completed'
      AND protocol_id IN ('rapid_reset_5', 'afternoon_recharge_10')
      AND local_day >= ?
    ORDER BY local_day ASC;
  `,

  // Calm Delta groups (headline insight)
  GET_CALM_DELTA_GROUPS: `
    SELECT
      protocol_id,
      pre_state,
      COUNT(*) AS n,
      AVG(post_state = 5)  AS pct_restored,
      AVG(post_state >= 4) AS pct_calm_plus
    FROM session_logs
    WHERE status='completed'
      AND pre_state IS NOT NULL
      AND post_state IS NOT NULL
    GROUP BY protocol_id, pre_state
    HAVING n >= 5;
  `,

  // Pro: mean delta by protocol x voice x mode
  GET_PRO_DELTA_BY_SLICE: `
    SELECT
      protocol_id,
      voice_id,
      mode,
      COUNT(*) AS n,
      AVG(post_state - pre_state) AS mean_delta
    FROM session_logs
    WHERE status='completed'
      AND pre_state IS NOT NULL
      AND post_state IS NOT NULL
    GROUP BY protocol_id, voice_id, mode;
  `,

  // Pro: weekly mean delta (last 8 weeks; Monday-based week start so weeks never split across years)
  GET_PRO_WEEKLY_DELTA: `
    SELECT
      date(local_day, 'weekday 1', '-7 days') AS wk,
      COUNT(*) AS n,
      AVG(post_state - pre_state) AS mean_delta
    FROM session_logs
    WHERE status='completed'
      AND pre_state IS NOT NULL
      AND post_state IS NOT NULL
      AND local_day >= ?
    GROUP BY wk
    ORDER BY wk ASC;
  `,

  // Pro: best time-of-day band (local start hour)
  GET_PRO_TIME_BAND_DELTA: `
    SELECT
      CASE
        WHEN h BETWEEN 5 AND 10 THEN '05-10'
        WHEN h BETWEEN 11 AND 14 THEN '11-14'
        WHEN h BETWEEN 15 AND 18 THEN '15-18'
        WHEN h BETWEEN 19 AND 22 THEN '19-22'
        ELSE '23-04'
      END AS band,
      COUNT(*) AS n,
      AVG(post_state - pre_state) AS mean_delta
    FROM (
      SELECT
        post_state,
        pre_state,
        CAST(strftime('%H', started_at_ms/1000 + tz_offset_min*60, 'unixepoch') AS INTEGER) AS h
      FROM session_logs
      WHERE status='completed'
        AND pre_state IS NOT NULL
        AND post_state IS NOT NULL
    )
    GROUP BY band
    HAVING n >= 3
    ORDER BY mean_delta DESC;
  `,

  // Morning-after check-in candidate (Sleep session awaiting post_state, within 10 h)
  GET_MORNING_CHECKIN_CANDIDATE: `
    SELECT *
    FROM session_logs
    WHERE mode='sleep'
      AND status='completed'
      AND post_state IS NULL
      AND committed_at_ms >= ?
    ORDER BY committed_at_ms DESC
    LIMIT 1;
  `,

  // Launch reconcile: in-progress sessions needing startup recovery
  GET_IN_PROGRESS_SESSIONS: `
    SELECT *
    FROM session_logs
    WHERE status='in_progress'
    ORDER BY started_at_ms ASC;
  `,

  // Learned reminder time input (last 14 days of commits)
  GET_LEARNED_REMINDER_COMMITS: `
    SELECT started_at_ms, tz_offset_min
    FROM session_logs
    WHERE status='completed'
      AND started_at_ms >= ?
    ORDER BY started_at_ms DESC;
  `,
} as const;
