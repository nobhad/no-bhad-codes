# Modals & Dialogs Audit

**Last Updated:** 2026-02-06

## Table of Contents

- [Summary](#summary)
- [Modal Implementations](#modal-implementations)
  - [ModalComponent](#1-modalcomponent)
  - [PortalModal](#2-portalmodal)
  - [ConfirmDialog](#3-confirmdialog)
  - [FocusTrap Utilities](#4-focustrap-utilities)
  - [ModalDropdown](#5-modaldropdown)
  - [Invoice Modals](#6-invoice-modals)
  - [Admin Module Modals](#7-admin-module-modals)
- [CSS Architecture](#css-architecture)
- [Accessibility](#accessibility)
- [Trigger Patterns](#trigger-patterns)
- [Close Patterns](#close-patterns)
- [Animation Patterns](#animation-patterns)
- [Issues & Recommendations](#issues--recommendations)

---

## Summary

| Metric | Value |
|--------|-------|
| Modal Implementation Types | 7 |
| Files with Modal Code | 47+ |
| Confirm/Alert Dialogs | 20+ instances |
| Form Modals | 15+ instances |
| CSS Files for Modals | 2 primary |
| Z-Index Layers | 3 (9999, 10002, 10100) |

### Modal Types Overview

| Type | Count | Primary Use |
|------|-------|-------------|
| Styled Confirm | 20+ | Delete confirmations, action verification |
| Alert Dialogs | 10+ | Error/success messages |
| Form Modals | 15+ | Create/edit operations |
| Portal Modals | 2 | KB categories/articles |
| Prompt Dialogs | 5+ | Single/multi-field input |
| Dropdown Modals | Many | Select elements within forms |
| Component Modals | 1 | Reusable base implementation |

---

## Modal Implementations

### 1. ModalComponent

**File:** `src/components/modal-component.ts`
**Lines:** 1-438
**Type:** Fully-featured accessible modal class extending BaseComponent

#### Props Interface

```typescript
interface ModalProps {
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  closable?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  headerContent?: string;
  footerContent?: string;
  children?: string;
  onClose?: () => void;
  onOpen?: () => void;
  zIndex?: number;
}
```

#### Size Variants

| Size | Max Width |
|------|-----------|
| `small` | 400px |
| `medium` | 600px |
| `large` | 800px |
| `fullscreen` | 100% |

#### Features

- Built-in accessibility (role, aria-modal, aria-labelledby)
- Focus trap implementation (Tab/Shift+Tab cycling)
- Focus restoration on close
- Configurable close mechanisms
- Animation states with reduced-motion support

#### Methods

| Method | Purpose |
|--------|---------|
| `open()` | Store focus, show modal, start focus trap |
| `close()` | Restore focus, hide modal |
| `toggle()` | Switch state |
| `setContent()` | Update body content |
| `isOpen()` | Query state |

#### CSS Classes Generated

```css
.modal-backdrop
.modal-backdrop--open
.modal
.modal--small | .modal--medium | .modal--large | .modal--fullscreen
.modal--open
.modal--animating
.modal__header
.modal__title
.modal__close
.modal__header-content
.modal__body
.modal__footer
```

---

### 2. PortalModal

**File:** `src/components/portal-modal.ts`
**Lines:** 1-104
**Type:** Lightweight modal factory function

#### Usage

```typescript
const modal = createPortalModal({
  id: 'my-modal',
  titleId: 'my-modal-title',
  title: 'Modal Title',
  contentClassName: 'custom-content',
  onClose: () => handleClose()
});

modal.body.innerHTML = formHTML;
modal.footer.innerHTML = buttonHTML;
document.body.appendChild(modal.overlay);
modal.show();
```

#### Returns

```typescript
interface PortalModalInstance {
  overlay: HTMLElement;
  content: HTMLElement;
  header: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement;
  show(): void;
  hide(): void;
  setTitle(title: string): void;
}
```

#### Features

- Creates DOM structure: overlay, header (title + close), body slot, footer slot
- `role="dialog"` and `aria-modal="true"`
- Close button uses ICONS.CLOSE SVG
- Backdrop click to close

#### CSS Classes

```css
.modal-overlay
.modal-content
.portal-shadow
.modal-header
.modal-body
.modal-footer
.modal-close
```

---

### 3. ConfirmDialog

**File:** `src/utils/confirm-dialog.ts`
**Lines:** 1-708
**Type:** Promise-based dialog utilities

#### 3a. confirmDialog()

```typescript
const confirmed = await confirmDialog({
  title: 'Confirm Action',
  message: 'Are you sure?',
  confirmText: 'Yes',
  cancelText: 'No',
  danger: false,
  icon: 'warning' // 'warning' | 'danger' | 'info' | 'question' | 'folder-plus'
});
// Returns: Promise<boolean>
```

**Shorthand:**

```typescript
const confirmed = await confirmDanger('Delete this item?', 'Delete', 'Confirm Delete');
```

#### 3b. alertDialog()

```typescript
await alertDialog({
  title: 'Success',
  message: 'Operation completed',
  buttonText: 'OK',
  type: 'success' // 'error' | 'success' | 'info' | 'warning'
});
// Returns: Promise<void>
```

**Shortcuts:**

```typescript
await alertError('Something went wrong', 'Error');
await alertSuccess('Saved successfully', 'Success');
await alertInfo('FYI...', 'Information');
await alertWarning('Be careful!', 'Warning');
```

#### 3c. promptDialog()

```typescript
const value = await promptDialog({
  title: 'Enter Name',
  label: 'Name',
  defaultValue: '',
  placeholder: 'Enter your name',
  inputType: 'text', // 'text' | 'number' | 'date' | 'email' | 'tel'
  required: true,
  confirmText: 'Save',
  cancelText: 'Cancel'
});
// Returns: Promise<string | null>
```

#### 3d. multiPromptDialog()

```typescript
const values = await multiPromptDialog({
  title: 'Enter Details',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: [...] }
  ],
  confirmText: 'Submit',
  cancelText: 'Cancel'
});
// Returns: Promise<Record<string, string> | null>
```

#### CSS Classes

```css
.confirm-dialog-overlay
.confirm-dialog-overlay.closing
.confirm-dialog
.confirm-dialog-header
.confirm-dialog-icon
.confirm-dialog-title
.confirm-dialog-message
.confirm-dialog-actions
.confirm-dialog-btn
.confirm-dialog-confirm
.confirm-dialog-confirm.danger
.confirm-dialog-cancel
.prompt-dialog
.prompt-dialog-field
.prompt-dialog-label
.prompt-dialog-input
.multi-prompt-dialog
.multi-prompt-form
```

#### Z-Index

`10100` (above all other modals)

---

### 4. FocusTrap Utilities

**File:** `src/utils/focus-trap.ts`
**Lines:** 1-189

#### Functions

| Function | Purpose |
|----------|---------|
| `createFocusTrap(container, options)` | Trap Tab/Shift+Tab within container |
| `removeFocusTrap(container)` | Clean up and restore previous focus |
| `hasFocusTrap(container)` | Check if trap is active |
| `manageFocusTrap(container, options)` | Higher-level wrapper for modal lifecycle |

#### Options

```typescript
interface FocusTrapOptions {
  initialFocus?: HTMLElement | string | null;
  returnFocus?: boolean; // default: true
  onEscape?: () => void;
}
```

#### Focusable Elements Selector

```css
button:not([disabled]),
a[href],
input:not([disabled]):not([type="hidden"]),
select:not([disabled]),
textarea:not([disabled]),
[tabindex]:not([tabindex="-1"])
```

---

### 5. ModalDropdown

**File:** `src/utils/modal-dropdown.ts`
**Lines:** 1-393
**Type:** Select-to-custom-dropdown converter for modals

#### Functions

| Function | Purpose |
|----------|---------|
| `initModalDropdown(select, options)` | Convert native select to custom dropdown |
| `initModalDropdowns(modal)` | Initialize all selects in modal |
| `getModalDropdownValue(wrapper)` | Get current value |
| `setModalDropdownValue(wrapper, value)` | Set value programmatically |

#### Features

- Fixed positioning to escape modal overflow
- Automatic flip-above detection when near modal bottom
- Global handlers (click-outside, escape, scroll/resize)
- Hides currently selected option from menu
- Hidden input for form submission

#### CSS Classes

```css
.custom-dropdown
.custom-dropdown[data-modal-dropdown]
.custom-dropdown.open
.custom-dropdown-trigger
.custom-dropdown-menu
.custom-dropdown-item
.custom-dropdown-text
.custom-dropdown-caret
.flip-above
```

#### Z-Index

`10002` (above modal content)

---

### 6. Invoice Modals

**File:** `src/features/admin/project-details/invoice-modals.ts`
**Lines:** 1-343

#### showCreateInvoicePrompt()

```typescript
const invoiceData = await showCreateInvoicePrompt(projectId);
// Returns: { type, lineItems, depositPercentage } | null
```

**Features:**

- Invoice type selection: Standard or Deposit
- Dynamic line items (description, quantity, rate)
- Live total calculation
- Add/remove line items
- Deposit percentage field (conditional)
- Form validation

#### CSS Classes Used

```css
.confirm-dialog-overlay
.confirm-dialog
.confirm-dialog-title
.confirm-dialog-icon
.invoice-modal
.invoice-modal-form
.line-items-container
.line-item-row
.line-item-amount
.invoice-total
.confirm-dialog-actions
```

---

### 7. Admin Module Modals

Various admin modules create modals dynamically:

| Module | Modal Types |
|--------|-------------|
| `admin-knowledge-base.ts` | Category modal, Article modal |
| `admin-clients.ts` | Add client, Edit info, Edit billing |
| `admin-proposals.ts` | Proposal creation/editing with tabs |
| `admin-projects.ts` | File preview, Project detail, Add project |
| `admin-document-requests.ts` | Tab-based modal structure |
| `admin-files.ts` | File detail modal |
| `admin-tasks.ts` | Task creation modal |
| `admin-leads.ts` | Multi-field prompt dialogs |
| `admin-analytics.ts` | Alert and confirm dialogs |
| `admin-contacts.ts` | Contact action modals |

---

## CSS Architecture

### Primary CSS Files

#### 1. `src/styles/admin/modals.css`

**Imports:**

- `../shared/confirm-dialog.css`
- `../shared/portal-dropdown.css`
- `../shared/portal-forms.css`

**Key Classes:**

| Class | Purpose |
|-------|---------|
| `.modal-overlay` | Fixed overlay, z-index: 9999, centered flex |
| `.modal-content` | Main container, max-width: 560px |
| `.admin-modal-overlay` | Alternative overlay implementation |
| `.admin-modal` | Alternative modal container |
| `.admin-modal--wide` | Wide variant (max-width: 860px) |
| `.admin-modal-header` | Title & close button area |
| `.admin-modal-title` | Header with optional icon |
| `.admin-modal-close` | Close button styling |
| `.admin-modal-tabs` | Tab navigation structure |
| `.admin-modal-tab.active` | Active tab underline |
| `.admin-modal-body` | Scrollable form area |
| `.admin-modal-footer` | Button action area |
| `.detail-grid` | Two-column label/value layout |
| `.detail-row` | Single label/value pair |
| `.file-preview-modal-body` | Image centering |

**Animations:**

```css
@keyframes fadeIn { opacity: 0 → 1 (0.2s) }
@keyframes slideUp { opacity: 0, translateY(20px) → opacity: 1, translateY(0) (0.2s) }
```

#### 2. `src/styles/shared/confirm-dialog.css`

| Class | Purpose |
|-------|---------|
| `.confirm-dialog-overlay` | Backdrop, z-index: 10100 |
| `.confirm-dialog-overlay.closing` | Closing animation state |
| `.confirm-dialog` | Dialog content, max-width: 400px |
| `.confirm-dialog-header` | Icon + title flex row |
| `.confirm-dialog-icon` | 32px icon with type-specific colors |
| `.confirm-dialog-title` | Bold, uppercase title |
| `.confirm-dialog-message` | Main message text |
| `.confirm-dialog-actions` | Button container |
| `.confirm-dialog-btn` | Base button style |
| `.confirm-dialog-confirm` | Primary action button |
| `.confirm-dialog-confirm.danger` | Red destructive button |
| `.confirm-dialog-cancel` | Secondary action button |
| `.prompt-dialog` | Prompt variant container |
| `.multi-prompt-dialog` | Multi-field variant, max-width: 480px |

**Animations:**

```css
@keyframes confirmFadeIn { opacity: 0 → 1 (0.15s) }
@keyframes confirmFadeOut { opacity: 1 → 0 (0.15s) }
@keyframes confirmDialogSlideUp {
  opacity: 0, translateY(10px), scale(0.98) →
  opacity: 1, translateY(0), scale(1) (0.15s)
}
@keyframes confirmDialogSlideDown {
  opacity: 1, translateY(0), scale(1) →
  opacity: 0, translateY(10px), scale(0.98) (0.15s)
}
```

### CSS Variables Used

| Variable | Purpose |
|----------|---------|
| `--space-2` to `--space-6` | Spacing |
| `--color-primary`, `--color-danger`, `--color-white` | Colors |
| `--color-text-primary`, `--color-text-secondary` | Text colors |
| `--portal-bg-darker`, `--portal-bg-dark` | Backgrounds |
| `--portal-border-dark`, `--portal-border-medium` | Borders |
| `--portal-text-light`, `--portal-text-secondary` | Portal text |
| `--font-family-acme` | Typography |
| `--portal-radius-lg`, `--portal-radius-md` | Border radius |
| `--shadow-modal`, `--shadow-panel` | Shadows |

---

## Accessibility

### WCAG Compliance Features

| Feature | Implementation |
|---------|----------------|
| Semantic Roles | `role="dialog"` on all modal containers |
| Modal State | `aria-modal="true"` on all modals |
| Labeling | `aria-labelledby` linking to title element |
| Focus Management | Focus trap (Tab/Shift+Tab cycling) |
| Focus Restoration | Previous focused element restored on close |
| Keyboard Navigation | Escape to close, Tab to navigate |
| Close Button Labels | `aria-label="Close modal"` on X buttons |
| Alert Dialogs | `role="alertdialog"` for alert variants |
| Color Contrast | CSS variables ensure themeable contrast |
| Motion Preferences | `prefers-reduced-motion` support |

### Focus Trap Behavior

- Tracks all focusable elements within modal
- Prevents focus from leaving modal boundary
- Shift+Tab from first element → focus last element
- Tab from last element → focus first element
- Supports custom initial focus target

---

## Trigger Patterns

### Button Click (Most Common)

```typescript
element.addEventListener('click', () => modal.show());
```

### Programmatic

```typescript
const modal = createPortalModal({...});
modal.show();
```

### Async Function

```typescript
const confirmed = await confirmDialog({...});
if (confirmed) {
  // proceed
}
```

### Custom Dropdown

```typescript
initModalDropdown(selectElement);
```

---

## Close Patterns

All modals support multiple close mechanisms:

| Mechanism | Implementation |
|-----------|----------------|
| Close Button (X) | All styled modals |
| Cancel Button | Confirm/Prompt dialogs |
| Backdrop Click | Overlay click (configurable) |
| Escape Key | Global keydown handler (configurable) |
| Confirm/OK Button | Dialog completion |
| Programmatic | `modal.hide()` or `modal.close()` |

---

## Animation Patterns

| Animation | Duration | Purpose |
|-----------|----------|---------|
| Fade In | 0.15-0.3s | Overlay appearance |
| Slide Up | 0.15-0.3s | Content entrance |
| Scale | 0.3s | Content size change |
| Fade Out | 0.15s | Closing overlay |
| Slide Down | 0.15s | Closing content |

### Transitions

```css
transition: opacity 0.3s ease, visibility 0.3s ease;
transition: all 150ms;
transition: background-color 0.2s ease;
```

---

## Issues & Recommendations

### Issues Found

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | Hardcoded Z-Index | Medium | 3 different values (9999, 10002, 10100) not centralized |
| 2 | Mixed Modal Patterns | Medium | Some use factory, some use inline HTML |
| 3 | Inconsistent Close Animation | Low | Some use `.closing` class, others use display |
| 4 | Dropdown Positioning | Low | Fixed positioning can break with complex overflow |
| 5 | Missing aria-describedby | Low | No link to message content in some dialogs |
| 6 | Inconsistent Modal Sizing | Low | Various max-widths (400px, 560px, 860px) |

### Recommendations

| # | Recommendation | Priority |
|---|----------------|----------|
| 1 | Centralize z-index to CSS variables | High |
| 2 | Standardize on `createPortalModal()` for admin | Medium |
| 3 | Create unified close animation pattern | Medium |
| 4 | Add modal registry to prevent stacking | Low |
| 5 | Standardize modal sizes globally | Low |
| 6 | Add aria-describedby for message content | Low |

### Best Practices Observed

- Comprehensive focus trap implementation
- Good ARIA attribute usage
- Keyboard navigation support
- Promise-based dialog API
- Reduced motion support in ModalComponent
- Consistent button placement (cancel left, confirm right)
- Visual distinction for danger actions

---

## Quick Reference

### Create a Simple Confirm

```typescript
import { confirmDialog, confirmDanger } from '@/utils/confirm-dialog';

// Standard confirm
const proceed = await confirmDialog({
  title: 'Confirm',
  message: 'Continue with this action?'
});

// Danger confirm
const deleteIt = await confirmDanger('Delete this item permanently?');
```

### Create a Form Modal

```typescript
import { createPortalModal } from '@/components/portal-modal';
import { manageFocusTrap } from '@/utils/focus-trap';

const modal = createPortalModal({
  id: 'my-form-modal',
  titleId: 'my-form-title',
  title: 'Edit Item',
  onClose: () => {
    cleanup();
    modal.hide();
  }
});

modal.body.innerHTML = `
  <form id="edit-form">
    <div class="form-group">
      <label for="name">Name</label>
      <input type="text" id="name" required />
    </div>
  </form>
`;

modal.footer.innerHTML = `
  <button type="button" class="btn btn-secondary" data-close>Cancel</button>
  <button type="submit" form="edit-form" class="btn btn-primary">Save</button>
`;

document.body.appendChild(modal.overlay);
const cleanup = manageFocusTrap(modal.overlay);
modal.show();
```

### Get User Input

```typescript
import { promptDialog, multiPromptDialog } from '@/utils/confirm-dialog';

// Single input
const name = await promptDialog({
  title: 'Enter Name',
  label: 'Name',
  required: true
});

// Multiple inputs
const data = await multiPromptDialog({
  title: 'Enter Details',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' }
  ]
});
```

### Initialize Modal Dropdowns

```typescript
import { initModalDropdowns } from '@/utils/modal-dropdown';

const modal = document.getElementById('my-modal');
const dropdowns = initModalDropdowns(modal);
// All <select> elements inside are now custom dropdowns
```
