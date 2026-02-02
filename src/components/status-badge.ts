/**
 * ===============================================
 * STATUS BADGE (REUSABLE)
 * ===============================================
 * @file src/components/status-badge.ts
 *
 * Renders a status/pill badge. Use in admin and client portal so badges
 * use the same markup and classes (shared CSS: portal-badges.css).
 */

export type StatusBadgeVariant =
  | 'active'
  | 'pending'
  | 'in-progress'
  | 'on_hold'
  | 'completed'
  | 'healthy'
  | 'at-risk'
  | 'critical'
  | 'signed'
  | 'not-signed'
  | string;

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Normalize variant for CSS class (e.g. on_hold -> on-hold).
 */
function variantToClass(variant: string): string {
  return variant.replace(/_/g, '-').toLowerCase();
}

/**
 * Create a status badge element. Use shared class .status-badge and
 * .status-{variant} (see shared/portal-badges.css).
 */
export function createStatusBadge(
  label: string,
  variant: StatusBadgeVariant = 'pending'
): HTMLElement {
  const span = document.createElement('span');
  span.className = `status-badge status-${variantToClass(variant)}`;
  span.textContent = label;
  return span;
}

/**
 * Return HTML string for a status badge (for use in innerHTML / template literals).
 */
export function getStatusBadgeHTML(
  label: string,
  variant: StatusBadgeVariant = 'pending'
): string {
  const cls = `status-badge status-${variantToClass(variant)}`;
  return `<span class="${escapeHtml(cls)}">${escapeHtml(label)}</span>`;
}
