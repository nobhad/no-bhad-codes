/**
 * ===============================================
 * LAZY TAB ROUTE
 * ===============================================
 * @file src/react/app/LazyTabRoute.tsx
 *
 * Wrapper component for tab routes that:
 * 1. Syncs the portal store's current tab on mount
 * 2. Passes standard props to the child component
 * 3. Handles route-level error boundaries
 */

import * as React from 'react';
import { usePortalStore } from '../stores/portal-store';
import { usePortalContext } from './PortalProviders';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBoundary } from '../components/portal/ErrorBoundary';

interface LazyTabRouteProps {
  tabId: string;
  children: React.ReactNode;
}

/**
 * Syncs the portal store when a route becomes active,
 * and provides navigation + notification props to child components.
 */
export function LazyTabRoute({ tabId, children }: LazyTabRouteProps) {
  const switchTab = usePortalStore((s) => s.switchTab);
  const navigate = useNavigate();
  const params = useParams();
  const { showNotification, getAuthToken } = usePortalContext();

  // Bumping this counter changes the wrapping element's `key`, forcing React
  // to unmount the child subtree and remount it — which re-runs data hooks.
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Sync store on mount/tabId change
  React.useEffect(() => {
    switchTab(tabId);
  }, [tabId, switchTab]);

  // Build props to inject into the child component
  const childProps = React.useMemo(() => ({
    onNavigate: (tab: string, entityId?: string) => {
      if (entityId) {
        navigate(`/${tab}/${entityId}`);
      } else {
        navigate(`/${tab}`);
      }
    },
    onNavigateToTab: (tab: string) => navigate(`/${tab}`),
    showNotification,
    getAuthToken,
    refreshData: () => {
      // Force a remount of the child so data-fetching hooks re-fire.
      setRefreshKey((k) => k + 1);
    },
    // Pass URL params for detail views
    ...(params.clientId ? { clientId: parseInt(params.clientId, 10) } : {}),
    ...(params.projectId ? { projectId: parseInt(params.projectId, 10) } : {}),
    // Back navigation for detail views
    ...(tabId === 'project-detail' ? { onBack: () => navigate('/projects') } : {}),
    ...(tabId === 'client-detail' ? { onBack: () => navigate('/clients') } : {})
  }), [navigate, showNotification, getAuthToken, params, tabId]);

  // Clone child element with injected props, wrapped in an error boundary
  // so a crash in one tab does not affect the portal layout or other tabs.
  // The inner key={refreshKey} forces an unmount/remount when refreshData()
  // is invoked by a child component.
  if (React.isValidElement(children)) {
    return (
      <ErrorBoundary componentName={tabId}>
        <React.Fragment key={refreshKey}>
          {React.cloneElement(children, childProps)}
        </React.Fragment>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary componentName={tabId}>
      <React.Fragment key={refreshKey}>
        {children}
      </React.Fragment>
    </ErrorBoundary>
  );
}
