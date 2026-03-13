/**
 * ===============================================
 * PORTAL SUBTABS
 * ===============================================
 * @file src/react/app/PortalSubtabs.tsx
 *
 * Renders the header subtab groups based on current
 * active group. Replaces the EJS subtab rendering.
 *
 * All subtab groups use the container pattern: clicking a subtab
 * dispatches a custom DOM event so the parent component switches
 * its internal view. The URL stays on the group route (e.g. /work).
 */

import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  useSubtabGroups,
  useCurrentTab,
  useCurrentGroup,
  useSwitchTab
} from '../stores/portal-store';

/**
 * Every subtab group dispatches a custom DOM event so the parent
 * component can switch its internal view. The parent stays mounted
 * on its own route (e.g. /work, /analytics) — no per-subtab routes.
 */
const GROUP_EVENTS: Record<string, string> = {
  work: 'workSubtabChange',
  crm: 'crmSubtabChange',
  documents: 'documentsSubtabChange',
  analytics: 'analyticsSubtabChange',
  system: 'systemSubtabChange',
  support: 'knowledgeBaseSubtabChange',
  settings: 'settingsSubtabChange'
};

export function PortalSubtabs() {
  const subtabGroups = useSubtabGroups();
  const currentTab = useCurrentTab();
  const currentGroup = useCurrentGroup();
  const switchTab = useSwitchTab();
  const navigate = useNavigate();
  const location = useLocation();

  const activeGroup = currentGroup || currentTab;

  // Track which container-group subtab is active (not in the URL)
  const [containerSubtab, setContainerSubtab] = React.useState<string | null>(null);

  // Reset container subtab when navigating away from a container group
  React.useEffect(() => {
    setContainerSubtab(null);
  }, [location.pathname]);

  const handleSubtabClick = React.useCallback((subtabId: string, groupForTab: string) => {
    const eventName = GROUP_EVENTS[groupForTab];

    if (subtabId === 'overview') {
      // Overview navigates to the parent group route and resets sub-view
      switchTab(groupForTab);
      navigate(`/${groupForTab}`);
      if (eventName) {
        document.dispatchEvent(
          new CustomEvent(eventName, { detail: { subtab: 'overview' } })
        );
      }
      setContainerSubtab(null);
      return;
    }

    // Stay on parent group route, dispatch event so the parent switches view
    const currentPath = location.pathname.replace(/^\//, '');
    if (currentPath !== groupForTab) {
      switchTab(groupForTab);
      navigate(`/${groupForTab}`);
      // Dispatch after a tick so the component has mounted
      if (eventName) {
        setTimeout(() => {
          document.dispatchEvent(
            new CustomEvent(eventName, { detail: { subtab: subtabId } })
          );
        }, 0);
      }
    } else if (eventName) {
      document.dispatchEvent(
        new CustomEvent(eventName, { detail: { subtab: subtabId } })
      );
    }
    setContainerSubtab(subtabId);
  }, [switchTab, navigate, location.pathname]);

  // Find the subtab group that matches the current active group
  const activeSubtabGroup = subtabGroups.find(
    (group) => group.forTab === activeGroup
  );

  if (!activeSubtabGroup) return null;

  return (
    <div className="portal-header-subtabs">
      <div className="header-subtabs">
        <div
          className="portal-subtabs header-subtab-group"
          data-for-tab={activeSubtabGroup.forTab}
          style={{ display: 'flex' }}
        >
          {activeSubtabGroup.subtabs.map((subtab) => {
            const isActive = subtab.id === 'overview'
              ? currentTab === activeSubtabGroup.forTab && !containerSubtab
              : containerSubtab === subtab.id;

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
    </div>
  );
}
