/**
 * ===============================================
 * NAVIGATION COMPONENTS (REUSABLE)
 * ===============================================
 * @file src/components/navigation.ts
 *
 * Reusable navigation components: Tabs, Sidebar, NavItem, StepIndicator.
 */

import { ICONS } from '../constants/icons';
import { cx } from '../utils/dom-utils';

// ===============================================
// TYPES
// ===============================================

export interface TabItem {
  /** Unique tab ID */
  id: string;
  /** Tab label */
  label: string;
  /** Optional icon HTML */
  icon?: string;
  /** Optional badge count */
  badge?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Tab content (HTML element or HTML string) */
  content?: HTMLElement | string;
}

export interface TabsConfig {
  /** Tab items */
  tabs: TabItem[];
  /** Initially active tab ID */
  activeTab?: string;
  /** Tab style */
  variant?: 'underline' | 'pills' | 'boxed';
  /** Layout direction */
  layout?: 'horizontal' | 'vertical';
  /** Additional class names */
  className?: string;
  /** Tab change handler */
  onChange?: (tabId: string) => void;
}

export interface NavItemConfig {
  /** Unique item ID */
  id: string;
  /** Item label */
  label: string;
  /** Optional icon HTML */
  icon?: string;
  /** Optional href for link */
  href?: string;
  /** Active state */
  active?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Optional badge count */
  badge?: number;
  /** Has submenu indicator */
  hasSubmenu?: boolean;
  /** Submenu expanded state */
  expanded?: boolean;
  /** Submenu items */
  children?: NavItemConfig[];
  /** Click handler */
  onClick?: (id: string, event: Event) => void;
}

export interface SidebarConfig {
  /** Sidebar items */
  items: NavItemConfig[];
  /** Initially collapsed to icons only */
  collapsed?: boolean;
  /** Show collapse toggle button */
  showToggle?: boolean;
  /** Header element or text */
  header?: HTMLElement | string;
  /** Footer element or text */
  footer?: HTMLElement | string;
  /** Additional class names */
  className?: string;
  /** Item click handler */
  onItemClick?: (id: string, event: Event) => void;
  /** Collapse state change handler */
  onToggle?: (collapsed: boolean) => void;
}

export interface StepItem {
  /** Step ID */
  id: string;
  /** Step label */
  label: string;
  /** Optional description */
  description?: string;
  /** Step state */
  state?: 'upcoming' | 'current' | 'completed';
}

export interface StepIndicatorConfig {
  /** Step items */
  steps: StepItem[];
  /** Current step index (0-based) */
  currentStep?: number;
  /** Layout direction */
  layout?: 'horizontal' | 'vertical';
  /** Allow clicking on completed steps */
  clickable?: boolean;
  /** Additional class names */
  className?: string;
  /** Step click handler */
  onStepClick?: (stepIndex: number, stepId: string) => void;
}

// ===============================================
// TABS COMPONENT
// ===============================================

/**
 * Create a tabbed interface with tab buttons and content panels.
 */
