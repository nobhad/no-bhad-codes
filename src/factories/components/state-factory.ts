/**
 * ===============================================
 * STATE FACTORY
 * ===============================================
 * @file src/factories/components/state-factory.ts
 *
 * Factory for creating empty, loading, and error states.
 * Provides consistent UI patterns for data states.
 */

import type { EmptyStateConfig, LoadingStateConfig, ErrorStateConfig } from '../types';

// ============================================
// ERROR ICONS
// ============================================

const ERROR_ICONS = {
  general:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',

  network:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="2" x2="22" y2="22" stroke-width="2"/></svg>',

  permission:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="15" x2="12" y2="17"/></svg>',

  notfound:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>'
};

// ============================================
// EMPTY STATE
// ============================================

/**
 * Render an empty state as HTML string.
 */
export function renderEmptyState(config: EmptyStateConfig): string {
  const { message, className = '', ctaLabel, role = 'status' } = config;

  const classes = ['empty-state', className].filter(Boolean).join(' ');

  let ctaHtml = '';
  if (ctaLabel) {
    ctaHtml = `<button type="button" class="btn btn-secondary empty-state-cta">${escapeHtml(ctaLabel)}</button>`;
  }

  return `<div class="${classes}" role="${role}" aria-live="polite"><p>${escapeHtml(message)}</p>${ctaHtml}</div>`;
}

/**
 * Create an empty state element.
 */
export function createEmptyState(
  message: string,
  options: Omit<EmptyStateConfig, 'message'> = {}
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = ['empty-state', options.className].filter(Boolean).join(' ');
  wrap.setAttribute('role', options.role ?? 'status');
  wrap.setAttribute('aria-live', 'polite');

  const p = document.createElement('p');
  p.textContent = message;
  wrap.appendChild(p);

  if (options.ctaLabel && options.ctaOnClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary empty-state-cta';
    btn.textContent = options.ctaLabel;
    btn.addEventListener('click', options.ctaOnClick);
    wrap.appendChild(btn);
  }

  return wrap;
}

/**
 * Render empty state into a container.
 */
export function renderEmptyStateInto(
  container: HTMLElement,
  message: string,
  options: Omit<EmptyStateConfig, 'message'> = {}
): void {
  container.innerHTML = '';
  container.appendChild(createEmptyState(message, options));
}

// ============================================
// LOADING STATE
// ============================================

/**
 * Render a loading state as HTML string.
 */
export function renderLoadingState(config: LoadingStateConfig = {}): string {
  const {
    message = 'Loading...',
    className = '',
    skeleton = false,
    skeletonCount = 3,
    skeletonType = 'list',
    ariaLabel = message
  } = config;

  const classes = ['loading-state', className];
  if (skeleton) {
    classes.push('loading-state--skeleton');
  }

  if (skeleton) {
    const skeletonItems = Array(skeletonCount)
      .fill(null)
      .map(() => getSkeletonItem(skeletonType))
      .join('');

    return `<div class="${classes.join(' ')}" role="status" aria-live="polite" aria-label="${escapeHtml(ariaLabel)}"><div class="skeleton-container skeleton-${skeletonType}" aria-hidden="true">${skeletonItems}</div><span class="sr-only">${escapeHtml(message)}</span></div>`;
  }

  return `<div class="${classes.join(' ')}" role="status" aria-live="polite" aria-label="${escapeHtml(ariaLabel)}"><span class="loading-spinner" aria-hidden="true"></span><p class="loading-message">${escapeHtml(message)}</p></div>`;
}

/**
 * Get skeleton item HTML for a given type.
 */
function getSkeletonItem(type: 'list' | 'cards' | 'table'): string {
  switch (type) {
  case 'cards':
    return '<div class="skeleton-item"><div class="skeleton-line skeleton-line--title"></div><div class="skeleton-line skeleton-line--text"></div><div class="skeleton-line skeleton-line--text skeleton-line--short"></div></div>';
  case 'table':
    return '<div class="skeleton-item"><div class="skeleton-line skeleton-line--full"></div></div>';
  default:
    return '<div class="skeleton-item"><div class="skeleton-line skeleton-line--title"></div><div class="skeleton-line skeleton-line--text"></div></div>';
  }
}

