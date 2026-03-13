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
import { ErrorBoundary } from '../components/portal/ErrorBoundary';
import { CommandPalette, useCommandPalette } from '../components/portal/CommandPalette';
import { KeyboardShortcutsOverlay, useKeyboardShortcuts } from '../components/portal/KeyboardShortcutsOverlay';
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
// GLOBAL POWER-USER SHORTCUTS
// ============================================

/**
 * Keyboard shortcuts available to all users:
 * - / : Focus the search input on the current page
 * - r : Refresh the current page (click the refresh button)
 * - g+m : Go to messages
 * - g+d : Go to dashboard
 * - g+p : Go to projects
 */
function GlobalKeyboardShortcuts() {
  const switchTab = usePortalStore((s) => s.switchTab);
  const pendingGRef = React.useRef(false);
  const gTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Skip if modifier keys are held (let browser/OS handle)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // "g then X" sequences for navigation
      if (pendingGRef.current) {
        pendingGRef.current = false;
        if (gTimerRef.current) {
          clearTimeout(gTimerRef.current);
          gTimerRef.current = null;
        }

        const goToMap: Record<string, string> = {
          d: 'dashboard',
          m: 'messages',
          p: 'projects',
          i: 'invoices',
          s: 'settings'
        };

        if (goToMap[key]) {
          e.preventDefault();
          switchTab(goToMap[key]);
          window.location.hash = `/${usePortalStore.getState().currentTab}`;
          return;
        }
      }

      // "g" starts a navigation sequence
      if (key === 'g') {
        pendingGRef.current = true;
        // Timeout to cancel if no follow-up key
        gTimerRef.current = setTimeout(() => {
          pendingGRef.current = false;
        }, 500);
        return;
      }

      // "/" focuses the first search input on the page
      if (key === '/') {
        const searchInput = document.querySelector<HTMLInputElement>(
          '.search-bar-input, .search-filter-input, [data-search-input]'
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      // "r" clicks the refresh button
      if (key === 'r') {
        const refreshBtn = document.querySelector<HTMLButtonElement>(
          '[title="Refresh"], [aria-label="Refresh"]'
        );
        if (refreshBtn) {
          e.preventDefault();
          refreshBtn.click();
        }

      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [switchTab]);

  return null;
}

// ============================================
// ROOT COMPONENT
// ============================================

function PortalAppInner() {
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { open: shortcutsOpen, setOpen: setShortcutsOpen } = useKeyboardShortcuts();

  return (
    <AuthInitializer>
      <AdminKeyboardShortcuts />
      <GlobalKeyboardShortcuts />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <PortalRoutes />
    </AuthInitializer>
  );
}

export function PortalApp() {
  return (
    <ErrorBoundary componentName="Portal">
      <PortalProviders>
        <PortalAppInner />
      </PortalProviders>
    </ErrorBoundary>
  );
}
