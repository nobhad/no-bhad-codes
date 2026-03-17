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
  const pendingSubtab = React.useRef<string | null>(null);

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
      // Navigation will change pathname, triggering the useEffect below.
      // Store the intended subtab so the effect applies it instead of resetting.
      pendingSubtab.current = subtabId;
      switchTab(groupForTab);
      navigate(`/${groupForTab}`);
    } else {
      setSubtab(subtabId);
    }
  }, [switchTab, navigate, location.pathname, setSubtab]);

  // Reset to overview on pathname change, but apply pending subtab if set
  React.useEffect(() => {
    if (pendingSubtab.current) {
      setSubtab(pendingSubtab.current);
      pendingSubtab.current = null;
    } else {
      setSubtab('overview');
    }
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
