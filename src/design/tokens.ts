/**
 * Ember Design Tokens
 * Master Plan Part 1 §2.1 — Single Source of Truth
 */

export const colors = {
  // Canvas & Surfaces
  bg: '#000000', // Primary canvas (true OLED black)
  surface: '#0B0B0E', // Cards, sheets (Deep Obsidian)
  surfaceRaised: '#111116', // Pressed/selected card fill
  border: '#1C1C22', // Hairline borders (1 dp)

  // Typography
  text: '#F4F4F6', // Primary text (Warm Alabaster)
  textMuted: '#8E8E99', // Secondary text (Muted Stone)
  textFaint: '#5C5C66', // Disabled / tertiary (use >= 14 sp only)

  // Amber Accent Palette
  accent: '#F59E0B', // Primary accent (Candlelight Amber)
  accentSoft: '#FBBF24', // Highlights, ember core, heatmap peak (Soft Gold)
  accentPressed: '#D97706', // Pressed state of amber surfaces
  accentGlow: 'rgba(245, 158, 11, 0.18)', // Selected-card halo, orb outer glow
  onAccent: '#000000', // Text/icons on amber (≈10:1 contrast)

  // Overlays & Feedback
  scrim: 'rgba(0, 0, 0, 0.72)', // Sheet backdrop
  dangerMuted: '#9A3412', // Destructive confirmations only (reset data)

  // Sleep mode auto-dim multiplier
  dimMultiplier: 0.38,
} as const;

/**
 * 30-day consistency heatmap cell ramp
 * Fills based on committed restorative minutes that day
 */
export const heatmapColors = {
  level0: '#14141A', // 0 min (no practice)
  level1: '#3B2A0A', // > 0 and < 5 min
  level2: '#7A4F0B', // >= 5 and < 10 min
  level3: '#C27A0A', // >= 10 and < 30 min
  level4: '#FBBF24', // >= 30 min
  graceRing: '#7A4F0B', // 1.5 dp inner ring for Grace-covered days
} as const;

/**
 * Self-reported perceived state check-in colors
 * Strict warm-only palette (no blue/purple channels)
 */
export const stateColors = {
  1: { key: 'wired', label: 'Wired', color: '#EA580C' },
  2: { key: 'drained', label: 'Drained', color: '#78716C' },
  3: { key: 'neutral', label: 'Neutral', color: '#A8A29E' },
  4: { key: 'calm', label: 'Calm', color: '#F59E0B' },
  5: { key: 'restored', label: 'Restored', color: '#FDE68A' },
} as const;

export const fontFamilies = {
  frauncesLight: 'Fraunces_300Light',
  interExtraLight: 'Inter_200ExtraLight',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.frauncesLight,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: colors.text,
  },
  displaySm: {
    fontFamily: fontFamilies.frauncesLight,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    color: colors.text,
  },
  timer: {
    fontFamily: fontFamilies.interExtraLight,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as 'tabular-nums'[],
    color: colors.text,
  },
  title: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
    color: colors.text,
  },
  cardTitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 0,
    color: colors.text,
  },
  body: {
    fontFamily: fontFamilies.interRegular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    color: colors.text,
  },
  label: {
    fontFamily: fontFamilies.interMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: colors.text,
  },
  caption: {
    fontFamily: fontFamilies.interMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  badge: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: colors.onAccent,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
  screenPaddingHorizontal: 20,
} as const;

export const radii = {
  card: 24,
  pill: 999,
  button: 28,
  sheet: 32,
  orb: 9999,
} as const;

export const layout = {
  minTouchTarget: 48,
  stickyCtaHeight: 72,
  topBarHeight: 56,
  sessionCardHeight: 88,
} as const;

export const motion = {
  durations: {
    press: 120,
    selection: 220,
    sheet: 360,
    stageChange: 480,
    fade: 150,
  },
  easings: {
    // Easing.bezier(0.22, 1, 0.36, 1) - Natural entrance
    entrance: [0.22, 1, 0.36, 1] as const,
    // Easing.bezier(0.45, 0, 0.55, 1) - Natural breathing cycle
    breathing: [0.45, 0, 0.55, 1] as const,
  },
} as const;

/**
 * Standard reusable component style presets
 */
export const componentStyles = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  cardSelected: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 0,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: layout.minTouchTarget,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chipSelected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
  },
  primaryButton: {
    height: layout.stickyCtaHeight,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: layout.minTouchTarget,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
} as const;
