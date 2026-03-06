/**
 * ===============================================
 * ADMIN UI HELPERS
 * ===============================================
 * @file src/features/admin/admin-ui-helpers.ts
 *
 * Miscellaneous UI helper functions for the admin dashboard:
 * - Auth gate setup
 * - Truncated text tooltips
 * - Visitor stats loading
 * - System info loading
 * - Table filtering & attention filters
 */

import type { AnalyticsEvent } from './admin-types';
import { apiPost } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';
import { formatDate } from '../../utils/format-utils';
import type { createDOMCache } from '../../utils/dom-cache';

const logger = createLogger('AdminUIHelpers');

type DOMCacheInstance = ReturnType<typeof createDOMCache>;

/**
 * Set up the auth gate login form.
 */
export function setupAuthGate(domCache: DOMCacheInstance): void {
  const authGate = domCache.get('authGate');
  const dashboard = domCache.get('adminDashboard');
  const loginForm = domCache.get('adminLoginForm');
  const passwordInput = domCache.getAs<HTMLInputElement>('adminPassword');
  const passwordToggle = domCache.get('passwordToggle');
  const authError = domCache.get('authError');
  const passwordPromptKey = 'nbw_password_prompted';

  if (authGate) authGate.style.display = 'flex';
  if (dashboard) dashboard.style.display = 'none';

  if (loginForm && sessionStorage.getItem(passwordPromptKey) === '1') {
    loginForm.setAttribute('autocomplete', 'off');
    passwordInput?.setAttribute('autocomplete', 'off');
  }

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (authError) authError.textContent = '';

      if (sessionStorage.getItem(passwordPromptKey) !== '1') {
        sessionStorage.setItem(passwordPromptKey, '1');
        loginForm.setAttribute('autocomplete', 'off');
        passwordInput?.setAttribute('autocomplete', 'off');
      }

      const password = passwordInput?.value;
      if (!password) return;

      const submitBtn = loginForm.querySelector('.auth-submit') as HTMLButtonElement;
      const btnText = submitBtn?.querySelector('.btn-text') as HTMLElement;
      const btnLoading = submitBtn?.querySelector('.btn-loading') as HTMLElement;

      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnLoading) btnLoading.style.display = 'inline';

      try {
        const response = await apiPost('/api/auth/admin/login', { password });
        if (response.ok) {
          window.location.reload();
        } else {
          const data = await response.json();
          if (authError) authError.textContent = data.error || 'Invalid password';
        }
      } catch (error) {
        logger.error(' Login error:', error);
        if (authError) authError.textContent = 'Connection error. Please try again.';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnLoading) btnLoading.style.display = 'none';
      }
    });
  }
}

/**
 * Set up fast custom tooltips for truncated text elements.
 */
