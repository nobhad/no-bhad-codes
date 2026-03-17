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
import { useSidebarCollapsed, usePortalRole, useCurrentTab, useCurrentGroup } from '../stores/portal-store';
import { PORTAL_SELECTORS } from '../config/portal-constants';

export function PortalLayout() {
  const collapsed = useSidebarCollapsed();
  const role = usePortalRole();
  const currentTab = useCurrentTab();
  const currentGroup = useCurrentGroup();

  // Sync sidebar-collapsed class on the mount container.
  // classList is intentional here: the .portal container is rendered by the
  // EJS server template (not React), so we cannot control its attributes via
  // JSX. This is the standard bridge pattern for syncing React state to a
  // server-rendered DOM node. The CSS selector `.sidebar-collapsed` is used
  // across portal layout stylesheets for grid/width adjustments.
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

  // Sync data attributes for CSS visibility rules
  // portal-layout.css uses [data-active-group] and [data-active-tab] on body
  // to show/hide subtab groups and header controls
  React.useEffect(() => {
    document.body.setAttribute('data-active-group', currentGroup || currentTab || '');
    document.body.setAttribute('data-active-tab', currentTab || '');
  }, [currentGroup, currentTab]);

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
