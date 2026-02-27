/**
 * ===============================================
 * LOADING UTILITIES
 * ===============================================
 * @file src/utils/loading-utils.ts
 *
 * Reusable loading state utilities for async operations.
 * Provides consistent loading UX across the application.
 */

/**
 * HTML for table loading row with spinner
 * @param colspan Number of columns in the table
 * @param message Optional loading message
 */
export function getTableLoadingRow(colspan: number, message: string = 'Loading...'): string {
  return `
    <tr class="loading-row">
      <td colspan="${colspan}" class="loading-row">
        <div class="loading-state">
          <span class="loading-spinner" aria-hidden="true"></span>
          <span class="loading-message">${message}</span>
        </div>
      </td>
    </tr>
  `;
}

/**
 * HTML for container loading state with spinner
 * @param message Optional loading message
 */
export function getContainerLoadingHTML(message: string = 'Loading...'): string {
  return `
    <div class="loading-container" role="status" aria-live="polite">
      <span class="loading-spinner loading-spinner--large" aria-hidden="true"></span>
      <p class="loading-message">${message}</p>
    </div>
  `;
}

/**
 * HTML for inline loading indicator
 */
export function getInlineLoadingHTML(): string {
  return '<span class="loading-spinner loading-spinner--small" aria-hidden="true"></span>';
}

/**
 * Standard loading state HTML - matches pattern used throughout codebase
 * Use this instead of inline HTML strings for consistency
 * @param message Optional loading message (default: 'Loading...')
 */
export function getLoadingStateHTML(message: string = 'Loading...'): string {
  return `<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">${message}</span></div>`;
}

/** Default loading state HTML constant for simple cases */
export const LOADING_STATE_HTML =
  '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading...</span></div>';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Standard empty state icon (Lucide inbox icon)
 * Used across all empty states for visual consistency
 */
const EMPTY_STATE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-state-icon" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';

/**
 * HTML for table empty row (no data)
 * @param colspan Number of columns in the table
 * @param message Message to display (e.g. "No clients found")
 */
export function getTableEmptyRow(colspan: number, message: string): string {
  return `
    <tr class="empty-row">
      <td colspan="${colspan}" class="empty-row">
        <div class="empty-state">
          ${EMPTY_STATE_ICON}
          <span class="empty-state-message">${escapeHtml(message)}</span>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Show empty state in a table body (e.g. "No clients found")
 */
export function showTableEmpty(tableBody: HTMLElement, colspan: number, message: string): void {
  tableBody.innerHTML = getTableEmptyRow(colspan, message);
}

/**
 * HTML for container empty state (non-table contexts)
 * @param message Message to display
 */
export function getContainerEmptyHTML(message: string): string {
  return `
    <div class="empty-state">
      ${EMPTY_STATE_ICON}
      <span class="empty-state-message">${escapeHtml(message)}</span>
    </div>
  `;
}

/**
 * Show empty state in a container (non-table context)
 * @param container The container element
 * @param message Message to display
 */
export function showContainerEmpty(container: HTMLElement, message: string): void {
  container.innerHTML = getContainerEmptyHTML(message);
}

/**
 * Show loading state in a table body
 * @param tableBody The table body element
 * @param colspan Number of columns
 * @param message Optional loading message
 */
export function showTableLoading(
  tableBody: HTMLElement,
  colspan: number,
  message: string = 'Loading...'
): void {
  tableBody.innerHTML = getTableLoadingRow(colspan, message);
}

/**
 * Show loading state in a container
 * @param container The container element
 * @param message Optional loading message
 */
export function showContainerLoading(container: HTMLElement, message: string = 'Loading...'): void {
  container.innerHTML = getContainerLoadingHTML(message);
}

/**
 * Get skeleton loader HTML for a list
 * @param itemCount Number of skeleton items to show
 */
export function getListSkeletonHTML(itemCount: number = 3): string {
  return Array(itemCount)
    .fill(null)
    .map(
      () => `
      <div class="skeleton-item" aria-hidden="true">
        <div class="skeleton-line skeleton-line--title"></div>
        <div class="skeleton-line skeleton-line--text"></div>
      </div>
    `
    )
    .join('');
}

/**
 * Get skeleton loader HTML for a card grid
 * @param cardCount Number of skeleton cards to show
 */
export function getCardSkeletonHTML(cardCount: number = 4): string {
  return Array(cardCount)
    .fill(null)
    .map(
      () => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-line skeleton-line--title"></div>
        <div class="skeleton-line skeleton-line--text"></div>
        <div class="skeleton-line skeleton-line--text skeleton-line--short"></div>
      </div>
    `
    )
    .join('');
}

/**
 * Get skeleton loader HTML for a chart
 */
export function getChartSkeletonHTML(): string {
  return `
    <div class="skeleton-chart" aria-hidden="true" role="status" aria-label="Loading chart">
      <div class="skeleton-chart-bars">
        <div class="skeleton-bar" style="height: 60%"></div>
        <div class="skeleton-bar" style="height: 80%"></div>
        <div class="skeleton-bar" style="height: 40%"></div>
        <div class="skeleton-bar" style="height: 70%"></div>
        <div class="skeleton-bar" style="height: 50%"></div>
        <div class="skeleton-bar" style="height: 90%"></div>
        <div class="skeleton-bar" style="height: 30%"></div>
      </div>
    </div>
  `;
}

/**
 * Wrap an async function with loading state management
 * @param container The container to show loading in
 * @param loadingHTML The loading HTML to display
 * @param asyncFn The async function to execute
 */
export async function withLoading<T>(
  container: HTMLElement,
  loadingHTML: string,
  asyncFn: () => Promise<T>
): Promise<T> {
  const originalContent = container.innerHTML;
  container.innerHTML = loadingHTML;

  try {
    return await asyncFn();
  } catch (error) {
    container.innerHTML = originalContent;
    throw error;
  }
}
