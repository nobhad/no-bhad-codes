/**
 * ===============================================
 * BUSINESS INFORMATION CONFIGURATION
 * ===============================================
 * @file server/config/business.ts
 *
 * Single source of truth for all business branding
 * and contact information used across PDFs, emails,
 * and other client-facing documents.
 *
 * All values are configurable via environment variables
 * with sensible defaults for the No Bhad Codes brand.
 */

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

/**
 * Business information interface
 */
export interface BusinessInfo {
  /** Business name displayed on documents */
  name: string;
  /** Owner/principal name */
  owner: string;
  /** Primary contact person name */
  contact: string;
  /** Business tagline/description */
  tagline: string;
  /** Primary business email */
  email: string;
  /** Business website URL (without https://) */
  website: string;
  /** Venmo handle for payments (with @) */
  venmoHandle: string;
  /** Zelle email for payments */
  zelleEmail: string;
  /** PayPal email for payments (optional) */
  paypalEmail: string;
}

/**
 * Centralized business information
 *
 * All PDF generation, email templates, and client-facing
 * documents should import from here to ensure consistency.
 *
 * @example
 * import { BUSINESS_INFO } from '../config/business.js';
 * page.drawText(BUSINESS_INFO.name, { ... });
 */
export const BUSINESS_INFO: BusinessInfo = {
  name: process.env.BUSINESS_NAME || 'No Bhad Codes',
  owner: process.env.BUSINESS_OWNER || 'Noelle Bhaduri',
  contact: process.env.BUSINESS_CONTACT || 'Noelle Bhaduri',
  tagline: process.env.BUSINESS_TAGLINE || 'Web Development & Design',
  email: process.env.BUSINESS_EMAIL || 'nobhaduri@gmail.com',
  website: process.env.BUSINESS_WEBSITE || 'nobhad.codes',
  venmoHandle: process.env.VENMO_HANDLE || '@nobhaduri',
  zelleEmail: process.env.ZELLE_EMAIL || 'nobhaduri@gmail.com',
  paypalEmail: process.env.PAYPAL_EMAIL || ''
};

/**
 * Get formatted business info for display
 */
export function getFormattedBusinessInfo(): {
  fullAddress: string;
  contactLine: string;
  footerText: string;
} {
  return {
    fullAddress: `${BUSINESS_INFO.name} • ${BUSINESS_INFO.owner}`,
    contactLine: `${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}`,
    footerText: `${BUSINESS_INFO.name} • ${BUSINESS_INFO.owner} • ${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}`
  };
}

export default BUSINESS_INFO;

/**
 * Standard contract terms and conditions
 * Can be overridden via environment variable CONTRACT_TERMS (JSON array)
 */
export const CONTRACT_TERMS: string[] = process.env.CONTRACT_TERMS
  ? JSON.parse(process.env.CONTRACT_TERMS)
  : [
    '1. All work will be performed in a professional manner and according to industry standards.',
    '2. Client agrees to provide timely feedback and necessary materials to avoid project delays.',
    '3. Changes to the scope of work may require additional time and cost adjustments.',
    '4. Client retains ownership of all final deliverables upon full payment.',
    '5. Service Provider retains the right to showcase the completed project in their portfolio.'
  ];

/**
 * PDF Logo configuration
 * Centralized logo path with fallback options
 */
export const PDF_LOGO_PATHS = [
  'public/images/avatar_pdf.png',
  'public/images/pdf-header-logo.png',
  'public/images/avatar_small-1.png'
];

/**
 * Get the PDF logo path (first existing file from fallback list)
 * @returns Absolute path to logo file, or null if none found
 */
export function getPdfLogoPath(): string | null {
  for (const relativePath of PDF_LOGO_PATHS) {
    const fullPath = join(process.cwd(), relativePath);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Get PDF logo bytes for embedding
 * @returns Buffer of logo image bytes, or null if no logo found
 */
export function getPdfLogoBytes(): Buffer | null {
  const logoPath = getPdfLogoPath();
  if (logoPath) {
    return readFileSync(logoPath);
  }
  return null;
}
