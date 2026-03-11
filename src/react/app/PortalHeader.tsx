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
import { Sun, Moon, PanelLeft, ChevronDown } from 'lucide-react';
import {
  usePageTitle,
  usePortalTheme,
  usePortalRole,
  useToggleTheme,
  useToggleSidebar,
  useProjects,
  useProjectCount,
  useActiveProjectId,
  useSetActiveProject
} from '../stores/portal-store';
import { usePortalAuth } from '../hooks/usePortalAuth';
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
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

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
                className={`project-selector-option${project.id === activeProjectId ? ' active' : ''}`}
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
            <span className="header-avatar" aria-hidden="true" />
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

          {role === 'client' && <ProjectSelector />}
        </div>

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
      </header>
    </>
  );
}
