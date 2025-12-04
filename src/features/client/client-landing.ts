/**
 * ===============================================
 * CLIENT LANDING MODULE
 * ===============================================
 * @file src/features/client/client-landing.ts
 *
 * Handles client landing page functionality including:
 * - Login form submission and validation
 * - Password visibility toggle
 * - Intake modal opening
 */

import { BaseModule } from '../../modules/base';
import { gsap } from 'gsap';
import { getContactEmail } from '../../config/branding';

// Demo credentials should be in environment variables for production
const DEMO_CREDENTIALS = {
  EMAIL: import.meta.env.VITE_DEMO_EMAIL || 'demo@example.com',
  PASSWORD: import.meta.env.VITE_DEMO_PASSWORD || 'nobhadDemo123'
};

export class ClientLandingModule extends BaseModule {
  // Demo credentials for testing
  private readonly DEMO_EMAIL = DEMO_CREDENTIALS.EMAIL;
  private readonly DEMO_PASSWORD = DEMO_CREDENTIALS.PASSWORD;

  // DOM elements - Desktop
  private loginForm: HTMLFormElement | null = null;
  private emailInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private passwordToggle: HTMLButtonElement | null = null;
  private loginError: HTMLElement | null = null;
  private submitButton: HTMLButtonElement | null = null;
  private openIntakeButton: HTMLButtonElement | null = null;
  private intakeModal: HTMLElement | null = null;

  // DOM elements - Mobile
  private loginFormMobile: HTMLFormElement | null = null;
  private emailInputMobile: HTMLInputElement | null = null;
  private passwordInputMobile: HTMLInputElement | null = null;
  private loginErrorMobile: HTMLElement | null = null;
  private openIntakeButtonMobile: HTMLButtonElement | null = null;

  constructor() {
    super('client-landing');
  }

  protected override async onInit(): Promise<void> {
    console.log('[ClientLandingModule] Initializing...');

    // Check if user is already logged in and redirect to portal
    if (this.isLoggedIn()) {
      console.log('[ClientLandingModule] User already logged in, redirecting to portal...');
      window.location.href = '/client/portal';
      return;
    }

    this.cacheElements();
    this.setupLoginForm();
    this.setupPasswordToggle();
    this.setupIntakeModal();
    console.log('[ClientLandingModule] Initialization complete');
  }

  /**
   * Check if user is already logged in by checking sessionStorage
   */
  private isLoggedIn(): boolean {
    const clientAuth = sessionStorage.getItem('clientAuth');

    // Check if we have auth data
    if (clientAuth) {
      try {
        const authData = JSON.parse(clientAuth);
        // Check if the session is still valid (optional: add expiration check)
        if (authData.email && authData.loginTime) {
          // Session is valid - we have both clientAuth and optionally a token
          return true;
        }
      } catch {
        // Invalid JSON, clear it
        sessionStorage.removeItem('clientAuth');
        sessionStorage.removeItem('client_auth_token');
      }
    }

    // Also check for the token stored by client-portal.ts
    const portalToken = sessionStorage.getItem('client_auth_token');
    if (portalToken && !portalToken.startsWith('demo_token_')) {
      return true;
    }

    return false;
  }

  protected override async onDestroy(): Promise<void> {
    // Cleanup event listeners if needed
  }

  private cacheElements(): void {
    // Desktop elements
    this.loginForm = document.getElementById('loginForm') as HTMLFormElement;
    this.emailInput = document.getElementById('login-email') as HTMLInputElement;
    this.passwordInput = document.getElementById('login-password') as HTMLInputElement;
    this.passwordToggle = document.querySelector(
      '.desktop-login-form .password-toggle'
    ) as HTMLButtonElement;
    this.loginError = document.getElementById('loginError') as HTMLElement;
    this.submitButton = this.loginForm?.querySelector('button[type="submit"]') as HTMLButtonElement;
    this.openIntakeButton = document.getElementById('openIntakeModal') as HTMLButtonElement;
    this.intakeModal = document.getElementById('intakeModal') as HTMLElement;

    // Mobile elements
    this.loginFormMobile = document.getElementById('loginFormMobile') as HTMLFormElement;
    this.emailInputMobile = document.getElementById('login-email-mobile') as HTMLInputElement;
    this.passwordInputMobile = document.getElementById('login-password-mobile') as HTMLInputElement;
    this.loginErrorMobile = document.getElementById('loginErrorMobile') as HTMLElement;
    this.openIntakeButtonMobile = document.getElementById(
      'openIntakeModalMobile'
    ) as HTMLButtonElement;

    console.log('[ClientLandingModule] Elements cached:', {
      loginForm: !!this.loginForm,
      emailInput: !!this.emailInput,
      passwordInput: !!this.passwordInput,
      passwordToggle: !!this.passwordToggle,
      loginError: !!this.loginError,
      submitButton: !!this.submitButton,
      openIntakeButton: !!this.openIntakeButton,
      intakeModal: !!this.intakeModal
    });
  }

