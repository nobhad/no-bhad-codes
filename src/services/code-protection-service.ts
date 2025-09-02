/**
 * ===============================================
 * CODE PROTECTION SERVICE
 * ===============================================
 * @file src/services/code-protection-service.ts
 *
 * Multi-layered code protection and obfuscation system.
 * Protects against inspection, reverse engineering, and unauthorized access.
 */

export interface CodeProtectionConfig {
  enabled: boolean;
  level: 'basic' | 'standard' | 'advanced' | 'maximum';
  features: {
    devToolsBlocking: boolean;
    sourceObfuscation: boolean;
    rightClickDisable: boolean;
    keyboardShortcuts: boolean;
    consoleDisabling: boolean;
    domMutationProtection: boolean;
    antiDebugging: boolean;
    networkObfuscation: boolean;
    stringEncryption: boolean;
    codeIntegrityCheck: boolean;
  };
  whitelist?: {
    ips?: string[];
    userAgents?: string[];
    domains?: string[];
  };
  onViolation?: (type: string, details: any) => void;
}

export interface ProtectionViolation {
  type: 'devtools' | 'console' | 'rightclick' | 'keyboard' | 'debugging' | 'tampering';
  timestamp: number;
  userAgent: string;
  ip?: string;
  details: any;
}

export class CodeProtectionService {
  private config: CodeProtectionConfig;
  private violations: ProtectionViolation[] = [];
  private isEnabled = false;
  private protectionIntervals: NodeJS.Timeout[] = [];
  private originalConsole: any;
  private encryptionKey: string;

  // Detection states
  private devToolsOpen = false;
  private debuggerDetected = false;
  private integrityCompromised = false;

  constructor(config: Partial<CodeProtectionConfig> = {}) {
    this.config = {
      enabled: false,
      level: 'standard',
      features: {
        devToolsBlocking: true,
        sourceObfuscation: true,
        rightClickDisable: true,
        keyboardShortcuts: true,
        consoleDisabling: true,
        domMutationProtection: true,
        antiDebugging: true,
        networkObfuscation: false,
        stringEncryption: true,
        codeIntegrityCheck: true,
        ...config.features
      },
      ...config
    };

    this.encryptionKey = this.generateEncryptionKey();
    this.originalConsole = { ...console };
  }

  /**
   * Initialize code protection (disabled by default)
   */
  async init(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[CodeProtection] Service initialized but protection is DISABLED');
      return;
    }

    console.log(`[CodeProtection] Initializing protection level: ${this.config.level}`);

    this.setupProtection();
    this.startMonitoring();

