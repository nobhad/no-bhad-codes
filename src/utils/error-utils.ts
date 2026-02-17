/**
 * ===============================================
 * ERROR UTILITIES
 * ===============================================
 * @file src/utils/error-utils.ts
 *
 * Reusable error state utilities for consistent error handling.
 * Provides error UI components with retry mechanisms.
 */

import { SanitizationUtils } from './sanitization-utils';

/**
 * Options for error state display
 */
export interface ErrorStateOptions {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  showIcon?: boolean;
}

/**
 * HTML for table error row with optional retry button
 * @param colspan Number of columns in the table
 * @param options Error state options
 */
export function getTableErrorRow(colspan: number, options: ErrorStateOptions): string {
  const { message, onRetry, retryLabel = 'Try Again', showIcon = true } = options;
  const safeMessage = SanitizationUtils.escapeHtml(message);
  const safeRetryLabel = SanitizationUtils.escapeHtml(retryLabel);
  const iconHtml = showIcon
    ? '<span class="error-icon" aria-hidden="true">⚠</span>'
    : '';
  const retryHtml = onRetry
    ? `<button class="btn btn-sm btn-retry" type="button">${safeRetryLabel}</button>`
    : '';

  return `
    <tr>
      <td colspan="${colspan}" class="error-row">
        <div class="error-state">
          ${iconHtml}
          <span class="error-message">${safeMessage}</span>
          ${retryHtml}
        </div>
      </td>
    </tr>
  `;
}

/**
 * HTML for container error state with optional retry button
 * @param options Error state options
 */
export function getContainerErrorHTML(options: ErrorStateOptions): string {
  const { message, onRetry, retryLabel = 'Try Again', showIcon = true } = options;
  const safeMessage = SanitizationUtils.escapeHtml(message);
  const safeRetryLabel = SanitizationUtils.escapeHtml(retryLabel);
  const iconHtml = showIcon
    ? '<span class="error-icon error-icon--large" aria-hidden="true">⚠</span>'
    : '';
  const retryHtml = onRetry
    ? `<button class="btn btn-sm btn-retry" type="button">${safeRetryLabel}</button>`
    : '';

  return `
    <div class="error-container" role="alert">
      ${iconHtml}
      <p class="error-message">${safeMessage}</p>
      ${retryHtml}
    </div>
  `;
}

/**
 * HTML for inline error message
 * @param message Error message
 */
export function getInlineErrorHTML(message: string): string {
  const safeMessage = SanitizationUtils.escapeHtml(message);
  return `<span class="error-inline" role="alert">${safeMessage}</span>`;
}

/**
 * Show error state in a table body with optional retry
 * @param tableBody The table body element
 * @param colspan Number of columns
 * @param message Error message
 * @param onRetry Optional retry callback
 */
export function showTableError(
  tableBody: HTMLElement,
  colspan: number,
  message: string,
  onRetry?: () => void
): void {
  tableBody.innerHTML = getTableErrorRow(colspan, { message, onRetry });

  if (onRetry) {
    const retryBtn = tableBody.querySelector('.btn-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', onRetry);
    }
  }
}

/**
 * Show error state in a container with optional retry
 * @param container The container element
 * @param message Error message
 * @param onRetry Optional retry callback
 */
export function showContainerError(
  container: HTMLElement,
  message: string,
  onRetry?: () => void
): void {
  container.innerHTML = getContainerErrorHTML({ message, onRetry });

  if (onRetry) {
    const retryBtn = container.querySelector('.btn-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', onRetry);
    }
  }
}

/**
 * Create an error notification element (toast-style)
 * @param message Error message
 * @param duration Duration in ms before auto-hide (0 = no auto-hide)
 */
export function createErrorNotification(message: string, duration: number = 5000): HTMLElement {
  const safeMessage = SanitizationUtils.escapeHtml(message);
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  notification.setAttribute('role', 'alert');
  notification.innerHTML = `
    <span class="error-icon" aria-hidden="true">⚠</span>
    <span class="error-message">${safeMessage}</span>
    <button class="error-dismiss" type="button" aria-label="Dismiss">×</button>
  `;

  const dismissBtn = notification.querySelector('.error-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => notification.remove());
  }

  if (duration > 0) {
    setTimeout(() => notification.remove(), duration);
  }

  return notification;
}

/**
 * Format API error message for display
 * @param error The error object or message
 * @param fallback Fallback message if error can't be parsed
 */
export function formatErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (typeof errorObj.error === 'string') {
      return errorObj.error;
    }
  }

  return fallback;
}
