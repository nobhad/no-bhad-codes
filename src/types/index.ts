/**
 * ===============================================
 * TYPE DEFINITIONS INDEX
 * ===============================================
 * @file src/types/index.ts
 *
 * Central export point for all client-side type definitions.
 */

// API types (primary source for API-related types)
export * from './api';

// Database entity types
export * from './database';

// Authentication types from centralized auth module
export { type UserRole, AUTH_STORAGE_KEYS, AUTH_ERROR_CODES } from '../auth/auth-constants';
export {
  type AuthUser,
  type AdminUser,
  type ClientUser,
  type AnyUser,
  type AuthState,
  type LoginCredentials,
  type AdminLoginCredentials,
  type AuthResult,
  type LoginResult,
  type SessionData,
  isAdminUser,
  isClientUser,
  isSessionExpired,
  shouldRefreshSession
} from '../auth/auth-types';

// Client/Project types (existing)
export * from './client';

// Project types (exclude ProjectStatus to avoid conflict with api.ts)
export {
  type ProjectCategory,
  type Project,
  type ProjectImage,
  type ProjectResult,
  type ProjectFilter,
  type ProjectCollection,
  type ProjectCategoryInfo,
  PROJECT_CATEGORIES,
  generateSlug,
  formatProjectDate,
  getCategoryInfo
} from './project';

// Module types (existing)
export * from './modules';

// Performance API types
export * from './performance';
