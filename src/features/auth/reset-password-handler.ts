/**
 * ===============================================
 * RESET PASSWORD PAGE HANDLER
 * ===============================================
 * @file src/features/auth/reset-password-handler.ts
 *
 * Handles the reset-password flow:
 * - Read token from URL query params
 * - Real-time password validation
 * - Submit to /api/auth/reset-password
 * - Show success/error states
 *
 * Migrated from inline <script> in client/reset-password.html
 */

import { initAllPasswordToggles } from '../../components/password-toggle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ResetPassword');

const API_RESET_PASSWORD = '/api/auth/reset-password';
const PASSWORD_MIN_LENGTH = 12;

const SUBMIT_TEXT = 'Reset Password';
const SUBMIT_LOADING_TEXT = 'Resetting Password...';

// --- DOM Element IDs ---

const ELEMENT_IDS = {
  LOADING: 'loading-state',
  ERROR: 'error-state',
  SUCCESS: 'success-state',
  FORM: 'reset-password-form',
  PASSWORD: 'password',
  CONFIRM_PASSWORD: 'confirm-password',
  FORM_ERROR: 'form-error',
  SUBMIT_BTN: 'submit-btn',
  ERROR_MESSAGE: 'error-message',
  REQ_LENGTH: 'req-length',
  REQ_UPPERCASE: 'req-uppercase',
  REQ_LOWERCASE: 'req-lowercase',
  REQ_NUMBER: 'req-number',
  REQ_SPECIAL: 'req-special'
} as const;

// --- Helpers ---

interface PageElements {
  error: HTMLElement;
  success: HTMLElement;
  form: HTMLFormElement;
  password: HTMLInputElement;
  confirmPassword: HTMLInputElement;
  formError: HTMLElement;
  submitBtn: HTMLButtonElement;
  errorMessage: HTMLElement;
  reqLength: HTMLElement;
  reqUppercase: HTMLElement;
  reqLowercase: HTMLElement;
  reqNumber: HTMLElement;
  reqSpecial: HTMLElement;
}

function getPageElements(): PageElements | null {
  const error = document.getElementById(ELEMENT_IDS.ERROR);
  const success = document.getElementById(ELEMENT_IDS.SUCCESS);
  const form = document.getElementById(ELEMENT_IDS.FORM) as HTMLFormElement | null;
  const password = document.getElementById(ELEMENT_IDS.PASSWORD) as HTMLInputElement | null;
  const confirmPassword = document.getElementById(
    ELEMENT_IDS.CONFIRM_PASSWORD
  ) as HTMLInputElement | null;
  const formError = document.getElementById(ELEMENT_IDS.FORM_ERROR);
  const submitBtn = document.getElementById(ELEMENT_IDS.SUBMIT_BTN) as HTMLButtonElement | null;
  const errorMessage = document.getElementById(ELEMENT_IDS.ERROR_MESSAGE);
  const reqLength = document.getElementById(ELEMENT_IDS.REQ_LENGTH);
  const reqUppercase = document.getElementById(ELEMENT_IDS.REQ_UPPERCASE);
  const reqLowercase = document.getElementById(ELEMENT_IDS.REQ_LOWERCASE);
  const reqNumber = document.getElementById(ELEMENT_IDS.REQ_NUMBER);
  const reqSpecial = document.getElementById(ELEMENT_IDS.REQ_SPECIAL);

  if (
    !error ||
    !success ||
    !form ||
    !password ||
    !confirmPassword ||
    !formError ||
    !submitBtn ||
    !errorMessage ||
    !reqLength ||
    !reqUppercase ||
    !reqLowercase ||
    !reqNumber ||
    !reqSpecial
  ) {
    logger.error('Missing required DOM elements for reset-password page');
    return null;
  }

  return {
    error,
    success,
    form,
    password,
    confirmPassword,
    formError,
    submitBtn,
    errorMessage,
    reqLength,
    reqUppercase,
    reqLowercase,
    reqNumber,
    reqSpecial
  };
}

function showFormError(el: HTMLElement, message: string): void {
  el.textContent = message;
  el.style.display = 'block';
}

function hideFormError(el: HTMLElement): void {
  el.style.display = 'none';
}

/**
 * Validate password and update requirement indicators in real-time
 */
function validatePassword(password: string, elements: PageElements): boolean {
  const results = {
    length: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&-]/.test(password)
  };

  elements.reqLength.classList.toggle('valid', results.length);
  elements.reqUppercase.classList.toggle('valid', results.uppercase);
  elements.reqLowercase.classList.toggle('valid', results.lowercase);
  elements.reqNumber.classList.toggle('valid', results.number);
  elements.reqSpecial.classList.toggle('valid', results.special);

  return Object.values(results).every(Boolean);
}

// --- Form Submission ---

async function handleFormSubmit(
  event: Event,
  token: string,
  elements: PageElements
): Promise<void> {
  event.preventDefault();
  hideFormError(elements.formError);

  const password = elements.password.value;
  const confirmPassword = elements.confirmPassword.value;

  if (password !== confirmPassword) {
    showFormError(elements.formError, 'Passwords do not match.');
    return;
  }

  if (!validatePassword(password, elements)) {
    showFormError(elements.formError, 'Password does not meet all requirements.');
    return;
  }

  elements.submitBtn.disabled = true;
  elements.submitBtn.textContent = SUBMIT_LOADING_TEXT;

  try {
    const response = await fetch(API_RESET_PASSWORD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showFormError(
        elements.formError,
        data.error || 'Failed to reset password. Please try again.'
      );
      elements.submitBtn.disabled = false;
      elements.submitBtn.textContent = SUBMIT_TEXT;

      // If token is invalid/expired, show error state
      if (data.code === 'INVALID_TOKEN' || data.code === 'TOKEN_EXPIRED') {
        elements.form.style.display = 'none';
        elements.error.style.display = 'block';
        elements.errorMessage.textContent =
          data.error || 'This password reset link is no longer valid.';
      }
      return;
    }

    // Success
    elements.form.style.display = 'none';
    elements.success.style.display = 'block';
  } catch {
    showFormError(elements.formError, 'An error occurred. Please try again later.');
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = SUBMIT_TEXT;
  }
}

// --- Public Entry Point ---

/**
 * Initialize the reset-password page.
 * Call this on DOMContentLoaded from the reset-password page.
 */
export function initResetPasswordPage(): void {
  const elements = getPageElements();
  if (!elements) return;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    elements.error.style.display = 'block';
    elements.errorMessage.textContent =
      'No reset token provided. Please use the link from your password reset email.';
    return;
  }

  // Show form immediately (token validation happens on submit)
  elements.form.style.display = 'block';

  // Initialize password toggles after form is shown
  logger.debug('Initializing password toggles');
  initAllPasswordToggles();

  // Real-time password validation
  elements.password.addEventListener('input', () => {
    validatePassword(elements.password.value, elements);
  });

  // Attach form submission handler
  elements.form.addEventListener('submit', (e) => handleFormSubmit(e, token, elements));
}
