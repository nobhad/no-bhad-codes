/**
 * ===============================================
 * CENTRALIZED AUTH MODULE
 * ===============================================
 * @file src/auth/index.ts
 *
 * Public API for the centralized authentication system.
 * Use this module for all auth operations.
 */

// ============================================
// Re-export everything
// ============================================

// Constants
export {
  AUTH_STORAGE_KEYS,
  AUTH_TIMING,
  AUTH_EVENTS,
  AUTH_ERROR_CODES,
  USER_ROLES,
  getLegacyKeys,
  getSessionKeys,
  getLocalKeys,
  type UserRole
} from './auth-constants';

// Types
export {
  type AuthUser,
  type AdminUser,
  type ClientUser,
  type AnyUser,
  type AuthState,
  type AuthStore,
  type LoginCredentials,
  type AdminLoginCredentials,
  type MagicLinkRequest,
  type AuthResult,
  type LoginResult,
  type SessionData,
  type SerializedSession,
  INITIAL_AUTH_STATE,
  isAdminUser,
  isClientUser,
  isAuthenticatedState,
  isSessionExpired,
  shouldRefreshSession
} from './auth-types';

// Store
export { authStore } from './auth-store';

// ============================================
// Convenience Functions
// ============================================

import { authStore } from './auth-store';
import type { AnyUser, LoginCredentials, AdminLoginCredentials, LoginResult, AuthResult } from './auth-types';

/**
 * Login a client user
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  return authStore.login(credentials);
}

/**
 * Login an admin user
 */
export async function adminLogin(credentials: AdminLoginCredentials): Promise<LoginResult> {
  return authStore.adminLogin(credentials);
}

/**
 * Logout the current user
 */
export async function logout(): Promise<void> {
  return authStore.logout();
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): AnyUser | null {
  return authStore.getCurrentUser();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return authStore.isAuthenticated();
}

/**
 * Check if current user is admin
 */
export function isAdmin(): boolean {
  return authStore.isAdmin();
}

/**
 * Check if current user is client
 */
export function isClient(): boolean {
  return authStore.isClient();
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (state: import('./auth-types').AuthState) => void
): () => void {
  return authStore.subscribe(callback);
}

/**
 * Request magic link for email
 */
export async function requestMagicLink(email: string): Promise<AuthResult> {
  return authStore.requestMagicLink(email);
}

/**
 * Verify magic link token
 */
export async function verifyMagicLink(token: string): Promise<LoginResult> {
  return authStore.verifyMagicLink(token);
}

/**
 * Validate current session
 */
export async function validateSession(): Promise<boolean> {
  return authStore.validateSession();
}

/**
 * Refresh current session
 */
export async function refreshSession(): Promise<boolean> {
  return authStore.refreshSession();
}

/**
 * Get remaining session time in milliseconds
 */
export function getSessionTimeRemaining(): number {
  return authStore.getSessionTimeRemaining();
}

/**
 * Extend the current session
 */
export function extendSession(): void {
  authStore.extendSession();
}

/**
 * Clear any auth errors
 */
export function clearAuthError(): void {
  authStore.clearError();
}

// ============================================
// Default Export
// ============================================

export default authStore;