export function createTabs(config: TabsConfig): HTMLElement {
  const {
    tabs,
    activeTab,
    variant = 'underline',
    layout = 'horizontal',
    className = '',
    onChange
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx(
    'tabs',
    `tabs-${variant}`,
    `tabs-${layout}`,
    className
  );

  // Tab list
  const tabList = document.createElement('div');
  tabList.className = 'tabs-list';
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-orientation', layout);

  // Tab panels container
  const panels = document.createElement('div');
  panels.className = 'tabs-panels';

  const initialActive = activeTab || tabs[0]?.id;

  tabs.forEach((tab, _index) => {
    // Tab button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = cx('tabs-tab', tab.disabled && 'disabled');
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `tabpanel-${tab.id}`);
    button.setAttribute('aria-selected', String(tab.id === initialActive));
    button.id = `tab-${tab.id}`;
    button.disabled = tab.disabled || false;
    button.tabIndex = tab.id === initialActive ? 0 : -1;

    if (tab.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'tabs-tab-icon';
      iconSpan.innerHTML = tab.icon;
      button.appendChild(iconSpan);
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'tabs-tab-label';
    labelSpan.textContent = tab.label;
    button.appendChild(labelSpan);

    if (tab.badge !== undefined) {
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'tabs-tab-badge';
      badgeSpan.textContent = String(tab.badge);
      button.appendChild(badgeSpan);
    }

    if (tab.id === initialActive) {
      button.classList.add('active');
    }

    // Tab click handler
    button.addEventListener('click', () => {
      if (tab.disabled) return;

      // Update buttons
      tabList.querySelectorAll('.tabs-tab').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
        (btn as HTMLButtonElement).tabIndex = -1;
      });
      button.classList.add('active');
      button.setAttribute('aria-selected', 'true');
      button.tabIndex = 0;

      // Update panels
      panels.querySelectorAll('.tabs-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.setAttribute('hidden', '');
      });
      const targetPanel = document.getElementById(`tabpanel-${tab.id}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
        targetPanel.removeAttribute('hidden');
      }

      onChange?.(tab.id);
    });

    // Keyboard navigation
    button.addEventListener('keydown', (e) => {
      const tabButtons = Array.from(tabList.querySelectorAll('.tabs-tab:not([disabled])')) as HTMLButtonElement[];
      const currentIndex = tabButtons.indexOf(button);

      let newIndex: number | null = null;
      if (layout === 'horizontal') {
        if (e.key === 'ArrowRight') newIndex = (currentIndex + 1) % tabButtons.length;
        if (e.key === 'ArrowLeft') newIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
      } else {
        if (e.key === 'ArrowDown') newIndex = (currentIndex + 1) % tabButtons.length;
        if (e.key === 'ArrowUp') newIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
      }
      if (e.key === 'Home') newIndex = 0;
      if (e.key === 'End') newIndex = tabButtons.length - 1;

      if (newIndex !== null) {
        e.preventDefault();
        tabButtons[newIndex].focus();
        tabButtons[newIndex].click();
      }
    });

    tabList.appendChild(button);

    // Tab panel
    const panel = document.createElement('div');
    panel.className = cx('tabs-panel', tab.id === initialActive && 'active');
    panel.id = `tabpanel-${tab.id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${tab.id}`);
    panel.tabIndex = 0;
    if (tab.id !== initialActive) {
      panel.setAttribute('hidden', '');
    }

    if (tab.content) {
      if (typeof tab.content === 'string') {
        panel.innerHTML = tab.content;
      } else {
        panel.appendChild(tab.content);
      }
    }

    panels.appendChild(panel);
  });

  wrapper.appendChild(tabList);
  wrapper.appendChild(panels);

  return wrapper;
}

/**
 * Switch to a specific tab programmatically
 */
export function switchTab(tabsWrapper: HTMLElement, tabId: string): void {
  const tab = tabsWrapper.querySelector(`#tab-${tabId}`) as HTMLButtonElement;
  if (tab) {
    tab.click();
  }
}

// ===============================================
// NAV ITEM COMPONENT
// ===============================================

/**
 * Create a navigation item (link or button).
 */
export function createNavItem(config: NavItemConfig): HTMLElement {
  const {
    id,
    label,
    icon,
    href,
    active = false,
    disabled = false,
    badge,
    hasSubmenu = false,
    expanded = false,
    children,
    onClick
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-item-wrapper';

  // Main item
  const item = href ? document.createElement('a') : document.createElement('button');
  item.className = cx(
    'nav-item',
    active && 'active',
    disabled && 'disabled',
    hasSubmenu && 'has-submenu'
  );
  item.setAttribute('data-nav-id', id);

  if (href && !disabled) {
    (item as HTMLAnchorElement).href = href;
  }
  if (!href) {
    (item as HTMLButtonElement).type = 'button';
    (item as HTMLButtonElement).disabled = disabled;
  }
  if (active) {
    item.setAttribute('aria-current', 'page');
  }
  if (hasSubmenu) {
    item.setAttribute('aria-expanded', String(expanded));
  }

  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'nav-item-icon';
    iconSpan.innerHTML = icon;
    item.appendChild(iconSpan);
  }

  const labelSpan = document.createElement('span');
  labelSpan.className = 'nav-item-label';
  labelSpan.textContent = label;
  item.appendChild(labelSpan);

  if (badge !== undefined) {
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'nav-item-badge';
    badgeSpan.textContent = String(badge);
    item.appendChild(badgeSpan);
  }

  if (hasSubmenu) {
    const chevron = document.createElement('span');
    chevron.className = 'nav-item-chevron';
    chevron.innerHTML = ICONS.CHEVRON_DOWN || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
    item.appendChild(chevron);
  }

  if (onClick && !disabled) {
    item.addEventListener('click', (e) => onClick(id, e));
  }

  wrapper.appendChild(item);

  // Submenu
  if (hasSubmenu && children && children.length > 0) {
    const submenu = document.createElement('div');
    submenu.className = cx('nav-submenu', expanded && 'expanded');
    submenu.setAttribute('role', 'group');

    children.forEach(child => {
      submenu.appendChild(createNavItem(child));
    });

    // Toggle submenu
    item.addEventListener('click', (e) => {
      if (hasSubmenu) {
        e.preventDefault();
        const isExpanded = item.getAttribute('aria-expanded') === 'true';
        item.setAttribute('aria-expanded', String(!isExpanded));
        submenu.classList.toggle('expanded', !isExpanded);
      }
    });

    wrapper.appendChild(submenu);
  }

  return wrapper;
}

// ===============================================
// SIDEBAR COMPONENT
// ===============================================

/**
 * Create a sidebar navigation component.
 */
export function createSidebar(config: SidebarConfig): HTMLElement {
  const {
    items,
    collapsed = false,
    showToggle = true,
    header,
    footer,
    className = '',
    onItemClick,
    onToggle
  } = config;

  const sidebar = document.createElement('nav');
  sidebar.className = cx(
    'sidebar',
    collapsed && 'sidebar-collapsed',
    className
  );
  sidebar.setAttribute('aria-label', 'Main navigation');

  // Header
  if (header) {
    const headerEl = document.createElement('div');
    headerEl.className = 'sidebar-header';
    if (typeof header === 'string') {
      headerEl.innerHTML = header;
    } else {
      headerEl.appendChild(header);
    }
    sidebar.appendChild(headerEl);
  }

  // Toggle button
  if (showToggle) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sidebar-toggle';
    toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    toggle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/>
    </svg>`;

    toggle.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
      toggle.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
      onToggle?.(isCollapsed);
    });

    sidebar.appendChild(toggle);
  }

  // Navigation items
  const nav = document.createElement('div');
  nav.className = 'sidebar-nav';

  items.forEach(item => {
    const navItem = createNavItem({
      ...item,
      onClick: (id, e) => {
        item.onClick?.(id, e);
        onItemClick?.(id, e);
      }
    });
    nav.appendChild(navItem);
  });

  sidebar.appendChild(nav);

  // Footer
  if (footer) {
    const footerEl = document.createElement('div');
    footerEl.className = 'sidebar-footer';
    if (typeof footer === 'string') {
      footerEl.innerHTML = footer;
    } else {
      footerEl.appendChild(footer);
    }
    sidebar.appendChild(footerEl);
  }

  return sidebar;
}

/**
 * Toggle sidebar collapsed state
 */
export function toggleSidebar(sidebar: HTMLElement): boolean {
  const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
  const toggle = sidebar.querySelector('.sidebar-toggle');
  if (toggle) {
    toggle.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
  }
  return isCollapsed;
}

/**
 * Set active nav item in sidebar
 */
export function setActiveNavItem(sidebar: HTMLElement, itemId: string): void {
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    item.removeAttribute('aria-current');
  });
  const target = sidebar.querySelector(`[data-nav-id="${itemId}"]`);
  if (target) {
    target.classList.add('active');
    target.setAttribute('aria-current', 'page');
  }
}

// ===============================================
// STEP INDICATOR COMPONENT
// ===============================================

/**
 * Create a step indicator for multi-step processes.
 */
export function createStepIndicator(config: StepIndicatorConfig): HTMLElement {
  const {
    steps,
    currentStep = 0,
    layout = 'horizontal',
    clickable = false,
    className = '',
    onStepClick
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = cx(
    'step-indicator',
    `step-indicator-${layout}`,
    className
  );
  wrapper.setAttribute('role', 'list');
  wrapper.setAttribute('aria-label', 'Progress steps');

  steps.forEach((step, index) => {
    const state = step.state || (index < currentStep ? 'completed' : index === currentStep ? 'current' : 'upcoming');

    const stepEl = document.createElement('div');
    stepEl.className = cx(
      'step-item',
      `step-${state}`,
      clickable && state === 'completed' && 'step-clickable'
    );
    stepEl.setAttribute('role', 'listitem');
    if (state === 'current') {
      stepEl.setAttribute('aria-current', 'step');
    }

    // Step marker
    const marker = document.createElement('div');
    marker.className = 'step-marker';

    if (state === 'completed') {
      marker.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    } else {
      marker.textContent = String(index + 1);
    }

    // Step content
    const content = document.createElement('div');
    content.className = 'step-content';

    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = step.label;
    content.appendChild(label);

    if (step.description) {
      const desc = document.createElement('span');
      desc.className = 'step-description';
      desc.textContent = step.description;
      content.appendChild(desc);
    }

    // Connector line (not on last item)
    if (index < steps.length - 1) {
      const connector = document.createElement('div');
      connector.className = 'step-connector';
      stepEl.appendChild(connector);
    }

    stepEl.appendChild(marker);
    stepEl.appendChild(content);

    // Click handler
    if (clickable && state === 'completed') {
      stepEl.addEventListener('click', () => {
        onStepClick?.(index, step.id);
      });
    }

    wrapper.appendChild(stepEl);
  });

  return wrapper;
}

/**
 * Update step indicator to show a new current step
 */
export function setCurrentStep(wrapper: HTMLElement, stepIndex: number): void {
  const steps = wrapper.querySelectorAll('.step-item');
  steps.forEach((step, index) => {
    step.classList.remove('step-completed', 'step-current', 'step-upcoming');
    step.removeAttribute('aria-current');

    const marker = step.querySelector('.step-marker');

    if (index < stepIndex) {
      step.classList.add('step-completed');
      if (marker) {
        marker.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      }
    } else if (index === stepIndex) {
      step.classList.add('step-current');
      step.setAttribute('aria-current', 'step');
      if (marker) {
        marker.textContent = String(index + 1);
      }
    } else {
      step.classList.add('step-upcoming');
      if (marker) {
        marker.textContent = String(index + 1);
      }
    }
  });
}
