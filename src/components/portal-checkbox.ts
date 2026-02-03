/**
 * ===============================================
 * PORTAL CHECKBOX COMPONENT
 * ===============================================
 * @file src/components/portal-checkbox.ts
 *
 * Reusable custom checkbox (16px, system-sized) for admin and client portal.
 * Renders wrapper + input; styling in shared/portal-forms.css (darkest grey bg when unchecked).
 */

export interface PortalCheckboxConfig {
  /** Input id (e.g. "clients-select-all") */
  id?: string;
  /** Input name for form submission */
  name?: string;
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Accessible label (e.g. "Select all clients") */
  ariaLabel: string;
  /** Extra CSS class on the input (e.g. "bulk-select-all", "leads-row-select") */
  inputClassName?: string;
  /** Extra CSS class on the wrapper (optional) */
  wrapperClassName?: string;
  /** Input value (e.g. for filter options) */
  value?: string;
  /** Optional data-* attributes for the input (e.g. { rowId: "123" } -> data-row-id="123") */
  dataAttributes?: Record<string, string | number>;
}

function escapeAttr(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function dataAttrs(attrs: Record<string, string | number>): string {
  return Object.entries(attrs)
    .map(([key, value]) => {
      const dataKey = key.startsWith('data-') ? key : `data-${key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}`;
      return `${dataKey}="${escapeAttr(String(value))}"`;
    })
    .join(' ');
}

/**
 * Returns HTML for a portal checkbox (wrapper + hidden native input).
 * Use class .portal-checkbox on the wrapper; styles in portal-forms.css.
 */
export function getPortalCheckboxHTML(config: PortalCheckboxConfig): string {
  const {
    id,
    name,
    checked = false,
    ariaLabel,
    inputClassName = '',
    wrapperClassName = '',
    dataAttributes = {},
    value
  } = config;

  const wrapperClass = ['portal-checkbox', wrapperClassName].filter(Boolean).join(' ');
  const inputClass = inputClassName.trim();
  const attrs = [
    'type="checkbox"',
    id ? `id="${escapeAttr(id)}"` : '',
    name ? `name="${escapeAttr(name)}"` : '',
    value !== undefined ? `value="${escapeAttr(value)}"` : '',
    inputClass ? `class="${escapeAttr(inputClass)}"` : '',
    `aria-label="${escapeAttr(ariaLabel)}"`,
    checked ? 'checked' : '',
    Object.keys(dataAttributes).length ? dataAttrs(dataAttributes) : ''
  ].filter(Boolean).join(' ');

  return `<div class="${escapeAttr(wrapperClass)}"><input ${attrs} /></div>`;
}
