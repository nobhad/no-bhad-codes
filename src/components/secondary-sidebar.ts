/**
 * ===============================================
 * SECONDARY SIDEBAR COMPONENT
 * ===============================================
 * @file src/components/secondary-sidebar.ts
 *
 * Reusable vertical tab navigation for multi-tab detail pages.
 * Used in project details, client details, and analytics views.
 *
 * Features:
 * - Vertical tabs with icons and labels
 * - Collapsible to icon-only mode
 * - State persistence via localStorage
 * - Horizontal tabs fallback on mobile
 * - Badge support for notification counts
 */

const STORAGE_KEY = 'secondary-sidebar-collapsed';

/**
 * Configuration for a secondary tab
 */
export interface SecondaryTab {
  /** Unique identifier for the tab */
  id: string;
  /** SVG icon string (Lucide-style) */
  icon: string;
  /** Display label for the tab */
  label: string;
  /** Optional badge count (e.g., unread count) */
  badge?: number;
  /** Optional aria-label (defaults to label) */
  ariaLabel?: string;
}

/**
 * Configuration for the secondary sidebar
 */
export interface SecondarySidebarConfig {
  /** Array of tabs to display */
  tabs: SecondaryTab[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;
  /** Optional title for the sidebar header (e.g., project name) */
  title?: string;
  /** Optional: callback when back button is clicked */
  onBack?: () => void;
  /** Optional: start collapsed */
  startCollapsed?: boolean;
  /** Optional: persist collapse state to localStorage */
  persistState?: boolean;
  /** Optional: container element to add .has-secondary-sidebar class */
  container?: HTMLElement | null;
}

/**
 * Secondary sidebar controller return type
 */
export interface SecondarySidebarController {
  /** Update the active tab */
  setActiveTab: (tabId: string) => void;
  /** Collapse the sidebar */
  collapse: () => void;
  /** Expand the sidebar */
  expand: () => void;
  /** Toggle collapsed state */
  toggle: () => void;
  /** Check if sidebar is collapsed */
  isCollapsed: () => boolean;
  /** Update badge count for a tab */
  setBadge: (tabId: string, count: number) => void;
  /** Destroy the sidebar and clean up */
  destroy: () => void;
  /** Get the sidebar element */
  getElement: () => HTMLElement;
  /** Get the horizontal tabs element */
  getHorizontalTabs: () => HTMLElement;
}

/**
 * Create a secondary sidebar with vertical tab navigation
 *
 * @param config - Configuration for the sidebar
 * @returns Controller object with methods to manage the sidebar
 */
export function createSecondarySidebar(config: SecondarySidebarConfig): SecondarySidebarController {
  const {
    tabs,
    activeTab,
    onTabChange,
    title = 'Navigation',
    onBack,
    startCollapsed = false,
    persistState = true,
    container
  } = config;

  let currentActiveTab = activeTab;
  let collapsed = startCollapsed;

  // Restore persisted state
  if (persistState) {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState !== null) {
      collapsed = savedState === 'true';
    }
  }

  // Create sidebar element
  const sidebar = document.createElement('aside');
  sidebar.className = 'secondary-sidebar';
  if (collapsed) {
    sidebar.classList.add('collapsed');
  }

  // Create header with back button, title and toggle
  const header = document.createElement('div');
  header.className = 'secondary-sidebar-header';

  // Back button (if onBack provided)
  if (onBack) {
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'secondary-sidebar-back';
    backBtn.setAttribute('aria-label', 'Go back');
    backBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
    backBtn.addEventListener('click', onBack);
    header.appendChild(backBtn);
  }

