/**
 * ===============================================
 * ADMIN SECURITY CONFIGURATION
 * ===============================================
 * @file src/features/admin/admin-security.ts
 *
 * Client-side security enhancements for the admin dashboard.
 *
 * ⚠️  IMPORTANT SECURITY LIMITATIONS:
 *
 * This module provides UX enhancements and defense-in-depth measures,
 * NOT primary security controls. All measures here can be bypassed
 * by a determined attacker with browser dev tools.
 *
 * ACTUAL SECURITY is provided by:
 * - Server-side authentication (JWT in HttpOnly cookies)
 * - Server-side rate limiting (Redis/in-memory by IP)
 * - Server-side input validation
 * - HTTPS encryption
 * - CSP headers (server-configured)
 *
 * What this module does:
 * - Rate limiting UI (shows lockout message after 3 failed attempts)
 * - CSP violation monitoring (reports violations for debugging)
 * - DevTools detection (UX only - can be bypassed)
 * - DOM integrity monitoring (basic XSS detection)
 *
 * DO NOT rely on any of these measures for actual security.
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminSecurity');

export class AdminSecurity {
  private static readonly MAX_LOGIN_ATTEMPTS = 3;
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly ATTEMPT_STORAGE_KEY = 'nbw_admin_attempts';
  private static devToolsIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Check if the user is rate limited (client-side UX only)
   *
   * NOTE: This is trivially bypassed by clearing localStorage.
   * Real rate limiting must be implemented server-side.
   */
  static checkRateLimit(): boolean {
    try {
      const attemptsData = localStorage.getItem(this.ATTEMPT_STORAGE_KEY);
      if (!attemptsData) return true;

      const attempts = JSON.parse(attemptsData);
      const now = Date.now();

      // Clean old attempts
      attempts.timestamps = attempts.timestamps.filter(
        (timestamp: number) => now - timestamp < this.LOCKOUT_DURATION_MS
      );

      // Check if locked out
      if (attempts.timestamps.length >= this.MAX_LOGIN_ATTEMPTS) {
        const oldestAttempt = Math.min(...attempts.timestamps);
        const timeUntilUnlock = this.LOCKOUT_DURATION_MS - (now - oldestAttempt);

        if (timeUntilUnlock > 0) {
          throw new Error(
            `Too many failed attempts. Try again in ${Math.ceil(timeUntilUnlock / 60000)} minutes.`
          );
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

  /**
   * Record a failed login attempt (client-side UX only)
   */
  static recordFailedAttempt(): void {
    try {
      const attemptsData = localStorage.getItem(this.ATTEMPT_STORAGE_KEY);
      const attempts = attemptsData ? JSON.parse(attemptsData) : { timestamps: [] };

      attempts.timestamps.push(Date.now());
      localStorage.setItem(this.ATTEMPT_STORAGE_KEY, JSON.stringify(attempts));
    } catch (error) {
      logger.error('Error recording failed attempt:', error);
    }
  }

  /**
   * Clear failed login attempts (after successful login)
   */
  static clearAttempts(): void {
    try {
      localStorage.removeItem(this.ATTEMPT_STORAGE_KEY);
    } catch (error) {
      logger.error('Error clearing attempts:', error);
    }
  }

  /**
   * Enable CSP violation reporting for debugging
   * Logs violations to help identify CSP issues
   */
  static enableCSPReporting(): void {
    document.addEventListener('securitypolicyviolation', (e) => {
      logger.warn('CSP Violation:', {
        directive: e.violatedDirective,
        blocked: e.blockedURI,
        source: e.sourceFile,
        line: e.lineNumber
      });
    });
  }

  /**
   * Detect if DevTools are open (UX only - easily bypassed)
   *
   * NOTE: This detection is NOT reliable and should NOT be used
   * for actual security. It's kept for UX/analytics purposes only.
   *
   * Returns cleanup function to stop detection.
   */
  static detectDevTools(): () => void {
    // Only run in production - dev tools detection in development is noise
    if (process.env.NODE_ENV !== 'production') {
      return () => {}; // No-op cleanup
    }

    const devtools = {
      open: false,
      orientation: null as string | null
    };

    const DEVTOOLS_THRESHOLD_PX = 160;
    const CHECK_INTERVAL_MS = 500;

    // Clear any existing interval
    if (this.devToolsIntervalId) {
      clearInterval(this.devToolsIntervalId);
    }

    this.devToolsIntervalId = setInterval(() => {
      if (
        window.outerHeight - window.innerHeight > DEVTOOLS_THRESHOLD_PX ||
        window.outerWidth - window.innerWidth > DEVTOOLS_THRESHOLD_PX
      ) {
        if (!devtools.open) {
          devtools.open = true;
          // Silent detection - no logging to avoid console noise
        }
      } else {
        devtools.open = false;
      }
    }, CHECK_INTERVAL_MS);

    // Return cleanup function
    return () => {
      if (this.devToolsIntervalId) {
        clearInterval(this.devToolsIntervalId);
        this.devToolsIntervalId = null;
      }
    };
  }

  /**
   * Suppress console output in production
   *
   * NOTE: This is NOT a security measure - it's for cleaner production logs.
   * All sensitive data should be handled server-side, not hidden client-side.
   */
  static obfuscateConsole(): void {
    if (process.env.NODE_ENV === 'production') {
      // Store original functions for error logging
      const originalError = console.error;

      // Suppress log and warn in production
      console.log = () => {};
      console.warn = () => {};

      // Keep error logging for debugging critical issues
      console.error = (...args: unknown[]) => {
        originalError.apply(console, args);
      };
    }
  }

  /**
   * Validate referrer header (basic check - easily bypassed)
   *
   * NOTE: Not a security control - referrer can be spoofed.
   * Used for basic analytics/monitoring only.
   */
  static validateReferrer(): boolean {
    const { referrer } = document;
    const currentHost = window.location.host;

    // Allow direct access (empty referrer) or same-origin
    if (!referrer || referrer.includes(currentHost)) {
      return true;
    }

    logger.warn('Suspicious referrer:', referrer);
    return false;
  }

  /**
   * Setup DOM integrity monitoring
   *
   * Monitors for injected scripts and removes them.
   * NOTE: This is a basic defense-in-depth measure.
   * Real XSS protection comes from CSP headers and proper escaping.
   */
  static setupIntegrityCheck(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Check for suspicious script injections
              if (element.tagName === 'SCRIPT' || element.innerHTML?.includes('<script>')) {
                logger.warn('Suspicious script detected and removed');
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

  /**
   * Initialize all security measures
   *
   * Call this once on admin dashboard initialization.
   * Returns cleanup function for proper teardown.
   */
  static init(): () => void {
    const cleanupFns: Array<() => void> = [];

    try {
      this.enableCSPReporting();
      cleanupFns.push(this.detectDevTools());
      this.obfuscateConsole();
      this.setupIntegrityCheck();

      if (!this.validateReferrer()) {
        logger.warn('Referrer validation failed');
      }
    } catch (error) {
      logger.error('Error initializing security:', error);
    }

    // Return cleanup function
    return () => {
      cleanupFns.forEach(fn => fn());
    };
  }
}
