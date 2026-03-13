/**
 * ===============================================
 * PORTAL SIDEBAR
 * ===============================================
 * @file src/react/app/PortalSidebar.tsx
 *
 * React replacement for server/views/partials/sidebar.ejs.
 * Renders navigation links from unified-navigation config,
 * filtered by the current user role.
 */

import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  useNavItems,
  useSidebarCollapsed,
  useCurrentGroup,
  useSwitchTab
} from '../stores/portal-store';
import { usePortalAuth } from '../hooks/usePortalAuth';
import { SIDEBAR_ICONS } from './portal-icons';

// ============================================
// COMPONENT
// ============================================

export function PortalSidebar() {
  const navItems = useNavItems();
  const collapsed = useSidebarCollapsed();
  const location = useLocation();
  const { logout } = usePortalAuth();
  const switchTab = useSwitchTab();

  const handleLogout = React.useCallback(async () => {
    await logout();
  }, [logout]);

  const currentPath = location.pathname.replace(/^\//, '');
  const currentGroup = useCurrentGroup();

  return (
    <aside
      className={`sidebar${collapsed ? ' collapsed' : ''}`}
      id="sidebar"
      role="navigation"
      aria-label="Portal navigation"
    >
      <div className="sidebar-content">
        <nav className="sidebar-buttons">
          {navItems
            .filter((item) => !item.group)
            .map((item) => {
              const tabId = item.dataTab || item.id;
              const isActive = currentPath === tabId || currentPath === item.id || currentGroup === tabId;
              const IconSvg = SIDEBAR_ICONS[item.icon];

              return (
                <Link
                  key={item.id}
                  to={`/${tabId}`}
                  className={`nav-btn${isActive ? ' is-active' : ''}`}
                  id={`btn-${item.id}`}
                  data-tab={tabId}
                  data-shortcut={item.shortcut}
                  aria-label={item.ariaLabel || item.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => switchTab(tabId)}
                >
                  {IconSvg && (
                    <IconSvg className="nav-icon" aria-hidden="true" />
                  )}
                  <span className="nav-label">{item.label}</span>
                  {item.badge && (
                    <span
                      className="sidebar-badge"
                      id={item.badge}
                      aria-label={`${item.label.toLowerCase()} count`}
                    />
                  )}
                </Link>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="nav-btn btn-logout"
            id="btn-logout"
            aria-label="Sign out"
            onClick={handleLogout}
          >
            {SIDEBAR_ICONS.logOut && (
              <SIDEBAR_ICONS.logOut className="nav-icon" aria-hidden="true" />
            )}
            <span className="nav-label">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
