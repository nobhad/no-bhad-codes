/**
 * ===============================================
 * SET PASSWORD PAGE HANDLER
 * ===============================================
 * @file src/features/auth/set-password-handler.ts
 *
 * Handles the full set-password flow:
 * - Token verification from URL params
 * - Form display and password validation
 * - Password submission and auth session setup
 * - Redirect to portal on success
 *
 * Migrated from inline <script> in client/set-password.html
 */

import { initAllPasswordToggles } from '../../components/password-toggle';
import { decodeJwtPayload } from '../../utils/jwt-utils';
import { createLogger } from '../../utils/logger';
import { API_ENDPOINTS } from '../../constants/api-endpoints';

const logger = createLogger('SetPassword');

// --- Constants ---

const PASSWORD_MIN_LENGTH = 12;
const SESSION_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

const API_VERIFY_INVITATION = API_ENDPOINTS.AUTH_VERIFY_INVITATION;
const API_SET_PASSWORD = API_ENDPOINTS.AUTH_SET_PASSWORD;
const PORTAL_DASHBOARD_PATH = '/dashboard';

const AUTH_STORAGE_KEYS = {
  USER: 'nbw_auth_user',
  ROLE: 'nbw_auth_role',
  EXPIRY: 'nbw_auth_expiry',
  SESSION_ID: 'nbw_auth_session_id',
  LEGACY_MODE: 'client_auth_mode',
  LEGACY_EMAIL: 'clientEmail'
} as const;

const SUBMIT_TEXT = 'Set Password & Activate Account';
const SUBMIT_LOADING_TEXT = 'Setting Password...';

// --- DOM Element IDs ---

const ELEMENT_IDS = {
  LOADING: 'loading-state',
  ERROR: 'error-state',
  SUCCESS: 'success-state',
  FORM: 'set-password-form',
  WELCOME: 'welcome-message',
  EMAIL: 'email',
  PASSWORD: 'password',
  CONFIRM_PASSWORD: 'confirm-password',
  FORM_ERROR: 'form-error',
  SUBMIT_BTN: 'submit-btn',
  ERROR_MESSAGE: 'error-message'
} as const;

// --- Helpers ---

interface PageElements {
  loading: HTMLElement;
  error: HTMLElement;
  success: HTMLElement;
  form: HTMLFormElement;
  welcome: HTMLElement;
  email: HTMLInputElement;
  password: HTMLInputElement;
  confirmPassword: HTMLInputElement;
  formError: HTMLElement;
  submitBtn: HTMLButtonElement;
  errorMessage: HTMLElement;
}

function getPageElements(): PageElements | null {
  const loading = document.getElementById(ELEMENT_IDS.LOADING);
  const error = document.getElementById(ELEMENT_IDS.ERROR);
  const success = document.getElementById(ELEMENT_IDS.SUCCESS);
  const form = document.getElementById(ELEMENT_IDS.FORM) as HTMLFormElement | null;
  const welcome = document.getElementById(ELEMENT_IDS.WELCOME);
  const email = document.getElementById(ELEMENT_IDS.EMAIL) as HTMLInputElement | null;
  const password = document.getElementById(ELEMENT_IDS.PASSWORD) as HTMLInputElement | null;
  const confirmPassword = document.getElementById(
    ELEMENT_IDS.CONFIRM_PASSWORD
  ) as HTMLInputElement | null;
  const formError = document.getElementById(ELEMENT_IDS.FORM_ERROR);
  const submitBtn = document.getElementById(ELEMENT_IDS.SUBMIT_BTN) as HTMLButtonElement | null;
  const errorMessage = document.getElementById(ELEMENT_IDS.ERROR_MESSAGE);

  if (
    !loading ||
    !error ||
    !success ||
    !form ||
    !welcome ||
    !email ||
    !password ||
    !confirmPassword ||
    !formError ||
    !submitBtn ||
    !errorMessage
  ) {
    logger.error('Missing required DOM elements for set-password page');
    return null;
  }

  return {
    loading,
    error,
    success,
    form,
    welcome,
    email,
    password,
    confirmPassword,
    formError,
    submitBtn,
    errorMessage
  };
}

/**
 * Safely set email input value, ignoring falsy/placeholder strings
 */
function setEmailValue(input: HTMLInputElement, value: string | null | undefined): void {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return;
  }
  input.value = trimmed;
}

/**
 * Validate password against server-matching requirements
 * Returns array of error descriptions (empty = valid)
 */
