/**
 * ===============================================
 * FACTORY CONSTANTS
 * ===============================================
 * @file src/factories/constants.ts
 *
 * Centralized constants for the UI factory system.
 * Defines sizes, contexts, and default configurations.
 */

/**
 * UI contexts determine sizing and spacing for components.
 */
export const UI_CONTEXTS = {
  TABLE: 'table',
  MODAL: 'modal',
  TOOLBAR: 'toolbar',
  CARD: 'card',
  SIDEBAR: 'sidebar',
  INLINE: 'inline'
} as const;

/**
 * Standard icon sizes (in pixels).
 * Matches design system specifications.
 */
export const ICON_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18, // Table standard (desktop)
  xl: 20,
  '2xl': 24, // Modal standard
  '3xl': 32
} as const;

/**
 * Standard button sizes (in pixels).
 * Defines touch target dimensions.
 */
export const BUTTON_SIZES = {
  xs: 24,
  sm: 28,
  md: 32,
  lg: 36, // Desktop standard
  xl: 40
} as const;

/**
 * Default configurations per UI context.
 * Each context has optimal icon/button sizes and spacing.
 */
export const CONTEXT_DEFAULTS = {
  table: { iconSize: 'lg' as const, buttonSize: 'lg' as const, gap: 8 },
  modal: { iconSize: '2xl' as const, buttonSize: 'xl' as const, gap: 12 },
  toolbar: { iconSize: 'lg' as const, buttonSize: 'lg' as const, gap: 8 },
  card: { iconSize: 'md' as const, buttonSize: 'md' as const, gap: 4 },
  sidebar: { iconSize: 'lg' as const, buttonSize: 'lg' as const, gap: 8 },
  inline: { iconSize: 'sm' as const, buttonSize: 'sm' as const, gap: 4 }
} as const;

/**
 * Standard SVG attributes for Lucide-style icons.
 */
export const SVG_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const;
