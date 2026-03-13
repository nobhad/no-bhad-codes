/**
 * ===============================================
 * FORGOT PASSWORD PAGE HANDLER
 * ===============================================
 * @file src/features/auth/forgot-password-handler.ts
 *
 * Handles the forgot-password flow:
 * - Form display and email validation
 * - POST to /api/auth/forgot-password
 * - Always shows success (security: don't reveal if email exists)
 *
 * Migrated from inline <script> in client/forgot-password.html
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('ForgotPassword');

const API_FORGOT_PASSWORD = '/api/auth/forgot-password';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUBMIT_LOADING_TEXT = 'Sending...';

// --- DOM Element IDs ---

const ELEMENT_IDS = {
  FORM: 'forgot-password-form',
  SUCCESS: 'success-state',
  EMAIL: 'email',
  FORM_ERROR: 'form-error',
  SUBMIT_BTN: 'submit-btn',
  SUCCESS_EMAIL: 'success-email'
} as const;

// --- Helpers ---

interface PageElements {
  form: HTMLFormElement;
  success: HTMLElement;
  email: HTMLInputElement;
  formError: HTMLElement;
  submitBtn: HTMLButtonElement;
  successEmail: HTMLElement;
}

function getPageElements(): PageElements | null {
  const form = document.getElementById(ELEMENT_IDS.FORM) as HTMLFormElement | null;
  const success = document.getElementById(ELEMENT_IDS.SUCCESS);
  const email = document.getElementById(ELEMENT_IDS.EMAIL) as HTMLInputElement | null;
  const formError = document.getElementById(ELEMENT_IDS.FORM_ERROR);
  const submitBtn = document.getElementById(ELEMENT_IDS.SUBMIT_BTN) as HTMLButtonElement | null;
  const successEmail = document.getElementById(ELEMENT_IDS.SUCCESS_EMAIL);

  if (!form || !success || !email || !formError || !submitBtn || !successEmail) {
    logger.error('Missing required DOM elements for forgot-password page');
    return null;
  }

  return { form, success, email, formError, submitBtn, successEmail };
}

function showFormError(el: HTMLElement, message: string): void {
  el.textContent = message;
  el.style.display = 'block';
}

function hideFormError(el: HTMLElement): void {
  el.style.display = 'none';
}

/**
 * Show the success state (always, for security)
 */
function showSuccess(elements: PageElements, email: string): void {
  elements.form.style.display = 'none';
  elements.successEmail.textContent = email;
  elements.success.style.display = 'block';
}

// --- Form Submission ---

async function handleFormSubmit(event: Event, elements: PageElements): Promise<void> {
  event.preventDefault();
  hideFormError(elements.formError);

  const email = elements.email.value.trim();

  if (!email) {
    showFormError(elements.formError, 'Please enter your email address.');
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    showFormError(elements.formError, 'Please enter a valid email address.');
    return;
  }

  elements.submitBtn.disabled = true;
  elements.submitBtn.textContent = SUBMIT_LOADING_TEXT;

  try {
    await fetch(API_FORGOT_PASSWORD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    // Always show success (for security - don't reveal if email exists)
    showSuccess(elements, email);
  } catch {
    // Even on network error, show success (for security)
    showSuccess(elements, email);
  }
}

// --- Public Entry Point ---

/**
 * Initialize the forgot-password page.
 * Call this on DOMContentLoaded from the forgot-password page.
 */
export function initForgotPasswordPage(): void {
  const elements = getPageElements();
  if (!elements) return;

  logger.debug('Forgot password page initialized');
  elements.form.addEventListener('submit', (e) => handleFormSubmit(e, elements));
}
