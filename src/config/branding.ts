/**
 * ===============================================
 * BRANDING & COMPANY CONSTANTS
 * ===============================================
 * Centralized branding values to avoid hardcoding throughout the app
 */

export const BRANDING = {
  // Company identity
  APP_NAME: 'No Bhad Codes',
  APP_NAME_SHORT: 'NBC',
  APP_IDENTIFIER: 'NoBhadCodes',
  APP_DOMAIN: 'nobhad.codes',

  // Contact information - all use nobhaduri@gmail.com as the only active email
  CONTACT_EMAIL: 'nobhaduri@gmail.com',
  SUPPORT_EMAIL: 'nobhaduri@gmail.com',
  FALLBACK_EMAIL: 'nobhaduri@gmail.com',

  // Social/external links
  GITHUB_URL: 'https://github.com/nobhadcodes',
  LINKEDIN_URL: 'https://linkedin.com/in/noellebhaduri',

  // Legal
  COPYRIGHT_HOLDER: 'No Bhad Codes',

  // Meta/SEO
  META: {
    TITLE: 'No Bhad Codes - Professional Web Development',
    DESCRIPTION: 'Professional web development services by Noelle Bhaduri. Custom websites, client portals, and modern web applications.',
    KEYWORDS: 'web development, portfolio, typescript, client management, professional websites',
    AUTHOR: 'Noelle Bhaduri'
  },

  // Terminal/CLI branding
  TERMINAL: {
    PROMPT: 'client@NoBhadCodes',
    SCRIPT_NAME: 'project_intake.sh'
  }
} as const;

/**
 * Get current copyright year dynamically
 */
export function getCopyrightYear(): number {
  return new Date().getFullYear();
}

/**
 * Get formatted copyright text
 */
export function getCopyrightText(): string {
  return `© ${getCopyrightYear()} ${BRANDING.COPYRIGHT_HOLDER}. All rights reserved.`;
}

/**
 * Get contact email with fallback
 */
export function getContactEmail(type: 'contact' | 'support' | 'fallback' = 'contact'): string {
  switch (type) {
  case 'support':
    return BRANDING.SUPPORT_EMAIL;
  case 'fallback':
    return BRANDING.FALLBACK_EMAIL;
  default:
    return BRANDING.CONTACT_EMAIL;
  }
}
