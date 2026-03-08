/**
 * ===============================================
 * CLIENT ROUTE HELPERS
 * ===============================================
 * @file server/routes/clients/helpers.ts
 *
 * Shared imports, types, validation schemas, and helper
 * functions used across client sub-route modules.
 */

export { logger } from '../../services/logger.js';
export { default as express } from 'express';
export { default as bcrypt } from 'bcryptjs';
export { default as crypto } from 'crypto';
export { getDatabase } from '../../database/init.js';
export { asyncHandler } from '../../middleware/errorHandler.js';
export {
  authenticateToken,
  requireAdmin,
  requireClient,
  type AuthenticatedRequest
} from '../../middleware/auth.js';
export { emailService } from '../../services/email-service.js';
export { cache, invalidateCache, QueryCache } from '../../middleware/cache.js';
export { auditLogger } from '../../services/audit-logger.js';
export { getString, getNumber } from '../../database/row-helpers.js';
export { softDeleteService } from '../../services/soft-delete-service.js';
export { notificationPreferencesService } from '../../services/notification-preferences-service.js';
export {
  errorResponse,
  sendSuccess,
  sendCreated,
  sendPaginated,
  parsePaginationQuery,
  ErrorCodes
} from '../../utils/api-response.js';
export { clientService } from '../../services/client-service.js';
export { validateRequest } from '../../middleware/validation.js';
export { rateLimit } from '../../middleware/security.js';
export { timelineService } from '../../services/timeline-service.js';

// Client validation schemas shared across sub-route modules
export const ClientValidationSchemas = {
  create: {
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    password: { type: 'string' as const, minLength: 8, maxLength: 128 },
    company_name: { type: 'string' as const, maxLength: 200 },
    contact_name: { type: 'string' as const, maxLength: 100 },
    phone: { type: 'string' as const, maxLength: 30 },
    client_type: {
      type: 'string' as const,
      allowedValues: ['business', 'individual', 'nonprofit', 'government']
    },
    status: {
      type: 'string' as const,
      allowedValues: ['active', 'inactive', 'pending']
    }
  },
  update: {
    email: { type: 'email' as const },
    company_name: { type: 'string' as const, maxLength: 200 },
    contact_name: { type: 'string' as const, maxLength: 100 },
    phone: { type: 'string' as const, maxLength: 30 },
    status: {
      type: 'string' as const,
      allowedValues: ['active', 'inactive', 'pending']
    }
  },
  invite: {
    // No body params needed - client info comes from DB via :id param
  },
  updateProfile: {
    contact_name: { type: 'string' as const, maxLength: 100 },
    company_name: { type: 'string' as const, maxLength: 200 },
    phone: { type: 'string' as const, maxLength: 30 }
  },
  changePassword: {
    currentPassword: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: 128 }
    ],
    newPassword: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 8, maxLength: 128 }
    ]
  },
  updateNotifications: {
    messages: { type: 'boolean' as const },
    status: { type: 'boolean' as const },
    invoices: { type: 'boolean' as const },
    weekly: { type: 'boolean' as const }
  }
};

/** Transform ClientNote to snake_case for API response */
export function toApiNote(n: {
  id: number;
  clientId: number;
  author: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: n.id,
    client_id: n.clientId,
    content: n.content,
    is_pinned: n.isPinned,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
    created_by: n.author
  };
}
