/**
 * ===============================================
 * ADMIN AUTH FORM
 * ===============================================
 * @file src/features/auth/admin-auth-form.ts
 *
 * Handles the admin login form button state toggle:
 * activates the submit button when the password field has content.
 *
 * Migrated from inline <script> in server/views/partials/auth-gate.ejs
 */

// --- Constants ---

const PASSWORD_INPUT_ID = 'admin-password';
const SUBMIT_BUTTON_SELECTOR = '.auth-submit';
const ACTIVE_CLASS = 'active';

// --- Public Entry Point ---

/**
 * Initialize the admin auth form button state toggle.
 * Adds/removes the 'active' class on the submit button
 * based on whether the password field has content.
 */
export function initAdminAuthForm(): void {
  const passwordInput = document.getElementById(PASSWORD_INPUT_ID) as HTMLInputElement | null;
  const submitBtn = document.querySelector(SUBMIT_BUTTON_SELECTOR) as HTMLButtonElement | null;

  if (!passwordInput || !submitBtn) {
    return;
  }

  passwordInput.addEventListener('input', () => {
    if (passwordInput.value.trim().length > 0) {
      submitBtn.classList.add(ACTIVE_CLASS);
    } else {
      submitBtn.classList.remove(ACTIVE_CLASS);
    }
  });
}
