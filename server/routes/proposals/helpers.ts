/**
 * ===============================================
 * PROPOSAL ROUTE HELPERS
 * ===============================================
 * @file server/routes/proposals/helpers.ts
 *
 * Shared imports, types, constants, and helpers for proposal routes.
 */

// Re-export commonly used middleware and utilities so sub-routes
// can import from a single location.
export { asyncHandler } from '../../middleware/errorHandler.js';
export { authenticateToken, requireAdmin } from '../../middleware/auth.js';
export type { AuthenticatedRequest } from '../../middleware/auth.js';
export { canAccessProject, canAccessProposal, isUserAdmin } from '../../middleware/access-control.js';
export { getDatabase } from '../../database/init.js';
export { getString, getNumber } from '../../database/row-helpers.js';
export { proposalService } from '../../services/proposal-service.js';
export { notDeleted } from '../../database/query-helpers.js';
export { userService } from '../../services/user-service.js';
export { softDeleteService } from '../../services/soft-delete-service.js';
export { workflowTriggerService } from '../../services/workflow-trigger-service.js';
export { logger } from '../../services/logger.js';
import { createRateLimiter } from '../../middleware/rate-limiter.js';
export { createRateLimiter };
export {
  ErrorCodes,
  errorResponse,
  errorResponseWithPayload,
  sendSuccess,
  sendCreated,
  sendPaginated,
  parsePaginationQuery
} from '../../utils/api-response.js';

// PDF-related exports (used by core.ts for PDF generation)
export { BUSINESS_INFO, getPdfLogoBytes } from '../../config/business.js';
export { PDFDocument as PDFLibDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
export {
  getPdfCacheKey,
  getCachedPdf,
  cachePdf,
  PAGE_MARGINS,
  ensureSpace,
  addPageNumbers,
  drawPdfDocumentHeader
} from '../../utils/pdf-utils.js';
export type { PdfPageContext } from '../../utils/pdf-utils.js';

/**
 * Explicit column lists for SELECT queries (avoid SELECT *)
 */
export const FEATURE_SELECTION_COLUMNS = `
  id, proposal_request_id, feature_id, feature_name, feature_price,
  feature_category, is_included_in_tier, is_addon, created_at
`.replace(/\s+/g, ' ').trim();

export const PROPOSAL_SIGNATURE_COLUMNS = `
  id, proposal_id, signer_name, signer_email, signer_title, signer_company,
  signature_method, signature_data, ip_address, user_agent, signed_at
`.replace(/\s+/g, ' ').trim();

/**
 * Project type constants (matches frontend)
 */
export const VALID_PROJECT_TYPES = [
  'simple-site',
  'business-site',
  'portfolio',
  'e-commerce',
  'ecommerce', // Legacy support
  'web-app',
  'browser-extension',
  'other'
];

/**
 * Valid tier IDs
 */
export const VALID_TIERS = ['good', 'better', 'best'];

/**
 * Valid maintenance options
 */
export const VALID_MAINTENANCE = ['diy', 'essential', 'standard', 'premium'];

/**
 * Proposal status constants
 */
export const VALID_STATUSES = ['pending', 'reviewed', 'accepted', 'rejected', 'converted'];

/**
 * Rate limiter for public signature endpoints (strict: 10 requests per 15 min)
 */
const SIGNATURE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SIGNATURE_RATE_LIMIT_MAX = 10;
const SIGNATURE_RATE_LIMIT_BLOCK_MS = 60 * 60 * 1000; // 1 hour block

export const signatureRateLimiter = createRateLimiter({
  windowMs: SIGNATURE_RATE_LIMIT_WINDOW_MS,
  maxRequests: SIGNATURE_RATE_LIMIT_MAX,
  blockDurationMs: SIGNATURE_RATE_LIMIT_BLOCK_MS
});

export interface ProposalSubmission {
  projectId: number;
  clientId: number;
  projectType: string;
  selectedTier: string;
  basePrice: number;
  finalPrice: number;
  maintenanceOption?: string | null;
  clientNotes?: string;
  features: Array<{
    featureId: string;
    featureName: string;
    featurePrice: number;
    featureCategory?: string;
    isIncludedInTier: boolean;
    isAddon: boolean;
  }>;
}

export interface ProposalRow {
  id: number;
  project_id: number;
  client_id: number;
  project_type: string;
  selected_tier: string;
  base_price: number;
  final_price: number;
  maintenance_option: string | null;
  status: string;
  client_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  signed_at?: string | null;
  terms_and_conditions?: string | null;
  contract_terms?: string | null;
  default_deposit_percentage?: number | null;
  // Joined fields
  project_name?: string;
  client_name?: string;
  client_email?: string;
  company_name?: string;
}

export interface FeatureRow {
  id: number;
  proposal_request_id: number;
  feature_id: string;
  feature_name: string;
  feature_price: number;
  feature_category: string | null;
  is_included_in_tier: number;
  is_addon: number;
}
