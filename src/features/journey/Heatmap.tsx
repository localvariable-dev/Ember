/**
 * Heatmap Component (30-day Retention Grid)
 * Master Plan Part 1 §2.7
 *
 * 7 rows (Mon-Sun) x ISO week columns (Mon-start).
 * 30-day sliding window ending on today.
 * Cells before the window are blank placeholder slots (not level 0).
 * Today cell in right-most column highlighted with 1dp accentSoft outline.
 * Accessible with TalkBack labels ("Tuesday 12 November: 10 minutes").
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../design/tokens';
import { addDays, daysBetween, type DayKey } from '../../domain/dayKey';
import type { DayLedgerRow } from '../../data/types';

interface HeatmapProps {
  today: DayKey;
  ledgerRows: DayLedgerRow[];
}

interface CellData {
  dayKey: DayKey;
  isBlank: boolean;
  isToday: boolean;
  level: 0 | 1 | 2 | 3; // 0: None, 1: <10m, 2: 10-29m, 3: >=30m
  isGrace: boolean;
  minutes: number;
  accessibilityLabel: string;
}

const CELL_SIZE = 14;
const CELL_GAP = 4;

function parseDayKeyDate(dayKey: DayKey): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function getIsoDayOfWeek(d: Date): number {
  // Monday = 0, Sunday = 6
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDayLabel(dayKey: DayKey): string {
  const d = parseDayKeyDate(dayKey);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  };
  return d.toLocaleDateString('en-US', options);
}

export function Heatmap({ today, ledgerRows }: HeatmapProps) {
  const windowDays = 30;
  const startDay = useMemo(() => addDays(today, -(windowDays - 1)), [today]);

  const practiceMap = useMemo(() => {
    const map = new Map<DayKey, DayLedgerRow>();
    for (const r of ledgerRows) {
      map.set(r.localDay as DayKey, r);
    }
    return map;
  }, [ledgerRows]);

  // Build grid columns
  const columns: CellData[][] = useMemo(() => {
    const startDate = parseDayKeyDate(startDay);
    const startDayOfWeek = getIsoDayOfWeek(startDate);

    // First Monday of the grid
    const firstMonday = addDays(startDay, -startDayOfWeek);

    const totalDaysToDisplay = daysBetween(firstMonday, today) + 1;
    // Align to full weeks (multiples of 7)
    const todayDate = parseDayKeyDate(today);
    const todayDayOfWeek = getIsoDayOfWeek(todayDate);
    const paddingAtEnd = 6 - todayDayOfWeek;
    const totalSlotCount = totalDaysToDisplay + paddingAtEnd;
    const numWeeks = Math.ceil(totalSlotCount / 7);

    const cols: CellData[][] = [];

    for (let w = 0; w < numWeeks; w++) {
      const colCells: CellData[] = [];
      for (let r = 0; r < 7; r++) {
        const offset = w * 7 + r;
        const currentDay = addDays(firstMonday, offset);
        const isBefore = daysBetween(currentDay, startDay) > 0;
        const isAfter = daysBetween(today, currentDay) > 0;
        const isBlank = isBefore || isAfter;
        const isTodayCell = currentDay === today;

        if (isBlank) {
          colCells.push({
            dayKey: currentDay,
            isBlank: true,
            isToday: false,
            level: 0,
            isGrace: false,
            minutes: 0,
            accessibilityLabel: '',
          });
          continue;
        }

        const record = practiceMap.get(currentDay);
        const dayLabel = formatDayLabel(currentDay);

        if (!record) {
          colCells.push({
            dayKey: currentDay,
            isBlank: false,
            isToday: isTodayCell,
            level: 0,
            isGrace: false,
            minutes: 0,
            accessibilityLabel: `${dayLabel}: No rest recorded`,
          });
        } else if (record.kind === 'grace') {
          colCells.push({
            dayKey: currentDay,
            isBlank: false,
            isToday: isTodayCell,
            level: 0,
            isGrace: true,
            minutes: 0,
            accessibilityLabel: `${dayLabel}: Rest Grace`,
          });
        } else {
          const minutes = Math.floor(record.committedMs / 60_000);
          let level: 0 | 1 | 2 | 3 = 0;
          if (record.committedMs >= 1_800_000) {
            level = 3;
          } else if (record.committedMs >= 600_000) {
            level = 2;
          } else if (record.committedMs > 0) {
            level = 1;
          }

          colCells.push({
            dayKey: currentDay,
            isBlank: false,
            isToday: isTodayCell,
            level,
            isGrace: false,
            minutes,
            accessibilityLabel: `${dayLabel}: ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
          });
        }
      }
      cols.push(colCells);
    }

    return cols;
  }, [startDay, today, practiceMap]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Last 30 days</Text>

      {/* Grid container with weekday hints */}
      <View style={styles.gridWrapper}>
        <View style={styles.weekdayColumn}>
          <Text style={styles.weekdayLabel}>M</Text>
          <Text style={styles.weekdayLabel} />
          <Text style={styles.weekdayLabel}>W</Text>
          <Text style={styles.weekdayLabel} />
          <Text style={styles.weekdayLabel}>F</Text>
          <Text style={styles.weekdayLabel} />
          <Text style={styles.weekdayLabel}>S</Text>
        </View>

        <View style={styles.grid}>
          {columns.map((col, colIndex) => (
            <View key={`col-${colIndex}`} style={styles.column}>
              {col.map((cell) => {
                if (cell.isBlank) {
                  return (
                    <View
                      key={cell.dayKey}
                      style={[styles.cell, styles.cellBlank]}
                      accessible={false}
                    />
                  );
                }

                let bg: string = colors.surfaceRaised;
                if (cell.isGrace) {
                  bg = 'rgba(245, 158, 11, 0.20)';
                } else if (cell.level === 1) {
                  bg = 'rgba(245, 158, 11, 0.40)';
                } else if (cell.level === 2) {
                  bg = 'rgba(245, 158, 11, 0.70)';
                } else if (cell.level === 3) {
                  bg = colors.accent;
                }

                return (
                  <View
                    key={cell.dayKey}
                    style={[
                      styles.cell,
                      { backgroundColor: bg },
                      cell.isGrace && styles.cellGrace,
                      cell.isToday && styles.cellToday,
                    ]}
                    accessible={true}
                    accessibilityRole="text"
                    accessibilityLabel={cell.accessibilityLabel}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Less</Text>
        <View style={[styles.legendCell, { backgroundColor: colors.surfaceRaised }]} />
        <View
          style={[styles.legendCell, { backgroundColor: 'rgba(245, 158, 11, 0.40)' }]}
          accessibilityLabel="Under 10 minutes"
        />
        <View
          style={[styles.legendCell, { backgroundColor: 'rgba(245, 158, 11, 0.70)' }]}
          accessibilityLabel="10 to 29 minutes"
        />
        <View
          style={[styles.legendCell, { backgroundColor: colors.accent }]}
          accessibilityLabel="30 or more minutes"
        />
        <View
          style={[
            styles.legendCell,
            {
              backgroundColor: 'rgba(245, 158, 11, 0.20)',
              borderColor: colors.accent,
              borderWidth: 1,
            },
          ]}
          accessibilityLabel="Rest grace"
        />
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  gridWrapper: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  weekdayColumn: {
    flexDirection: 'column',
    gap: CELL_GAP,
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  weekdayLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textFaint,
    height: CELL_SIZE,
    lineHeight: CELL_SIZE,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  column: {
    flexDirection: 'column',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
  },
  cellBlank: {
    backgroundColor: 'transparent',
  },
  cellGrace: {
    borderColor: colors.accent,
    borderWidth: 1,
  },
  cellToday: {
    borderColor: colors.accentSoft,
    borderWidth: 1.5,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.xs,
  },
  legendText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
