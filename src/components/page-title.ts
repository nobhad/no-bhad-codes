/**
 * ===============================================
 * PAGE TITLE (REUSABLE)
 * ===============================================
 * @file src/components/page-title.ts
 *
 * Renders .page-title block (h2 + optional status badge). Use in admin and
 * client portal for per-tab titles so markup is shared.
 */

import { createStatusBadge } from './status-badge';
import type { StatusBadgeVariant } from './status-badge';

export interface PageTitleConfig {
  /** Title text */
  title: string;
  /** Optional h2 id */
  id?: string;
  /** Optional badge text (e.g. status); renders right-aligned */
  badge?: string;
  /** Badge variant for status styling */
  badgeVariant?: StatusBadgeVariant;
}

/**
 * Create .page-title DOM (h2 and optional badge). For title + badge use
 * class .page-title.page-title-with-badge and shared CSS (e.g. project-detail.css).
 */
export function createPageTitle(config: PageTitleConfig): HTMLElement {
  const { title, id, badge, badgeVariant = 'pending' } = config;

  const wrap = document.createElement('div');
  wrap.className = badge ? 'page-title page-title-with-badge' : 'page-title';

  const h2 = document.createElement('h2');
  h2.textContent = title;
  if (id) h2.id = id;
  wrap.appendChild(h2);

  if (badge) {
    wrap.appendChild(createStatusBadge(badge, badgeVariant));
  }

  return wrap;
}
