/**
 * ===============================================
 * AUTHENTICATION TYPE DEFINITIONS
 * ===============================================
 * @file src/types/auth.ts
 *
 * Type definitions for authentication, authorization,
 * and session management.
 */

// ============================================
// User Role Types
// ============================================

/**
 * User role enum
 */
export type UserRole = 'admin' | 'client';

/**
 * Permission types
 */
export type Permission =
  | 'read:leads'
  | 'write:leads'
  | 'delete:leads'
  | 'read:clients'
  | 'write:clients'
  | 'delete:clients'
  | 'read:projects'
  | 'write:projects'
  | 'delete:projects'
  | 'read:messages'
  | 'write:messages'
  | 'read:invoices'
  | 'write:invoices'
  | 'read:analytics'
  | 'admin:settings';

/**
 * Role permission mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'read:leads',
    'write:leads',
    'delete:leads',
    'read:clients',
    'write:clients',
    'delete:clients',
    'read:projects',
    'write:projects',
    'delete:projects',
    'read:messages',
    'write:messages',
    'read:invoices',
    'write:invoices',
    'read:analytics',
    'admin:settings'
  ],
  client: [
    'read:projects',
    'read:messages',
    'write:messages',
    'read:invoices'
  ]
};

// ============================================
// Authenticated User Types
// ============================================

/**
 * Base authenticated user
 */
export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

/**
 * Authenticated admin user
 */
export interface AuthAdminUser extends AuthUser {
  role: 'admin';
  username: string;
}

/**
 * Authenticated client user
 */
export interface AuthClientUser extends AuthUser {
  role: 'client';
  companyName: string;
  contactName: string;
  status: string;
}

/**
 * Union type for any authenticated user
 */
export type AnyAuthUser = AuthAdminUser | AuthClientUser;

// ============================================
// JWT Types
// ============================================

/**
 * JWT token payload (decoded)
 */
export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

/**
 * Admin JWT payload
 */
export interface AdminJWTPayload extends JWTPayload {
  role: 'admin';
  username: string;
}

/**
 * Client JWT payload
 */
export interface ClientJWTPayload extends JWTPayload {
  role: 'client';
  clientId: number;
  companyName: string;
}

/**
 * Token pair (access + refresh)
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/**
 * Decoded token result
 */
export interface DecodedToken<T extends JWTPayload = JWTPayload> {
  payload: T;
  expired: boolean;
  error?: string;
}

// ============================================
// Session Types
// ============================================

/**
 * Session data stored in memory/cache
 */
export interface SessionData {
  userId: number;
  userType: UserRole;
  email: string;
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Admin session data
 */
export interface AdminSessionData extends SessionData {
  userType: 'admin';
}

/**
 * Client session data
 */
export interface ClientSessionData extends SessionData {
  userType: 'client';
  clientId: number;
  companyName: string;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  error?: string;
  shouldRefresh?: boolean;
}

// ============================================
// Login/Auth Request Types
// ============================================

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Admin login credentials (password only)
 */
export interface AdminLoginCredentials {
  password: string;
}

/**
 * Magic link request
 */
export interface MagicLinkRequest {
  email: string;
}

/**
 * Magic link verification
 */
export interface MagicLinkVerification {
  token: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirmation {
  token: string;
  newPassword: string;
}

// ============================================
// Auth Response Types
// ============================================

/**
 * Generic auth result
 */
export interface AuthResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: AuthErrorCode;
}

/**
 * Login result
 */
export interface LoginResult extends AuthResult<AuthClientUser | AuthAdminUser> {
  expiresIn?: string;
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult extends AuthResult {
  expiresIn?: number;
}

/**
 * Auth error codes
 */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_INACTIVE'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'MAGIC_LINK_EXPIRED'
  | 'MAGIC_LINK_INVALID'
  | 'PASSWORD_TOO_WEAK'
  | 'EMAIL_NOT_FOUND'
  | 'NETWORK_ERROR';

// ============================================
// Auth State Types (Client-side)
// ============================================

/**
 * Auth state for UI
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AnyAuthUser | null;
  error: string | null;
}

/**
 * Auth context value
 */
export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  validateSession: () => Promise<boolean>;
}

// ============================================
// Storage Key Types
// ============================================

/**
 * Auth storage keys (for migration/cleanup)
 */
export interface AuthStorageKeys {
  session: {
    user: string;
    role: string;
    expiry: string;
  };
  legacy: {
    [key: string]: string;
  };
}

/**
 * Default auth storage keys
 */
export const AUTH_STORAGE_KEYS: AuthStorageKeys = {
  session: {
    user: 'nbw_auth_user',
    role: 'nbw_auth_role',
    expiry: 'nbw_auth_expiry'
  },
  legacy: {
    // Old keys for migration
    authUser: 'auth_user',
    authToken: 'auth_token',
    clientSession: 'client_session',
    adminSession: 'admin_session',
    clientAuthMode: 'client_auth_mode'
  }
};

// ============================================
// Type Guards
// ============================================

/**
 * Check if user is admin
 */
export function isAdminUser(user: AnyAuthUser | null): user is AuthAdminUser {
  return user !== null && user.role === 'admin';
}

/**
 * Check if user is client
 */
export function isClientUser(user: AnyAuthUser | null): user is AuthClientUser {
  return user !== null && user.role === 'client';
}

/**
 * Check if user has permission
 */
export function hasPermission(user: AnyAuthUser | null, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/**
 * Check if JWT payload is expired
 */
export function isTokenExpired(payload: JWTPayload): boolean {
  return Date.now() >= payload.exp * 1000;
}

/**
 * Check if token needs refresh (within 5 minutes of expiry)
 */
export function shouldRefreshToken(payload: JWTPayload, bufferMs: number = 300000): boolean {
  return Date.now() >= (payload.exp * 1000) - bufferMs;
}

// ============================================
// Utility Types
// ============================================

/**
 * Extract user ID from auth user
 */
export type UserId<T extends AuthUser> = T['id'];

/**
 * Auth request with user context
 */
export interface AuthenticatedRequest<T extends AuthUser = AuthUser> {
  user: T;
  token?: string;
  sessionId?: string;
}

/**
 * Optional auth request (for public routes that can be authenticated)
 */
export interface OptionalAuthRequest<T extends AuthUser = AuthUser> {
  user?: T;
  token?: string;
}
