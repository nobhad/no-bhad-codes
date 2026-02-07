/**
 * ===============================================
 * VIEW TOGGLE (REUSABLE)
 * ===============================================
 * @file src/components/view-toggle.ts
 *
 * Renders a segmented control: two or more options, one active.
 * Use for Table/Pipeline, List/Grid, Board/List, etc.
 * Inactive option gets darker bg; active gets primary color.
 */

export interface ViewToggleOption {
  /** Value passed to onChange when this option is selected */
  value: string;
  /** Visible label (optional if iconSvg is set) */
  label: string;
  /** Tooltip (defaults to label) */
  title?: string;
  /** aria-label (defaults to label) */
  ariaLabel?: string;
  /** Optional SVG markup for icon (e.g. from ICONS or inline) */
  iconSvg?: string;
}

export interface ViewToggleConfig {
  /** Options; one will be active based on value */
  options: ViewToggleOption[];
  /** Currently selected value */
  value: string;
  /** Called when user selects a different option */
  onChange: (value: string) => void;
  /** Optional id for the root element */
  id?: string;
  /** Optional extra class name(s) for the root */
  className?: string;
  /** Optional aria-label for the group */
  ariaLabel?: string;
}

/**
 * Create a view toggle (segmented control). Returns the root div.
 * Mount it where the toggle should appear (e.g. replace existing placeholder).
 */
export function createViewToggle(config: ViewToggleConfig): HTMLDivElement {
  const { options, value, onChange, id, className = '', ariaLabel } = config;

  const root = document.createElement('div');
  root.className = ['view-toggle', className].filter(Boolean).join(' ');
  if (id) root.id = id;
  if (ariaLabel) root.setAttribute('aria-label', ariaLabel);
  root.setAttribute('role', 'group');

  options.forEach((opt) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-value', opt.value);
    button.title = opt.title ?? opt.label;
    button.setAttribute('aria-label', opt.ariaLabel ?? opt.label);
    if (opt.value === value) button.classList.add('active');

    if (opt.iconSvg) {
      const iconWrap = document.createElement('span');
      iconWrap.innerHTML = opt.iconSvg;
      iconWrap.classList.add('view-toggle-icon');
      button.appendChild(iconWrap);
    }
    if (opt.label) {
      const span = document.createElement('span');
      span.textContent = opt.label;
      button.appendChild(span);
    }

    button.addEventListener('click', () => {
      // Check if already active (don't use closure value - it's stale)
      if (button.classList.contains('active')) return;
      root.querySelectorAll('button').forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      onChange(opt.value);
    });

    root.appendChild(button);
  });

  return root;
}
