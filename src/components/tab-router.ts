/**
 * ===============================================
 * TAB ROUTER (REUSABLE)
 * ===============================================
 * @file src/components/tab-router.ts
 *
 * Shared tab switching for admin and client portals.
 * Handles: show/hide tab content, active button state, optional onChange callback.
 * Portals still own data loading; this only does DOM and notifies on change.
 */

export interface TabRouterConfig {
  /** Selector for tab buttons (e.g. .sidebar-buttons .btn[data-tab]) */
  buttonSelector: string;
  /** ID prefix for tab content panels (e.g. "tab-" => tab-overview, tab-leads) */
  contentIdPrefix: string;
  /** Optional: fallback selector for tab content (e.g. .tab-content) */
  contentSelector?: string;
  /** Optional: class name for active tab content */
  activeClass?: string;
  /** Optional: called when tab changes so portal can load data */
  onChange?: (tabName: string) => void;
}

/**
 * Set up tab switching: when a button with data-tab is clicked,
 * hide all tab content, show the matching one, update active button, call onChange.
 */
export function setupTabRouter(config: TabRouterConfig): void {
  const {
    buttonSelector,
    contentIdPrefix,
    contentSelector = '.tab-content',
    activeClass = 'active',
    onChange
  } = config;

  const buttons = document.querySelectorAll(buttonSelector);

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = (btn as HTMLElement).dataset.tab;
      if (!tabName) return;

      // Update active button
      buttons.forEach((b) => {
        b.classList.remove(activeClass);
        b.removeAttribute('aria-current');
      });
      btn.classList.add(activeClass);
      btn.setAttribute('aria-current', 'page');

      // Hide all tab content, show selected
      const allContent = document.querySelectorAll(contentSelector);
      allContent.forEach((el) => el.classList.remove(activeClass));
      const target = document.getElementById(`${contentIdPrefix}${tabName}`);
      if (target) target.classList.add(activeClass);

      onChange?.(tabName);
    });
  });
}
