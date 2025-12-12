/**
 * ===============================================
 * CODE PROTECTION CONFIGURATION
 * ===============================================
 * @file src/config/protection.config.ts
 *
 * Configuration for code protection and obfuscation.
 *
 * INSTRUCTIONS FOR ENABLING PROTECTION:
 * 1. Change `enabled: false` to `enabled: true` below
 * 2. Choose your protection level: 'basic' | 'standard' | 'advanced' | 'maximum'
 * 3. Enable/disable specific features as needed
 * 4. For production builds, also update vite.config.js to enable the obfuscation plugin
 */

import type { CodeProtectionConfig } from '../services/code-protection-service';

export const PROTECTION_CONFIG: CodeProtectionConfig = {
  // ⚠️  PROTECTION IS DISABLED BY DEFAULT ⚠️
  // Change this to `true` when you want to enable protection
  enabled: false,

  // Protection levels:
  // - 'basic': Light protection, minimal impact on performance
  // - 'standard': Balanced protection with moderate security
  // - 'advanced': Strong protection, may impact user experience
  // - 'maximum': Extreme protection, aggressive blocking
  level: 'maximum',

  features: {
    // Block developer tools (F12, Ctrl+Shift+I, etc.)
    devToolsBlocking: true,

    // Obfuscate HTML source code
    sourceObfuscation: true,

    // Disable right-click context menu
    rightClickDisable: true,

    // Block keyboard shortcuts (F12, Ctrl+U, Ctrl+S, etc.)
    keyboardShortcuts: true,

    // Disable/override console methods
    consoleDisabling: true,

    // Protect against DOM manipulation
    domMutationProtection: true,

    // Anti-debugging techniques
    antiDebugging: true,

    // Network request obfuscation (experimental)
    networkObfuscation: false,

    // Encrypt sensitive strings in code
    stringEncryption: true,

    // Check code integrity
    codeIntegrityCheck: true
  },

  // Whitelist (optional) - IPs, user agents, or domains that bypass protection
  whitelist: {
    // Example: Allow your own IP during development
    // ips: ['192.168.1.100', '10.0.0.1'],
    // Example: Allow specific browsers
    // userAgents: ['MyTestAgent/1.0'],
    // Example: Allow specific domains
    // domains: ['localhost', '127.0.0.1'],
  },

  // Violation callback - called when protection is triggered
  onViolation: (type: string, details: any) => {
    console.warn(`🛡️ [Protection] ${type.toUpperCase()} violation detected:`, details);

    // Optional: Send violation data to your analytics
    // if (window.gtag) {
    //   window.gtag('event', 'security_violation', {
    //     violation_type: type,
    //     user_agent: navigator.userAgent,
    //     timestamp: Date.now()
    //   });
    // }

    // Optional: Send to your backend
    // fetch('/api/security-violation', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ type, details, timestamp: Date.now() })
    // }).catch(() => {}); // Ignore errors
  }
};

/**
 * Production build obfuscation settings
 * Used by the Vite plugin during build process
 */
export const BUILD_OBFUSCATION_CONFIG = {
  // ⚠️  BUILD OBFUSCATION IS DISABLED BY DEFAULT ⚠️
  // Enable this in vite.config.js when you want build-time obfuscation
  enabled: false,

  level: 'maximum' as const,

  // Preserve these function/class names (don't obfuscate them)
  preserveNames: ['init', 'mount', 'render', 'destroy', 'addEventListener', 'querySelector'],

  // Encryption key for string obfuscation
  encryptionKey: `nbw_build_key_${Date.now()}`,

  features: {
    minifyHTML: true,
    obfuscateJS: true,
    obfuscateCSS: true,
    encryptStrings: true,
    antiDebugTraps: true,
    fakeSourceMaps: false, // Set to true to generate fake source maps
    polymorphicCode: true // Advanced: code that changes its structure
  }
};

/**
 * Quick enable functions for different scenarios
 */
export const PROTECTION_PRESETS = {
  // For development - minimal protection, easy to debug
  development: {
    ...PROTECTION_CONFIG,
    enabled: false,
    level: 'basic' as const,
    features: {
      ...PROTECTION_CONFIG.features,
      devToolsBlocking: false,
      consoleDisabling: false,
      antiDebugging: false,
      rightClickDisable: false,
      keyboardShortcuts: false
    }
  },

  // For staging - moderate protection for testing
  staging: {
    ...PROTECTION_CONFIG,
    enabled: true,
    level: 'standard' as const,
    features: {
      ...PROTECTION_CONFIG.features,
      consoleDisabling: false, // Allow console for testing
      antiDebugging: false // Allow debugging for testing
    }
  },

  // For production - full protection (right-click and console enabled for usability)
  production: {
    ...PROTECTION_CONFIG,
    enabled: false, // Disabled - use build-time obfuscation instead
    level: 'standard' as const,
    features: {
      ...PROTECTION_CONFIG.features,
      rightClickDisable: false, // Allow right-click for usability
      consoleDisabling: false, // Never disable console - breaks error handling
      devToolsBlocking: false, // Don't block devtools - user hostile
      antiDebugging: false, // Don't use anti-debugging - user hostile
      keyboardShortcuts: false // Don't block keyboard - user hostile
    }
  },

  // For demo/portfolio - user-friendly protection
  demo: {
    ...PROTECTION_CONFIG,
    enabled: true,
    level: 'advanced' as const,
    features: {
      ...PROTECTION_CONFIG.features,
      rightClickDisable: false, // Allow right-click for accessibility
      keyboardShortcuts: false, // Allow shortcuts for accessibility
      consoleDisabling: false // Allow console for demo purposes
    }
  }
};

/**
 * Get protection config based on environment
 */
export function getProtectionConfig(): CodeProtectionConfig {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
  case 'production':
    return PROTECTION_PRESETS.production;
  case 'staging':
    return PROTECTION_PRESETS.staging;
  case 'development':
  default:
    return PROTECTION_PRESETS.development;
  }
}

/**
 * Check if protection is enabled for the current environment
 * Used to skip loading CodeProtectionService when disabled
 */
export function isProtectionEnabled(): boolean {
  return getProtectionConfig().enabled;
}
