/**
 * ===============================================
 * TOAST NOTIFICATION SYSTEM
 * ===============================================
 * @file src/utils/toast-notifications.ts
 *
 * Lightweight toast notifications for success/error/info messages.
 * Replaces excessive success dialogs with non-intrusive toasts.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** Duration in milliseconds (default: 3000) */
  duration?: number;
  /** Whether to show an icon (default: true) */
  showIcon?: boolean;
  /** Optional action link to display in the toast */
  actionLabel?: string;
  actionHref?: string;
}

/**
 * Shows a toast notification
 *
 * @example
 * showToast('Status updated successfully', 'success');
 * showToast('Failed to update', 'error', { duration: 5000 });
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  options: ToastOptions = {}
): void {
  const { duration = 3000, showIcon = true, actionLabel, actionHref } = options;

  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  // Icon SVG
  const iconSvg = showIcon ? getIconSvg(type) : '';

  const actionHtml = actionLabel && actionHref
    ? `<a class="toast-action" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>`
    : '';

  // Toast content
  toast.innerHTML = `
    ${iconSvg ? `<div class="toast-icon">${iconSvg}</div>` : ''}
    <div class="toast-message">${escapeHtml(message)}</div>
    ${actionHtml}
    <button class="toast-close" aria-label="Close notification">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // Add to container
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  // Close handler
  const closeToast = () => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => {
      toast.remove();
      // Remove container if empty
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  };

  // Close button
  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeToast);
  }

  // Auto-close
  if (duration > 0) {
    setTimeout(closeToast, duration);
  }
}

/**
 * Shorthand for success toast
 */
export function showSuccessToast(message: string, options?: ToastOptions): void {
  showToast(message, 'success', options);
}

/**
 * Shorthand for error toast
 */
export function showErrorToast(message: string, options?: ToastOptions): void {
  showToast(message, 'error', { duration: 5000, ...options });
}

/**
 * Shorthand for info toast
 */
export function showInfoToast(message: string, options?: ToastOptions): void {
  showToast(message, 'info', options);
}

/**
 * Shorthand for warning toast
 */
export function showWarningToast(message: string, options?: ToastOptions): void {
  showToast(message, 'warning', { duration: 4000, ...options });
}

/**
 * Get icon SVG based on type
 */
function getIconSvg(type: ToastType): string {
  switch (type) {
  case 'success':
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  case 'error':
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  case 'warning':
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>';
  case 'info':
  default:
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }
}

/**
 * Simple HTML escape to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
