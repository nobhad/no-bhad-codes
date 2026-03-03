/**
 * ===============================================
 * TEXT DECODING UTILITIES
 * ===============================================
 * @file src/react/utils/decodeText.ts
 *
 * Utilities for decoding HTML entities in API responses.
 * Prevents double-encoding issues (e.g., "&amp;" displaying instead of "&").
 */

/**
 * Decode HTML entities in a string
 * Uses the browser's built-in HTML parser via textarea element
 *
 * @example
 * decodeHtmlEntities("Emily Gold &amp; Abigail Wolf") // "Emily Gold & Abigail Wolf"
 * decodeHtmlEntities("&lt;script&gt;") // "<script>"
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return '';

  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Decode specified string fields in an object
 * Preserves other fields unchanged
 *
 * @example
 * decodeObjectFields(lead, ['contact_name', 'company_name', 'notes'])
 */
export function decodeObjectFields<T>(obj: T, fields: readonly string[]): T {
  const decoded = { ...obj } as T;

  for (const field of fields) {
    const value = (obj as Record<string, unknown>)[field];
    if (typeof value === 'string') {
      (decoded as Record<string, unknown>)[field] = decodeHtmlEntities(value);
    }
  }

  return decoded;
}

/**
 * Decode an array of objects, applying field decoding to each
 *
 * @example
 * decodeArrayFields(leads, ['contact_name', 'company_name'])
 */
export function decodeArrayFields<T>(items: T[], fields: readonly string[]): T[] {
  return items.map((item) => decodeObjectFields(item, fields));
}
