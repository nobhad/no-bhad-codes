/**
 * ===============================================
 * USE PORTAL AUTH HOOK
 * ===============================================
 * @file src/react/hooks/usePortalAuth.ts
 *
 * React hook wrapping the vanilla authStore singleton
 * for use in React components. Subscribes to auth state
 * changes and provides typed accessors.
 *
 * Uses a cached snapshot ref so useSyncExternalStore
 * receives the same object reference when state hasn't changed.
 */

import { useSyncExternalStore, useCallback } from 'react';
import { authStore } from '../../auth/auth-store';
import type { AuthState, AnyUser } from '../../auth/auth-types';

/**
 * Subscribe to authStore changes from React.
 * Stable function reference — never changes.
 */
function subscribe(callback: () => void): () => void {
  return authStore.subscribe(callback);
}

/**
 * Cached snapshot to satisfy useSyncExternalStore's
 * requirement that getSnapshot returns the same reference
 * when state hasn't changed.
 *
 * authStore.getState() spreads a new object every call,
 * so we compare fields and reuse the previous ref if unchanged.
 */
let cachedSnapshot: AuthState | null = null;

function getSnapshot(): AuthState {
  const next = authStore.getState();

  if (
    cachedSnapshot !== null &&
    cachedSnapshot.isAuthenticated === next.isAuthenticated &&
    cachedSnapshot.isLoading === next.isLoading &&
    cachedSnapshot.isProcessing === next.isProcessing &&
    cachedSnapshot.user === next.user &&
    cachedSnapshot.role === next.role &&
    cachedSnapshot.error === next.error &&
    cachedSnapshot.isFirstLogin === next.isFirstLogin
  ) {
    return cachedSnapshot;
  }

  cachedSnapshot = next;
  return next;
}

/**
 * Hook that provides reactive auth state in React components.
 * Automatically re-renders when auth state changes.
 */
export function usePortalAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const login = useCallback(
    (credentials: { email: string; password: string }) => authStore.login(credentials),
    []
  );

  const logout = useCallback(() => authStore.logout(), []);

  const refreshSession = useCallback(() => authStore.refreshSession(), []);

  return {
    // State
    isAuthenticated: state.isAuthenticated && !state.isLoading,
    isLoading: state.isLoading,
    isProcessing: state.isProcessing,
    user: state.user as AnyUser | null,
    role: state.role,
    error: state.error,
    isFirstLogin: state.isFirstLogin,

    // Derived
    isAdmin: state.role === 'admin' && state.isAuthenticated,
    isClient: state.role === 'client' && state.isAuthenticated,

    // Actions
    login,
    logout,
    refreshSession,
    clearError: authStore.clearError
  };
}