function validatePassword(password: string): string[] {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('one lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('one number');
  }
  if (!/[@$!%*?&-]/.test(password)) {
    errors.push('one special character (@$!%*?&-)');
  }

  return errors;
}

/**
 * Show an error in the form error element
 */
function showFormError(el: HTMLElement, message: string): void {
  el.textContent = message;
  el.style.display = 'block';
}

/**
 * Hide the form error element
 */
function hideFormError(el: HTMLElement): void {
  el.style.display = 'none';
}

/**
 * Generate a random session ID
 */
function generateSessionId(): string {
  return `sess_${  Math.random().toString(36).substring(2)}`;
}

/**
 * Store auth session data after successful password set
 */
function storeAuthSession(token: string, email: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    logger.error('Failed to decode JWT token');
    return false;
  }

  const user = {
    id: payload.id ?? payload.sub,
    email: (payload.email as string) || email,
    role: 'client',
    contactName: '',
    companyName: ''
  };

  const expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + SESSION_EXPIRY_MS;
  const sessionId = generateSessionId();

  sessionStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
  sessionStorage.setItem(AUTH_STORAGE_KEYS.ROLE, 'client');
  sessionStorage.setItem(AUTH_STORAGE_KEYS.EXPIRY, expiresAt.toString());
  sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION_ID, sessionId);

  // Legacy keys for backward compatibility
  sessionStorage.setItem(AUTH_STORAGE_KEYS.LEGACY_MODE, 'authenticated');
  sessionStorage.setItem(AUTH_STORAGE_KEYS.LEGACY_EMAIL, user.email);

  logger.debug('Auth session stored', { userId: user.id, email: user.email });
  return true;
}

// --- Token Verification ---

async function verifyToken(
  token: string,
  elements: PageElements,
  emailFromLink: string | null
): Promise<boolean> {
  try {
    const response = await fetch(API_VERIFY_INVITATION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      elements.loading.style.display = 'none';
      elements.error.style.display = 'block';
      elements.errorMessage.textContent = data.error || 'Invalid invitation link.';
      return false;
    }

    // Token valid - show the form
    elements.loading.style.display = 'none';
    elements.form.style.display = 'block';
    setEmailValue(elements.email, emailFromLink || data.email);

    if (data.name) {
      elements.welcome.textContent = `Welcome, ${data.name}! Create your password to access your client portal.`;
    }

    // Initialize password toggles after form is visible
    logger.debug('Initializing password toggles');
    initAllPasswordToggles();

    return true;
  } catch {
    elements.loading.style.display = 'none';
    elements.error.style.display = 'block';
    elements.errorMessage.textContent = 'Unable to verify invitation. Please try again later.';
    return false;
  }
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

  // Check passwords match
  if (password !== confirmPassword) {
    showFormError(elements.formError, 'Passwords do not match.');
    return;
  }

  // Validate password requirements
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    showFormError(elements.formError, `Password must contain: ${  passwordErrors.join(', ')}`);
    return;
  }

  // Disable submit button
  elements.submitBtn.disabled = true;
  elements.submitBtn.textContent = SUBMIT_LOADING_TEXT;

  try {
    const response = await fetch(API_SET_PASSWORD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showFormError(
        elements.formError,
        data.error || 'Failed to set password. Please try again.'
      );
      elements.submitBtn.disabled = false;
      elements.submitBtn.textContent = SUBMIT_TEXT;
      return;
    }

    // Success - attempt auto-login via JWT
    if (data.data?.token) {
      const stored = storeAuthSession(data.data.token, data.data.email || '');
      if (stored) {
        window.location.href = PORTAL_DASHBOARD_PATH;
        return;
      }
    }

    // Fallback: show success state if no token returned
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
 * Initialize the set-password page.
 * Call this on DOMContentLoaded from the set-password HTML page.
 */
export function initSetPasswordPage(): void {
  const elements = getPageElements();
  if (!elements) return;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const emailFromLink = params.get('email');

  if (!token) {
    elements.loading.style.display = 'none';
    elements.error.style.display = 'block';
    elements.errorMessage.textContent =
      'No invitation token provided. Please use the link from your invitation email.';
    return;
  }

  // Pre-fill email from URL if present
  setEmailValue(elements.email, emailFromLink);

  // Verify token and show form
  verifyToken(token, elements, emailFromLink).then((valid) => {
    if (!valid) return;

    // Attach form submission handler
    elements.form.addEventListener('submit', (e) => handleFormSubmit(e, token, elements));
  });
}
