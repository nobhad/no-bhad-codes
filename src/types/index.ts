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

// Authentication types (exclude duplicates from api.ts)
export {
  type UserRole,
  type Permission,
  ROLE_PERMISSIONS,
  type AuthUser,
  type AuthAdminUser,
  type AuthClientUser,
  type AnyAuthUser,
  type JWTPayload,
  type AdminJWTPayload,
  type ClientJWTPayload,
  type TokenPair,
  type DecodedToken,
  type SessionData,
  type AdminSessionData,
  type ClientSessionData,
  type SessionValidationResult,
  type LoginCredentials,
  type AdminLoginCredentials,
  type MagicLinkVerification,
  type PasswordResetRequest,
  type PasswordResetConfirmation,
  type AuthResult,
  type LoginResult,
  type TokenRefreshResult,
  type AuthErrorCode,
  type AuthState,
  type AuthContextValue,
  type AuthStorageKeys,
  AUTH_STORAGE_KEYS,
  isAdminUser,
  isClientUser,
  hasPermission,
  isTokenExpired,
  shouldRefreshToken,
  type UserId,
  type AuthenticatedRequest,
  type OptionalAuthRequest
} from './auth';

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
