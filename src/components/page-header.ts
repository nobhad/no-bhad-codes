/**
 * ===============================================
 * PAGE HEADER (REUSABLE)
 * ===============================================
 * @file src/components/page-header.ts
 *
 * Renders the .page-header block (sidebar toggle + h2). Use in admin and
 * client portal so markup is shared and consistent.
 */

export interface PageHeaderConfig {
  title: string;
  /** Show sidebar toggle button (default true) */
  showToggle?: boolean;
  /** Aria label for toggle (default "Toggle sidebar") */
  toggleAriaLabel?: string;
}

/**
 * Create the .page-header DOM. Mount at top of tab content.
 */
export function createPageHeader(config: PageHeaderConfig): HTMLElement {
  const { title, showToggle = true, toggleAriaLabel = 'Toggle sidebar' } = config;

  const wrap = document.createElement('div');
  wrap.className = 'page-header';

  if (showToggle) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'header-sidebar-toggle';
    toggle.setAttribute('aria-label', toggleAriaLabel);
    toggle.textContent = '\u25C0'; // ◀
    wrap.appendChild(toggle);
  }

  const h2 = document.createElement('h2');
  h2.textContent = title;
  wrap.appendChild(h2);

  return wrap;
}
