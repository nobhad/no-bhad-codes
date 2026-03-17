/**
 * ===============================================
 * PORTAL SUBTABS
 * ===============================================
 * @file src/react/app/PortalSubtabs.tsx
 *
 * Renders the header subtab groups based on current
 * active group. Uses SubtabContext for state management.
 *
 * All subtab groups use the context pattern: clicking a subtab
 * calls setSubtab() so the parent component switches its internal
 * view. The URL stays on the group route (e.g. /work).
 *
 * Dashboard components can inject page-specific actions (date range,
 * refresh, export) into the subtab row via setActions().
 */

import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  useSubtabGroups,
  useCurrentTab,
  useCurrentGroup,
  useSwitchTab
} from '../stores/portal-store';
import { useSubtabContext } from '../contexts/SubtabContext';
import { DETAIL_VIEW_TABS } from '../../../server/config/unified-navigation';

export function PortalSubtabs() {
  const subtabGroups = useSubtabGroups();
  const currentTab = useCurrentTab();
  const currentGroup = useCurrentGroup();
  const switchTab = useSwitchTab();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeSubtab, setSubtab, actions } = useSubtabContext();

  const activeGroup = currentGroup || currentTab;

  const handleSubtabClick = React.useCallback((subtabId: string, groupForTab: string) => {
    if (subtabId === 'overview') {
      switchTab(groupForTab);
      navigate(`/${groupForTab}`);
      setSubtab('overview');
      return;
    }

    const currentPath = location.pathname.replace(/^\//, '');
    if (currentPath !== groupForTab) {
      switchTab(groupForTab);
      navigate(`/${groupForTab}`);
      // Set after a tick so the component has mounted
      setTimeout(() => setSubtab(subtabId), 0);
    } else {
      setSubtab(subtabId);
    }
  }, [switchTab, navigate, location.pathname, setSubtab]);

  // Reset to overview when navigating away
  React.useEffect(() => {
    setSubtab('overview');
  }, [location.pathname, setSubtab]);

  // Find the subtab group that matches the current active group
  const activeSubtabGroup = subtabGroups.find(
    (group) => group.forTab === activeGroup
  );

  // Detail views (client-detail, project-detail) have their own internal tabs
  if (DETAIL_VIEW_TABS[currentTab]) return null;

  if (!activeSubtabGroup) return null;

  return (
    <div className="portal-header-subtabs">
      <div className="header-subtabs">
        <div
          className="portal-subtabs header-subtab-group"
          data-for-tab={activeSubtabGroup.forTab}
        >
          {activeSubtabGroup.subtabs.map((subtab) => {
            const isActive = subtab.id === activeSubtab;

            return (
              <button
                key={subtab.id}
                className={`portal-subtab${isActive ? ' is-active' : ''}`}
                data-subtab={subtab.id}
                onClick={() => handleSubtabClick(subtab.id, activeSubtabGroup.forTab)}
              >
                {subtab.label}
              </button>
            );
          })}
        </div>
      </div>
      {/* Page-specific actions rendered inline on the right */}
      {actions && (
        <div className="header-subtab-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
