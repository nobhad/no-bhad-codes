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

export interface LoadingStateOptions {
  /** Optional class in addition to .loading-state */
  className?: string;
  /** Use skeleton loader instead of spinner */
  skeleton?: boolean;
  /** Number of skeleton items (default: 3) */
  skeletonCount?: number;
  /** Skeleton type: 'list', 'cards', 'table' */
  skeletonType?: 'list' | 'cards' | 'table';
  /** Optional aria-label for the loading indicator */
  ariaLabel?: string;
}

export interface ErrorStateOptions {
  /** Optional class in addition to .error-state */
  className?: string;
  /** Retry button label (default: "Try Again") */
  retryLabel?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Optional secondary action label */
  secondaryLabel?: string;
  /** Optional secondary action callback */
  onSecondary?: () => void;
  /** Error type for styling (default: 'general') */
  type?: 'general' | 'network' | 'permission' | 'notfound';
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

/**
 * Create a loading state element with spinner or skeleton loader.
 * Apply shared styles via class .loading-state.
 */
export function createLoadingState(
  message: string = 'Loading...',
  options: LoadingStateOptions = {}
): HTMLElement {
  const {
    className = '',
    skeleton = false,
    skeletonCount = 3,
    skeletonType = 'list',
    ariaLabel = message
  } = options;

  const wrap = document.createElement('div');
  wrap.className = ['loading-state', className].filter(Boolean).join(' ');
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-live', 'polite');
  wrap.setAttribute('aria-label', ariaLabel);

  if (skeleton) {
    // Skeleton loader
    wrap.classList.add('loading-state--skeleton');
    const skeletonContainer = document.createElement('div');
    skeletonContainer.className = `skeleton-container skeleton-${skeletonType}`;
    skeletonContainer.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < skeletonCount; i++) {
      const item = document.createElement('div');
      item.className = 'skeleton-item';

      if (skeletonType === 'cards') {
        item.innerHTML = `
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--text"></div>
          <div class="skeleton-line skeleton-line--text skeleton-line--short"></div>
        `;
      } else if (skeletonType === 'table') {
        item.innerHTML = `
          <div class="skeleton-line skeleton-line--full"></div>
        `;
      } else {
        // list
        item.innerHTML = `
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--text"></div>
        `;
      }

      skeletonContainer.appendChild(item);
    }

    wrap.appendChild(skeletonContainer);

    // Screen reader only message
    const srMessage = document.createElement('span');
    srMessage.className = 'sr-only';
    srMessage.textContent = message;
    wrap.appendChild(srMessage);
  } else {
    // Spinner
    const spinner = document.createElement('span');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    wrap.appendChild(spinner);

    const messageEl = document.createElement('p');
    messageEl.className = 'loading-message';
    messageEl.textContent = message;
    wrap.appendChild(messageEl);
  }

  return wrap;
}

/**
 * Render loading state into a container (replaces content).
 */
export function renderLoadingState(
  container: HTMLElement,
  message: string = 'Loading...',
  options: LoadingStateOptions = {}
): void {
  container.innerHTML = '';
  container.appendChild(createLoadingState(message, options));
}

/**
 * Create an error state element with optional retry button.
 */
export function createErrorState(
  message: string,
  options: ErrorStateOptions = {}
): HTMLElement {
  const {
    className = '',
    retryLabel = 'Try Again',
    onRetry,
    secondaryLabel,
    onSecondary,
    type = 'general'
  } = options;

  const wrap = document.createElement('div');
  wrap.className = ['error-state', `error-state--${type}`, className].filter(Boolean).join(' ');
  wrap.setAttribute('role', 'alert');

  // Error icon based on type
  const iconContainer = document.createElement('div');
  iconContainer.className = 'error-state-icon';
  iconContainer.setAttribute('aria-hidden', 'true');

  const iconSvg = getErrorIcon(type);
  iconContainer.innerHTML = iconSvg;
  wrap.appendChild(iconContainer);

  // Error message
  const messageEl = document.createElement('p');
  messageEl.className = 'error-state-message';
  messageEl.textContent = message;
  wrap.appendChild(messageEl);

  // Action buttons
  if (onRetry || onSecondary) {
    const actions = document.createElement('div');
    actions.className = 'error-state-actions';

    if (onRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn btn-primary error-state-retry';
      retryBtn.textContent = retryLabel;
      retryBtn.addEventListener('click', onRetry);
      actions.appendChild(retryBtn);
    }

    if (secondaryLabel && onSecondary) {
      const secondaryBtn = document.createElement('button');
      secondaryBtn.type = 'button';
      secondaryBtn.className = 'btn btn-secondary error-state-secondary';
      secondaryBtn.textContent = secondaryLabel;
      secondaryBtn.addEventListener('click', onSecondary);
      actions.appendChild(secondaryBtn);
    }

    wrap.appendChild(actions);
  }

  return wrap;
}

/**
 * Render error state into a container (replaces content).
 */
export function renderErrorState(
  container: HTMLElement,
  message: string,
  options: ErrorStateOptions = {}
): void {
  container.innerHTML = '';
  container.appendChild(createErrorState(message, options));
}

/**
 * Get appropriate error icon SVG based on error type.
 */
function getErrorIcon(type: 'general' | 'network' | 'permission' | 'notfound'): string {
  switch (type) {
  case 'network':
    return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        <circle cx="12" cy="12" r="3"/>
        <line x1="2" y1="2" x2="22" y2="22" stroke-width="2"/>
      </svg>`;
  case 'permission':
    return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        <line x1="12" y1="15" x2="12" y2="17"/>
      </svg>`;
  case 'notfound':
    return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="8" y1="11" x2="14" y2="11"/>
      </svg>`;
  default:
    // General error - alert triangle
    return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>`;
  }
}
