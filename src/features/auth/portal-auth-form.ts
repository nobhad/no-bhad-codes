/**
 * ===============================================
 * PORTAL AUTH FORM
 * ===============================================
 * @file src/features/auth/portal-auth-form.ts
 *
 * Handles the client portal login form on the auth-gate.
 * Intercepts native form POST, submits via fetch, and
 * redirects based on the user's role (admin vs client).
 */

import { apiPost } from '../../utils/api-client';
import { initPasswordToggle } from '../../components/password-toggle';
import { createLogger } from '../../utils/logger';
import { API_ENDPOINTS, ROUTES } from '../../constants/api-endpoints';
import { AUTH_STORAGE_KEYS } from '../../auth/auth-constants';
import { TIME_MS } from '../../constants/thresholds';

const logger = createLogger('PortalAuthForm');

// --- Constants ---

const DEFAULT_SESSION_EXPIRY_MS = TIME_MS.DAY; // 24 hours

const FORM_ID = 'portal-login-form';
const EMAIL_INPUT_ID = 'portal-email';
const PASSWORD_INPUT_ID = 'portal-password';
const AUTH_ERROR_ID = 'auth-error';
const EMAIL_ERROR_ID = 'email-error';
const PASSWORD_ERROR_ID = 'password-error';
const PASSWORD_TOGGLE_ID = 'portal-password-toggle';
const MAGIC_LINK_FORM_ID = 'magic-link-form';
const MAGIC_LINK_TOGGLE_ID = 'magic-link-toggle';
const MAGIC_LINK_EMAIL_ID = 'magic-link-email';
const MAGIC_LINK_ERROR_ID = 'magic-link-error';
const MAGIC_LINK_SUCCESS_ID = 'magic-link-success';

// --- Helpers ---

function showError(elementId: string, message: string): void {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function hideError(elementId: string): void {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = '';
    el.style.display = 'none';
  }
}

function setButtonLoading(form: HTMLFormElement, loading: boolean): void {
  const submitBtn = form.querySelector('.auth-submit') as HTMLButtonElement | null;
  const btnText = submitBtn?.querySelector('.btn-text') as HTMLElement | null;
  const btnLoading = submitBtn?.querySelector('.btn-loading') as HTMLElement | null;

  if (submitBtn) submitBtn.disabled = loading;
  if (btnText) btnText.style.display = loading ? 'none' : 'inline';
  if (btnLoading) btnLoading.style.display = loading ? 'inline' : 'none';
}

// --- Auth Session ---

interface LoginResponseData {
  user: {
    id: number;
    email: string;
    name?: string;
    companyName?: string;
    contactName?: string;
    isAdmin?: boolean;
    role?: string;
  };
  expiresIn?: string;
}

function storeAuthSession(data: LoginResponseData): void {
  const { user, expiresIn } = data;

  // Parse expiresIn (e.g. "24h", "7d") to milliseconds
  let expiryMs = DEFAULT_SESSION_EXPIRY_MS;
  if (expiresIn) {
    const match = expiresIn.match(/^(\d+)([hdm])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      if (unit === 'h') expiryMs = value * 60 * 60 * 1000;
      else if (unit === 'd') expiryMs = value * 24 * 60 * 60 * 1000;
      else if (unit === 'm') expiryMs = value * 60 * 1000;
    }
  }

  const expiresAt = Date.now() + expiryMs;
  const sessionId = `sess_${Math.random().toString(36).substring(2)}`;

  sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.USER, JSON.stringify(user));
  sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.ROLE, user.role || (user.isAdmin ? 'admin' : 'client'));
  sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.EXPIRY, expiresAt.toString());
  sessionStorage.setItem(AUTH_STORAGE_KEYS.SESSION.SESSION_ID, sessionId);
}

// --- Form Handlers ---

