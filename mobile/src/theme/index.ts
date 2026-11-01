// MediArca design tokens (DESIGN.md, Apple HIG). Same colours as the website.
export const colors = {
  primary: '#0066cc',
  primaryPressed: '#0071e3',
  primarySoft: 'rgba(0,102,204,0.08)',
  primaryTint: '#eaf2fc',
  ink: '#1d1d1f',
  secondaryInk: '#48484a',
  muted: '#86868b',
  placeholder: '#a1a1a6',
  canvas: '#f5f5f7',
  card: '#ffffff',
  border: '#d2d2d7',
  hairline: '#e5e5ea',
  fill: 'rgba(118,118,128,0.12)',
  danger: '#d70015',
  dangerSoft: '#fff2f3',
  success: '#248a3d',
  successSoft: '#effaf2',
  warning: '#b25000',
  warningSoft: '#fff6eb',
  white: '#ffffff',
  tabInactive: '#8e8e93',
  /** Status dot for "Stepped out" (Apple system orange). */
  orange: '#ff9500',
  inactive: '#6e6e73',
} as const;

/** Inter, loaded in app/_layout.tsx; components/AppText.tsx applies it to all text. */
export const font = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
} as const;

export const radius = {
  field: 12,
  tile: 16,
  card: 22,
  pill: 999,
} as const;

/** Soft Apple-style lift instead of borders (works on iOS, Android and web). */
export const shadow = {
  card: { boxShadow: '0px 1px 2px rgba(0,0,0,0.04), 0px 8px 24px rgba(0,0,0,0.05)' },
  raised: { boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 16px 40px rgba(0,0,0,0.08)' },
  bar: { boxShadow: '0px -1px 0px rgba(0,0,0,0.04), 0px -8px 24px rgba(0,0,0,0.04)' },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '600' as const, letterSpacing: -0.8, color: colors.ink },
  title: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.4, color: colors.ink },
  heading: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2, color: colors.ink },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2, color: colors.ink },
  body: { fontSize: 16, color: colors.ink },
  label: { fontSize: 13, color: colors.ink },
  caption: { fontSize: 14, color: colors.muted },
  footnote: { fontSize: 13, color: colors.muted },
  small: { fontSize: 12, color: colors.muted },
} as const;
