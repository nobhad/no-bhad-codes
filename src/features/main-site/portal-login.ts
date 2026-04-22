/**
 * ===============================================
 * PORTAL LOGIN ON MAIN SITE
 * ===============================================
 * @file src/features/main-site/portal-login.ts
 *
 * Handles the portal login form on the main site (#/portal hash page).
 * Supports email + password and magic link login.
 * Redirects to /dashboard on successful authentication.
 *
 * Goes through authStore so the canonical session state (sessionStorage
 * + in-memory auth state) is consistent with the dropdown login and the
 * React SPA's RequireAuth guard.
 */

import { authStore } from '../../auth/auth-store';
import { initPasswordToggle } from '../../components/password-toggle';
import { ROUTES } from '../../constants/api-endpoints';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalLogin');

function extractQuery(hash: string): string {
  const idx = hash.indexOf('?');
  return idx >= 0 ? hash.slice(idx + 1) : '';
}

export class PortalLoginOnMainSite {
  private loginForm: HTMLFormElement | null = null;
  private magicForm: HTMLFormElement | null = null;
  private emailInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private authError: HTMLElement | null = null;

  init(): void {
    this.loginForm = document.getElementById('portal-page-login-form') as HTMLFormElement | null;
    this.magicForm = document.getElementById('portal-page-magic-form') as HTMLFormElement | null;
    this.emailInput = document.getElementById('portal-page-email') as HTMLInputElement | null;
    this.passwordInput = document.getElementById('portal-page-password') as HTMLInputElement | null;
    this.authError = document.getElementById('portal-page-auth-error');

    if (!this.loginForm) return;

    // Show session-expired notice if redirected here from an expired session
    const hashQuery = extractQuery(window.location.hash);
    if (new URLSearchParams(hashQuery).get('session') === 'expired' && this.authError) {
      this.authError.textContent = 'Your session has expired. Please sign in again.';
    }

    this.setupPasswordToggle();
    this.setupLoginForm();
    this.setupMagicLinkToggle();
    if (this.magicForm) this.setupMagicForm();
  }

  private setupPasswordToggle(): void {
    initPasswordToggle({
      input: 'portal-page-password',
      toggle: 'portal-page-pw-toggle'
    });
  }

  private setupLoginForm(): void {
    if (!this.loginForm) return;

    this.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.authError) this.authError.textContent = '';

      const email = this.emailInput?.value?.trim();
      const password = this.passwordInput?.value;
      if (!email || !password) return;

      const submitBtn = this.loginForm!.querySelector<HTMLButtonElement>('.portal-page-submit');
      const btnText = submitBtn?.querySelector<HTMLElement>('.btn-text');
      const btnLoading = submitBtn?.querySelector<HTMLElement>('.btn-loading');

      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnLoading) btnLoading.style.display = 'inline';

      try {
        // Unified login: server detects admin vs client by email and branches.
        const result = await authStore.login({ email, password });

        if (result.success) {
          window.location.href = ROUTES.PORTAL.DASHBOARD;
          return;
        }

        if (this.authError) {
          this.authError.textContent = result.error || 'Invalid email or password';
        }
      } catch (error) {
        logger.error('Login error:', error);
        if (this.authError) {
          this.authError.textContent = 'Connection error. Please try again.';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnLoading) btnLoading.style.display = 'none';
      }
    });
  }

  private setupMagicLinkToggle(): void {
    const magicToggle = document.getElementById('portal-page-magic-toggle');
    const backToLogin = document.getElementById('portal-page-back-to-login');

    magicToggle?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.loginForm) this.loginForm.style.display = 'none';
      if (this.magicForm) this.magicForm.style.display = 'flex';
    });

    backToLogin?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.loginForm) this.loginForm.style.display = 'flex';
      if (this.magicForm) this.magicForm.style.display = 'none';
    });
  }

  private setupMagicForm(): void {
    if (!this.magicForm) return;

    const errorEl = document.getElementById('portal-page-magic-error');
    const successEl = document.getElementById('portal-page-magic-success');

    this.magicForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.textContent = '';

      const emailInput = this.magicForm!.querySelector<HTMLInputElement>(
        '#portal-page-magic-email'
      );
      const submitBtn = this.magicForm!.querySelector<HTMLButtonElement>(
        '.portal-page-magic-submit'
      );

      if (!emailInput) return;
      const email = emailInput.value.trim();
      if (!email) {
        if (errorEl) errorEl.textContent = 'Please enter your email address.';
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      try {
        const result = await authStore.requestMagicLink(email);
        if (result.success) {
          if (successEl) {
            successEl.style.display = 'block';
            this.magicForm!.style.display = 'none';
          }
        } else if (errorEl) {
          errorEl.textContent = result.error || 'Failed to send link. Please try again.';
        }
      } catch (error) {
        logger.error('Magic link error:', error);
        if (errorEl) errorEl.textContent = 'Failed to send link. Please try again.';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}
