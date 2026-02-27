/**
 * ===============================================
 * SAFE DOM MANIPULATION UTILITIES
 * ===============================================
 * @file src/utils/safe-dom.ts
 *
 * XSS-safe DOM manipulation utilities.
 * Use these instead of direct innerHTML assignments.
 *
 * SECURITY: All methods ensure user data is properly escaped
 * before being inserted into the DOM.
 */

import { SanitizationUtils } from './sanitization-utils';
import { createLogger } from './logger';

const logger = createLogger('SafeDOM');

/**
 * Wrapper class for trusted HTML content.
 * Content marked as TrustedHtml will not be escaped by safeHtml.
 */
export class TrustedHtml {
  constructor(public readonly html: string) {}
  toString(): string {
    return this.html;
  }
}

/**
 * Template literal tag for creating safe HTML strings.
 * Automatically escapes all interpolated values.
 *
 * @example
 * const name = '<script>alert("xss")</script>';
 * const html = safeHtml`<div>Hello, ${name}!</div>`;
 * // Result: <div>Hello, &lt;script&gt;alert("xss")&lt;/script&gt;!</div>
 */
export function safeHtml(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  return strings.reduce((result, str, i) => {
    const value = values[i - 1];
    const escaped = escapeValue(value);
    return result + escaped + str;
  });
}

/**
 * Mark a string as already-safe HTML (pre-escaped or from trusted source).
 * Use sparingly and only for HTML that has already been sanitized.
 *
 * @example
 * const iconHtml = trustHtml(ICONS.EDIT); // SVG icons are trusted
 * const html = safeHtml`<button>${iconHtml}</button>`;
 */
export function trustHtml(html: string): TrustedHtml {
  return new TrustedHtml(html);
}

/**
 * Escape a value for safe HTML insertion.
 */
function escapeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // TrustedHtml is not escaped
  if (value instanceof TrustedHtml) {
    return value.html;
  }

  // Arrays: escape each element and join
  if (Array.isArray(value)) {
    return value.map(escapeValue).join('');
  }

  // Everything else: convert to string and escape
  return SanitizationUtils.escapeHtml(String(value));
}

/**
 * Safely set innerHTML on an element.
 * All dynamic values in the HTML should already be escaped.
 *
 * @param element - The element to update
 * @param html - The HTML string (should use safeHtml template or be pre-escaped)
 * @param options - Additional options
 */
export function setInnerHTML(
  element: HTMLElement | null,
  html: string,
  options: { allowScripts?: boolean } = {}
): void {
  if (!element) {
    logger.warn('setInnerHTML called with null element');
    return;
  }

  // Security check: detect potential XSS in the HTML
  if (!options.allowScripts && SanitizationUtils.detectXss(html)) {
    logger.error('XSS pattern detected in HTML, blocking insertion');
    SanitizationUtils.logSecurityViolation('innerHTML_xss_blocked', {
      htmlLength: html.length,
      sample: html.substring(0, 200)
    });
    return;
  }

  element.innerHTML = html;
}

/**
 * Safely set text content on an element.
 * Always use this for text-only content instead of innerHTML.
 *
 * @param element - The element to update
 * @param text - The text content (will NOT be interpreted as HTML)
 */
export function setText(
  element: HTMLElement | null,
  text: string | number | null | undefined
): void {
  if (!element) return;
  element.textContent = text === null || text === undefined ? '' : String(text);
}

/**
 * Create an element with safe text content.
 *
 * @example
 * const span = createTextElement('span', userName, { className: 'user-name' });
 */
export function createTextElement(
  tagName: string,
  text: string | number | null | undefined,
  attributes?: Record<string, string>
): HTMLElement {
  const element = document.createElement(tagName);
  element.textContent = text === null || text === undefined ? '' : String(text);

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        // Skip dataset, handle separately
      } else {
        element.setAttribute(key, value);
      }
    }
  }

  return element;
}

