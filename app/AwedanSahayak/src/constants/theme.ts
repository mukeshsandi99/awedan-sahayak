/**
 * Design tokens for Awedan Sahayak.
 *
 * Centralised theme — import from here instead of hardcoding values.
 *
 * Colour palette
 *   background    #FFF8F0  cream / warm white (all screens)
 *   card          #FFFFFF  white cards on cream background
 *   primary       #E17055  coral orange — buttons, accents
 *   textPrimary   #1A1A2E  dark navy — titles, body text
 *   textSecondary #999     grey — subtitles, hints
 *   danger        #D63031  red — errors, recording state
 *   success       #27AE60  green — save, success states
 *   info          #0984E3  blue — links, directions
 *   word          #2B579A  dark blue — Word/RTF export
 *   aiCleanup     #6C5CE7  purple — AI cleanup button
 *   borderLight   #F0E8E0  warm border (matches cream bg)
 *   borderInput   #E8E8E8  neutral input border
 */

export const COLORS = {
  background: '#FFF8F0',
  card: '#FFFFFF',
  primary: '#E17055',
  primaryLight: '#FFF0ED',
  textPrimary: '#1A1A2E',
  textSecondary: '#999',
  textTertiary: '#666',
  danger: '#D63031',
  success: '#27AE60',
  info: '#0984E3',
  word: '#2B579A',
  aiCleanup: '#6C5CE7',
  borderLight: '#F0E8E0',
  borderInput: '#E8E8E8',
  warning: '#F39C12',
  warningBg: '#FEF9E7',
  errorBg: '#FFF5F5',
  errorBorder: '#FFE0E0',
} as const;

/** Standard font sizes across the app. */
export const FONT = {
  title: 28,        // page titles (Home, Profile)
  sectionTitle: 22, // card headers, section titles
  cardTitle: 16,    // card/item primary text
  body: 16,         // body text
  bodySmall: 14,    // secondary body, info cards
  subtitle: 13,     // subtitles, hints
  caption: 12,      // captions, English labels
  micro: 11,        // micro hints
} as const;

/** Standard spacing values (in dp). */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pageHorizontal: 20,
} as const;

/** Standard border radii. */
export const RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  round: 9999,
} as const;

/** Standard shadow presets (for elevation on Android). */
export const SHADOW = {
  /** Subtle shadow — list items, info cards */
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  /** Standard card shadow */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  /** Prominent — primary buttons, profile card */
  prominent: {
    shadowColor: '#E17055',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

/** Standard icon sizes. */
export const ICON = {
  sm: 16,
  md: 18,
  lg: 22,
  xl: 24,
  hero: 48,
} as const;
