/**
 * ===============================================
 * ADMIN LOGIN ON MAIN SITE
 * ===============================================
 * @file src/features/main-site/admin-login.ts
 *
 * Handles admin login form on main site (#/admin-login route).
 * After successful login, redirects to /admin/ dashboard.
 */

import { apiPost } from '../../utils/api-client';

export class AdminLoginOnMainSite {
  private loginForm: HTMLFormElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private passwordToggle: HTMLButtonElement | null = null;
  private authError: HTMLElement | null = null;

  async init(): Promise<void> {
    // Only initialize if on admin-login route
    const hash = window.location.hash;
    if (hash !== '#/admin-login' && hash !== '#admin-login') {
      return;
    }

    this.loginForm = document.getElementById('admin-login-form') as HTMLFormElement;
    this.passwordInput = document.getElementById('admin-password') as HTMLInputElement;
    this.passwordToggle = document.getElementById('password-toggle') as HTMLButtonElement;
    this.authError = document.getElementById('auth-error');

    if (!this.loginForm || !this.passwordInput) {
      console.warn('[AdminLogin] Login form or password input not found');
      return;
    }

    this.setupPasswordToggle();
    this.setupLoginForm();
  }

  private setupPasswordToggle(): void {
    if (!this.passwordToggle || !this.passwordInput) return;

    this.passwordToggle.addEventListener('click', () => {
      const isPassword = this.passwordInput!.type === 'password';
      this.passwordInput!.type = isPassword ? 'text' : 'password';
    });
  }

  private setupLoginForm(): void {
    if (!this.loginForm) return;

    this.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.authError) this.authError.textContent = '';

      const password = this.passwordInput?.value;
      if (!password) return;

      const submitBtn = this.loginForm!.querySelector('.auth-submit') as HTMLButtonElement;
      const btnText = submitBtn?.querySelector('.btn-text') as HTMLElement;
      const btnLoading = submitBtn?.querySelector('.btn-loading') as HTMLElement;

      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnLoading) btnLoading.style.display = 'inline';

      try {
        const response = await apiPost('/api/auth/admin/login', { password });

        if (response.ok) {
          // Redirect to admin dashboard after successful login
          window.location.href = '/admin/';
        } else {
          const data = await response.json();
          if (this.authError) {
            this.authError.textContent = data.error || 'Invalid password';
          }
        }
      } catch (error) {
        console.error('[AdminLogin] Login error:', error);
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
}