/**
 * Safely build a table row using DOM methods instead of innerHTML.
 *
 * @example
 * const row = buildTableRow([
 *   { text: client.name },
 *   { text: client.email, className: 'email-cell' },
 *   { html: trustHtml(actionsHtml) }
 * ]);
 */
export function buildTableRow(
  cells: Array<{
    text?: string | number | null;
    html?: TrustedHtml | string;
    className?: string;
    dataLabel?: string;
    colSpan?: number;
  }>,
  rowAttributes?: Record<string, string>
): HTMLTableRowElement {
  const row = document.createElement('tr');

  if (rowAttributes) {
    for (const [key, value] of Object.entries(rowAttributes)) {
      if (key.startsWith('data-')) {
        row.dataset[key.substring(5)] = value;
      } else {
        row.setAttribute(key, value);
      }
    }
  }

  for (const cell of cells) {
    const td = document.createElement('td');

    if (cell.className) {
      td.className = cell.className;
    }

    if (cell.dataLabel) {
      td.dataset.label = cell.dataLabel;
    }

    if (cell.colSpan) {
      td.colSpan = cell.colSpan;
    }

    if (cell.html !== undefined) {
      // HTML content (should be pre-sanitized or TrustedHtml)
      const htmlString = cell.html instanceof TrustedHtml ? cell.html.html : cell.html;
      td.innerHTML = htmlString;
    } else {
      // Text content (automatically safe)
      td.textContent = cell.text === null || cell.text === undefined ? '' : String(cell.text);
    }

    row.appendChild(td);
  }

  return row;
}

/**
 * Escape a value and return as a string.
 * Use when building HTML strings manually.
 *
 * @example
 * const html = `<div class="name">${escape(userName)}</div>`;
 */
export function escape(value: unknown): string {
  return escapeValue(value);
}

/**
 * Batch update text content for multiple elements by ID.
 * More efficient than individual updates.
 *
 * @example
 * batchSetText({
 *   'stat-total': stats.total,
 *   'stat-active': stats.active,
 *   'stat-pending': stats.pending
 * });
 */
export function batchSetText(updates: Record<string, string | number | null | undefined>): void {
  for (const [id, value] of Object.entries(updates)) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value === null || value === undefined ? '' : String(value);
    }
  }
}

/**
 * Create an element with attributes and optional children.
 *
 * @example
 * const div = createElement('div', { className: 'card' }, [
 *   createElement('h3', {}, 'Title'),
 *   createElement('p', {}, description)
 * ]);
 */
export function createElement(
  tagName: string,
  attributes?: Record<string, string | boolean | undefined>,
  children?: Array<HTMLElement | string> | string
): HTMLElement {
  const element = document.createElement(tagName);

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === false) continue;

      if (key === 'className') {
        element.className = String(value);
      } else if (key.startsWith('data')) {
        const dataKey = key.replace(/^data/, '').replace(/^[A-Z]/, c => c.toLowerCase());
        element.dataset[dataKey] = String(value);
      } else if (value === true) {
        element.setAttribute(key, '');
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  if (children) {
    if (typeof children === 'string') {
      element.textContent = children;
    } else {
      for (const child of children) {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else {
          element.appendChild(child);
        }
      }
    }
  }

  return element;
}

/**
 * Safely parse HTML string and return document fragment.
 * Removes dangerous elements and attributes.
 *
 * @example
 * const fragment = parseHtmlSafe('<p>Hello</p><script>alert("xss")</script>');
 * // Returns fragment with only <p>Hello</p>
 */
// eslint-disable-next-line no-undef
export function parseHtmlSafe(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;

  const fragment = template.content;

  // Remove dangerous elements
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'style'];
  for (const tag of dangerousTags) {
    const elements = fragment.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  }

  // Remove dangerous attributes
  const allElements = fragment.querySelectorAll('*');
  allElements.forEach(el => {
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'href' && attr.value.startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return fragment;
}