export function setupTruncatedTextTooltips(): void {
  const addTooltipIfTruncated = (element: HTMLElement): void => {
    const text = element.textContent?.trim();
    if (!text || text === '-') return;
    if (element.scrollWidth > element.clientWidth || text.length > 30) {
      element.setAttribute('data-tooltip', text);
      element.removeAttribute('title');
    }
  };

  const truncatedElements = document.querySelectorAll(
    '.truncate-text, .message-cell, [class*="ellipsis"]'
  );
  truncatedElements.forEach((el) => addTooltipIfTruncated(el as HTMLElement));

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const truncated = node.querySelectorAll(
            '.truncate-text, .message-cell, [class*="ellipsis"]'
          );
          truncated.forEach((el) => {
            if (!el.hasAttribute('data-tooltip')) {
              addTooltipIfTruncated(el as HTMLElement);
            }
          });
          if (
            node.classList?.contains('truncate-text') ||
            node.classList?.contains('message-cell')
          ) {
            if (!node.hasAttribute('data-tooltip')) {
              addTooltipIfTruncated(node);
            }
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Load system information into DOM elements.
 */
export function loadSystemInfo(domCache: DOMCacheInstance): void {
  const sysVersion = domCache.get('sysVersion');
  const sysEnv = domCache.get('sysEnvironment');
  const sysBuildDate = domCache.get('sysBuildDate');
  const sysUserAgent = domCache.get('sysUseragent');
  const sysScreen = domCache.get('sysScreen');
  const sysViewport = domCache.get('sysViewport');

  if (sysVersion) sysVersion.textContent = '10.0.0';
  if (sysEnv) sysEnv.textContent = import.meta.env?.MODE || 'development';
  if (sysBuildDate) sysBuildDate.textContent = formatDate(new Date());
  if (sysUserAgent) {
    sysUserAgent.textContent = navigator.userAgent;
    sysUserAgent.title = navigator.userAgent;
  }
  if (sysScreen) sysScreen.textContent = `${screen.width} x ${screen.height}`;
  if (sysViewport) sysViewport.textContent = `${window.innerWidth} x ${window.innerHeight}`;

  loadVisitorStats(domCache);
}

/**
 * Load visitor tracking stats from sessionStorage.
 */
export function loadVisitorStats(domCache: DOMCacheInstance): void {
  try {
    const eventsJson = sessionStorage.getItem('nbw_tracking_events');
    const events: AnalyticsEvent[] = eventsJson ? JSON.parse(eventsJson) : [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const todayEvents = events.filter((e) => e.timestamp >= todayStart);
    const todaySessions = new Set(todayEvents.map((e) => e.sessionId));
    const visitorsToday = todaySessions.size;

    const pageViews = events.filter((e) => 'title' in e);
    const totalPageViews = pageViews.length;

    const allSessions = new Set(events.map((e) => e.sessionId));
    const totalVisitors = allSessions.size;

    const statVisitors = domCache.get('statVisitors');
    if (statVisitors) statVisitors.textContent = visitorsToday.toString();

    const analyticsVisitors = domCache.get('analyticsVisitors');
    const analyticsPageviews = domCache.get('analyticsPageviews');
    const analyticsSessions = domCache.get('analyticsSessions');

    if (analyticsVisitors) analyticsVisitors.textContent = totalVisitors.toString();
    if (analyticsPageviews) analyticsPageviews.textContent = totalPageViews.toString();
    if (analyticsSessions) {
      const sessionsWithTime = pageViews.filter((pv) => pv.timeOnPage);
      if (sessionsWithTime.length > 0) {
        const totalTime = sessionsWithTime.reduce(
          (sum: number, pv) => sum + (pv.timeOnPage || 0),
          0
        );
        const avgTimeMs = totalTime / sessionsWithTime.length;
        const avgSeconds = Math.round(avgTimeMs / 1000);
        const minutes = Math.floor(avgSeconds / 60);
        const seconds = avgSeconds % 60;
        analyticsSessions.textContent = `${minutes}m ${seconds}s`;
      } else {
        analyticsSessions.textContent = '-';
      }
    }

    logger.log('Visitor stats loaded:', { visitorsToday, totalVisitors, totalPageViews });
  } catch (error) {
    logger.error(' Failed to load visitor stats:', error);

    const statVisitors = domCache.get('statVisitors');
    const analyticsVisitors = domCache.get('analyticsVisitors');
    const analyticsPageviews = domCache.get('analyticsPageviews');
    const analyticsSessions = domCache.get('analyticsSessions');

    if (statVisitors) statVisitors.textContent = '0';
    if (analyticsVisitors) analyticsVisitors.textContent = '0';
    if (analyticsPageviews) analyticsPageviews.textContent = '0';
    if (analyticsSessions) analyticsSessions.textContent = '-';
  }
}

/**
 * Apply special filters from attention cards.
 */
export function applyAttentionFilter(
  tabName: string,
  filter: string,
  filterTable: (tableName: string, filter: string) => void
): void {
  setTimeout(() => {
    if (tabName === 'invoices' && filter === 'overdue') {
      filterTable('invoices', 'overdue');
      const filterCards = document.querySelectorAll(
        '.stat-card-clickable[data-table="invoices"]'
      );
      filterCards.forEach((c) => c.classList.remove('active'));
      const overdueCard = document.querySelector(
        '.stat-card-clickable[data-filter="overdue"][data-table="invoices"]'
      );
      overdueCard?.classList.add('active');
    } else if (tabName === 'messages' && filter === 'unread') {
      const threadList = document.querySelector('.thread-list');
      if (threadList) {
        const threads = threadList.querySelectorAll('.thread-item');
        threads.forEach((thread) => {
          const hasUnread =
            thread.classList.contains('unread') ||
            thread.querySelector('.unread-badge, .unread-indicator');
          (thread as HTMLElement).style.display = hasUnread ? '' : 'none';
        });
      }
    }
  }, 100);
}

/**
 * Filter table rows by status column value.
 */
export function filterTable(tableName: string, filter: string): void {
  let tableBody: HTMLElement | null = null;
  let statusColumnIndex = -1;

  if (tableName === 'invoices') {
    tableBody = document.querySelector<HTMLElement>('[data-table-body="invoices"]');
    statusColumnIndex = 4;
  }

  if (!tableBody) return;

  const rows = tableBody.querySelectorAll('tr');
  rows.forEach((row) => {
    if (filter === 'all') {
      row.style.display = '';
      return;
    }

    const statusCell = row.querySelectorAll('td')[statusColumnIndex];
    if (statusCell) {
      const statusText = statusCell.textContent?.toLowerCase().replace(/\s+/g, '_') || '';
      const filterNormalized = filter.toLowerCase();
      const matches =
        statusText.includes(filterNormalized) ||
        (filterNormalized === 'in_progress' && statusText.includes('progress')) ||
        (filterNormalized === 'on_hold' && statusText.includes('hold'));
      row.style.display = matches ? '' : 'none';
    }
  });
}
