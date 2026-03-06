/**
 * ===============================================
 * SET COPYRIGHT YEAR UTILITY
 * ===============================================
 * @file src/utils/set-copyright-year.ts
 *
 * Sets the current year in a copyright element.
 *
 * Migrated from inline <script> in server/views/partials/footer.ejs
 * and client/set-password.html
 */

/**
 * Set the text content of an element to the current year.
 * @param elementId - The ID of the element to update
 */
export function setCopyrightYear(elementId: string): void {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = new Date().getFullYear().toString();
  }
}
