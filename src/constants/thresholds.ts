/**
 * ===============================================
 * THRESHOLD CONSTANTS
 * ===============================================
 * @file src/constants/thresholds.ts
 *
 * Centralized threshold values for health scores,
 * success rates, and other scoring systems.
 * Use these instead of magic numbers in conditional logic.
 */

/**
 * Health score thresholds for client health classification
 * Score >= HEALTHY → "Healthy"
 * Score >= AT_RISK → "At Risk"
 * Score < AT_RISK → "Critical"
 */
export const HEALTH_SCORE = {
  HEALTHY: 70,
  AT_RISK: 40
} as const;

/**
 * Success rate thresholds for workflow performance
 * Rate >= EXCELLENT → text-success
 * Rate >= ACCEPTABLE → text-warning
 * Rate < ACCEPTABLE → text-danger
 */
export const SUCCESS_RATE = {
  EXCELLENT: 90,
  ACCEPTABLE: 70
} as const;

/**
 * Time constants in milliseconds
 * Use these for date math instead of raw numbers.
 * NOTE: For timer/interval constants, see src/utils/time-utils.ts
 */
export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
} as const;

/**
 * Currency formatting thresholds for compact display
 * Used in formatCurrencyCompact to decide K vs M notation
 */
export const CURRENCY_COMPACT = {
  MILLION: 1_000_000,
  THOUSAND: 1_000
} as const;
