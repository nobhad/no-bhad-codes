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
    <tr>
      <td colspan="${colspan}" class="loading-row loading-state">
        <span class="loading-spinner" aria-hidden="true"></span>
        <span>${message}</span>
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
export function showContainerLoading(
  container: HTMLElement,
  message: string = 'Loading...'
): void {
  container.innerHTML = getContainerLoadingHTML(message);
}

/**
 * Get skeleton loader HTML for a list
 * @param itemCount Number of skeleton items to show
 */
export function getListSkeletonHTML(itemCount: number = 3): string {
  return Array(itemCount)
    .fill(null)
    .map(() => `
      <div class="skeleton-item" aria-hidden="true">
        <div class="skeleton-line skeleton-line--title"></div>
        <div class="skeleton-line skeleton-line--text"></div>
      </div>
    `)
    .join('');
}

/**
 * Get skeleton loader HTML for a card grid
 * @param cardCount Number of skeleton cards to show
 */
export function getCardSkeletonHTML(cardCount: number = 4): string {
  return Array(cardCount)
    .fill(null)
    .map(() => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-line skeleton-line--title"></div>
        <div class="skeleton-line skeleton-line--text"></div>
        <div class="skeleton-line skeleton-line--text skeleton-line--short"></div>
      </div>
    `)
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
