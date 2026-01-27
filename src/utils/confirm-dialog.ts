/**
 * ===============================================
 * CUSTOM CONFIRM DIALOG
 * ===============================================
 * @file src/utils/confirm-dialog.ts
 *
 * Replaces native browser confirm() with styled dialog
 * that matches the admin portal theme.
 */

export interface ConfirmDialogOptions {
  /** Dialog title */
  title?: string;
  /** Main message to display */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Makes confirm button red (for destructive actions) */
  danger?: boolean;
  /** Icon type to show */
  icon?: 'warning' | 'danger' | 'info' | 'question';
}

/**
 * Shows a custom confirm dialog and returns a Promise
 * that resolves to true (confirmed) or false (cancelled)
 *
 * @example
 * const confirmed = await confirmDialog({
 *   title: 'Delete Item',
 *   message: 'Are you sure you want to delete this item?',
 *   confirmText: 'Delete',
 *   danger: true
 * });
 * if (confirmed) {
 *   // proceed with deletion
 * }
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const {
    title = 'Confirm',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false,
    icon = 'question'
  } = options;

  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirm-dialog-title');

    // Get icon SVG based on type
    const iconSvg = getIconSvg(icon);

    // Create dialog HTML
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog-icon ${icon}">${iconSvg}</div>
        <h3 id="confirm-dialog-title" class="confirm-dialog-title">${escapeHtml(title)}</h3>
        <p class="confirm-dialog-message">${escapeHtml(message)}</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-btn confirm-dialog-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="confirm-dialog-btn confirm-dialog-confirm ${danger ? 'danger' : ''}">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    // Get buttons
    const cancelBtn = overlay.querySelector('.confirm-dialog-cancel') as HTMLButtonElement;
    const confirmBtn = overlay.querySelector('.confirm-dialog-confirm') as HTMLButtonElement;

    // Store previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Close dialog helper
    const closeDialog = (confirmed: boolean) => {
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
        // Restore focus
        if (previouslyFocused && previouslyFocused.focus) {
          previouslyFocused.focus();
        }
        resolve(confirmed);
      }, 150);
    };

    // Event handlers
    cancelBtn.addEventListener('click', () => closeDialog(false));
    confirmBtn.addEventListener('click', () => closeDialog(true));

    // Close on overlay click (outside dialog)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog(false);
      }
    });

    // Close on Escape key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDialog(false);
      }
      // Tab trap
      if (e.key === 'Tab') {
        const focusableElements = [cancelBtn, confirmBtn];
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    overlay.addEventListener('keydown', handleKeydown);

    // Add to DOM and focus confirm button
    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}

/**
 * Shorthand for danger confirm dialogs (delete, reset, etc.)
 */
export function confirmDanger(
  message: string,
  confirmText = 'Delete',
  title = 'Are you sure?'
): Promise<boolean> {
  return confirmDialog({
    title,
    message,
    confirmText,
    cancelText: 'Cancel',
    danger: true,
    icon: 'danger'
  });
}

/**
 * Alert dialog options
 */
export interface AlertDialogOptions {
  /** Dialog title */
  title?: string;
  /** Main message to display */
  message: string;
  /** OK button text */
  buttonText?: string;
  /** Alert type (affects icon and styling) */
  type?: 'error' | 'success' | 'info' | 'warning';
}

/**
 * Shows a custom alert dialog (single OK button)
 * Replaces native browser alert() with styled dialog
 *
 * @example
 * await alertDialog({
 *   title: 'Error',
 *   message: 'Something went wrong',
 *   type: 'error'
 * });
 */
export function alertDialog(options: AlertDialogOptions): Promise<void> {
  const {
    title,
    message,
    buttonText = 'OK',
    type = 'info'
  } = options;

  // Map type to icon
  const iconMap: Record<string, string> = {
    error: 'danger',
    success: 'success',
    info: 'info',
    warning: 'warning'
  };

  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'alert-dialog-title');

    // Get icon SVG
    const iconSvg = getIconSvg(iconMap[type] || 'info');

    // Derive title from type if not provided
    const displayTitle = title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Notice');

    // Create dialog HTML
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog-icon ${iconMap[type]}">${iconSvg}</div>
        <h3 id="alert-dialog-title" class="confirm-dialog-title">${escapeHtml(displayTitle)}</h3>
        <p class="confirm-dialog-message">${escapeHtml(message)}</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-btn confirm-dialog-confirm">${escapeHtml(buttonText)}</button>
        </div>
      </div>
    `;

    // Get button
    const okBtn = overlay.querySelector('.confirm-dialog-confirm') as HTMLButtonElement;

    // Store previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Close dialog helper
    const closeDialog = () => {
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
        // Restore focus
        if (previouslyFocused && previouslyFocused.focus) {
          previouslyFocused.focus();
        }
        resolve();
      }, 150);
    };

    // Event handlers
    okBtn.addEventListener('click', closeDialog);

    // Close on overlay click (outside dialog)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog();
      }
    });

    // Close on Escape or Enter key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        closeDialog();
      }
    };

    overlay.addEventListener('keydown', handleKeydown);

    // Add to DOM and focus button
    document.body.appendChild(overlay);
    okBtn.focus();
  });
}

/**
 * Shorthand for error alert
 */
export function alertError(message: string, title = 'Error'): Promise<void> {
  return alertDialog({ title, message, type: 'error' });
}

/**
 * Shorthand for success alert
 */
export function alertSuccess(message: string, title = 'Success'): Promise<void> {
  return alertDialog({ title, message, type: 'success' });
}

/**
 * Shorthand for info alert
 */
export function alertInfo(message: string, title = 'Notice'): Promise<void> {
  return alertDialog({ title, message, type: 'info' });
}

/**
 * Shorthand for warning alert
 */
export function alertWarning(message: string, title = 'Warning'): Promise<void> {
  return alertDialog({ title, message, type: 'warning' });
}

/**
 * Simple HTML escape to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get SVG icon based on type
 */
function getIconSvg(type: string): string {
  switch (type) {
  case 'danger':
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
  case 'warning':
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  case 'success':
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
  case 'info':
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  case 'question':
  default:
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>';
  }
}