/**
 * Create a loading state element.
 */
export function createLoadingState(
  message: string = 'Loading...',
  options: Omit<LoadingStateConfig, 'message'> = {}
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
    wrap.classList.add('loading-state--skeleton');
    const skeletonContainer = document.createElement('div');
    skeletonContainer.className = `skeleton-container skeleton-${skeletonType}`;
    skeletonContainer.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < skeletonCount; i++) {
      const item = document.createElement('div');
      item.className = 'skeleton-item';
      item.innerHTML =
        getSkeletonItem(skeletonType).match(/<div class="skeleton-item">([\s\S]*?)<\/div>/)?.[1] ??
        '';
      skeletonContainer.appendChild(item);
    }

    wrap.appendChild(skeletonContainer);

    const srMessage = document.createElement('span');
    srMessage.className = 'sr-only';
    srMessage.textContent = message;
    wrap.appendChild(srMessage);
  } else {
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
 * Render loading state into a container.
 */
export function renderLoadingStateInto(
  container: HTMLElement,
  message: string = 'Loading...',
  options: Omit<LoadingStateConfig, 'message'> = {}
): void {
  container.innerHTML = '';
  container.appendChild(createLoadingState(message, options));
}

// ============================================
// ERROR STATE
// ============================================

/**
 * Render an error state as HTML string.
 */
export function renderErrorState(config: ErrorStateConfig): string {
  const {
    message,
    className = '',
    retryLabel = 'Try Again',
    type = 'general',
    secondaryLabel
  } = config;

  const classes = ['error-state', `error-state--${type}`, className].filter(Boolean).join(' ');

  const iconSvg = ERROR_ICONS[type] ?? ERROR_ICONS.general;

  let actionsHtml = '';
  if (config.onRetry || config.onSecondary) {
    let buttonsHtml = '';
    if (config.onRetry) {
      buttonsHtml += `<button type="button" class="btn btn-primary error-state-retry">${escapeHtml(retryLabel)}</button>`;
    }
    if (secondaryLabel && config.onSecondary) {
      buttonsHtml += `<button type="button" class="btn btn-secondary error-state-secondary">${escapeHtml(secondaryLabel)}</button>`;
    }
    actionsHtml = `<div class="error-state-actions">${buttonsHtml}</div>`;
  }

  return `<div class="${classes}" role="alert"><div class="error-state-icon" aria-hidden="true">${iconSvg}</div><p class="error-state-message">${escapeHtml(message)}</p>${actionsHtml}</div>`;
}

/**
 * Create an error state element.
 */
export function createErrorState(
  message: string,
  options: Omit<ErrorStateConfig, 'message'> = {}
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

  // Error icon
  const iconContainer = document.createElement('div');
  iconContainer.className = 'error-state-icon';
  iconContainer.setAttribute('aria-hidden', 'true');
  iconContainer.innerHTML = ERROR_ICONS[type] ?? ERROR_ICONS.general;
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
 * Render error state into a container.
 */
export function renderErrorStateInto(
  container: HTMLElement,
  message: string,
  options: Omit<ErrorStateConfig, 'message'> = {}
): void {
  container.innerHTML = '';
  container.appendChild(createErrorState(message, options));
}

// ============================================
// SKELETON LOADERS
// ============================================

/**
 * Render a skeleton loader.
 */
export function renderSkeleton(
  type: 'list' | 'cards' | 'table' = 'list',
  count: number = 3
): string {
  return renderLoadingState({
    skeleton: true,
    skeletonType: type,
    skeletonCount: count
  });
}

/**
 * Create a skeleton loader element.
 */
export function createSkeleton(
  type: 'list' | 'cards' | 'table' = 'list',
  count: number = 3
): HTMLElement {
  return createLoadingState('Loading...', {
    skeleton: true,
    skeletonType: type,
    skeletonCount: count
  });
}

// ============================================
// UTILITY
// ============================================

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
