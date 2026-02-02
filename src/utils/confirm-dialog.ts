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
  icon?: 'warning' | 'danger' | 'info' | 'question' | 'folder-plus';
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
 * Prompt dialog options
 */
export interface PromptDialogOptions {
  /** Dialog title */
  title?: string;
  /** Label text above the input */
  label: string;
  /** Default value for the input */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Input type (text, number, date, etc.) */
  inputType?: 'text' | 'number' | 'date' | 'email' | 'tel';
  /** Whether the input is required */
  required?: boolean;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
}

/**
 * Shows a custom prompt dialog with an input field
 * Replaces native browser prompt() with styled dialog
 *
 * @returns The input value or null if cancelled
 *
 * @example
 * const name = await promptDialog({
 *   title: 'Enter Name',
 *   label: 'What is your name?',
 *   defaultValue: 'John'
 * });
 * if (name !== null) {
 *   console.log('Name:', name);
 * }
 */
export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  const {
    title = 'Input Required',
    label,
    defaultValue = '',
    placeholder = '',
    inputType = 'text',
    required = false,
    confirmText = 'OK',
    cancelText = 'Cancel'
  } = options;

  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'prompt-dialog-title');

    // Get icon SVG (edit/pencil icon)
    const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';

    // Create dialog HTML
    overlay.innerHTML = `
      <div class="confirm-dialog prompt-dialog">
        <div class="confirm-dialog-icon info">${iconSvg}</div>
        <h3 id="prompt-dialog-title" class="confirm-dialog-title">${escapeHtml(title)}</h3>
        <div class="prompt-dialog-field">
          <label for="prompt-dialog-input" class="prompt-dialog-label">${escapeHtml(label)}</label>
          <input
            type="${inputType}"
            id="prompt-dialog-input"
            class="prompt-dialog-input form-input"
            value="${escapeHtml(defaultValue)}"
            placeholder="${escapeHtml(placeholder)}"
            ${required ? 'required' : ''}
          />
        </div>
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-btn confirm-dialog-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="confirm-dialog-btn confirm-dialog-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    // Get elements
    const cancelBtn = overlay.querySelector('.confirm-dialog-cancel') as HTMLButtonElement;
    const confirmBtn = overlay.querySelector('.confirm-dialog-confirm') as HTMLButtonElement;
    const input = overlay.querySelector('#prompt-dialog-input') as HTMLInputElement;

    // Store previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Close dialog helper
    const closeDialog = (value: string | null) => {
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
        // Restore focus
        if (previouslyFocused && previouslyFocused.focus) {
          previouslyFocused.focus();
        }
        resolve(value);
      }, 150);
    };

    // Event handlers
    cancelBtn.addEventListener('click', () => closeDialog(null));
    confirmBtn.addEventListener('click', () => {
      const value = input.value.trim();
      if (required && !value) {
        input.classList.add('field--invalid');
        input.focus();
        return;
      }
      closeDialog(value);
    });

    // Close on overlay click (outside dialog)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog(null);
      }
    });

    // Handle keyboard events
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDialog(null);
      }
      if (e.key === 'Enter' && document.activeElement === input) {
        e.preventDefault();
        const value = input.value.trim();
        if (required && !value) {
          input.classList.add('field--invalid');
          return;
        }
        closeDialog(value);
      }
      // Tab trap
      if (e.key === 'Tab') {
        const focusableElements = [input, cancelBtn, confirmBtn];
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

    // Clear invalid state on input
    input.addEventListener('input', () => {
      input.classList.remove('field--invalid');
    });

    // Add to DOM and focus input
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}

/**
 * Select option for select fields
 */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Multi-field prompt dialog for complex inputs
 */
export interface MultiPromptField {
  /** Field name (key in result object) */
  name: string;
  /** Label text */
  label: string;
  /** Input type */
  type?: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'select';
  /** Default value */
  defaultValue?: string;
  /** Placeholder */
  placeholder?: string;
  /** Whether required */
  required?: boolean;
  /** Options for select type */
  options?: SelectOption[];
}

export interface MultiPromptDialogOptions {
  /** Dialog title */
  title: string;
  /** Array of fields */
  fields: MultiPromptField[];
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
}

/**
 * Shows a multi-field prompt dialog
 * Returns an object with field values or null if cancelled
 */
export function multiPromptDialog(
  options: MultiPromptDialogOptions
): Promise<Record<string, string> | null> {
  const {
    title,
    fields,
    confirmText = 'OK',
    cancelText = 'Cancel'
  } = options;

  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'multi-prompt-dialog-title');

    // Get icon SVG
    const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';

    // Build fields HTML
    const fieldsHtml = fields.map(field => {
      const inputId = `multi-prompt-${field.name}`;
      if (field.type === 'textarea') {
        return `
          <div class="prompt-dialog-field">
            <label for="${inputId}" class="prompt-dialog-label">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
            <textarea
              id="${inputId}"
              name="${field.name}"
              class="prompt-dialog-input form-input form-textarea"
              placeholder="${escapeHtml(field.placeholder || '')}"
              ${field.required ? 'required' : ''}
              rows="3"
            >${escapeHtml(field.defaultValue || '')}</textarea>
          </div>
        `;
      }
      if (field.type === 'select' && field.options) {
        const optionsHtml = field.options.map(opt =>
          `<option value="${escapeHtml(opt.value)}"${opt.value === field.defaultValue ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
        ).join('');
        return `
          <div class="prompt-dialog-field">
            <label for="${inputId}" class="prompt-dialog-label">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
            <select
              id="${inputId}"
              name="${field.name}"
              class="prompt-dialog-input form-input form-select"
              ${field.required ? 'required' : ''}
            >${optionsHtml}</select>
          </div>
        `;
      }
      return `
        <div class="prompt-dialog-field">
          <label for="${inputId}" class="prompt-dialog-label">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
          <input
            type="${field.type || 'text'}"
            id="${inputId}"
            name="${field.name}"
            class="prompt-dialog-input form-input"
            value="${escapeHtml(field.defaultValue || '')}"
            placeholder="${escapeHtml(field.placeholder || '')}"
            ${field.required ? 'required' : ''}
          />
        </div>
      `;
    }).join('');

    // Create dialog HTML
    overlay.innerHTML = `
      <div class="confirm-dialog prompt-dialog multi-prompt-dialog">
        <div class="confirm-dialog-icon info">${iconSvg}</div>
        <h3 id="multi-prompt-dialog-title" class="confirm-dialog-title">${escapeHtml(title)}</h3>
        <form class="multi-prompt-form">
          ${fieldsHtml}
          <div class="confirm-dialog-actions">
            <button type="button" class="confirm-dialog-btn confirm-dialog-cancel">${escapeHtml(cancelText)}</button>
            <button type="submit" class="confirm-dialog-btn confirm-dialog-confirm">${escapeHtml(confirmText)}</button>
          </div>
        </form>
      </div>
    `;

    // Get elements
    const cancelBtn = overlay.querySelector('.confirm-dialog-cancel') as HTMLButtonElement;
    const form = overlay.querySelector('.multi-prompt-form') as HTMLFormElement;
    const inputs = Array.from(overlay.querySelectorAll('input, textarea, select')) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];

    // Store previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Close dialog helper
    const closeDialog = (result: Record<string, string> | null) => {
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
        if (previouslyFocused && previouslyFocused.focus) {
          previouslyFocused.focus();
        }
        resolve(result);
      }, 150);
    };

    // Validate and get values
    const getValues = (): Record<string, string> | null => {
      const result: Record<string, string> = {};
      let valid = true;

      for (const field of fields) {
        const input = overlay.querySelector(`[name="${field.name}"]`) as HTMLInputElement | HTMLTextAreaElement;
        const value = input.value.trim();

        if (field.required && !value) {
          input.classList.add('field--invalid');
          if (valid) input.focus(); // Focus first invalid
          valid = false;
        } else {
          result[field.name] = value;
        }
      }

      return valid ? result : null;
    };

    // Event handlers
    cancelBtn.addEventListener('click', () => closeDialog(null));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = getValues();
      if (values) closeDialog(values);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog(null);
      }
    });

    // Handle keyboard
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDialog(null);
      }
    };

    overlay.addEventListener('keydown', handleKeydown);

    // Clear invalid on input
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        input.classList.remove('field--invalid');
      });
    });

    // Add to DOM and focus first input
    document.body.appendChild(overlay);
    if (inputs.length > 0) {
      inputs[0].focus();
      if (inputs[0] instanceof HTMLInputElement) {
        inputs[0].select();
      }
    }
  });
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
  case 'folder-plus':
  default:
    // FolderPlus icon from Lucide - used for "activate as project" type actions
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';
  }
}
