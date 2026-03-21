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
import { Link } from 'react-router-dom';
import { Sun, Moon, PanelLeft, ChevronDown, ChevronRight, Search } from 'lucide-react';
import {
  usePageTitle,
  usePortalTheme,
  usePortalRole,
  useToggleTheme,
  useToggleSidebar,
  useProjects,
  useProjectCount,
  useActiveProjectId,
  useSetActiveProject,
  useCurrentTab,
  useCurrentGroup
} from '../stores/portal-store';
import { UNIFIED_TAB_GROUPS, DETAIL_VIEW_TABS } from '../../../server/config/unified-navigation';
import { useClickOutside } from '../hooks/useClickOutside';
import { NotificationBell } from '../components/portal/NotificationBell';
// ============================================
// PROJECT SELECTOR (client portal only)
// ============================================

function ProjectSelector() {
  const projects = useProjects();
  const projectCount = useProjectCount();
  const activeProjectId = useActiveProjectId();
  const setActiveProject = useSetActiveProject();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleSelect = React.useCallback((projectId: number) => {
    setActiveProject(projectId);
    setIsOpen(false);
  }, [setActiveProject]);

  // Close on outside click
  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  // Only show when client has multiple projects
  if (projectCount <= 1) return null;

  return (
    <div className="project-selector" ref={dropdownRef}>
      <button
        type="button"
        className="project-selector-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select project"
      >
        <span className="project-selector-name">
          {activeProject?.name ?? 'Select Project'}
        </span>
        <ChevronDown className="icon-xs" aria-hidden="true" />
      </button>
      {isOpen && (
        <ul className="project-selector-dropdown" role="listbox" aria-label="Projects">
          {projects.map((project) => (
            <li key={project.id} role="option" aria-selected={project.id === activeProjectId}>
              <button
                type="button"
                className={`project-selector-option${project.id === activeProjectId ? ' is-active' : ''}`}
                onClick={() => handleSelect(project.id)}
              >
                {project.name}
                <span className="project-selector-status">{project.status}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================
// HEADER BREADCRUMBS
// ============================================

function HeaderBreadcrumbs() {
  const pageTitle = usePageTitle();
  const currentTab = useCurrentTab();
  const currentGroup = useCurrentGroup();

  const groupLabel = currentGroup ? UNIFIED_TAB_GROUPS[currentGroup]?.label : null;
  const isSubtab = currentGroup && currentTab !== currentGroup;
  const isDashboard = currentTab === 'dashboard';
  const detailConfig = DETAIL_VIEW_TABS[currentTab] ?? null;

  return (
    <div className="breadcrumb-trail" aria-label="Breadcrumb">
      {/* Dashboard root crumb */}
      {isDashboard ? (
        <span className="breadcrumb-current">Dashboard</span>
      ) : (
        <>
          <Link className="breadcrumb-link" to="/dashboard">Dashboard</Link>
          <ChevronRight className="breadcrumb-separator" aria-hidden="true" />
        </>
      )}

      {/* Group crumb (when inside a group subtab) */}
      {!isDashboard && isSubtab && groupLabel && (
        <>
          <Link className="breadcrumb-link" to={`/${currentGroup}`}>{groupLabel}</Link>
          <ChevronRight className="breadcrumb-separator" aria-hidden="true" />
        </>
      )}

      {/* Parent list crumb for detail views (e.g., Clients, Projects) */}
      {!isDashboard && detailConfig && (
        <>
          <Link className="breadcrumb-link" to={`/${detailConfig.parentTab}`}>{detailConfig.parentLabel}</Link>
          <ChevronRight className="breadcrumb-separator" aria-hidden="true" />
        </>
      )}

      {/* Current page */}
      {!isDashboard && (
        <span className="breadcrumb-current">{pageTitle}</span>
      )}
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

interface PortalHeaderProps {
  onSearchOpen?: () => void;
}

export function PortalHeader({ onSearchOpen }: PortalHeaderProps = {}) {
  const role = usePortalRole();
  const theme = usePortalTheme();
  const toggleTheme = useToggleTheme();
  const toggleSidebar = useToggleSidebar();

  return (
    <>
      <header className="portal-global-header">
        <div className="portal-global-header-breadcrumbs">
          <button
            className="header-sidebar-toggle"
            id="header-sidebar-toggle"
            aria-label="Toggle sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeft
              className="sidebar-toggle-icon"
              aria-hidden="true"
            />
          </button>

          <HeaderBreadcrumbs />

          {/* Search trigger — always visible */}
          <button
            type="button"
            className="header-search-trigger"
            onClick={onSearchOpen}
            aria-label="Open search"
          >
            <Search className="icon-xs" aria-hidden="true" />
            <span className="header-search-placeholder">Search...</span>
            <kbd className="header-search-shortcut">&#8984;K</kbd>
          </button>

          <div className="portal-global-header-right">
            <NotificationBell />

            <button
              id="header-toggle-theme"
              className="header-theme-toggle"
              aria-label="Toggle dark/light theme"
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <Sun aria-hidden="true" />
              ) : (
                <Moon aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="portal-global-header-row">
          <div className="portal-global-header-left">
            <a href="/" className="header-branding" aria-label="Go to homepage">
              <span className="header-avatar" aria-hidden="true" />
              <span className="header-logo-text">NO BHAD CODES</span>
            </a>

            {role === 'client' && <ProjectSelector />}
          </div>
        </div>
      </header>
    </>
  );
}
