/**
 * ===============================================
 * PORTAL DROPDOWN (MAIN SITE)
 * ===============================================
 * @file src/features/main-site/portal-dropdown.ts
 *
 * Wires up the login dropdown rendered in index.html (#portal-dropdown).
 * Handles open/close, form switching (password/magic/forgot), password
 * visibility toggle, autofill detection, and form submission.
 *
 * Submits through authStore so the canonical session state (sessionStorage
 * + in-memory auth state) is consistent with the /#/portal login page and
 * the React SPA's RequireAuth guard.
 */

import { authStore } from '../../auth/auth-store';
import { APP_CONSTANTS } from '../../config/constants';
import { ROUTES } from '../../constants/api-endpoints';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalDropdown');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTOFILL_CHECK_DELAYS_MS = [100, 500, 1000];
const AUTOFILL_OPEN_DELAYS_MS = [50, 200];
const MAGIC_LINK_RESET_MS = 3000;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

function setInlineError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
}

export function initPortalDropdown(): void {
  const trigger = document.getElementById('portal-trigger');
  const dropdown = document.getElementById('portal-dropdown');
  const backdrop = document.getElementById('portal-backdrop');
  const passwordForm = document.getElementById('portal-password-form') as HTMLFormElement | null;
  const magicForm = document.getElementById('portal-magic-form') as HTMLFormElement | null;
  const forgotForm = document.getElementById('portal-forgot-form') as HTMLFormElement | null;
  const resetSent = document.getElementById('portal-reset-sent');
  const forgotLink = document.getElementById('forgot-password-link');
  const backToLogin = document.getElementById('back-to-login');
  const backToLogin2 = document.getElementById('back-to-login-2');
  const loginError = document.getElementById('portal-login-error');
  const magicError = document.getElementById('portal-magic-error');
  const forgotError = document.getElementById('portal-forgot-error');

  if (
    !trigger ||
    !dropdown ||
    !backdrop ||
    !passwordForm ||
    !magicForm ||
    !forgotForm ||
    !resetSent
  ) {
    return;
  }

  const authToggle = dropdown.querySelector<HTMLElement>('.portal-auth-toggle');
  if (!authToggle) return;

  function positionCaret(): void {
    if (!trigger || !dropdown) return;
    const iconWrap = trigger.querySelector('.icon-wrap');
    const anchor = (iconWrap as HTMLElement | null) || trigger;
    const anchorRect = anchor.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    const caretLeft = anchorRect.left + anchorRect.width / 2 - dropdownRect.left - 10;
    dropdown.style.setProperty('--caret-left', `${caretLeft}px`);
  }

  function closeDropdown(): void {
    dropdown?.classList.remove('open');
    backdrop?.classList.remove('open');
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.toggle('open');
    backdrop.classList.toggle('open');
    requestAnimationFrame(positionCaret);
  });

  window.addEventListener('resize', () => {
    if (dropdown.classList.contains('open')) {
      positionCaret();
    }
  });

  backdrop.addEventListener('click', closeDropdown);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      closeDropdown();
    }
  });

  function hideAllForms(): void {
    passwordForm?.classList.remove('form-active');
    magicForm?.classList.remove('form-active');
    forgotForm?.classList.remove('form-active');
    resetSent?.classList.remove('form-active');
  }

  function showLoginForm(): void {
    hideAllForms();
    passwordForm?.classList.add('form-active');
    if (authToggle) {
      authToggle.style.display = 'flex';
      authToggle.querySelector('[data-form="password"]')?.classList.add('active');
      authToggle.querySelector('[data-form="magic"]')?.classList.remove('active');
    }
    setInlineError(loginError, '');
  }

  authToggle.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLElement>('.portal-toggle-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    forgotForm.classList.remove('form-active');
    resetSent.classList.remove('form-active');

    authToggle.querySelectorAll('.portal-toggle-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.form === 'password') {
      const magicEmail = magicForm.querySelector<HTMLInputElement>('#portal-magic-email');
      const passwordEmail = passwordForm.querySelector<HTMLInputElement>('#portal-email');
      if (magicEmail && passwordEmail && magicEmail.value.trim()) {
        passwordEmail.value = magicEmail.value.trim();
        validatePasswordForm();
      }
      passwordForm.classList.add('form-active');
      magicForm.classList.remove('form-active');
    } else {
      const passwordEmail = passwordForm.querySelector<HTMLInputElement>('#portal-email');
      const magicEmail = magicForm.querySelector<HTMLInputElement>('#portal-magic-email');
      if (passwordEmail && magicEmail && passwordEmail.value.trim()) {
        magicEmail.value = passwordEmail.value.trim();
        validateMagicForm();
      }
      magicForm.classList.add('form-active');
      passwordForm.classList.remove('form-active');
    }
  });

  const pwToggle = dropdown.querySelector<HTMLButtonElement>('.password-toggle');
  if (pwToggle) {
    pwToggle.addEventListener('click', function () {
      const input = this.previousElementSibling as HTMLInputElement | null;
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      this.classList.toggle('showing', !isPassword);
    });
  }

  forgotLink?.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllForms();
    forgotForm.classList.add('form-active');
    authToggle.style.display = 'none';
    setInlineError(forgotError, '');
  });

  backToLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });

  backToLogin2?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });

  function validatePasswordForm(): void {
    const emailInput = passwordForm?.querySelector<HTMLInputElement>('#portal-email');
    const passwordInput = passwordForm?.querySelector<HTMLInputElement>('input[type="password"]');
    const submitBtn = passwordForm?.querySelector<HTMLButtonElement>('.dropdown-submit');
    if (!emailInput || !passwordInput || !submitBtn) return;

    const emailValid = isValidEmail(emailInput.value.trim());
    const passwordValid = passwordInput.value.length >= 1;
    submitBtn.classList.toggle('valid', emailValid && passwordValid);
  }

  passwordForm.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', validatePasswordForm);
    input.addEventListener('change', validatePasswordForm);
  });

  function checkAutofill(): void {
    const emailInput = passwordForm?.querySelector<HTMLInputElement>('#portal-email');
    const passwordInput = passwordForm?.querySelector<HTMLInputElement>('input[type="password"]');
    if (!emailInput || !passwordInput) return;

    const emailFilled = emailInput.matches(':-webkit-autofill') || emailInput.value.length > 0;
    const passFilled = passwordInput.matches(':-webkit-autofill') || passwordInput.value.length > 0;
    if (emailFilled || passFilled) {
      validatePasswordForm();
    }
  }

  AUTOFILL_CHECK_DELAYS_MS.forEach((delay) => setTimeout(checkAutofill, delay));

  const openObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const target = mutation.target as HTMLElement;
      if (target.classList?.contains('open')) {
        AUTOFILL_OPEN_DELAYS_MS.forEach((delay) => setTimeout(checkAutofill, delay));
      }
    });
  });
  openObserver.observe(dropdown, { attributes: true, attributeFilter: ['class'] });

  function validateMagicForm(): void {
    const emailInput = magicForm?.querySelector<HTMLInputElement>('#portal-magic-email');
    const submitBtn = magicForm?.querySelector<HTMLButtonElement>('.dropdown-submit');
    if (!emailInput || !submitBtn) return;
    submitBtn.classList.toggle('valid', isValidEmail(emailInput.value.trim()));
  }

  magicForm.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', validateMagicForm);
  });

  magicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = magicForm.querySelector<HTMLInputElement>('#portal-magic-email');
    const submitBtn = magicForm.querySelector<HTMLButtonElement>('.dropdown-submit');
    if (!emailInput || !submitBtn) return;

    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      setInlineError(magicError, 'Please enter a valid email address.');
      return;
    }

    setInlineError(magicError, '');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    // Always show success for security (don't reveal whether the email exists)
    await authStore.requestMagicLink(email).catch((error) => {
      logger.warn('Magic link request failed:', error);
    });

    submitBtn.textContent = 'Link sent!';
    submitBtn.classList.add('sent');

    setTimeout(() => {
      emailInput.value = '';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Link';
      submitBtn.classList.remove('sent', 'valid');
      setInlineError(magicError, '');
    }, MAGIC_LINK_RESET_MS);
  });

  function validateForgotForm(): void {
    const emailInput = forgotForm?.querySelector<HTMLInputElement>('#portal-forgot-email');
    const submitBtn = forgotForm?.querySelector<HTMLButtonElement>('.dropdown-submit');
    if (!emailInput || !submitBtn) return;
    submitBtn.classList.toggle('valid', isValidEmail(emailInput.value.trim()));
  }

  forgotForm.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', validateForgotForm);
  });

  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = forgotForm.querySelector<HTMLInputElement>('#portal-forgot-email');
    const submitBtn = forgotForm.querySelector<HTMLButtonElement>('.dropdown-submit');
    if (!emailInput || !submitBtn) return;

    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      setInlineError(forgotError, 'Please enter a valid email address.');
      return;
    }

    setInlineError(forgotError, '');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    // Server returns success regardless of whether the email exists
    // (email enumeration protection). The only failures surfaced here are
    // network/validation errors — everything else shows the success screen.
    const result = await authStore.requestPasswordReset(email);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Reset Link';

    if (!result.success) {
      setInlineError(forgotError, result.error || 'Failed to send reset link. Please try again.');
      return;
    }

    hideAllForms();
    resetSent.classList.add('form-active');
    emailInput.value = '';
    submitBtn.classList.remove('valid');
  });

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = passwordForm.querySelector<HTMLInputElement>('#portal-email');
    const passwordInput = passwordForm.querySelector<HTMLInputElement>('input[type="password"]');
    const submitBtn = passwordForm.querySelector<HTMLButtonElement>('.dropdown-submit');
    if (!emailInput || !passwordInput || !submitBtn) {
      setInlineError(loginError, 'Form error. Please refresh and try again.');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      setInlineError(loginError, 'Please enter your email and password.');
      return;
    }

    setInlineError(loginError, '');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    const isAdminLogin = email.toLowerCase() === APP_CONSTANTS.SECURITY.ADMIN_EMAIL.toLowerCase();

    try {
      const result = isAdminLogin
        ? await authStore.adminLogin({ password })
        : await authStore.login({ email, password });

      if (result.success) {
        closeDropdown();
        window.location.href = ROUTES.PORTAL.DASHBOARD;
        return;
      }

      setInlineError(loginError, result.error || 'Invalid email or password. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    } catch (error) {
      logger.error('Login error:', error);
      setInlineError(loginError, 'An unexpected error occurred. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}
