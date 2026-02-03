/**
 * ===============================================
 * EMPTY STATE (REUSABLE)
 * ===============================================
 * @file src/components/empty-state.ts
 *
 * Renders "no data" / "loading" / empty list message. Use in admin and client
 * portal so empty states look and behave the same.
 */

export interface EmptyStateOptions {
  /** Optional class in addition to .empty-state */
  className?: string;
  /** Optional CTA label (renders a button) */
  ctaLabel?: string;
  /** Optional CTA callback (use with ctaLabel) */
  ctaOnClick?: () => void;
  /** Optional role (default "status" for live region) */
  role?: string;
}

/**
 * Create an empty-state element (e.g. "No files yet", "Loading...").
 * Apply shared styles via class .empty-state (see portal/project-detail CSS).
 */
export function createEmptyState(
  message: string,
  options: EmptyStateOptions = {}
): HTMLElement {
  const { className = '', ctaLabel, ctaOnClick, role = 'status' } = options;

  const wrap = document.createElement('div');
  wrap.className = ['empty-state', className].filter(Boolean).join(' ');
  wrap.setAttribute('role', role);
  wrap.setAttribute('aria-live', 'polite');

  const p = document.createElement('p');
  p.textContent = message;
  wrap.appendChild(p);

  if (ctaLabel && ctaOnClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary empty-state-cta';
    btn.textContent = ctaLabel;
    btn.addEventListener('click', ctaOnClick);
    wrap.appendChild(btn);
  }

  return wrap;
}

/**
 * Render empty state into a container (replaces content).
 */
export function renderEmptyState(
  container: HTMLElement,
  message: string,
  options: EmptyStateOptions = {}
): void {
  container.innerHTML = '';
  container.appendChild(createEmptyState(message, options));
}
