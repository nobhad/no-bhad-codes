/**
 * ===============================================
 * BADGE FACTORY
 * ===============================================
 * @file src/factories/components/badge-factory.ts
 *
 * Factory for creating status badges and indicators.
 * Provides consistent styling across the application.
 */

import type { BadgeConfig, DotConfig, BadgeVariant } from '../types';

// ============================================
// BADGE VARIANTS
// ============================================

/**
 * Standard badge variant definitions.
 * Maps status values to CSS class modifiers and default labels.
 */
export const BADGE_VARIANTS: Record<string, { cssClass: string; defaultLabel: string }> = {
  // Active/Live states
  active: { cssClass: 'active', defaultLabel: 'Active' },
  live: { cssClass: 'active', defaultLabel: 'Live' },
  enabled: { cssClass: 'active', defaultLabel: 'Enabled' },

  // Pending/Waiting states
  pending: { cssClass: 'pending', defaultLabel: 'Pending' },
  awaiting: { cssClass: 'pending', defaultLabel: 'Awaiting' },
  draft: { cssClass: 'pending', defaultLabel: 'Draft' },
  'awaiting-review': { cssClass: 'pending', defaultLabel: 'Awaiting Review' },

  // In Progress states
  'in-progress': { cssClass: 'in-progress', defaultLabel: 'In Progress' },
  'in_progress': { cssClass: 'in-progress', defaultLabel: 'In Progress' },
  processing: { cssClass: 'in-progress', defaultLabel: 'Processing' },
  working: { cssClass: 'in-progress', defaultLabel: 'Working' },

  // On Hold states
  'on-hold': { cssClass: 'on-hold', defaultLabel: 'On Hold' },
  'on_hold': { cssClass: 'on-hold', defaultLabel: 'On Hold' },
  paused: { cssClass: 'on-hold', defaultLabel: 'Paused' },

  // Completed/Success states
  completed: { cssClass: 'completed', defaultLabel: 'Completed' },
  done: { cssClass: 'completed', defaultLabel: 'Done' },
  finished: { cssClass: 'completed', defaultLabel: 'Finished' },
  approved: { cssClass: 'completed', defaultLabel: 'Approved' },
  accepted: { cssClass: 'completed', defaultLabel: 'Accepted' },

  // Health/Status indicators
  healthy: { cssClass: 'healthy', defaultLabel: 'Healthy' },
  good: { cssClass: 'healthy', defaultLabel: 'Good' },
  'at-risk': { cssClass: 'at-risk', defaultLabel: 'At Risk' },
  warning: { cssClass: 'at-risk', defaultLabel: 'Warning' },
  critical: { cssClass: 'critical', defaultLabel: 'Critical' },
  error: { cssClass: 'critical', defaultLabel: 'Error' },
  failed: { cssClass: 'critical', defaultLabel: 'Failed' },

  // Contract/Signature states
  signed: { cssClass: 'signed', defaultLabel: 'Signed' },
  'not-signed': { cssClass: 'not-signed', defaultLabel: 'Not Signed' },
  unsigned: { cssClass: 'not-signed', defaultLabel: 'Unsigned' },

  // Invoice/Payment states
  sent: { cssClass: 'sent', defaultLabel: 'Sent' },
  paid: { cssClass: 'paid', defaultLabel: 'Paid' },
  overdue: { cssClass: 'overdue', defaultLabel: 'Overdue' },
  unpaid: { cssClass: 'overdue', defaultLabel: 'Unpaid' },

  // Visibility states
  visible: { cssClass: 'active', defaultLabel: 'Visible' },
  hidden: { cssClass: 'pending', defaultLabel: 'Hidden' },
  disabled: { cssClass: 'pending', defaultLabel: 'Disabled' },

  // Archive states
  archived: { cssClass: 'archived', defaultLabel: 'Archived' },
  deleted: { cssClass: 'critical', defaultLabel: 'Deleted' }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Normalize status string for CSS class.
 */
function normalizeStatus(status: string): string {
  return status.replace(/_/g, '-').toLowerCase();
}

/**
 * Format status text for display.
 */
function formatStatusLabel(status: string): string {
  return status
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get the CSS class for a status.
 */
function getStatusClass(status: string): string {
  const normalized = normalizeStatus(status);
  const variant = BADGE_VARIANTS[normalized];
  return variant?.cssClass ?? normalized;
}

/**
 * Get the default label for a status.
 */
function getDefaultLabel(status: string): string {
  const normalized = normalizeStatus(status);
  const variant = BADGE_VARIANTS[normalized];
  return variant?.defaultLabel ?? formatStatusLabel(status);
}

// ============================================
// BADGE RENDERING
// ============================================

/**
 * Render a status badge as HTML string.
 */
export function renderBadge(config: BadgeConfig): string {
  const { status, label, uppercase = false, className = '' } = config;

  const cssClass = getStatusClass(status);
  let displayLabel = label ?? getDefaultLabel(status);

  if (uppercase) {
    displayLabel = displayLabel.toUpperCase();
  }

  const classes = ['status-badge', `status-${cssClass}`, className]
    .filter(Boolean)
    .join(' ');

  return `<span class="${escapeHtml(classes)}">${escapeHtml(displayLabel)}</span>`;
}

/**
 * Render a status indicator with dot.
 */
export function renderDot(config: DotConfig): string {
  const { status, label, uppercase = false, className = '' } = config;

  const cssClass = getStatusClass(status);
  let displayLabel = label ?? getDefaultLabel(status);

  if (uppercase) {
    displayLabel = displayLabel.toUpperCase();
  }

  const classes = ['status-indicator', `status-${cssClass}`, className]
    .filter(Boolean)
    .join(' ');

  return `<span class="${escapeHtml(classes)}"><span class="status-dot"></span><span class="status-text">${escapeHtml(displayLabel)}</span></span>`;
}

/**
 * Get badge HTML (alias for renderBadge).
 */
export function getStatusBadgeHTML(
  label: string,
  variant: BadgeVariant = 'pending'
): string {
  return renderBadge({ status: variant, label });
}

/**
 * Get dot indicator HTML (alias for renderDot).
 */
export function getStatusDotHTML(
  status: string,
  options?: { label?: string; uppercase?: boolean }
): string {
  return renderDot({
    status,
    label: options?.label,
    uppercase: options?.uppercase
  });
}

// ============================================
// DOM CREATION
// ============================================

/**
 * Create a badge element.
 */
export function createBadge(config: BadgeConfig): HTMLSpanElement {
  const html = renderBadge(config);
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild as HTMLSpanElement;
}

/**
 * Create a status badge element (alias for createBadge).
 */
export function createStatusBadge(
  label: string,
  variant: BadgeVariant = 'pending'
): HTMLElement {
  return createBadge({ status: variant, label });
}

/**
 * Create a dot indicator element.
 */
export function createDot(config: DotConfig): HTMLSpanElement {
  const html = renderDot(config);
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild as HTMLSpanElement;
}

/**
 * Create a status dot element (alias for createDot).
 */
export function createStatusDot(
  status: string,
  options?: { label?: string; uppercase?: boolean }
): HTMLElement {
  return createDot({
    status,
    label: options?.label,
    uppercase: options?.uppercase
  });
}

// ============================================
// UTILITY EXPORTS
// ============================================

export {
  normalizeStatus,
  formatStatusLabel,
  getStatusClass,
  getDefaultLabel
};
