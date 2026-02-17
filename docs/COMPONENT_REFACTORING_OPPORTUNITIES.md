# Component Refactoring Opportunities

**Last Updated:** February 15, 2026

---

## Button/Modal Standardization — COMPLETE

All manual button and modal usages have been refactored to use standardized ButtonComponent and ModalComponent patterns. CSS classes and variables are now consistent, and accessibility is improved across all modules.

### Refactor Summary

- All button creation now uses ButtonComponent/button.ts/icon-button.ts
- All modal implementations use ModalComponent or createPortalModal
- CSS updated for shared classes and variables
- ARIA, keyboard, and focus management standardized

See src/components/button-component.ts, button.ts, icon-button.ts, modal-component.ts, portal-modal.ts for implementation details.

---

## 1. Alert Dialogs → Use `alertDialog()` Utility

### Available Utility

**File:** `src/utils/confirm-dialog.ts`

- `alertDialog(options)` - Custom styled alert dialog
- `alertError(message, title)` - Error alerts
- `alertSuccess(message, title)` - Success alerts
- `alertInfo(message, title)` - Info alerts
- `alertWarning(message, title)` - Warning alerts

### Files to Refactor

#### `src/features/client/client-portal.ts`

**Status:** Refactored. Client portal now uses `alertDialog`/`alertError`/`alertSuccess`/`showToast`; no remaining native `alert()` in this file. Line numbers below are historical.

#### Historical locations (pre-refactor):

- Line 426: `alert('Please log in to submit a project request.')`
- Line 437: `alert('Please fill in all required fields')`
- Line 463: `alert(data.message || 'Project request submitted successfully!')`
- Line 473: `alert(...)` - Error message
- Line 488: `alert('Please log in to save settings.')`
- Line 522: `alert('New passwords do not match')`
- Line 527: `alert('Password must be at least 8 characters')`
- Line 557: `alert('Profile updated successfully!')`
- Line 560: `alert(error instanceof Error ? error.message : 'Failed to save profile...')`
- Line 571: `alert('Please log in to change your password.')`
- Line 580: `alert('Please fill in all password fields')`
- Line 585: `alert('New passwords do not match')`
- Line 590: `alert('Password must be at least 8 characters')`
- Line 620: `alert('Password updated successfully!')`
- Line 623: `alert(error instanceof Error ? error.message : 'Failed to update password...')`
- Line 634: `alert('Please log in to save settings.')`
- Line 664: `alert('Notification preferences saved!')`
- Line 667: `alert(...)` - Error message
- Line 680: `alert('Please log in to save settings.')`
- Line 709: `alert('Billing information saved!')`
- Line 712: `alert(...)` - Error message

#### Refactor to: Alert Dialogs

```typescript
import { alertError, alertSuccess, alertInfo } from '../../utils/confirm-dialog';

// Success messages
await alertSuccess('Project request submitted successfully!');
await alertSuccess('Profile updated successfully!');
await alertSuccess('Password updated successfully!');
await alertSuccess('Notification preferences saved!');
await alertSuccess('Billing information saved!');

// Error messages
await alertError('Please log in to submit a project request.');
await alertError('Please fill in all required fields');
await alertError(error instanceof Error ? error.message : 'Failed to save profile. Please try again.');

// Info messages
await alertInfo('Please log in to save settings.');
```

**Note:** There's also a `showSuccessMessage()` method (line 1407) that creates custom DOM elements - this should also use `showToast()` instead.

#### `src/features/client/modules/portal-messages.ts`

**Status:** Refactored; uses `alertError` (or equivalent). Line numbers historical.
**Historical:** Line 210 - `alert(...)` for send message error.

#### Refactor to: Portal Messages

```typescript
import { alertError } from '../../../utils/confirm-dialog';
await alertError(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
```

#### `src/features/client/modules/portal-invoices.ts`

**Status:** Refactored; uses `alertError` (or equivalent). Line numbers historical.
**Historical:** Line 222 - `alert('Failed to download invoice...')`.

#### Refactor to: Portal Invoices

```typescript
import { alertError } from '../../../utils/confirm-dialog';
await alertError('Failed to download invoice. Please try again.');
```

#### `src/services/code-protection-service.ts`