  const titleEl = document.createElement('span');
  titleEl.className = 'secondary-sidebar-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'secondary-sidebar-toggle';
  toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
  toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  toggleBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    updateCollapseState();
    if (persistState) {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    }
  });
  header.appendChild(toggleBtn);

  sidebar.appendChild(header);

  // Create nav container
  const nav = document.createElement('nav');
  nav.className = 'secondary-nav';

  // Create tab buttons
  const tabElements = new Map<string, HTMLButtonElement>();

  tabs.forEach(tab => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-nav-tab';
    if (tab.id === currentActiveTab) {
      button.classList.add('active');
    }
    button.setAttribute('data-tab', tab.id);
    button.setAttribute('data-tooltip', tab.label);
    button.setAttribute('aria-label', tab.ariaLabel || tab.label);

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'secondary-nav-tab-icon';
    iconSpan.innerHTML = tab.icon;
    button.appendChild(iconSpan);

    // Label
    const labelSpan = document.createElement('span');
    labelSpan.className = 'secondary-nav-tab-label';
    labelSpan.textContent = tab.label;
    button.appendChild(labelSpan);

    // Badge (if present)
    if (tab.badge !== undefined && tab.badge > 0) {
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'secondary-nav-tab-badge';
      badgeSpan.textContent = tab.badge > 99 ? '99+' : String(tab.badge);
      button.appendChild(badgeSpan);
    }

    button.addEventListener('click', () => {
      if (tab.id === currentActiveTab) return;
      currentActiveTab = tab.id;
      updateActiveTab();
      onTabChange(tab.id);
    });

    nav.appendChild(button);
    tabElements.set(tab.id, button);
  });

  sidebar.appendChild(nav);

  // Create horizontal tabs fallback (for mobile)
  const horizontalTabs = document.createElement('div');
  horizontalTabs.className = 'secondary-tabs-horizontal';

  const horizontalNav = document.createElement('nav');
  horizontalNav.className = 'secondary-tabs-horizontal-nav';

  tabs.forEach(tab => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-tab-horizontal';
    if (tab.id === currentActiveTab) {
      button.classList.add('active');
    }
    button.setAttribute('data-tab', tab.id);
    button.setAttribute('aria-label', tab.ariaLabel || tab.label);

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'secondary-tab-horizontal-icon';
    iconSpan.innerHTML = tab.icon;
    button.appendChild(iconSpan);

    // Label
    const labelSpan = document.createElement('span');
    labelSpan.className = 'secondary-tab-horizontal-label';
    labelSpan.textContent = tab.label;
    button.appendChild(labelSpan);

    button.addEventListener('click', () => {
      if (tab.id === currentActiveTab) return;
      currentActiveTab = tab.id;
      updateActiveTab();
      onTabChange(tab.id);
    });

    horizontalNav.appendChild(button);
  });

  horizontalTabs.appendChild(horizontalNav);

  // Add has-secondary-sidebar class to container
  if (container) {
    container.classList.add('has-secondary-sidebar');
  }

  /**
   * Update collapse state in DOM
   */
  function updateCollapseState(): void {
    if (collapsed) {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
  }

  /**
   * Update active tab in DOM (both sidebar and horizontal)
   */
  function updateActiveTab(): void {
    // Update sidebar tabs
    tabElements.forEach((button, id) => {
      if (id === currentActiveTab) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    // Update horizontal tabs
    horizontalNav.querySelectorAll('.secondary-tab-horizontal').forEach(button => {
      const tabId = button.getAttribute('data-tab');
      if (tabId === currentActiveTab) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Update badge for a specific tab
   */
  function setBadge(tabId: string, count: number): void {
    const button = tabElements.get(tabId);
    if (!button) return;

    // Find or create badge element
    let badge = button.querySelector('.secondary-nav-tab-badge') as HTMLSpanElement | null;

    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'secondary-nav-tab-badge';
        button.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : String(count);
    } else if (badge) {
      badge.remove();
    }
  }

  /**
   * Destroy the sidebar and clean up
   */
  function destroy(): void {
    sidebar.remove();
    horizontalTabs.remove();
    if (container) {
      container.classList.remove('has-secondary-sidebar');
    }
  }

  return {
    setActiveTab: (tabId: string) => {
      if (tabId === currentActiveTab) return;
      currentActiveTab = tabId;
      updateActiveTab();
    },
    collapse: () => {
      collapsed = true;
      updateCollapseState();
      if (persistState) {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
    },
    expand: () => {
      collapsed = false;
      updateCollapseState();
      if (persistState) {
        localStorage.setItem(STORAGE_KEY, 'false');
      }
    },
    toggle: () => {
      collapsed = !collapsed;
      updateCollapseState();
      if (persistState) {
        localStorage.setItem(STORAGE_KEY, String(collapsed));
      }
    },
    isCollapsed: () => collapsed,
    setBadge,
    destroy,
    getElement: () => sidebar,
    getHorizontalTabs: () => horizontalTabs
  };
}

/**
 * Standard icons for common tabs
 */
export const SECONDARY_TAB_ICONS = {
  /** Overview / Dashboard */
  OVERVIEW: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',

  /** Tasks / Todo */
  TASKS: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>',

  /** Files / Documents */
  FILES: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',

  /** Messages / Chat */
  MESSAGES: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',

  /** Contract / Agreement */
  CONTRACT: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="m9 15 2 2 4-4"/></svg>',

  /** Invoices / Billing */
  INVOICES: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>',

  /** Timeline / History */
  TIMELINE: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-6"/><path d="M12 14V8l-4 4"/><circle cx="12" cy="20" r="2"/><path d="M6 20h12"/><circle cx="12" cy="4" r="2"/></svg>',

  /** Settings / Config */
  SETTINGS: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',

  /** Analytics / Charts */
  ANALYTICS: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',

  /** Users / Team */
  USERS: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',

  /** Projects */
  PROJECTS: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/></svg>',

  /** Info / About */
  INFO: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',

  /** Milestones / Checkpoints */
  MILESTONES: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',

  /** Case Study */
  CASE_STUDY: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
};

export default createSecondarySidebar;
