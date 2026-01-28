/**
 * ===============================================
 * BUTTON LOADING STATE UTILITIES
 * ===============================================
 * @file src/utils/button-loading.ts
 *
 * Reusable utilities for button loading states during form submissions.
 * Shows spinner, disables button, and prevents double-submit.
 */

/** Original button state for restoration */
interface ButtonState {
  disabled: boolean;
  innerHTML: string;
  ariaDisabled: string | null;
}

/** WeakMap to store original button states */
const buttonStates = new WeakMap<HTMLButtonElement, ButtonState>();

/**
 * Set a button to loading state
 * - Disables the button
 * - Shows a spinner with optional loading text
 * - Stores original state for restoration
 *
 * @param button - The button element
 * @param loadingText - Optional text to show (default: "Saving...")
 */
export function setButtonLoading(
  button: HTMLButtonElement | HTMLInputElement | null,
  loadingText = 'Saving...'
): void {
  if (!button) return;

  // Store original state if not already stored
  if (button instanceof HTMLButtonElement && !buttonStates.has(button)) {
    buttonStates.set(button, {
      disabled: button.disabled,
      innerHTML: button.innerHTML,
      ariaDisabled: button.getAttribute('aria-disabled')
    });
  }

  // Set loading state
  button.disabled = true;
  button.setAttribute('aria-disabled', 'true');
  button.setAttribute('aria-busy', 'true');

  // For button elements, replace content with spinner
  if (button instanceof HTMLButtonElement) {
    button.innerHTML = `
      <span class="loading-spinner loading-spinner--small" aria-hidden="true"></span>
      <span class="btn-loading-text">${loadingText}</span>
    `;
  } else {
    // For input[type="submit"], just change the value
    button.value = loadingText;
  }
}

/**
 * Clear the loading state and restore original button
 *
 * @param button - The button element
 * @param originalText - Optional text to restore (for input buttons)
 */
export function clearButtonLoading(
  button: HTMLButtonElement | HTMLInputElement | null,
  originalText?: string
): void {
  if (!button) return;

  // Restore from stored state if available
  if (button instanceof HTMLButtonElement) {
    const originalState = buttonStates.get(button);
    if (originalState) {
      button.disabled = originalState.disabled;
      button.innerHTML = originalState.innerHTML;
      if (originalState.ariaDisabled) {
        button.setAttribute('aria-disabled', originalState.ariaDisabled);
      } else {
        button.removeAttribute('aria-disabled');
      }
      buttonStates.delete(button);
    } else {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }
  } else {
    // For input[type="submit"]
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    if (originalText) {
      button.value = originalText;
    }
  }

  button.removeAttribute('aria-busy');
}

/**
 * Wrapper to execute an async function with button loading state
 * Automatically sets loading on start and clears on completion (success or error)
 *
 * @param button - The button element
 * @param asyncFn - The async function to execute
 * @param loadingText - Optional loading text
 * @returns The result of the async function
 */
export async function withButtonLoading<T>(
  button: HTMLButtonElement | HTMLInputElement | null,
  asyncFn: () => Promise<T>,
  loadingText = 'Saving...'
): Promise<T> {
  setButtonLoading(button, loadingText);
  try {
    return await asyncFn();
  } finally {
    clearButtonLoading(button);
  }
}
