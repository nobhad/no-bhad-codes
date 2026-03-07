/**
 * ===============================================
 * PORTAL PROVIDERS
 * ===============================================
 * @file src/react/app/PortalProviders.tsx
 *
 * Wraps the portal app with all required context providers:
 * - HashRouter for client-side routing
 * - PortalContext for shared portal state
 */

import * as React from 'react';
import { HashRouter } from 'react-router-dom';
import { showToast } from '../../utils/toast-notifications';

// ============================================
// PORTAL CONTEXT
// ============================================

export interface PortalContextValue {
  showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  getAuthToken: () => string | null;
}

const PortalContext = React.createContext<PortalContextValue | null>(null);

export function usePortalContext(): PortalContextValue {
  const ctx = React.useContext(PortalContext);
  if (!ctx) {
    throw new Error('usePortalContext must be used within PortalProviders');
  }
  return ctx;
}

// ============================================
// PROVIDER COMPONENT
// ============================================

interface PortalProvidersProps {
  children: React.ReactNode;
}

export function PortalProviders({ children }: PortalProvidersProps) {
  const contextValue = React.useMemo<PortalContextValue>(() => ({
    showNotification: (message, type) => {
      showToast(message, type);
    },
    // Auth is cookie-based; token getter is unused but kept for interface compat
    getAuthToken: () => null
  }), []);

  return (
    <HashRouter>
      <PortalContext.Provider value={contextValue}>
        {children}
      </PortalContext.Provider>
    </HashRouter>
  );
}
