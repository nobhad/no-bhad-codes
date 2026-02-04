/**
 * ===============================================
 * COPY EMAIL UTILITY
 * ===============================================
 * @file src/utils/copy-email.ts
 *
 * Centralized copy-icon-after-email for admin and client portal.
 * Use getCopyEmailButtonHtml() where email is displayed, and call
 * initCopyEmailDelegation() once at app load.
 */

/* global ParentNode */

import { SanitizationUtils } from './sanitization-utils';
import { showToast } from './toast-notifications';
import { ICONS } from '../constants/icons';

const COPY_EMAIL_BTN_CLASS = 'copy-email-btn';
const COPY_EMAIL_ATTR = 'data-copy-email';

/**
 * Returns HTML for a copy button to place after an email address.
 * Store the raw email in data-copy-email (escaped for attribute safety).
 */
export function getCopyEmailButtonHtml(email: string): string {
  const safe = SanitizationUtils.escapeHtml(email || '');
  return `<button type="button" class="icon-btn ${COPY_EMAIL_BTN_CLASS}" ${COPY_EMAIL_ATTR}="${safe}" title="Copy email" aria-label="Copy email address">${ICONS.COPY}</button>`;
}

/**
 * Wrapper HTML for an email value with the copy button (shared pattern for meta-value).
 */
export function getEmailWithCopyHtml(email: string, displayEmail?: string): string {
  const raw = email || '';
  const display = SanitizationUtils.escapeHtml(displayEmail ?? raw);
  const button = getCopyEmailButtonHtml(raw);
  return `<span class="meta-value-with-copy">${display} ${button}</span>`;
}

let delegationInitialized = false;

/**
 * Call once when the app (admin or portal) loads. Listens for clicks on
 * .copy-email-btn and copies the data-copy-email value to the clipboard.
 */
export function initCopyEmailDelegation(root: ParentNode = document): void {
  if (delegationInitialized) return;
  delegationInitialized = true;

  root.addEventListener('click', async (e: Event) => {
    const btn = (e.target as Element).closest?.(`.${COPY_EMAIL_BTN_CLASS}`);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const email = (btn as HTMLElement).getAttribute(COPY_EMAIL_ATTR);
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      showToast('Email copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy email', 'error');
    }
  });
}
