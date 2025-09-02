/**
 * ===============================================
 * ADMIN SECURITY CONFIGURATION
 * ===============================================
 * @file src/admin/admin-security.ts
 *
 * Additional security measures for the admin dashboard.
 */

export class AdminSecurity {
  private static readonly MAX_LOGIN_ATTEMPTS = 3;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly ATTEMPT_STORAGE_KEY = 'nbw_admin_attempts';

  static checkRateLimit(): boolean {
    try {
      const attemptsData = localStorage.getItem(this.ATTEMPT_STORAGE_KEY);
      if (!attemptsData) return true;

      const attempts = JSON.parse(attemptsData);
      const now = Date.now();

      // Clean old attempts
      attempts.timestamps = attempts.timestamps.filter(
        (timestamp: number) => now - timestamp < this.LOCKOUT_DURATION
      );

      // Check if locked out
      if (attempts.timestamps.length >= this.MAX_LOGIN_ATTEMPTS) {
        const oldestAttempt = Math.min(...attempts.timestamps);
        const timeUntilUnlock = this.LOCKOUT_DURATION - (now - oldestAttempt);

        if (timeUntilUnlock > 0) {
          throw new Error(`Too many failed attempts. Try again in ${Math.ceil(timeUntilUnlock / 60000)} minutes.`);
        }
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      return true;
    }
  }

  static recordFailedAttempt(): void {
    try {
      const attemptsData = localStorage.getItem(this.ATTEMPT_STORAGE_KEY);
      const attempts = attemptsData ? JSON.parse(attemptsData) : { timestamps: [] };

      attempts.timestamps.push(Date.now());
      localStorage.setItem(this.ATTEMPT_STORAGE_KEY, JSON.stringify(attempts));
    } catch (error) {
      console.error('[AdminSecurity] Error recording failed attempt:', error);
    }
  }

  static clearAttempts(): void {
    try {
      localStorage.removeItem(this.ATTEMPT_STORAGE_KEY);
    } catch (error) {
      console.error('[AdminSecurity] Error clearing attempts:', error);
    }
  }

  static enableCSPReporting(): void {
    // Add CSP violation reporting
    document.addEventListener('securitypolicyviolation', (e) => {
      console.warn('[AdminSecurity] CSP Violation:', {
        directive: e.violatedDirective,
        blocked: e.blockedURI,
        source: e.sourceFile,
        line: e.lineNumber
      });
    });
  }

  static detectDevTools(): boolean {
    // Simple dev tools detection (not foolproof but adds a layer)
    const devtools = {
      open: false,
      orientation: null as string | null
    };

    const threshold = 160;
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold ||
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          console.warn('[AdminSecurity] Developer tools detected');
        }
      } else {
        devtools.open = false;
      }
    }, 500);

    return devtools.open;
  }

  static obfuscateConsole(): void {
    // Obfuscate console output in production
    if (process.env.NODE_ENV === 'production') {
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = () => {};
      console.warn = () => {};
      console.error = (...args) => {
        // Still allow error logging for debugging
        originalError.apply(console, args);
      };
    }
  }

  static validateReferrer(): boolean {
    // Check if accessed from expected domain
    const referrer = document.referrer;
    const currentHost = window.location.host;

    // Allow direct access (empty referrer) or same-origin
    if (!referrer || referrer.includes(currentHost)) {
      return true;
    }

    console.warn('[AdminSecurity] Suspicious referrer:', referrer);
    return false;
  }

  static setupIntegrityCheck(): void {
    // Basic integrity check for critical elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Check for suspicious script injections
              if (element.tagName === 'SCRIPT' ||
                  element.innerHTML?.includes('<script>')) {
                console.warn('[AdminSecurity] Suspicious script detected');
                element.remove();
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  static init(): void {
    try {
      this.enableCSPReporting();
      this.detectDevTools();
      this.obfuscateConsole();
      this.setupIntegrityCheck();

      if (!this.validateReferrer()) {
        console.warn('[AdminSecurity] Referrer validation failed');
      }
    } catch (error) {
      console.error('[AdminSecurity] Error initializing security:', error);
    }
  }
}