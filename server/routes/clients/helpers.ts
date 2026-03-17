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
      allowedValues: ['individual', 'company', 'nonprofit', 'government']
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
  },
  updateBilling: {
    billing_name: { type: 'string' as const, maxLength: 100 },
    company: { type: 'string' as const, maxLength: 200 },
    address: { type: 'string' as const, maxLength: 255 },
    address2: { type: 'string' as const, maxLength: 255 },
    city: { type: 'string' as const, maxLength: 100 },
    state: { type: 'string' as const, maxLength: 50 },
    zip: { type: 'string' as const, maxLength: 20 },
    country: { type: 'string' as const, maxLength: 100 },
    phone: { type: 'string' as const, maxLength: 30 },
    email: { type: 'email' as const }
  },
  createContact: {
    first_name: [{ type: 'required' as const }, { type: 'string' as const, maxLength: 100 }],
    last_name: [{ type: 'required' as const }, { type: 'string' as const, maxLength: 100 }],
    email: { type: 'email' as const },
    phone: { type: 'string' as const, maxLength: 30 },
    title: { type: 'string' as const, maxLength: 100 },
    department: { type: 'string' as const, maxLength: 100 },
    role: { type: 'string' as const, maxLength: 50 },
    notes: { type: 'string' as const, maxLength: 2000 }
  },
  updateContact: {
    first_name: { type: 'string' as const, maxLength: 100 },
    last_name: { type: 'string' as const, maxLength: 100 },
    email: { type: 'email' as const },
    phone: { type: 'string' as const, maxLength: 30 },
    title: { type: 'string' as const, maxLength: 100 },
    department: { type: 'string' as const, maxLength: 100 },
    role: { type: 'string' as const, maxLength: 50 },
    notes: { type: 'string' as const, maxLength: 2000 }
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

/** Normalize email: trim + lowercase */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Basic email format validation */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Normalize phone: strip non-numeric except leading + */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/[^\d]/g, '');
  }
  return trimmed.replace(/[^\d]/g, '');
}

/** Basic phone format validation (at least 7 digits, max 15) */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
