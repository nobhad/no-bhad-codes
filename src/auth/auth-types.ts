/**
 * ===============================================
 * AUTH TYPE DEFINITIONS
 * ===============================================
 * @file src/auth/auth-types.ts
 *
 * Type definitions for the centralized auth system.
 */

import type { UserRole } from './auth-constants';

// ============================================
// User Types
// ============================================

/**
 * Base user information
 */
export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

/**
 * Admin user
 */
export interface AdminUser extends AuthUser {
  role: 'admin';
  username?: string;
}

/**
 * Client user
 */
export interface ClientUser extends AuthUser {
  role: 'client';
  companyName: string;
  contactName: string;
  status: string;
}

/**
 * Any authenticated user
 */
export type AnyUser = AdminUser | ClientUser;

// ============================================
// Auth State
// ============================================

/**
 * Authentication state
 */
export interface AuthState {
  /** Whether user is authenticated */
  isAuthenticated: boolean;

  /** Whether auth is being initialized/checked */
  isLoading: boolean;

  /** Whether auth is being processed (login/logout in progress) */
  isProcessing: boolean;

  /** Current authenticated user */
  user: AnyUser | null;

  /** Current user role */
  role: UserRole | null;

  /** Session expiry time */
  expiresAt: number | null;

  /** Session ID */
  sessionId: string | null;

  /** Auth error (if any) */
  error: string | null;
}

/**
 * Default/initial auth state
 */
export const INITIAL_AUTH_STATE: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  isProcessing: false,
  user: null,
  role: null,
  expiresAt: null,
  sessionId: null,
  error: null
};

// ============================================
// Auth Actions
// ============================================

/**
 * Login credentials (client)
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Admin login credentials
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
 * Auth result from operations
 */
export interface AuthResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Login result
 */
export interface LoginResult extends AuthResult<AnyUser> {
  expiresIn?: string;
  sessionId?: string;
}

// ============================================
// Session Data
// ============================================

/**
 * Session data stored in storage
 */
export interface SessionData {
  user: AnyUser;
  role: UserRole;
  expiresAt: number;
  sessionId: string;
  createdAt: number;
}

/**
 * Serialized session for storage
 */
export interface SerializedSession {
  user: string;
  role: UserRole;
  expiresAt: string;
  sessionId: string;
}

// ============================================
// Auth Store Interface
// ============================================

/**
 * Auth store public interface
 */
export interface AuthStore {
  // State
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;

  // Session Management
  login(credentials: LoginCredentials): Promise<LoginResult>;
  adminLogin(credentials: AdminLoginCredentials): Promise<LoginResult>;
  logout(): Promise<void>;
  refreshSession(): Promise<boolean>;
  validateSession(): Promise<boolean>;

  // Magic Link
  requestMagicLink(email: string): Promise<AuthResult>;
  verifyMagicLink(token: string): Promise<LoginResult>;

  // Getters
  isAuthenticated(): boolean;
  isAdmin(): boolean;
  isClient(): boolean;
  getCurrentUser(): AnyUser | null;
  getSessionTimeRemaining(): number;

  // Utilities
  clearError(): void;
  extendSession(): void;
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if user is admin
 */
export function isAdminUser(user: AnyUser | null): user is AdminUser {
  return user !== null && user.role === 'admin';
}

/**
 * Check if user is client
 */
export function isClientUser(user: AnyUser | null): user is ClientUser {
  return user !== null && user.role === 'client';
}

/**
 * Check if auth state is authenticated
 */
export function isAuthenticatedState(state: AuthState): boolean {
  return state.isAuthenticated && state.user !== null;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) return true;
  return Date.now() >= expiresAt;
}

/**
 * Check if session should be refreshed (within 5 minutes of expiry)
 */
export function shouldRefreshSession(expiresAt: number | null, bufferMs: number = 300000): boolean {
  if (expiresAt === null) return false;
  return Date.now() >= (expiresAt - bufferMs);
}
