/**
 * ===============================================
 * PORTAL HEADER
 * ===============================================
 * @file src/react/app/PortalHeader.tsx
 *
 * React replacement for server/views/partials/portal-header.ejs.
 * Renders the global header with branding, sidebar toggle,
 * page title, notification bell container, and theme toggle.
 */

import * as React from 'react';
import { Sun, Moon, PanelLeft } from 'lucide-react';
import {
  usePageTitle,
  usePortalTheme,
  usePortalRole,
  useToggleTheme,
  useToggleSidebar
} from '../stores/portal-store';
import { usePortalAuth } from '../hooks/usePortalAuth';
import { NotificationBell } from '../components/portal/NotificationBell';
// ============================================
// COMPONENT
// ============================================

export function PortalHeader() {
  const pageTitle = usePageTitle();
  const role = usePortalRole();
  const theme = usePortalTheme();
  const toggleTheme = useToggleTheme();
  const toggleSidebar = useToggleSidebar();
  const { user } = usePortalAuth();

  // Get display name from user based on role
  const userName = React.useMemo(() => {
    if (!user) return null;
    if (user.role === 'client') return user.contactName;
    return user.username || user.email;
  }, [user]);

  return (
    <>
      <header className="portal-global-header">
        <div className="portal-global-header-left">
          <a href="/" className="header-branding" aria-label="Go to homepage">
            <img
              src="/images/avatar_small_sidebar.svg"
              alt=""
              className="header-avatar"
            />
            <span className="header-logo-text">NO BHAD CODES</span>
          </a>

          <button
            className="header-sidebar-toggle"
            id="header-sidebar-toggle"
            aria-label="Toggle sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeft
              size={18}
              className="sidebar-toggle-icon"
              aria-hidden="true"
            />
          </button>

          <h1
            className="header-page-title"
            id={role === 'client' ? 'portal-page-title' : 'admin-page-title'}
          >
            {role === 'client' && userName ? (
              <>
                Welcome Back, <span id="client-name">{userName}</span>!
              </>
            ) : (
              pageTitle
            )}
          </h1>
        </div>

        <div className="portal-global-header-right">
          <NotificationBell />

          <button
            id="header-toggle-theme"
            className="header-theme-toggle"
            aria-label="Toggle dark/light theme"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            )}
          </button>
        </div>
      </header>
    </>
  );
}
