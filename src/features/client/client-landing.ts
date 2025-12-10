/**
 * ===============================================
 * CLIENT LANDING MODULE
 * ===============================================
 * @file src/features/client/client-landing.ts
 *
 * Handles client landing page functionality including:
 * - Login form submission and validation
 * - Auth method toggle (Password / Magic Link)
 * - Password visibility toggle
 * - Intake modal opening
 */

import { BaseModule } from '../../modules/base';
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

  // DOM elements - Auth container
  private authToggleBtns: NodeListOf<HTMLButtonElement> | null = null;
  private loginForm: HTMLFormElement | null = null;
  private magicLinkForm: HTMLFormElement | null = null;
  private emailInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private passwordToggle: HTMLButtonElement | null = null;
  private loginError: HTMLElement | null = null;
  private magicLinkEmailInput: HTMLInputElement | null = null;
  private magicLinkError: HTMLElement | null = null;
  private openIntakeButton: HTMLButtonElement | null = null;
  private intakeModal: HTMLElement | null = null;

  constructor() {
    super('client-landing');
  }

  protected override async onInit(): Promise<void> {
    console.log('[ClientLandingModule] Initializing on path:', window.location.pathname);

    // Check if user is already logged in and redirect to portal
    if (this.isLoggedIn()) {
      console.log('[ClientLandingModule] User already logged in, redirecting to portal...');
      window.location.href = '/client/portal';
      return;
    }

    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      await new Promise<void>((resolve) => {
        document.addEventListener('DOMContentLoaded', () => resolve());
      });
    }

    this.cacheElements();
    this.setupAuthToggle();
    this.setupLoginForm();
    this.setupMagicLinkForm();
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
    // Auth toggle buttons
    this.authToggleBtns = document.querySelectorAll('.auth-toggle-btn');

    // Password login form elements
    this.loginForm = document.getElementById('loginForm') as HTMLFormElement;
    this.emailInput = document.getElementById('login-email') as HTMLInputElement;
    this.passwordInput = document.getElementById('login-password') as HTMLInputElement;
    this.passwordToggle = document.querySelector('.password-toggle') as HTMLButtonElement;
    this.loginError = document.getElementById('loginError') as HTMLElement;

    // Magic link form elements
    this.magicLinkForm = document.getElementById('magicLinkForm') as HTMLFormElement;
    this.magicLinkEmailInput = document.getElementById('magic-link-email') as HTMLInputElement;
    this.magicLinkError = document.getElementById('magicLinkError') as HTMLElement;

    // Intake modal elements
    this.openIntakeButton = document.getElementById('openIntakeModal') as HTMLButtonElement;
    this.intakeModal = document.getElementById('intakeModal') as HTMLElement;

    console.log('[ClientLandingModule] Elements cached:', {
      authToggleBtns: this.authToggleBtns?.length || 0,
      loginForm: !!this.loginForm,
      emailInput: !!this.emailInput,
      passwordInput: !!this.passwordInput,
      passwordToggle: !!this.passwordToggle,
      magicLinkForm: !!this.magicLinkForm,
      openIntakeButton: !!this.openIntakeButton,
      intakeModal: !!this.intakeModal
    });
  }

  /**
   * Setup auth method toggle (Password / Magic Link)
   */
  private setupAuthToggle(): void {
    if (!this.authToggleBtns || this.authToggleBtns.length === 0) {
      console.warn('[ClientLandingModule] Auth toggle buttons not found');
      return;
    }

    this.authToggleBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const method = btn.dataset.authMethod;
        console.log('[ClientLandingModule] Auth method toggled to:', method);

        // Update active state on buttons
        this.authToggleBtns?.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Show/hide forms based on selected method
        if (method === 'password') {
          if (this.loginForm) this.loginForm.style.display = 'flex';
          if (this.magicLinkForm) this.magicLinkForm.style.display = 'none';
        } else if (method === 'magic-link') {
          if (this.loginForm) this.loginForm.style.display = 'none';
          if (this.magicLinkForm) this.magicLinkForm.style.display = 'flex';
        }

        // Clear any previous errors
        this.clearError();
        this.clearMagicLinkError();
      });
    });
  }

  private setupLoginForm(): void {
    if (!this.loginForm) {
      console.warn('[ClientLandingModule] Login form not found');
      return;
    }

    this.loginForm.addEventListener('submit', async (e: Event) => {
      e.preventDefault();
      console.log('[ClientLandingModule] Login form submitted');
      await this.handleLogin();
    });
  }

  private setupMagicLinkForm(): void {
    if (!this.magicLinkForm) {
      console.warn('[ClientLandingModule] Magic link form not found');
      return;
    }

    this.magicLinkForm.addEventListener('submit', async (e: Event) => {
      e.preventDefault();
      console.log('[ClientLandingModule] Magic link form submitted');
      await this.handleMagicLinkRequest();
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

      // Toggle the showing class for icon visibility
      this.passwordToggle!.classList.toggle('showing', isPassword);
    });
  }

  private setupIntakeModal(): void {
    if (!this.intakeModal) {
      console.warn('[ClientLandingModule] Intake modal not found');
      return;
    }

    // Open modal when button is clicked
    if (this.openIntakeButton) {
      this.openIntakeButton.addEventListener('click', () => {
        console.log('[ClientLandingModule] Opening intake modal');
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

  private async handleMagicLinkRequest(): Promise<void> {
    const email = this.magicLinkEmailInput?.value.trim() || '';

    // Clear previous errors
    this.clearMagicLinkError();

    // Validate email
    if (!email) {
      this.showMagicLinkError('Please enter your email address');
      this.magicLinkEmailInput?.focus();
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showMagicLinkError('Please enter a valid email address');
      return;
    }

    // Show loading state
    const submitBtn = this.magicLinkForm?.querySelector('button[type="submit"]') as HTMLButtonElement;
    this.setButtonLoading(submitBtn, true, 'Sending...');

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      // Always show success message for security (don't reveal if email exists)
      this.showMagicLinkSuccess(
        result.message || 'If an account exists, a login link has been sent to your email.'
      );
    } catch (error) {
      console.error('[ClientLandingModule] Magic link request error:', error);
      this.showMagicLinkError('Unable to send magic link. Please try again.');
    } finally {
      this.setButtonLoading(submitBtn, false, 'Send Magic Link');
    }
  }

  private async openIntakeModalWithAnimation(): Promise<void> {
    if (!this.intakeModal) return;

    // Pre-render terminal content (sync) before showing modal
    await this.preRenderTerminalIntake();

    // Show modal - content is already rendered, appears instantly
    this.intakeModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Start terminal animations after modal is visible
    this.startTerminalAnimations();
  }

  private closeIntakeModal(): void {
    if (this.intakeModal) {
      console.log('[ClientLandingModule] Closing intake modal');

      const container = this.intakeModal.querySelector('.terminal-intake-container');

      // Close immediately - just toggle class
      this.intakeModal.classList.remove('open');
      this.intakeModal.classList.remove('minimized');
      this.intakeModal.classList.remove('fullscreen');
      document.body.style.overflow = '';

      // Reset the container so it can be re-initialized with resume prompt
      if (container) {
        container.removeAttribute('data-initialized');
        container.innerHTML = '';
      }
    }
  }

  // Store terminal module instance for split init
  private terminalModule: InstanceType<typeof import('./terminal-intake').TerminalIntakeModule> | null = null;

  private async preRenderTerminalIntake(): Promise<void> {
    const container = this.intakeModal?.querySelector('.terminal-intake-container');
    if (!container || container.hasAttribute('data-initialized')) {
      return;
    }

    try {
      const { TerminalIntakeModule } = await import('./terminal-intake');
      this.terminalModule = new TerminalIntakeModule(container as HTMLElement);
      // Only render HTML - don't start animations yet
      this.terminalModule.renderOnly();
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

  private startTerminalAnimations(): void {
    // Start the terminal conversation animations after modal is visible
    if (this.terminalModule) {
      this.terminalModule.startAnimations();
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
    const submitBtn = this.loginForm?.querySelector('button[type="submit"]') as HTMLButtonElement;
    this.setButtonLoading(submitBtn, true);

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
      this.setButtonLoading(submitBtn, false);
    }
  }

  private showError(message: string): void {
    if (this.loginError) {
      this.loginError.textContent = message;
      this.loginError.style.display = 'block';
      this.loginError.style.color = '';
    }
  }

  private clearError(): void {
    if (this.loginError) {
      this.loginError.textContent = '';
      this.loginError.style.display = 'none';
    }
  }

  private showMagicLinkError(message: string): void {
    if (this.magicLinkError) {
      this.magicLinkError.textContent = message;
      this.magicLinkError.style.display = 'block';
      this.magicLinkError.style.color = 'var(--color-error, #ef4444)';
    }
  }

  private showMagicLinkSuccess(message: string): void {
    if (this.magicLinkError) {
      this.magicLinkError.textContent = message;
      this.magicLinkError.style.display = 'block';
      this.magicLinkError.style.color = 'var(--color-success, #22c55e)';
    }
  }

  private clearMagicLinkError(): void {
    if (this.magicLinkError) {
      this.magicLinkError.textContent = '';
      this.magicLinkError.style.display = 'none';
    }
  }

  private setButtonLoading(button: HTMLButtonElement | null, loading: boolean, loadingText?: string): void {
    if (!button) return;

    const btnText = button.querySelector('.btn-text');

    if (loading) {
      button.disabled = true;
      button.classList.add('loading');
      if (btnText && loadingText) {
        (btnText as HTMLElement).dataset.originalText = (btnText as HTMLElement).textContent || '';
        (btnText as HTMLElement).textContent = loadingText;
      }
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      if (btnText) {
        const originalText = (btnText as HTMLElement).dataset.originalText;
        if (originalText) {
          (btnText as HTMLElement).textContent = originalText;
        }
      }
    }
  }
}