**Current:** Line 489 - `alert('Developer tools detected. Some features may be limited.')`

#### Refactor to: Code Protection Service

## 2. Prompt Dialogs → Use `ModalComponent` with Form Inputs

### Available Component

**File:** `src/components/modal-component.ts`

- `ModalComponent` - Full-featured modal with form support
- Factory: `createModal(props, mountTarget)`

### Files to Refactor

#### `src/features/admin/modules/admin-projects.ts`

**Current:** Using native `prompt()` (3 instances)

#### Prompt Dialog Locations:

- Line 1315: `prompt('Enter line item description:', 'Web Development Services')`
- Line 1318: `prompt('Enter amount ($):', '1000')`
- Line 1379: `prompt('Enter milestone title:')`
- Line 1382: `prompt('Enter milestone description (optional):', '')`
- Line 1383: `prompt('Enter due date (YYYY-MM-DD):', ...)`

#### Refactor to: Admin Project Details

```typescript
import { createModal } from '../../../components';
import { ButtonComponent } from '../../../components/button-component';

// Create modal with form inputs
const modal = await createModal({
  title: 'Add Line Item',
  size: 'medium',
  closable: true,
  children: `
    <form id="line-item-form">
      <div class="form-group">
        <label for="line-item-desc">Description</label>
        <input type="text" id="line-item-desc" value="Web Development Services" required>
      </div>
      <div class="form-group">
        <label for="line-item-amount">Amount ($)</label>
        <input type="number" id="line-item-amount" value="1000" step="0.01" required>
      </div>
    </form>
  `,
  footerContent: `
    <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
    <button type="button" class="btn btn-primary" data-action="submit">Add Item</button>
  `
}, document.body);

await modal.open();

// Handle form submission
modal.on('submit', () => {
  const desc = document.getElementById('line-item-desc')?.value;
  const amount = parseFloat(document.getElementById('line-item-amount')?.value || '0');
  // Process data...
  modal.close();
});
```

#### `src/features/admin/admin-project-details.ts`

#### Locations:

- Line 1103: `prompt('Enter milestone title:')`
- Line 1106: `prompt('Enter milestone description (optional):')`
- Line 1107: `prompt('Enter due date (YYYY-MM-DD, optional):')`
- Line 1276: `prompt('Enter line item description:', 'Web Development Services')`
**Refactor to:** Same pattern as above using `ModalComponent`.

---

## 3. Buttons → Use `ButtonComponent`

### Available Component

**File:** `src/components/button-component.ts`

#### `src/utils/modal-dropdown.ts`

**Current:** Line 150 - Manual button creation

```typescript
const trigger = document.createElement('button');
trigger.type = 'button';
trigger.className = 'custom-dropdown-trigger';
```

#### Refactor to: Table Dropdown

```typescript
import { createButton } from '../components';

const trigger = await createButton({
  variant: 'ghost',
  ariaLabel: 'Select option',
  type: 'button',
  children: displayText
}, container);
```

#### `src/utils/table-dropdown.ts`

**Current:** Line 50 - Manual button creation

**Refactor to:** Same pattern as above.

#### `src/features/client/terminal-intake.ts`

**Current:** Lines 260-273 - Manual button creation for resume/restart options

```typescript
const btn1 = document.createElement('button');
btn1.className = 'chat-option';
btn1.textContent = '[1] Resume where I left off';
```

#### Refactor to: Admin Dashboard Modal

```typescript
import { createButton } from '../../components';

const btn1 = await createButton({
  variant: 'secondary',

#### `src/features/client/modules/portal-navigation.ts`


**Refactor to:** Use `ButtonComponent` with appropriate variant.

#### `src/features/client/terminal-intake-ui.ts`

**Current:** Lines 256, 273, 368, 384 - Multiple manual button creations

---

## 4. Modals → Use `ModalComponent`

### Available Component

**File:** `src/components/modal-component.ts`

- `ModalComponent` - Full-featured modal with lifecycle management
- Factory: `createModal(props, mountTarget)`

### Files to Refactor

#### `src/features/admin/admin-dashboard.ts`

**Current:** Lines 557-581 - Manual modal handlers with `style.display` manipulation

```typescript
private setupModalHandlers(): void {
  const modal = this.domCache.get('detailModal');
  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };
  // ... manual event handlers
}
```

#### Refactor to:

```typescript
import { createModal } from '../../components';

