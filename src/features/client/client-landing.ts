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

export class ClientLandingModule extends BaseModule {
  // Demo credentials for testing
  private readonly DEMO_EMAIL = 'demo@example.com';
  private readonly DEMO_PASSWORD = 'nobhadDemo123';

  // DOM elements
  private loginForm: HTMLFormElement | null = null;
  private emailInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private passwordToggle: HTMLButtonElement | null = null;
  private loginError: HTMLElement | null = null;
  private submitButton: HTMLButtonElement | null = null;
  private openIntakeButton: HTMLButtonElement | null = null;
  private intakeModal: HTMLElement | null = null;

  constructor() {
    super('client-landing');
  }

  protected override async onInit(): Promise<void> {
    console.log('[ClientLandingModule] Initializing...');
    this.cacheElements();
    this.setupLoginForm();
    this.setupPasswordToggle();
    this.setupIntakeModal();
    console.log('[ClientLandingModule] Initialization complete');
  }

  protected override async onDestroy(): Promise<void> {
    // Cleanup event listeners if needed
  }

  private cacheElements(): void {
    this.loginForm = document.getElementById('loginForm') as HTMLFormElement;
    this.emailInput = document.getElementById('login-email') as HTMLInputElement;
    this.passwordInput = document.getElementById('login-password') as HTMLInputElement;
    this.passwordToggle = document.querySelector('.password-toggle') as HTMLButtonElement;
    this.loginError = document.getElementById('loginError') as HTMLElement;
    this.submitButton = this.loginForm?.querySelector('button[type="submit"]') as HTMLButtonElement;
    this.openIntakeButton = document.getElementById('openIntakeModal') as HTMLButtonElement;
    this.intakeModal = document.getElementById('intakeModal') as HTMLElement;

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
    if (!this.loginForm) {
      console.warn('[ClientLandingModule] Login form not found');
      return;
    }

    this.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('[ClientLandingModule] Login form submitted');
      await this.handleLogin();
    });
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
          svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
          // Show "eye" icon when password is hidden
          svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
      }
    });
  }

  private setupIntakeModal(): void {
    if (!this.openIntakeButton || !this.intakeModal) {
      console.warn('[ClientLandingModule] Intake modal elements not found');
      return;
    }

    // Open modal when button is clicked
    this.openIntakeButton.addEventListener('click', () => {
      console.log('[ClientLandingModule] Opening intake modal');
      this.intakeModal!.classList.add('open');
      document.body.style.overflow = 'hidden';

      // Initialize terminal intake if not already done
      this.initTerminalIntake();
    });

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

  private closeIntakeModal(): void {
    if (this.intakeModal) {
      console.log('[ClientLandingModule] Closing intake modal');
      this.intakeModal.classList.remove('open');
      document.body.style.overflow = '';
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
    } catch (error) {
      console.error('[ClientLandingModule] Failed to initialize terminal intake:', error);
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #ff4444;">
          <h2>Unable to load intake form</h2>
          <p>Please try refreshing the page or contact hello@nobhadcodes.com</p>
        </div>
      `;
    }
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
        localStorage.setItem('clientAuth', JSON.stringify({
          email: this.DEMO_EMAIL,
          name: 'Demo User',
          isDemo: true,
          loginTime: Date.now()
        }));

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
        // Store auth token
        if (result.token) {
          localStorage.setItem('clientAuthToken', result.token);
        }
        localStorage.setItem('clientAuth', JSON.stringify({
          email: result.user?.email || email,
          name: result.user?.name || 'Client',
          isDemo: false,
          loginTime: Date.now()
        }));

        // Redirect to portal
        window.location.href = '/client/portal';
      } else {
        this.showError(result.error || 'Invalid email or password');
      }
    } catch (error) {
      console.error('[ClientLandingModule] Login error:', error);
      // If API fails, check for demo credentials as fallback
      if (email === this.DEMO_EMAIL && password === this.DEMO_PASSWORD) {
        localStorage.setItem('clientAuth', JSON.stringify({
          email: this.DEMO_EMAIL,
          name: 'Demo User',
          isDemo: true,
          loginTime: Date.now()
        }));
        window.location.href = '/client/portal';
        return;
      }
      this.showError('Login failed. Please check your credentials and try again.');
    } finally {
      this.setLoading(false);
    }
  }

  private showError(message: string): void {
    if (this.loginError) {
      this.loginError.textContent = message;
      this.loginError.style.display = 'block';
    }
  }

  private clearError(): void {
    if (this.loginError) {
      this.loginError.textContent = '';
      this.loginError.style.display = 'none';
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
}
