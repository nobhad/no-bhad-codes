/**
 * ===============================================
 * BUSINESS INFORMATION CONSTANTS (FRONTEND)
 * ===============================================
 * @file src/constants/business.ts
 *
 * Frontend mirror of server/config/business.ts
 * Single source of truth for client-facing business info.
 *
 * NOTE: This duplicates server config intentionally.
 * For a single source of truth approach, see docs for
 * alternative patterns (API endpoint, build-time injection).
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
}

/**
 * Centralized business information for frontend
 *
 * @example
 * import { BUSINESS_INFO } from '../constants/business';
 * `<span>${BUSINESS_INFO.email}</span>`
 */
export const BUSINESS_INFO: BusinessInfo = {
  name: 'No Bhad Codes',
  owner: 'Noelle Bhaduri',
  contact: 'Noelle Bhaduri',
  tagline: 'Web Development & Design',
  email: 'nobhaduri@gmail.com',
  website: 'nobhad.codes'
};
