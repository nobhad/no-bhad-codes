/**
 * ===============================================
 * PORTAL APP
 * ===============================================
 * @file src/react/app/PortalApp.tsx
 *
 * Root React component for the portal SPA.
 * Replaces the vanilla TS orchestrators (PortalShell,
 * AdminDashboard, ClientPortalModule).
 *
 * Initializes:
 * - Auth state from authStore
 * - Portal store with role-based config
 * - React Router with hash routing
 * - Keyboard shortcuts (admin)
 */

import * as React from 'react';
import { PortalProviders } from './PortalProviders';
import { PortalRoutes } from './PortalRoutes';
import { usePortalStore } from '../stores/portal-store';
import { usePortalAuth } from '../hooks/usePortalAuth';
import type { UserRole } from '../../../server/config/unified-navigation';

// ============================================
// AUTH INITIALIZER
// ============================================

/**
 * Initializes portal store role from auth state.
 * Must be inside PortalProviders for router access.
 */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { role, isAuthenticated } = usePortalAuth();
  const setRole = usePortalStore((s) => s.setRole);
  const currentRole = usePortalStore((s) => s.role);

  React.useEffect(() => {
    if (isAuthenticated && role && role !== currentRole) {
      setRole(role as UserRole);
    }
  }, [isAuthenticated, role, currentRole, setRole]);

  return <>{children}</>;
}

// ============================================
// KEYBOARD SHORTCUTS (admin)
// ============================================

function AdminKeyboardShortcuts() {
  const role = usePortalStore((s) => s.role);
  const navItems = usePortalStore((s) => s.navItems);
  const switchTab = usePortalStore((s) => s.switchTab);

  React.useEffect(() => {
    if (role !== 'admin') return;

    function handleKeydown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = e.key;
      if (key >= '1' && key <= '9') {
        const item = navItems.find((nav) => nav.shortcut === key);
        if (item) {
          e.preventDefault();
          switchTab(item.id);
          // Update URL hash
          window.location.hash = `/${usePortalStore.getState().currentTab}`;
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [role, navItems, switchTab]);

  return null;
}

// ============================================
// ROOT COMPONENT
// ============================================

export function PortalApp() {
  return (
    <PortalProviders>
      <AuthInitializer>
        <AdminKeyboardShortcuts />
        <PortalRoutes />
      </AuthInitializer>
    </PortalProviders>
  );
}