    this.isEnabled = true;
    console.log('[CodeProtection] Protection activated');
  }

  /**
   * Enable protection (can be called later)
   */
  enable(): void {
    if (this.isEnabled) return;

    this.config.enabled = true;
    this.setupProtection();
    this.startMonitoring();
    this.isEnabled = true;

    console.log('[CodeProtection] Protection enabled');
  }

  /**
   * Disable protection
   */
  disable(): void {
    if (!this.isEnabled) return;

    this.config.enabled = false;
    this.teardownProtection();
    this.stopMonitoring();
    this.isEnabled = false;

    console.log('[CodeProtection] Protection disabled');
  }

  /**
   * Setup all protection mechanisms
   */
  private setupProtection(): void {
    const { features } = this.config;

    if (features.devToolsBlocking) {
      this.setupDevToolsBlocking();
    }

    if (features.sourceObfuscation) {
      this.setupSourceObfuscation();
    }

    if (features.rightClickDisable) {
      this.setupRightClickBlocking();
    }

    if (features.keyboardShortcuts) {
      this.setupKeyboardBlocking();
    }

    if (features.consoleDisabling) {
      this.setupConsoleDisabling();
    }

    if (features.domMutationProtection) {
      this.setupDomProtection();
    }

    if (features.antiDebugging) {
      this.setupAntiDebugging();
    }

    if (features.codeIntegrityCheck) {
      this.setupIntegrityChecks();
    }

    if (features.stringEncryption) {
      this.setupStringEncryption();
    }
  }

  /**
   * DevTools detection and blocking
   */
  private setupDevToolsBlocking(): void {
    // Method 1: Console message detection
    let consoleCount = 0;
    const originalLog = console.log;
    console.log = (...args) => {
      consoleCount++;
      if (consoleCount > 2 && !this.devToolsOpen) {
        this.onDevToolsDetected('console-flood');
      }
      return originalLog.apply(console, args);
    };

    // Method 2: Window size detection
    const windowWidth = window.outerWidth;
    const windowHeight = window.outerHeight;

    const checkWindowSize = () => {
      if (Math.abs(window.outerWidth - window.innerWidth) > 200 ||
          Math.abs(window.outerHeight - window.innerHeight) > 200) {
        if (!this.devToolsOpen) {
          this.onDevToolsDetected('window-size');
        }
      }
    };

    // Method 3: Performance timing
    const checkPerformanceTiming = () => {
      const start = performance.now();
      debugger; // This will pause if devtools is open
      const end = performance.now();

      if (end - start > 100) {
        if (!this.devToolsOpen) {
          this.onDevToolsDetected('debugger-pause');
        }
      }
    };

    // Method 4: Element inspection
    const div = document.createElement('div');
    div.id = '__protection_element__';
    Object.defineProperty(div, 'id', {
      get: () => {
        if (!this.devToolsOpen) {
          this.onDevToolsDetected('element-inspection');
        }
        return '__protection_element__';
      }
    });
    document.body.appendChild(div);

    // Schedule checks
    this.protectionIntervals.push(
      setInterval(checkWindowSize, 1000),
      setInterval(checkPerformanceTiming, 2000)
    );
  }

  /**
   * Source code obfuscation
   */
  private setupSourceObfuscation(): void {
    // Obfuscate HTML source
    const obfuscateHTML = () => {
      if (document.documentElement.outerHTML.includes('<!--')) {
        document.documentElement.innerHTML = document.documentElement.innerHTML
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\s+/g, ' ')
          .replace(/>\s+</g, '><');
      }
    };

    // Remove sourcemaps from scripts
    const removeSourceMaps = () => {
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        if (script.src && script.src.includes('.map')) {
          script.remove();
        }
      });
    };

    // Obfuscate CSS
    const obfuscateCSS = () => {
      const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
      styles.forEach(style => {
        if (style.textContent) {
          style.textContent = style.textContent
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ');
        }
      });
    };

    setTimeout(() => {
      obfuscateHTML();
      removeSourceMaps();
      obfuscateCSS();
    }, 100);
  }

  /**
   * Right-click blocking
   */
  private setupRightClickBlocking(): void {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.logViolation('rightclick', { target: e.target });
      return false;
    });

    document.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });

    document.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });
  }

  /**
   * Keyboard shortcuts blocking
   */
  private setupKeyboardBlocking(): void {
    const blockedKeys = [
      { key: 'F12' },
      { key: 'I', ctrl: true, shift: true }, // Ctrl+Shift+I
      { key: 'J', ctrl: true, shift: true }, // Ctrl+Shift+J
      { key: 'C', ctrl: true, shift: true }, // Ctrl+Shift+C
      { key: 'U', ctrl: true }, // Ctrl+U (view source)
      { key: 'S', ctrl: true }, // Ctrl+S (save)
      { key: 'A', ctrl: true }, // Ctrl+A (select all)
      { key: 'P', ctrl: true }, // Ctrl+P (print)
      { key: 'F', ctrl: true } // Ctrl+F (find)
    ];

    document.addEventListener('keydown', (e) => {
      const blocked = blockedKeys.some(combo => {
        return e.key === combo.key &&
               (!(combo as any).ctrl || e.ctrlKey) &&
               (!(combo as any).shift || e.shiftKey) &&
               (!(combo as any).alt || e.altKey);
      });

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        this.logViolation('keyboard', { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey });
        return false;
      }
      return true;
    });
  }

  /**
   * Console disabling
   */
  private setupConsoleDisabling(): void {
    const noop = () => {};
    const throwError = () => { throw new Error('Console access denied'); };

    // Override console methods
    Object.keys(console).forEach(key => {
      if (typeof console[key as keyof Console] === 'function') {
        (console as any)[key] = this.config.level === 'maximum' ? throwError : noop;
      }
    });

    // Block common console access methods
    (window as any).console = this.config.level === 'maximum' ? undefined : {
      log: noop, info: noop, warn: noop, error: noop, debug: noop,
      trace: noop, table: noop, group: noop, groupEnd: noop, clear: noop
    };

    // Override eval and Function constructor
    (window as any).eval = throwError;
    (window as any).Function = throwError;
  }

  /**
   * DOM mutation protection
   */
  private setupDomProtection(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Detect suspicious DOM modifications
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Check for debugging tools injection
              if (element.tagName === 'SCRIPT' &&
                  element.textContent?.includes('debugger')) {
                element.remove();
                this.logViolation('tampering', { type: 'script-injection' });
              }
            }
          });
        }
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  /**
   * Anti-debugging techniques
   */
  private setupAntiDebugging(): void {
    // Infinite debugger loop
    const antiDebugger = () => {
      setInterval(() => {
        const start = performance.now();
        debugger;
        const end = performance.now();

        if (end - start > 100) {
          this.debuggerDetected = true;
          this.onDebuggerDetected();
        }
      }, 1000);
    };

    // Function toString override
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function () {
      if (this === antiDebugger || this.name.includes('protection')) {
        throw new Error('Access denied');
      }
      return originalToString.call(this);
    };

    antiDebugger();
  }

  /**
   * Code integrity checks
   */
  private setupIntegrityChecks(): void {
    const checkIntegrity = () => {
      // Check if critical functions have been modified
      if (typeof document.createElement !== 'function' ||
          typeof window.addEventListener !== 'function') {
        this.integrityCompromised = true;
        this.onIntegrityViolation();
      }

      // Check for common debugging tools
      if ((window as any).chrome?.runtime ||
          (window as any).webkitRequestAnimationFrame?.toString().includes('native') === false) {
        this.logViolation('tampering', { type: 'extension-detected' });
      }
    };

    this.protectionIntervals.push(
      setInterval(checkIntegrity, 3000)
    );
  }

  /**
   * String encryption for sensitive data
   */
  private setupStringEncryption(): void {
    // This would be used to encrypt sensitive strings in the code
    // Implementation would involve replacing sensitive strings with encrypted versions
  }

  /**
   * Event handlers
   */
  private onDevToolsDetected(method: string): void {
    this.devToolsOpen = true;
    this.logViolation('devtools', { method });

    if (this.config.level === 'maximum') {
      document.body.innerHTML = '<h1>Access Denied</h1><p>Developer tools detected.</p>';
      window.location.href = 'about:blank';
    } else {
      console.clear();
      alert('Developer tools detected. Some features may be limited.');
    }
  }

  private onDebuggerDetected(): void {
    this.logViolation('debugging', { type: 'debugger-pause' });

    if (this.config.level === 'maximum') {
      window.location.reload();
    }
  }

  private onIntegrityViolation(): void {
    this.logViolation('tampering', { type: 'integrity-check' });

    if (this.config.level === 'advanced' || this.config.level === 'maximum') {
      document.body.style.display = 'none';
    }
  }

  /**
   * Logging and monitoring
   */
  private logViolation(type: string, details: any): void {
    const violation: ProtectionViolation = {
      type: type as any,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      details
    };

    this.violations.push(violation);

    if (this.config.onViolation) {
      this.config.onViolation(type, details);
    }

    console.warn(`[CodeProtection] Violation detected: ${type}`, details);
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Monitor for protection bypass attempts
    const monitor = () => {
      if (!this.isEnabled) return;

      // Check if protection has been disabled
      if (document.getElementById('__protection_element__') === null) {
        this.logViolation('tampering', { type: 'element-removed' });
        this.setupProtection(); // Re-setup
      }
    };

    this.protectionIntervals.push(
      setInterval(monitor, 5000)
    );
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    this.protectionIntervals.forEach(interval => clearInterval(interval));
    this.protectionIntervals = [];
  }

  /**
   * Teardown protection
   */
  private teardownProtection(): void {
    // Restore original console
    Object.assign(console, this.originalConsole);

    // Remove protection elements
    const protectionElement = document.getElementById('__protection_element__');
    if (protectionElement) {
      protectionElement.remove();
    }

    // Re-enable right click
    document.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleContextMenu = (e: Event) => {
    e.preventDefault();
    return false;
  };

  /**
   * Utility methods
   */
  private generateEncryptionKey(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Public API
   */
  getViolations(): ProtectionViolation[] {
    return this.violations;
  }

  clearViolations(): void {
    this.violations = [];
  }

  getStatus(): any {
    return {
      enabled: this.isEnabled,
      level: this.config.level,
      devToolsDetected: this.devToolsOpen,
      debuggerDetected: this.debuggerDetected,
      integrityCompromised: this.integrityCompromised,
      violationCount: this.violations.length,
      features: this.config.features
    };
  }

  updateConfig(updates: Partial<CodeProtectionConfig>): void {
    this.config = { ...this.config, ...updates };

    if (this.isEnabled) {
      this.teardownProtection();
      this.setupProtection();
    }
  }
}