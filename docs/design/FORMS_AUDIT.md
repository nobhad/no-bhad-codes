# Forms Audit

**Last Updated:** 2026-02-06

## Table of Contents

- [Summary](#summary)
- [Forms Inventory](#forms-inventory)
- [Field Types Used](#field-types-used)
- [Validation Architecture](#validation-architecture)
  - [Client-Side Validation](#client-side-validation)
  - [Shared Validation Schemas](#shared-validation-schemas)
  - [Server-Side Validation](#server-side-validation)
- [Error Handling](#error-handling)
- [Form Implementations](#form-implementations)
- [Accessibility](#accessibility)
- [Security Patterns](#security-patterns)
- [CSS Architecture](#css-architecture)
- [Issues & Recommendations](#issues--recommendations)

---

## Summary

| Metric | Value |
| --- | --- |
| Total Major Forms | 9 |
| Form Field Types | 11 (text, email, password, tel, number, date, url, checkbox, radio, textarea, select) |
| Validation Functions | 30+ |
| Pre-defined Schemas | 10 |
| CSS Files for Forms | 7 |
| Error Handling Functions | 6 |
| ARIA Attributes Used | 12 types |

---

## Forms Inventory

### HTML Forms (9 Total)

| Location | Form Type | Purpose |
| --- | --- | --- |
| `/index.html` | Login/Portal Forms | Client/Admin authentication + password reset + magic link |
| `/admin/index.html` | Multiple Admin Forms | Document requests, client creation, project creation, proposal forms |
| `/client/portal.html` | Client Portal Forms | Client dashboard and settings |
| `/client/intake.html` | Terminal Intake Form | AI-style project intake questionnaire |
| `/client/set-password.html` | Password Set Form | Initial password setup |
| `/public/sign-contract.html` | Contract Signing Form | Contract + signature capture |
| `/index.html` | Contact Form | Contact submission with validation |

### Admin HTML Form Groups

The admin dashboard (`admin/index.html`) contains **82 form-group instances** covering:

- Client creation/editing
- Project creation/editing
- Invoice creation
- Proposal builder
- Document requests
- Knowledge base articles
- Task management
- Time tracking entries
- Settings forms

---

## Field Types Used

### Input Types

| Type | Purpose | Example Fields |
| --- | --- | --- |
| `text` | Names, company names, text fields | Name, Company, Subject |
| `email` | Email addresses (validated) | Email, Billing Email |
| `password` | Admin/client passwords | Password, Confirm Password |
| `tel` | Phone numbers | Phone, Mobile |
| `number` | Numeric values | Budget, Quantity, Rate |
| `date` | Date pickers | Due Date, Start Date |
| `url` | URL fields | Website, Portfolio URL |
| `checkbox` | Boolean selections | Agree to Terms, Feature Selection |
| `radio` | Single choice | Project Type, Budget Range, Timeline |
| `textarea` | Long-form text | Description, Message, Notes |
| `select` | Dropdown menus | Client, Template, Status |

### Field Attributes

| Attribute | Purpose |
| --- | --- |
| `required` | HTML5 required validation |
| `data-required="true"` | Custom required marker (contact form) |
| `aria-required="true"` | Accessibility attribute |
| `placeholder` | Placeholder text |
| `autocomplete` | Browser autocomplete hints |
| `aria-label` | Accessible labels |
| `aria-describedby` | Error message association |
| `minlength` / `maxlength` | Length constraints |
| `min` / `max` | Numeric constraints |
| `pattern` | Regex validation |

---

## Validation Architecture

### Client-Side Validation

**File:** `src/utils/form-validation.ts`

```typescript
// Core validation functions
validateFormCompletion(form: HTMLFormElement): void
initFormValidation(form: HTMLFormElement): void
initAllFormsValidation(): void

// Built-in validators
validators.required(label?)
validators.email(value)
validators.minLength(min, label?)
validators.maxLength(max, label?)
validators.numeric(value)
validators.currency(value)
```

**Features:**

- Debounced validation (150ms delay for performance)
- Tracks which fields have been "touched"
- Disables submit button until all required fields are filled
- Real-time validation on input/change events
- Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### Shared Validation Schemas

**File:** `shared/validation/schemas.ts`

| Schema | Fields Validated |
| --- | --- |
| `contactFormSchema` | name, email, subject, message, company |
| `clientIntakeSchema` | name, email, company, phone, project details |
| `userRegistrationSchema` | email, password, password confirmation |
| `adminLoginSchema` | password |
| `clientLoginSchema` | email, password |
| `messageSendSchema` | message content |
| `projectUpdateSchema` | project name, status, description, progress |
| `leadStatusSchema` | lead status, notes |
| `fileUploadSchema` | filename, type, size |
| `paginationSchema` | page, limit, sort, search |

### Shared Validators

**File:** `shared/validation/validators.ts`

| Validator | Purpose |
| --- | --- |
| `validateRequired()` | Checks for empty/null/whitespace |
| `validateEmail()` | Email format (optional strict mode) |
| `validatePhone()` | Phone (E.164, US, generic formats) |
| `validatePassword()` | Password strength (basic/medium/strong) |
| `validateName()` | Name (person/single/company types) |
| `validateLength()` | String length constraints |
| `validateAllowedValues()` | Enum validation |
| `validateMessageContent()` | Message with spam checking |
| `validateUrl()` | URL with optional HTTPS requirement |
| `validateDate()` | Date (ISO/datetime formats) |
| `validateRange()` | Numeric range |
| `validateArray()` | Array with item validators |

### Server-Side Validation

**File:** `server/middleware/validation.ts`

```typescript
class ApiValidator {
  validate(data: unknown, schema: ValidationSchema): ValidationResult
}

interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'string' | 'number' | 'boolean' | 'array' | 'object';
  options?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    customValidator?: (value: unknown) => boolean;
    customSanitizer?: (value: unknown) => unknown;
    allowedValues?: unknown[];
  };
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitizedData: Record<string, unknown>;
}
```

### When to Use Each Validation Layer

| Layer | When to Use | Example |
|-------|-------------|---------|
| **HTML5 (`required`, `type="email"`)** | Always - provides immediate browser feedback | All form fields |
| **Client-Side (`form-validation.ts`)** | Real-time UX feedback, debounced validation | Form completion tracking, submit button state |
| **Shared Schemas (`shared/validation/`)** | Complex validation rules shared between client and server | Contact form, intake form, registration |
| **Server-Side (`validation.ts`)** | Final validation before database operations | All API endpoints |

**Rule of Thumb:**

1. Use HTML5 attributes for basic constraints (required, email, minlength)
2. Use client-side validation for UX (button states, real-time feedback)
3. Use shared schemas when same rules apply client and server
4. Always validate on server - never trust client data

---

## Error Handling

### Error Display Functions

**File:** `src/utils/form-errors.ts`

| Function | Purpose |
| --- | --- |
| `showFieldError(field, message)` | Show error below field |
| `clearFieldError(field)` | Clear field error |
| `clearAllFieldErrors(form)` | Clear all errors in form |
| `showFieldErrors(errors, form?)` | Show multiple errors |
| `validateField(field, validator)` | Validate single field |

### Error Element Structure

```html
<div class="field-error field-error--visible" role="alert" aria-live="polite">
  Error message text
</div>
```

### CSS Error States

**File:** `src/styles/components/form-validation.css`

| Class | Purpose |
| --- | --- |
| `.field-error` | Error message container (hidden by default) |
| `.field-error--visible` | Shows error |
| `.field--invalid` | Invalid field styling (red border) |
| `.field--invalid:focus` | Focus ring on invalid fields |
| `.form-button.loading` | Loading state with spinner |
| `.form-button.form-valid` | Valid form button styling |

### Contact Form Error Patterns

**File:** `src/modules/ui/contact-form.ts`

- Inline error display using shared `showFieldError()` utility
- Errors appear below the corresponding field
- Uses ARIA attributes for accessibility (`aria-invalid`, `aria-describedby`)
- Focus management: first error field receives focus on submit
- XSS detection with `SanitizationUtils.detectXss()`
- Input length limits (max 5000 characters for message field)

---

## Form Implementations

### 1. Admin Login Form

**File:** `src/features/main-site/admin-login.ts`

- Single password field (no email)
- Password visibility toggle button
- Error display in `#auth-error` element
- Loading state on submit button
- API endpoint: `/api/auth/admin/login`
- Redirect to `/admin/` on success

### 2. Client Portal Auth

**File:** `src/features/client/modules/portal-auth.ts`

- Email + password login
- Email validation (disposable emails allowed)
- Supports redirect parameter in URL
- Admin users redirect to `/admin/`
- Uses centralized `authStore` for state management

### 3. Terminal Intake Form

**File:** `src/features/client/terminal-intake.ts`

- AI chat-style questionnaire
- Terminal aesthetic UI
- Collects: name, email, company, phone, project type, budget, timeline, description, features
- Schema validation on submission
- Saves progress to localStorage
- Resume/confirm workflows

### 4. Contact Form

**Files:** `src/modules/ui/contact-form.ts`, `/index.html`

**Fields:**

| Field | Type | Validation |
| --- | --- | --- |
| Name | text | required, min 2 chars |
| Email | email | required, email format |
| Company | text | optional |
| Message | textarea | required, min 10 chars |

**Features:**

- Form completion tracking (arrow points to empty field)
- Real-time validation on input
- Inline error display with ARIA accessibility
- Focus management on validation errors
- GSAP arrow fly animation on success
- Formspree/Netlify Forms backend support
- XSS detection

### 5. Portal Forms

**File:** `src/styles/shared/portal-forms.css`

**Standardized styling:**

- 48px height input fields
- Consistent padding: 12px vertical, 16px horizontal
- Dark theme: black background, light text
- Focus state: primary color border
- Disabled state: 0.5 opacity
- Custom dropdown styling (SVG arrow)
- Textarea: 100px minimum height
- Custom checkbox: `.portal-checkbox` component

---

## Accessibility

### ARIA Attributes Used

| Attribute | Purpose | Location |
| --- | --- | --- |
| `aria-label` | Label for icon buttons, dropzone | Contact form, admin modules |
| `aria-required="true"` | Mark required fields | Contact form |
| `aria-invalid="true"` | Mark invalid fields | form-errors.ts |
| `aria-describedby` | Link field to error message | form-errors.ts |
| `role="alert"` | Error message role | form-errors.ts, contact-form.ts |
| `aria-live="polite"` | Announce error updates | form-errors.ts |
| `aria-labelledby` | Modal labels | Admin modules |
| `aria-hidden="true"` | Hide decorative SVGs | Throughout UI |

### Label Associations

```html
<label class="field-label" for="field-id">Label Text</label>
<input id="field-id" />
```

### Error Association

```html
<input aria-invalid="true" aria-describedby="field-error" />
<div id="field-error" role="alert" aria-live="polite">Error text</div>
```

### Skip Link

```html
<a href="#admin-main" class="skip-link">Skip to main content</a>
```

### Keyboard Navigation

- Tab through form fields
- Enter to submit forms
- Space/Enter for checkboxes and radio buttons
- Focus visible indicators on all inputs
- Password toggle buttons keyboard accessible

---

## Security Patterns

### Client-Side Security

**File:** `src/utils/sanitization.ts`

| Function | Purpose |
| --- | --- |
| `SanitizationUtils.sanitizeText()` | HTML/script removal |
| `SanitizationUtils.sanitizeEmail()` | Email sanitization |
| `SanitizationUtils.sanitizeMessage()` | Message sanitization |
| `SanitizationUtils.detectXss()` | XSS pattern detection |

**Protection Measures:**

- Honeypot field: `input[name="bot-field"]` (hidden)
- Input length limits (5000 char max)
- XSS violation logging

### Server-Side Security

- Request validation before processing
- Sanitization during validation
- Error logging with context
- CSRF protection available

---

## CSS Architecture

### CSS Files for Forms

| File | Purpose |
| --- | --- |
| `src/styles/components/form-fields.css` | Input/textarea/select styling |
| `src/styles/components/form-validation.css` | Error states |
| `src/styles/components/form-buttons.css` | Button styling |
| `src/styles/shared/portal-forms.css` | Portal-specific forms |
| `src/styles/admin/auth.css` | Admin auth gate |
| `src/styles/pages/terminal-intake.css` | Terminal intake UI |
| `src/styles/pages/contact.css` | Contact form |

### Form Component Classes

**Universal Classes:**

| Class | Purpose |
| --- | --- |
| `.form-container` | Form wrapper |
| `.form-group` | Field wrapper |
| `.form-input` | Text/email/tel inputs |
| `.form-textarea` | Textarea fields |
| `.form-select` | Select dropdowns |
| `.form-button` | Submit buttons |
| `.form-button.loading` | Loading state |
| `.form-button.form-valid` | Valid state |
| `.field-label` | Field labels |
| `.field-error` | Error messages |
| `.field--invalid` | Invalid field |

**Portal Forms:**

| Class | Purpose |
| --- | --- |
| `.label-inside` | Labels inside inputs (opt-in) |
| `.field-with-left-icon` | With left icon padding |
| `.portal-checkbox` | Custom checkbox |

---

## Current State

### Compliant Areas

| Area | Status | Implementation |
|------|--------|----------------|
| Password toggles | PASS | Shared component `src/components/password-toggle.ts` with `data-password-toggle` attribute |
| Label associations | PASS | All form inputs have associated labels (explicit or aria-label) |
| ARIA attributes | PASS | Error messages use `role="alert"`, `aria-live` |
| Validation | PASS | Three-layer validation (HTML5, client-side, server-side) |
| Required attributes | PASS | Standardized on HTML5 `required` + `aria-required="true"` |

### Open Issues

None. All forms follow established patterns.

### Best Practices Observed

- Comprehensive validation schema system
- Good error handling with ARIA attributes
- Client-side sanitization
- Debounced validation (performance)
- Reusable CSS component classes
- Honeypot bot detection
- Password visibility toggle
- Form completion tracking
- Error message accessibility (role="alert", aria-live)
- Consistent dark theme styling

---

## Quick Reference

### Add a New Form Field

```html
<div class="form-group">
  <label class="field-label" for="my-field">Label</label>
  <input
    type="text"
    id="my-field"
    name="myField"
    class="form-input"
    required
    aria-required="true"
  />
  <div class="field-error" role="alert" aria-live="polite"></div>
</div>
```

### Validate a Field

```typescript
import { showFieldError, clearFieldError } from '@/utils/form-errors';
import { validators } from '@/utils/form-validation';

const field = document.getElementById('my-field') as HTMLInputElement;

if (!validators.required()(field.value)) {
  showFieldError(field, 'This field is required');
} else {
  clearFieldError(field);
}
```

### Create a Validation Schema

```typescript
// shared/validation/schemas.ts
export const myFormSchema: ValidationSchema = {
  rules: [
    { field: 'name', type: 'required' },
    { field: 'email', type: 'email' },
    { field: 'message', type: 'string', options: { minLength: 10 } }
  ]
};
```
