/**
 * ===============================================
 * PORTAL SIDEBAR
 * ===============================================
 * @file src/react/app/PortalSidebar.tsx
 *
 * React replacement for server/views/partials/sidebar.ejs.
 * Renders navigation buttons from unified-navigation config,
 * filtered by the current user role.
 */

import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  useNavItems,
  useSidebarCollapsed,
  useCurrentGroup,
  useSwitchTab,
  usePortalStore
} from '../stores/portal-store';
import { usePortalAuth } from '../hooks/usePortalAuth';
import { SIDEBAR_ICONS } from './portal-icons';

// ============================================
// COMPONENT
// ============================================

export function PortalSidebar() {
  const navItems = useNavItems();
  const collapsed = useSidebarCollapsed();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = usePortalAuth();
  const switchTab = useSwitchTab();

  const handleNavClick = React.useCallback((tabId: string) => {
    switchTab(tabId);
    // Get resolved tab from store after switchTab
    const { currentTab } = usePortalStore.getState();
    navigate(`/${currentTab}`);
  }, [navigate, switchTab]);

  const handleLogout = React.useCallback(async () => {
    await logout();
    // Redirect handled by auth guard in PortalApp
  }, [logout]);

  // Determine active tab from URL and store group
  const currentPath = location.pathname.replace(/^\//, '');
  const currentGroup = useCurrentGroup();

  return (
    <aside
      className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}
      id="sidebar"
      role="navigation"
      aria-label="Portal navigation"
    >
      <div className="sidebar-content">
        <div className="sidebar-buttons">
          {navItems
            .filter((item) => !item.group) // Only show top-level items
            .map((item) => {
              const tabId = item.dataTab || item.id;
              const isActive = currentPath === tabId || currentPath === item.id || currentGroup === tabId;
              const IconSvg = SIDEBAR_ICONS[item.icon];

              return (
                <button
                  key={item.id}
                  className={`btn sidebar-btn${isActive ? ' active' : ''}`}
                  id={`btn-${item.id}`}
                  data-tab={tabId}
                  data-shortcut={item.shortcut}
                  aria-label={item.ariaLabel || item.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleNavClick(tabId)}
                >
                  {IconSvg && (
                    <IconSvg className="btn-icon" aria-hidden="true" />
                  )}
                  <span className="btn-text">{item.label}</span>
                  {item.badge && (
                    <span
                      className="sidebar-badge"
                      id={item.badge}
                      aria-label={`${item.label.toLowerCase()} count`}
                    />
                  )}
                </button>
              );
            })}
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="btn sidebar-btn btn-logout"
            id="btn-logout"
            aria-label="Sign out"
            onClick={handleLogout}
          >
            {SIDEBAR_ICONS.logOut && (
              <SIDEBAR_ICONS.logOut className="btn-icon" aria-hidden="true" />
            )}
            <span className="btn-text">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
