/**
 * ===============================================
 * UTILIZATION UTILITIES
 * ===============================================
 * @file src/react/utils/utilization.ts
 *
 * Shared color/class helpers for utilization progress bars.
 * Used by both admin RetainersTable and portal PortalRetainers.
 */

// ============================================
// THRESHOLD CONSTANTS
// ============================================

/** Below this ratio the bar is green (success) */
export const UTILIZATION_THRESHOLD_WARNING = 0.6;

/** At or above this ratio the bar is red (danger) */
export const UTILIZATION_THRESHOLD_DANGER = 0.8;

// ============================================
// OPTIONS
// ============================================

export interface UtilizationThresholdOptions {
  /** Ratio at which color shifts to warning (default 0.6) */
  warningThreshold?: number;
  /** Ratio at which color shifts to danger (default 0.8) */
  dangerThreshold?: number;
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Return a CSS variable string for the utilization color.
 *
 * @param ratio - Utilization ratio (0..1+). Values above 1 are treated as over-utilized.
 * @param options - Optional custom thresholds.
 * @returns A CSS var() reference suitable for inline styles.
 */
export function getUtilizationColor(
  ratio: number,
  options?: UtilizationThresholdOptions
): string {
  const warning = options?.warningThreshold ?? UTILIZATION_THRESHOLD_WARNING;
  const danger = options?.dangerThreshold ?? UTILIZATION_THRESHOLD_DANGER;

  if (ratio >= danger) return 'var(--status-danger)';
  if (ratio >= warning) return 'var(--status-warning)';
  return 'var(--status-success)';
}

/**
 * Return a CSS class name for the utilization color.
 * Useful for progress-bar fill elements that use class-based coloring.
 *
 * @param ratio - Utilization ratio (0..1+).
 * @param options - Optional custom thresholds.
 * @returns One of 'progress-danger', 'progress-warning', or 'progress-success'.
 */
export function getUtilizationColorClass(
  ratio: number,
  options?: UtilizationThresholdOptions
): string {
  const warning = options?.warningThreshold ?? UTILIZATION_THRESHOLD_WARNING;
  const danger = options?.dangerThreshold ?? UTILIZATION_THRESHOLD_DANGER;

  if (ratio >= danger) return 'progress-danger';
  if (ratio >= warning) return 'progress-warning';
  return 'progress-success';
}
