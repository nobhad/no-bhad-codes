/**
 * ===============================================
 * ADMIN AUTH FORM
 * ===============================================
 * @file src/features/auth/admin-auth-form.ts
 *
 * Handles the admin login form on the auth-gate:
 * - Button state toggle (active class when password has content)
 * - Form submission interception (prevents native POST, uses fetch)
 * - Redirects to /admin/ on success
 *
 * Migrated from inline <script> in server/views/partials/auth-gate.ejs
 */

import { apiPost } from '../../utils/api-client';
import { initPasswordToggle } from '../../components/password-toggle';
import { createLogger } from '../../utils/logger';
import { API_ENDPOINTS } from '../../constants/api-endpoints';

const logger = createLogger('AdminAuthForm');

// --- Constants ---

const FORM_ID = 'admin-login-form';
const PASSWORD_INPUT_ID = 'admin-password';
const AUTH_ERROR_ID = 'auth-error';
const PASSWORD_TOGGLE_ID = 'password-toggle';
const SUBMIT_BUTTON_SELECTOR = '.auth-submit';
const ACTIVE_CLASS = 'active';

// --- Helpers ---

function setButtonLoading(form: HTMLFormElement, loading: boolean): void {
  const submitBtn = form.querySelector(SUBMIT_BUTTON_SELECTOR) as HTMLButtonElement | null;
  const btnText = submitBtn?.querySelector('.btn-text') as HTMLElement | null;
  const btnLoading = submitBtn?.querySelector('.btn-loading') as HTMLElement | null;

  if (submitBtn) submitBtn.disabled = loading;
  if (btnText) btnText.style.display = loading ? 'none' : 'inline';
  if (btnLoading) btnLoading.style.display = loading ? 'inline' : 'none';
}

// --- Public Entry Point ---

/**
 * Initialize the admin auth form:
 * - Password visibility toggle
 * - Button state toggle (active class)
 * - Form submission interception (prevents native POST)
 */
export function initAdminAuthForm(): void {
  const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
  const passwordInput = document.getElementById(PASSWORD_INPUT_ID) as HTMLInputElement | null;
  const authError = document.getElementById(AUTH_ERROR_ID);

  if (!form || !passwordInput) return;

  // Password toggle
  initPasswordToggle({
    input: PASSWORD_INPUT_ID,
    toggle: PASSWORD_TOGGLE_ID
  });

  // Button active state toggle
  const submitBtn = form.querySelector(SUBMIT_BUTTON_SELECTOR) as HTMLButtonElement | null;
  if (submitBtn) {
    passwordInput.addEventListener('input', () => {
      if (passwordInput.value.trim().length > 0) {
        submitBtn.classList.add(ACTIVE_CLASS);
      } else {
        submitBtn.classList.remove(ACTIVE_CLASS);
      }
    });
  }

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (authError) authError.textContent = '';

    const password = passwordInput.value;
    if (!password) {
      passwordInput.focus();
      return;
    }

    setButtonLoading(form, true);

    try {
      const response = await apiPost(API_ENDPOINTS.AUTH_ADMIN_LOGIN, { password });
      const data = await response.json();

      if (response.ok && data.success) {
        window.location.href = '/admin/';
      } else {
        if (authError) {
          authError.textContent = data.error || 'Invalid password';
        }
      }
    } catch (error) {
      logger.error('Admin login error:', error);
      if (authError) {
        authError.textContent = 'Connection error. Please try again.';
      }
    } finally {
      setButtonLoading(form, false);
    }
  });
}
