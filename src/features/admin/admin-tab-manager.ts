/**
 * ===============================================
 * ADMIN TAB MANAGER
 * ===============================================
 * @file src/features/admin/admin-tab-manager.ts
 *
 * Tab configuration, navigation resolution, breadcrumbs,
 * and page title management for the admin dashboard.
 */

import { renderBreadcrumbs, type BreadcrumbItem } from '../../components/breadcrumbs';
import type { AdminProjectDetails } from './admin-project-details';

/** Admin tab titles for dynamic page header */
export const ADMIN_TAB_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  contacts: 'Contacts',
  projects: 'Projects',
  clients: 'Clients',
  invoices: 'Invoices',
  contracts: 'Contracts',
  tasks: 'Tasks',
  messages: 'Messages',
  analytics: 'Analytics',
  'document-requests': 'Document Requests',
  'ad-hoc-requests': 'Ad Hoc Requests',
  questionnaires: 'Questionnaires',
  support: 'Knowledge Base',
  system: 'Settings',
  work: 'Work',
  crm: 'CRM',
  documents: 'Documents',
  'client-detail': 'Client Details',
  'project-detail': 'Project Details'
};

/** Tab groups that use INTERNAL VIEW pattern (one component handles all subtabs) */
export const ADMIN_TAB_GROUPS = {
  work: {
    label: 'Work',
    tabs: ['overview', 'projects', 'tasks', 'ad-hoc-requests'],
    defaultTab: 'overview'
  },
  crm: {
    label: 'CRM',
    tabs: ['overview', 'leads', 'contacts', 'messages', 'clients'],
    defaultTab: 'overview'
  },
  documents: {
    label: 'Documents',
    tabs: ['overview', 'invoices', 'contracts', 'document-requests', 'questionnaires'],
    defaultTab: 'overview'
  },
  system: {
    label: 'Settings',
    tabs: ['overview', 'configuration', 'workflows', 'email-templates', 'audit-log', 'system-health'],
    defaultTab: 'overview'
  },
  support: {
    label: 'Knowledge Base',
    tabs: ['overview', 'categories', 'articles'],
    defaultTab: 'overview'
  },
  analytics: {
    label: 'Analytics',
    tabs: ['overview', 'revenue', 'leads', 'projects'],
    defaultTab: 'overview'
  }
} as const;

export type AdminTabGroup = keyof typeof ADMIN_TAB_GROUPS;

/** Groups that have a parent dashboard component (mount the group, not the defaultTab) */
const GROUPS_WITH_PARENT_COMPONENT = ['analytics', 'system', 'support', 'work', 'crm', 'documents'] as const;

/**
 * Find which group a tab belongs to (if any).
 */
export function getAdminGroupForTab(tabName: string): AdminTabGroup | null {
  const entries = Object.entries(ADMIN_TAB_GROUPS) as [
    AdminTabGroup,
    (typeof ADMIN_TAB_GROUPS)[AdminTabGroup],
  ][];
  for (const [group, config] of entries) {
    if ((config.tabs as readonly string[]).includes(tabName)) return group;
  }
  return null;
}

/**
 * Resolve a tab name to its effective tab and group.
 */
export function resolveAdminTab(tabName: string): { group: AdminTabGroup | null; tab: string } {
  if (tabName in ADMIN_TAB_GROUPS) {
    const group = tabName as AdminTabGroup;
    if ((GROUPS_WITH_PARENT_COMPONENT as readonly string[]).includes(group)) {
      return { group, tab: group };
    }
    return { group, tab: ADMIN_TAB_GROUPS[group].defaultTab };
  }

  return { group: getAdminGroupForTab(tabName), tab: tabName };
}

/**
 * Update the admin header page title based on active tab/section.
 */
