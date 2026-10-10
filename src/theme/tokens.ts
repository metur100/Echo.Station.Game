/**
 * ECHO STATION design tokens. Every screen pulls colour, spacing, type and motion from here.
 *
 * Palette roles
 *   bg*      deep navy / near-black surfaces
 *   cyan     functional, healthy systems, primary actions
 *   teal     secondary functional (life support, corridors)
 *   amber    energy and warnings
 *   orange   urgent warnings
 *   violet   unknown, anomalies, Echo Memory (muted on purpose)
 *   danger   failures and destructive actions
 *
 * Contrast: text (#E6EDF8) on bg0 ≈ 16:1, textDim (#93A1BF) on panel ≈ 6.5:1, accent text on
 * panel ≥ 4.5:1. Status is never shown by colour alone: pills and chips always pair an icon
 * and a word with the colour.
 */
export const colors = {
  bg0: '#04070F',
  bg1: '#070C1A',
  bg2: '#0B1326',
  panel: 'rgba(14, 24, 46, 0.94)',
  panelSolid: '#0E182E',
  panelRaised: '#13203B',
  panelPressed: '#182A4C',
  line: '#1C2A48',
  lineStrong: '#2A3C63',
  scrim: 'rgba(2, 4, 10, 0.72)',

  text: '#E6EDF8',
  textDim: '#93A1BF',
  textFaint: '#5D6B8A',

  cyan: '#45E0DC',
  cyanDeep: '#1B8F95',
  teal: '#24B8A6',
  amber: '#FFB547',
  orange: '#FF7A3D',
  violet: '#9A84F0',
  violetDeep: '#4B3C8A',
  danger: '#FF5866',
  success: '#54D18C',
  frost: '#9FD8FF',
  green: '#7BD389',
  steel: '#8FA3C4',
} as const;

export type ColorToken = keyof typeof colors;

export const accentColor = {
  cyan: colors.cyan,
  teal: colors.teal,
  amber: colors.amber,
  violet: colors.violet,
  green: colors.green,
  steel: colors.steel,
  frost: colors.frost,
} as const;

/** 4-px grid */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const fonts = {
  display: 'Oxanium_700Bold',
  displaySemi: 'Oxanium_600SemiBold',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',
} as const;

/** Type scale (size / line height). Minimum on-screen size is 12. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: 1 },
  heading: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24, letterSpacing: 0.6 },
  label: { fontFamily: fonts.displaySemi, fontSize: 12, lineHeight: 16, letterSpacing: 1.6, textTransform: 'uppercase' as const },
  body: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.uiSemi, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.uiSemi, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.uiMedium, fontSize: 12, lineHeight: 16 },
  number: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 18, fontVariant: ['tabular-nums' as const] },
} as const;

export const icon = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Minimum touch target (dp) */
export const touch = 44;

export const motion = {
  fast: 140,
  base: 220,
  slow: 380,
  pulse: 2400,
  /** Spring config for sheets and cards */
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
} as const;

export const shadow = {
  glowCyan: { shadowColor: colors.cyan, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  card: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
} as const;

export type StatusTone = 'ok' | 'info' | 'warn' | 'critical' | 'anomaly' | 'muted';
export const toneColor: Record<StatusTone, string> = {
  ok: colors.success,
  info: colors.cyan,
  warn: colors.amber,
  critical: colors.danger,
  anomaly: colors.violet,
  muted: colors.textFaint,
};
