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

/**
 * Format status text for display (capitalize, handle underscores/hyphens).
 */
function formatStatusLabel(status: string): string {
  return status
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
  const variant = variantToClass(status);
  let label = options?.label ?? formatStatusLabel(status);
  if (options?.uppercase) {
    label = label.toUpperCase();
  }
  return `<span class="status-indicator status-${escapeHtml(variant)}"><span class="status-dot"></span><span class="status-text">${escapeHtml(label)}</span></span>`;
}

/**
 * Create a status indicator element with colored dot.
 */
export function createStatusDot(
  status: string,
  options?: { label?: string; uppercase?: boolean }
): HTMLElement {
  const span = document.createElement('span');
  span.className = `status-indicator status-${variantToClass(status)}`;

  const dot = document.createElement('span');
  dot.className = 'status-dot';

  const text = document.createElement('span');
  text.className = 'status-text';
  let label = options?.label ?? formatStatusLabel(status);
  if (options?.uppercase) {
    label = label.toUpperCase();
  }
  text.textContent = label;

  span.appendChild(dot);
  span.appendChild(text);
  return span;
}
