/**
 * ===============================================
 * PORTAL LAYOUT
 * ===============================================
 * @file src/react/app/PortalLayout.tsx
 *
 * Main layout component for the portal SPA.
 * Renders sidebar + header + content area.
 * Replaces server/views/layouts/portal.ejs structure.
 *
 * Mounts directly into the existing .portal element (no wrapper div),
 * so we sync container-level classes via useEffect rather than
 * rendering an outer <div>.
 */

import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';
import { PortalSubtabs } from './PortalSubtabs';
import { RouteErrorBoundary } from '../components/portal/RouteErrorBoundary';
import { useSidebarCollapsed, usePortalRole } from '../stores/portal-store';
import { PORTAL_SELECTORS } from '../config/portal-constants';

export function PortalLayout() {
  const collapsed = useSidebarCollapsed();
  const role = usePortalRole();

  // Sync sidebar-collapsed class on the mount container
  // (the .portal div is owned by EJS, not React)
  React.useEffect(() => {
    const container = document.querySelector(PORTAL_SELECTORS.PORTAL_CONTAINER) as HTMLElement | null;
    if (container) {
      container.classList.toggle('sidebar-collapsed', collapsed);
    }
  }, [collapsed]);

  // Keep the container ID consistent with the active role
  React.useEffect(() => {
    const container = document.querySelector(PORTAL_SELECTORS.PORTAL_CONTAINER) as HTMLElement | null;
    if (container) {
      container.id = role === 'admin' ? 'admin-dashboard' : 'client-dashboard';
    }
  }, [role]);

  return (
    <>
      <PortalHeader />

      <div className="portal-body">
        <PortalSidebar />

        <div className="dashboard-content" id="dashboard-content" role="main">
          <div className="section">
            <PortalSubtabs />
            <RouteErrorBoundary>
              <React.Suspense fallback={<TabLoadingFallback />}>
                <Outlet />
              </React.Suspense>
            </RouteErrorBoundary>
          </div>
        </div>
      </div>
    </>
  );
}

function TabLoadingFallback() {
  return (
    <div className="tab-content is-active">
      <div className="loading-state">
        <div className="loading-spinner" />
        <p className="loading-text">Loading...</p>
      </div>
    </div>
  );
}