  private setupLoginForm(): void {
    // Desktop form
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[ClientLandingModule] Desktop login form submitted');
        await this.handleLogin();
      });
    }

    // Mobile form
    if (this.loginFormMobile) {
      this.loginFormMobile.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[ClientLandingModule] Mobile login form submitted');
        await this.handleLoginMobile();
      });

      // Setup mobile password toggle
      const mobilePasswordToggle = this.loginFormMobile.querySelector(
        '.password-toggle'
      ) as HTMLButtonElement;
      if (mobilePasswordToggle && this.passwordInputMobile) {
        mobilePasswordToggle.addEventListener('click', () => {
          const isPassword = this.passwordInputMobile!.type === 'password';
          this.passwordInputMobile!.type = isPassword ? 'text' : 'password';
          const svg = mobilePasswordToggle.querySelector('svg');
          if (svg) {
            if (isPassword) {
              svg.innerHTML =
                '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
            } else {
              svg.innerHTML =
                '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
          }
        });
      }
    }
  }

  private setupPasswordToggle(): void {
    if (!this.passwordToggle || !this.passwordInput) {
      console.warn('[ClientLandingModule] Password toggle elements not found');
      return;
    }

    this.passwordToggle.addEventListener('click', () => {
      console.log('[ClientLandingModule] Password toggle clicked');
      const isPassword = this.passwordInput!.type === 'password';
      this.passwordInput!.type = isPassword ? 'text' : 'password';

      // Update the icon (swap between eye and eye-off)
      const svg = this.passwordToggle!.querySelector('svg');
      if (svg) {
        if (isPassword) {
          // Show "eye-off" icon when password is visible
          svg.innerHTML =
            '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
          // Show "eye" icon when password is hidden
          svg.innerHTML =
            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
      }
    });
  }

  private setupIntakeModal(): void {
    if (!this.intakeModal) {
      console.warn('[ClientLandingModule] Intake modal not found');
      return;
    }

    // Open modal when desktop button is clicked
    if (this.openIntakeButton) {
      this.openIntakeButton.addEventListener('click', () => {
        console.log('[ClientLandingModule] Opening intake modal (desktop)');
        this.openIntakeModalWithAnimation();
      });
    }

    // Open modal when mobile button is clicked
    if (this.openIntakeButtonMobile) {
      this.openIntakeButtonMobile.addEventListener('click', () => {
        console.log('[ClientLandingModule] Opening intake modal (mobile)');
        this.openIntakeModalWithAnimation();
      });
    }

    // Close modal when clicking outside content
    this.intakeModal.addEventListener('click', (e) => {
      if (e.target === this.intakeModal) {
        this.closeIntakeModal();
      }
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.intakeModal?.classList.contains('open')) {
        this.closeIntakeModal();
      }
    });
  }

  private openIntakeModalWithAnimation(): void {
    if (!this.intakeModal) return;

    const modalContent = this.intakeModal.querySelector('.intake-modal-content') as HTMLElement;

    // Show modal (display: flex)
    this.intakeModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Reset styles for animation
    gsap.set(this.intakeModal, { background: 'rgba(0, 0, 0, 0)' });
    gsap.set(modalContent, { maxWidth: '200px', opacity: 0.8 });

    // Create timeline for smooth sequential animation
    const tl = gsap.timeline();

    // First: expand the terminal width
    tl.to(modalContent, {
      maxWidth: '900px',
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out'
    });

    // Then: fade in the overlay
    tl.to(
      this.intakeModal,
      {
        background: 'rgba(0, 0, 0, 0.8)',
        duration: 0.3,
        ease: 'power2.inOut'
      },
      '+=0.1'
    ); // Small delay after expansion

    // Initialize terminal intake
    this.initTerminalIntake();
  }

  private closeIntakeModal(): void {
    if (this.intakeModal) {
      console.log('[ClientLandingModule] Closing intake modal');

      const modalContent = this.intakeModal.querySelector('.intake-modal-content') as HTMLElement;
      const container = this.intakeModal.querySelector('.terminal-intake-container');

      // Animate out
      const tl = gsap.timeline({
        onComplete: () => {
          this.intakeModal!.classList.remove('open');
          this.intakeModal!.classList.remove('minimized');
          this.intakeModal!.classList.remove('fullscreen');
          document.body.style.overflow = '';

          // Reset the container so it can be re-initialized with resume prompt
          if (container) {
            container.removeAttribute('data-initialized');
            container.innerHTML = '';
          }
        }
      });

      tl.to(this.intakeModal, {
        background: 'rgba(0, 0, 0, 0)',
        duration: 0.2,
        ease: 'power2.in'
      });

      tl.to(
        modalContent,
        {
          maxWidth: '200px',
          opacity: 0,
          duration: 0.2,
          ease: 'power2.in'
        },
        '-=0.1'
      );
    }
  }

  private async initTerminalIntake(): Promise<void> {
    const container = this.intakeModal?.querySelector('.terminal-intake-container');
    if (!container || container.hasAttribute('data-initialized')) {
      return;
    }

    try {
      const { TerminalIntakeModule } = await import('./terminal-intake');
      const module = new TerminalIntakeModule(container as HTMLElement);
      await module.init();
      container.setAttribute('data-initialized', 'true');

      // Setup terminal window button handlers
      this.setupTerminalButtons();
    } catch (error) {
      console.error('[ClientLandingModule] Failed to initialize terminal intake:', error);
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #ff4444;">
          <h2>Unable to load intake form</h2>
          <p>Please try refreshing the page or contact ${getContactEmail('fallback')}</p>
        </div>
      `;
    }
  }

  private setupTerminalButtons(): void {
    if (!this.intakeModal) return;

    const closeBtn = this.intakeModal.querySelector('.terminal-btn.close');
    const minimizeBtn = this.intakeModal.querySelector('.terminal-btn.minimize');
    const maximizeBtn = this.intakeModal.querySelector('.terminal-btn.maximize');
    const modalContent = this.intakeModal.querySelector('.intake-modal-content');

    // Close button - close the modal
    closeBtn?.addEventListener('click', () => {
      this.closeIntakeModal();
    });

    // Minimize button - shrink to bottom of screen
    minimizeBtn?.addEventListener('click', () => {
      this.intakeModal?.classList.toggle('minimized');
      this.intakeModal?.classList.remove('fullscreen');
    });

    // Maximize button - fullscreen
    maximizeBtn?.addEventListener('click', () => {
      this.intakeModal?.classList.toggle('fullscreen');
      this.intakeModal?.classList.remove('minimized');
    });

    // Click on minimized modal content to restore
    modalContent?.addEventListener('click', (e) => {
      if (this.intakeModal?.classList.contains('minimized')) {
        // Only restore if clicking on the header area (not the buttons)
        const target = e.target as HTMLElement;
        if (!target.closest('.terminal-btn')) {
          this.intakeModal.classList.remove('minimized');
        }
      }
    });
  }

  private async handleLogin(): Promise<void> {
    // Clear previous errors
    this.clearError();

    const email = this.emailInput?.value.trim() || '';
    const password = this.passwordInput?.value || '';

    // Basic validation
    if (!email || !password) {
      this.showError('Please enter both email and password');
      return;
    }

    // Show loading state
    this.setLoading(true);

    try {
      // Check for demo credentials
      if (email === this.DEMO_EMAIL && password === this.DEMO_PASSWORD) {
        console.log('[ClientLandingModule] Demo login successful');
        // Store demo session
        sessionStorage.setItem(
          'clientAuth',
          JSON.stringify({
            email: this.DEMO_EMAIL,
            name: 'Demo User',
            isDemo: true,
            loginTime: Date.now()
          })
        );

        // Redirect to portal
        window.location.href = '/client/portal';
        return;
      }

      // Try actual API login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('[ClientLandingModule] Login successful');
        // Store auth token (use 'client_auth_token' to match client-portal.ts)
        if (result.token) {
          sessionStorage.setItem('client_auth_token', result.token);
        }
        sessionStorage.setItem(
          'clientAuth',
          JSON.stringify({
            email: result.user?.email || email,
            name: result.user?.name || result.user?.contactName || 'Client',
            isDemo: false,
            isAdmin: result.user?.isAdmin || false,
            loginTime: Date.now()
          })
        );

        // Redirect to admin portal if admin, otherwise client portal
        if (result.user?.isAdmin) {
          window.location.href = '/admin';
        } else {
          window.location.href = '/client/portal';
        }
      } else {
        this.showError(result.error || 'Invalid email or password');
      }
    } catch (error) {
      console.error('[ClientLandingModule] Login error:', error);
      // If API fails, check for demo credentials as fallback
      if (email === this.DEMO_EMAIL && password === this.DEMO_PASSWORD) {
        sessionStorage.setItem(
          'clientAuth',
          JSON.stringify({
            email: this.DEMO_EMAIL,
            name: 'Demo User',
            isDemo: true,
            loginTime: Date.now()
          })
        );
        window.location.href = '/client/portal';
        return;
      }
      this.showError('Login failed. Please check your credentials and try again.');
    } finally {
      this.setLoading(false);
    }
  }

  private async handleLoginMobile(): Promise<void> {
    // Clear previous errors
    this.clearErrorMobile();

    const email = this.emailInputMobile?.value.trim() || '';
    const password = this.passwordInputMobile?.value || '';

    // Basic validation
    if (!email || !password) {
      this.showErrorMobile('Please enter both email and password');
      return;
    }

    // Show loading state
    this.setLoadingMobile(true);

    try {
      // Check for demo credentials
      if (email === this.DEMO_EMAIL && password === this.DEMO_PASSWORD) {
        console.log('[ClientLandingModule] Demo login successful (mobile)');
        sessionStorage.setItem(
          'clientAuth',
          JSON.stringify({
            email: this.DEMO_EMAIL,
            name: 'Demo User',
            isDemo: true,
            loginTime: Date.now()
          })
        );
        window.location.href = '/client/portal';
        return;
      }

      // Try actual API login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('[ClientLandingModule] Login successful (mobile)');
        if (result.token) {
          sessionStorage.setItem('client_auth_token', result.token);
        }
        sessionStorage.setItem(
          'clientAuth',
          JSON.stringify({
            email: result.user?.email || email,
            name: result.user?.name || 'Client',
            isDemo: false,
            isAdmin: result.user?.isAdmin || false,
            loginTime: Date.now()
          })
        );
        // Redirect to admin portal if admin, otherwise client portal
        if (result.user?.isAdmin) {
          window.location.href = '/admin';
        } else {
          window.location.href = '/client/portal';
        }
      } else {
        this.showErrorMobile(result.error || 'Invalid email or password');
      }
    } catch (error) {
      console.error('[ClientLandingModule] Login error (mobile):', error);
      if (email === this.DEMO_EMAIL && password === this.DEMO_PASSWORD) {
        sessionStorage.setItem(
          'clientAuth',
          JSON.stringify({
            email: this.DEMO_EMAIL,
            name: 'Demo User',
            isDemo: true,
            loginTime: Date.now()
          })
        );
        window.location.href = '/client/portal';
        return;
      }
      this.showErrorMobile('Login failed. Please check your credentials.');
    } finally {
      this.setLoadingMobile(false);
    }
  }

  private showError(message: string): void {
    if (this.loginError) {
      this.loginError.textContent = message;
      this.loginError.style.display = 'block';
    }
  }

  private showErrorMobile(message: string): void {
    if (this.loginErrorMobile) {
      this.loginErrorMobile.textContent = message;
      this.loginErrorMobile.style.display = 'block';
    }
  }

  private clearError(): void {
    if (this.loginError) {
      this.loginError.textContent = '';
      this.loginError.style.display = 'none';
    }
  }

  private clearErrorMobile(): void {
    if (this.loginErrorMobile) {
      this.loginErrorMobile.textContent = '';
      this.loginErrorMobile.style.display = 'none';
    }
  }

  private setLoading(loading: boolean): void {
    if (this.submitButton) {
      const btnText = this.submitButton.querySelector('.btn-text');
      const btnLoader = this.submitButton.querySelector('.btn-loader');

      if (loading) {
        this.submitButton.disabled = true;
        if (btnText) (btnText as HTMLElement).style.opacity = '0';
        if (btnLoader) (btnLoader as HTMLElement).style.display = 'block';
      } else {
        this.submitButton.disabled = false;
        if (btnText) (btnText as HTMLElement).style.opacity = '1';
        if (btnLoader) (btnLoader as HTMLElement).style.display = 'none';
      }
    }
  }

  private setLoadingMobile(loading: boolean): void {
    const submitBtn = this.loginFormMobile?.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    if (submitBtn) {
      const btnText = submitBtn.querySelector('.btn-text');
      const btnLoader = submitBtn.querySelector('.btn-loader');

      if (loading) {
        submitBtn.disabled = true;
        if (btnText) (btnText as HTMLElement).style.opacity = '0';
        if (btnLoader) (btnLoader as HTMLElement).style.display = 'block';
      } else {
        submitBtn.disabled = false;
        if (btnText) (btnText as HTMLElement).style.opacity = '1';
        if (btnLoader) (btnLoader as HTMLElement).style.display = 'none';
      }
    }
  }
}
