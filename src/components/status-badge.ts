/**
 * ===============================================
 * STATUS BADGE (REUSABLE)
 * ===============================================
 * @file src/components/status-badge.ts
 *
 * Renders a status/pill badge. Use in admin and client portal so badges
 * use the same markup and classes (shared CSS: portal-badges.css).
 *
 * NOTE: This module now uses the factory system internally.
 * For new code, consider importing directly from @/factories.
 */

import {
  getStatusBadgeHTML as factoryGetStatusBadgeHTML,
  getStatusDotHTML as factoryGetStatusDotHTML,
  createStatusBadge as factoryCreateStatusBadge,
  createStatusDot as factoryCreateStatusDot,
  normalizeStatus,
  formatStatusLabel
} from '../factories';
import type { BadgeVariant } from '../factories/types';

// Re-export the variant type for backwards compatibility
export type StatusBadgeVariant = BadgeVariant;

/**
 * Create a status badge element. Use shared class .status-badge and
 * .status-{variant} (see shared/portal-badges.css).
 */
export function createStatusBadge(
  label: string,
  variant: StatusBadgeVariant = 'pending'
): HTMLElement {
  return factoryCreateStatusBadge(label, variant);
}

/**
 * Return HTML string for a status badge (for use in innerHTML / template literals).
 */
export function getStatusBadgeHTML(
  label: string,
  variant: StatusBadgeVariant = 'pending'
): string {
  return factoryGetStatusBadgeHTML(label, variant);
}

/**
 * Return HTML string for a status indicator with colored dot (minimal style).
 * Use this instead of badges for cleaner table displays.
 * @param status - Status value (used for CSS class and default label)
 * @param options.label - Custom label text (optional, overrides auto-formatted label)
 * @param options.uppercase - Display label in uppercase
 */
export function getStatusDotHTML(
  status: string,
  options?: { label?: string; uppercase?: boolean }
): string {
  return factoryGetStatusDotHTML(status, options);
}

/**
 * Create a status indicator element with colored dot.
 */
export function createStatusDot(
  status: string,
  options?: { label?: string; uppercase?: boolean }
): HTMLElement {
  return factoryCreateStatusDot(status, options);
}

// Re-export utility functions
export { normalizeStatus, formatStatusLabel };