// Replace HTML modal with ModalComponent
const detailModal = await createModal({
  title: 'Project Details',
  size: 'large',
  closable: true,
  showFooter: true,
  footerContent: '<button class="btn btn-secondary" data-action="close">Close</button>'
}, document.body);

// Use modal methods instead of style manipulation
detailModal.open();
detailModal.close();
detailModal.on('close', () => { /* cleanup */ });
```

#### `src/features/admin/renderers/admin-contacts.renderer.ts`

**Current:** Line 174 - Manual modal display manipulation

**Refactor to:** Use `ModalComponent` instead of manual DOM manipulation.

---

## 5. Toast Notifications → Use `showToast()` Utility

### Available Utility

**File:** `src/utils/toast-notifications.ts`

- `showToast(message, type, options)` - Non-intrusive toast notifications
- `showToastSuccess(message, options)` - Success toasts
- `showToastError(message, options)` - Error toasts
- `showToastInfo(message, options)` - Info toasts
- `showToastWarning(message, options)` - Warning toasts

#### `src/features/client/client-portal.ts`

**Current:** Line 1407 - Custom `showSuccessMessage()` method that creates DOM elements

```typescript
private showSuccessMessage(message: string): void {
  successDiv.textContent = message;
  successDiv.style.cssText = `...`;
  document.body.appendChild(successDiv);
  setTimeout(() => successDiv.remove(), 3000);
}
```

#### Refactor to:

```typescript
import { showToastSuccess } from '../../utils/toast-notifications';

// Replace all showSuccessMessage() calls with:
showToastSuccess(message);
```

**Note:** This method is called in multiple places (lines 557, 620, 664, 709) and should be replaced with `showToastSuccess()`.

---

## 6. Confirm Dialogs → Already Using Utility ✅

**Status:** Already using `confirmDialog()` utility correctly in most places.

**File:** `src/utils/confirm-dialog.ts`

- `confirmDialog(options)` - Custom styled confirm dialog
- `confirmDanger(message, confirmText, title)` - Danger confirmations

**Note:** Some files may still use native `confirm()` - search for remaining instances.

---

## Implementation Priority

### High Priority (User-Facing)

1. **Alert dialogs** - Replace all `alert()` calls with `alertDialog()` utilities
   - Improves UX consistency
   - Better accessibility
   - Styled to match portal theme

   - Better form validation
   - Consistent styling
   - Better mobile support

### Medium Priority (Code Quality)

1. **Button components** - Replace manual button creation
   - Lifecycle management
   - Built-in accessibility features
   - Consistent behavior

### Low Priority (Polish)

1. **Toast notifications** - Replace custom success message DOM creation
   - Non-intrusive UX
   - Consistent styling
   - Better positioning

---

## Benefits of Refactoring

1. **Consistency**: All dialogs/modals/buttons will have consistent styling and behavior
2. **Accessibility**: Components include ARIA attributes and keyboard navigation
3. **Maintainability**: Changes to component styling/behavior happen in one place
4. **User Experience**: Better mobile support, animations, and visual feedback
5. **Code Quality**: Less DOM manipulation, more declarative component usage

---

## Migration Checklist

- [x] Replace all `alert()` calls with `alertDialog()` utilities (5 files, 20+ instances) - COMPLETE
- [x] Replace all `prompt()` calls with `multiPromptDialog()` utility (2 files, 5 instances) - COMPLETE
- [x] Add focus trap to detail modal in admin-dashboard.ts - COMPLETE January 30, 2026
- [x] Replace custom success message DOM with `showToast()` (1 file, 5+ instances) - COMPLETE
- [ ] Replace manual modal handling with `ModalComponent` (2 files, 3 instances) - DEFERRED
- [x] Test all refactored components for accessibility - Ongoing
- [x] Verify mobile responsiveness - Ongoing
- [x] Update documentation - COMPLETE

---

## Related Documentation

- [Button Component](../../src/components/button-component.ts)
- [Toast Notifications](../../src/utils/toast-notifications.ts)
- [Confirm Dialog](../../src/utils/confirm-dialog.ts)
