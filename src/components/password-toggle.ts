/**
 * ===============================================
 * PASSWORD TOGGLE COMPONENT
 * ===============================================
 * @file src/components/password-toggle.ts
 *
 * Reusable password visibility toggle with:
 * - Icon updates (eye/eye-off)
 * - ARIA labels for accessibility
 * - Consistent behavior across all login/password forms
 */

import { ICONS } from '../constants/icons';

/**
 * Configuration for password toggle
 */
interface PasswordToggleConfig {
  /** The password input element or its ID */
  input: HTMLInputElement | string;
  /** The toggle button element or its ID */
  toggle: HTMLButtonElement | string;
  /** Initial state - whether password is visible */
  initiallyVisible?: boolean;
}

/**
 * Initialize a password visibility toggle
 *
 * @example
 * // Initialize with element IDs
 * initPasswordToggle({
 *   input: 'password-input',
 *   toggle: 'password-toggle-btn'
 * });
 *
 * @example
 * // Initialize with DOM elements
 * const input = document.getElementById('password') as HTMLInputElement;
 * const toggle = document.getElementById('toggle-btn') as HTMLButtonElement;
 * initPasswordToggle({ input, toggle });
 */
export function initPasswordToggle(config: PasswordToggleConfig): void {
  // Resolve elements from IDs if needed
  const inputEl =
    typeof config.input === 'string'
      ? (document.getElementById(config.input) as HTMLInputElement | null)
      : config.input;

  const toggleEl =
    typeof config.toggle === 'string'
      ? (document.getElementById(config.toggle) as HTMLButtonElement | null)
      : config.toggle;

  console.log('[PasswordToggle] Input element:', inputEl);
  console.log('[PasswordToggle] Toggle element:', toggleEl);

  if (!inputEl || !toggleEl) {
    console.warn('[PasswordToggle] Input or toggle element not found');
    return;
  }

  // Prevent double initialization
  if (toggleEl.dataset.initialized === 'true') {
    console.log('[PasswordToggle] Already initialized, skipping');
    return;
  }
  toggleEl.dataset.initialized = 'true';

  // Set initial state
  const isVisible = config.initiallyVisible ?? false;
  inputEl.type = isVisible ? 'text' : 'password';
  updateToggleState(toggleEl, isVisible);
  console.log('[PasswordToggle] Toggle initialized for input:', config.input);

  // Add click handler
  toggleEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const currentlyVisible = inputEl.type === 'text';
    console.log('[PasswordToggle] Toggle clicked, current type:', inputEl.type, '-> changing to:', currentlyVisible ? 'password' : 'text');
    inputEl.type = currentlyVisible ? 'password' : 'text';
    console.log('[PasswordToggle] New type:', inputEl.type);
    updateToggleState(toggleEl, !currentlyVisible);
    // Keep focus on input for better UX
    inputEl.focus();
  });
}

/**
 * Update the toggle button's icon and aria-label
 */
function updateToggleState(toggle: HTMLButtonElement, isVisible: boolean): void {
  if (isVisible) {
    toggle.innerHTML = ICONS.EYE_OFF;
    toggle.setAttribute('aria-label', 'Hide password');
    toggle.setAttribute('aria-pressed', 'true');
  } else {
    toggle.innerHTML = ICONS.EYE;
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('aria-pressed', 'false');
  }
}

/**
 * Initialize all password toggles on the page
 * Looks for elements with data-password-toggle attribute
 *
 * @example
 * // HTML structure:
 * // <input type="password" id="my-password" />
 * // <button type="button" data-password-toggle="my-password">Show</button>
 *
 * // JavaScript:
 * initAllPasswordToggles();
 */
export function initAllPasswordToggles(): void {
  const toggles = document.querySelectorAll<HTMLButtonElement>('[data-password-toggle]');
  console.log('[PasswordToggle] Found', toggles.length, 'toggle buttons');

  toggles.forEach((toggle, index) => {
    const inputId = toggle.dataset.passwordToggle;
    console.log('[PasswordToggle] Processing toggle', index, 'for input:', inputId);
    if (inputId) {
      initPasswordToggle({
        input: inputId,
        toggle
      });
    }
  });
}

export default initPasswordToggle;