function setupLoginForm(form: HTMLFormElement): void {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    hideError(AUTH_ERROR_ID);
    hideError(EMAIL_ERROR_ID);
    hideError(PASSWORD_ERROR_ID);

    const emailInput = document.getElementById(EMAIL_INPUT_ID) as HTMLInputElement | null;
    const passwordInput = document.getElementById(PASSWORD_INPUT_ID) as HTMLInputElement | null;

    const email = emailInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';

    // Client-side validation
    if (!email) {
      showError(EMAIL_ERROR_ID, 'Email is required');
      emailInput?.focus();
      return;
    }

    if (!password) {
      showError(PASSWORD_ERROR_ID, 'Password is required');
      passwordInput?.focus();
      return;
    }

    setButtonLoading(form, true);

    try {
      const response = await apiPost(API_ENDPOINTS.AUTH_PORTAL_LOGIN, { email, password });
      const data = await response.json();

      if (response.ok && data.success && data.data) {
        // Store auth session in sessionStorage for client-side auth gate
        storeAuthSession(data.data as LoginResponseData);

        // Redirect based on role
        const isAdmin = data.data?.user?.isAdmin;
        window.location.href = isAdmin ? '/admin/' : ROUTES.PORTAL.DASHBOARD;
      } else {
        showError(AUTH_ERROR_ID, data.error || 'Invalid credentials');
      }
    } catch (error) {
      logger.error('Login error:', error);
      showError(AUTH_ERROR_ID, 'Connection error. Please try again.');
    } finally {
      setButtonLoading(form, false);
    }
  });
}

function setupMagicLinkForm(): void {
  const magicForm = document.getElementById(MAGIC_LINK_FORM_ID) as HTMLFormElement | null;
  if (!magicForm) return;

  magicForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    hideError(MAGIC_LINK_ERROR_ID);
    const successEl = document.getElementById(MAGIC_LINK_SUCCESS_ID);
    if (successEl) successEl.style.display = 'none';

    const emailInput = document.getElementById(MAGIC_LINK_EMAIL_ID) as HTMLInputElement | null;
    const email = emailInput?.value.trim() ?? '';

    if (!email) {
      showError(MAGIC_LINK_ERROR_ID, 'Email is required');
      emailInput?.focus();
      return;
    }

    setButtonLoading(magicForm, true);

    try {
      const response = await apiPost(API_ENDPOINTS.AUTH_MAGIC_LINK, { email });
      const data = await response.json();

      if (response.ok && data.success) {
        if (successEl) successEl.style.display = 'block';
      } else {
        showError(MAGIC_LINK_ERROR_ID, data.error || 'Failed to send magic link');
      }
    } catch (error) {
      logger.error('Magic link error:', error);
      showError(MAGIC_LINK_ERROR_ID, 'Connection error. Please try again.');
    } finally {
      setButtonLoading(magicForm, false);
    }
  });
}

function setupMagicLinkToggle(): void {
  const toggleLink = document.getElementById(MAGIC_LINK_TOGGLE_ID);
  const loginForm = document.getElementById(FORM_ID);
  const magicForm = document.getElementById(MAGIC_LINK_FORM_ID);

  if (!toggleLink || !loginForm || !magicForm) return;

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();

    const showingMagicLink = magicForm.style.display !== 'none';

    if (showingMagicLink) {
      // Switch back to password login
      magicForm.style.display = 'none';
      loginForm.style.display = 'block';
      toggleLink.textContent = 'Use magic link instead';
    } else {
      // Switch to magic link
      loginForm.style.display = 'none';
      magicForm.style.display = 'block';
      toggleLink.textContent = 'Use password instead';
    }
  });
}

// --- Public Entry Point ---

/**
 * Initialize the portal auth form:
 * - Password visibility toggle
 * - Form submission interception (prevents native POST)
 * - Magic link form toggle and submission
 */
export function initPortalAuthForm(): void {
  const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
  if (!form) return;

  // Password toggle
  initPasswordToggle({
    input: PASSWORD_INPUT_ID,
    toggle: PASSWORD_TOGGLE_ID
  });

  // Login form submission
  setupLoginForm(form);

  // Magic link
  setupMagicLinkForm();
  setupMagicLinkToggle();
}