export function updateAdminPageTitle(
  tabName: string,
  projectDetails: AdminProjectDetails
): void {
  const titleEl = document.getElementById('admin-page-title');
  if (!titleEl) return;

  if (tabName === 'client-detail') {
    titleEl.textContent = 'Client';
    return;
  }

  if (tabName === 'project-detail') {
    const projectName = projectDetails.getCurrentProjectName() || 'Project';
    titleEl.textContent = projectName;
    return;
  }

  const group = getAdminGroupForTab(tabName);
  if (group) {
    titleEl.textContent = ADMIN_TAB_GROUPS[group].label;
    return;
  }

  titleEl.textContent = ADMIN_TAB_TITLES[tabName] || 'Dashboard';
}

/**
 * Update admin header breadcrumbs based on active tab/section.
 */
export function updateAdminBreadcrumbs(
  tabName: string,
  projectDetails: AdminProjectDetails,
  switchTab: (tab: string) => void
): void {
  const list = document.getElementById('breadcrumb-list');
  if (!list) return;

  const goOverview = (): void => switchTab('dashboard');
  const goClients = (): void => switchTab('clients');
  const goProjects = (): void => switchTab('projects');

  const items: BreadcrumbItem[] = [];

  const group = getAdminGroupForTab(tabName);
  if (group) {
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({
      label: ADMIN_TAB_GROUPS[group].label,
      href: true,
      onClick: () => switchTab(group)
    });
    items.push({ label: ADMIN_TAB_TITLES[tabName] || tabName, href: false });
    renderBreadcrumbs(list, items);
    return;
  }

  switch (tabName) {
  case 'dashboard':
    items.push({ label: 'Dashboard', href: false });
    break;
  case 'clients':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Clients', href: false });
    break;
  case 'invoices':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Invoices', href: false });
    break;
  case 'contracts':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Contracts', href: false });
    break;
  case 'tasks':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Tasks', href: false });
    break;
  case 'client-detail': {
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Clients', href: true, onClick: goClients });
    items.push({ label: 'Client', href: false });
    break;
  }
  case 'leads':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Leads', href: false });
    break;
  case 'projects':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Projects', href: false });
    break;
  case 'project-detail': {
    const projectName = projectDetails.getCurrentProjectName();
    const label = projectName
      ? projectName.length > 40
        ? `${projectName.slice(0, 37)}...`
        : projectName
      : 'Project';
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Projects', href: true, onClick: goProjects });
    items.push({ label, href: false });
    break;
  }
  case 'messages':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Messages', href: false });
    break;
  case 'analytics':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Analytics', href: false });
    break;
  case 'support':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Knowledge Base', href: false });
    break;
  case 'documents':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Documents', href: false });
    break;
  case 'document-requests':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Document Requests', href: false });
    break;
  case 'system':
    items.push({ label: 'Dashboard', href: true, onClick: goOverview });
    items.push({ label: 'Settings', href: false });
    break;
  default:
    items.push({ label: 'Dashboard', href: false });
  }

  renderBreadcrumbs(list, items);
}

/**
 * Update the active sidebar nav item and body dataset.
 */
export function updateActiveGroupState(
  group: string | null,
  tabName: string
): string {
  const activeGroup = group || tabName;

  document.body.dataset.activeGroup = activeGroup;
  document.body.dataset.activeTab = tabName;

  // Update sidebar nav items
  document.querySelectorAll('.sidebar-buttons .btn[data-tab]').forEach((btn) => {
    const isActive = (btn as HTMLElement).dataset.tab === activeGroup;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  // Update subtab active states for PRIMARY subtab groups only
  const subtabGroup = document.querySelector(
    `.header-subtab-group[data-for-tab="${activeGroup}"]`
  ) as HTMLElement | null;
  const groupMode = subtabGroup?.dataset.mode?.replace(/["']/g, '');
  if (subtabGroup && groupMode === 'primary') {
    const subtabs = subtabGroup.querySelectorAll('.portal-subtab[data-subtab]');
    const hasMatchingSubtab = Array.from(subtabs).some(
      (btn) => (btn as HTMLElement).dataset.subtab === tabName
    );

    if (hasMatchingSubtab) {
      subtabs.forEach((btn) => {
        btn.classList.toggle('active', (btn as HTMLElement).dataset.subtab === tabName);
      });
    }
  }

  return activeGroup;
}
