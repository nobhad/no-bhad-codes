# User Settings

## Table of Contents

1. [Overview](#overview)
2. [Settings Grid Layout](#settings-grid-layout)
3. [Account Section](#account-section)
4. [Notification Preferences](#notification-preferences)
5. [Billing Information](#billing-information)
6. [Password Visibility Toggle](#password-visibility-toggle)
7. [TypeScript Implementation](#typescript-implementation)
8. [LocalStorage Keys](#localstorage-keys)
9. [Backend Integration](#backend-integration)
10. [Styling](#styling)
11. [File Locations](#file-locations)

---

## Overview

The Settings page allows clients to manage their account information, notification preferences, and billing details. Settings are organized into three responsive columns that stack vertically on smaller screens.

**Access:** Client Portal > Settings tab (`tab-settings`)

---

## Settings Grid Layout

### 3-Column Responsive Grid

```css
.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(320px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 1200px) {
  .settings-grid {
    grid-template-columns: repeat(2, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
```

### Section Card Template

Each section is wrapped in a card with consistent styling:

```html
<div class="settings-section cp-shadow">
  <h3>Section Title</h3>
  <form class="settings-form" id="form-id">
    <!-- Form fields -->
    <button type="submit" class="btn btn-secondary">Save Changes</button>
  </form>
</div>
```

---

## Account Section

Combined Profile and Password management in one section.

### HTML Implementation

```html
<!-- templates/pages/client-portal.ejs:228-271 -->
<div class="settings-section cp-shadow">
    <h3>Account</h3>
    <form class="settings-form" id="profile-form">
        <!-- Profile Fields -->
        <div class="form-group">
            <label for="settings-name">Full Name</label>
            <input type="text" id="settings-name" class="form-input" value="Client Name">
        </div>
        <div class="form-group">
            <label for="settings-email">Email</label>
            <input type="email" id="settings-email" class="form-input" value="client@example.com">
        </div>
        <div class="form-group">
            <label for="settings-company">Company</label>
            <input type="text" id="settings-company" class="form-input" placeholder="Your company name">
        </div>
        <div class="form-group">
            <label for="settings-phone">Phone</label>
            <input type="tel" id="settings-phone" class="form-input" placeholder="(555) 555-5555">
        </div>

        <!-- Password Fields with Toggle -->
        <div class="form-group">
            <label for="current-password">Current Password</label>
            <div class="cp-password-wrapper">
                <input type="password" id="current-password" class="form-input" autocomplete="current-password">
                <button type="button" class="cp-password-toggle" data-target="current-password"
                        aria-label="Toggle password visibility">
                    <!-- Eye SVG icon -->
                </button>
            </div>
        </div>
        <div class="form-group">
            <label for="new-password">New Password</label>
            <div class="cp-password-wrapper">
                <input type="password" id="new-password" class="form-input" autocomplete="new-password">
                <button type="button" class="cp-password-toggle" data-target="new-password"
                        aria-label="Toggle password visibility">
                    <!-- Eye SVG icon -->
                </button>
            </div>
        </div>
        <div class="form-group">
            <label for="confirm-password">Confirm New Password</label>
            <div class="cp-password-wrapper">
                <input type="password" id="confirm-password" class="form-input" autocomplete="new-password">
                <button type="button" class="cp-password-toggle" data-target="confirm-password"
                        aria-label="Toggle password visibility">
                    <!-- Eye SVG icon -->
                </button>
            </div>
        </div>

        <button type="submit" class="btn btn-secondary">Save Changes</button>
    </form>
</div>
```

### Profile Fields

| Field | ID | Type | Purpose |
|-------|-----|------|---------|
| Full Name | `settings-name` | text | Display name |
| Email | `settings-email` | email | Login and notifications |
| Company | `settings-company` | text | Company/organization name |
| Phone | `settings-phone` | tel | Contact number |

### Password Fields

| Field | ID | Type | Purpose |
|-------|-----|------|---------|
| Current Password | `current-password` | password | Verify identity |
| New Password | `new-password` | password | New password |
| Confirm Password | `confirm-password` | password | Verify new password |

---

## Notification Preferences

Email notification settings with checkbox options.

### HTML Implementation

```html
<!-- templates/pages/client-portal.ejs:273-297 -->
<div class="settings-section cp-shadow">
    <h3>Notification Preferences</h3>
    <form class="settings-form" id="notifications-form">
        <div class="checkbox-group">
            <label class="checkbox-item">
                <input type="checkbox" checked>
                <span>Email me when I receive a new message</span>
            </label>
            <label class="checkbox-item">
                <input type="checkbox" checked>
                <span>Email me when project status changes</span>
            </label>
            <label class="checkbox-item">
                <input type="checkbox" checked>
                <span>Email me when a new invoice is generated</span>
            </label>
            <label class="checkbox-item">
                <input type="checkbox">
                <span>Email me weekly project summary</span>
            </label>
        </div>
        <button type="submit" class="btn btn-secondary">Save Preferences</button>
    </form>
</div>
```

### Notification Options

| Option | Default | Description |
|--------|---------|-------------|
| New message | Checked | When receiving a new message |
| Project status change | Checked | When project status updates |
| New invoice | Checked | When invoice is generated |
| Weekly summary | Unchecked | Weekly project progress email |

---

## Billing Information

Company and address information for invoicing.

### HTML Implementation

```html
<!-- templates/pages/client-portal.ejs:299-333 -->
<div class="settings-section cp-shadow">
    <h3>Billing Information</h3>
    <form class="settings-form" id="billing-form">
        <div class="form-group">
            <label for="billing-company">Company Name</label>
            <input type="text" id="billing-company" class="form-input" placeholder="Your company name">
        </div>
        <div class="form-group">
            <label for="billing-address">Street Address</label>
            <input type="text" id="billing-address" class="form-input" placeholder="123 Main St">
        </div>
        <div class="form-group">
            <label for="billing-address2">Address Line 2</label>
            <input type="text" id="billing-address2" class="form-input" placeholder="Apt, Suite, etc.">
        </div>
        <div class="form-group">
            <label for="billing-city">City</label>
            <input type="text" id="billing-city" class="form-input" placeholder="City">
        </div>
        <div class="form-group">
            <label for="billing-state">State / Province</label>
            <input type="text" id="billing-state" class="form-input" placeholder="State">
        </div>
        <div class="form-group">
            <label for="billing-zip">ZIP / Postal Code</label>
            <input type="text" id="billing-zip" class="form-input" placeholder="12345">
        </div>
        <div class="form-group">
            <label for="billing-country">Country</label>
            <input type="text" id="billing-country" class="form-input" placeholder="United States">
        </div>
        <button type="submit" class="btn btn-secondary">Save Billing Info</button>
    </form>
</div>
```

### Billing Fields

| Field | ID | Purpose |
|-------|-----|---------|
| Company Name | `billing-company` | Business name for invoices |
| Street Address | `billing-address` | Primary address line |
| Address Line 2 | `billing-address2` | Apt, Suite, etc. |
| City | `billing-city` | City name |
| State / Province | `billing-state` | State or province |
| ZIP / Postal Code | `billing-zip` | Postal code |
| Country | `billing-country` | Country name |

---

## Password Visibility Toggle

Eye icon buttons to show/hide password fields.

### HTML Structure

```html
<div class="cp-password-wrapper">
    <input type="password" id="current-password" class="form-input" autocomplete="current-password">
    <button type="button" class="cp-password-toggle" data-target="current-password"
            aria-label="Toggle password visibility">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    </button>
</div>
```

### TypeScript Implementation

```typescript
// src/features/client/client-portal.ts:172-193
// Password toggle buttons
const passwordToggles = document.querySelectorAll('.cp-password-toggle');
const eyeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const eyeOffIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

passwordToggles.forEach((toggle) => {
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = (toggle as HTMLElement).dataset.target;
    if (targetId) {
      const input = document.getElementById(targetId) as HTMLInputElement;
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          toggle.innerHTML = eyeOffIcon;
        } else {
          input.type = 'password';
          toggle.innerHTML = eyeIcon;
        }
      }
    }
  });
});
```

---

## TypeScript Implementation

### Form Save Methods

```typescript
// src/features/client/modules/portal-settings.ts

async function saveContactInfo(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const data = Object.fromEntries(formData);
  console.log('Saving contact info:', data);
  sessionStorage.setItem('client_contact_info', JSON.stringify(data));
  ctx.showNotification('Contact information saved successfully!', 'success');
}

async function saveBillingAddress(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const data = Object.fromEntries(formData);
  console.log('Saving billing address:', data);
  sessionStorage.setItem('client_billing_address', JSON.stringify(data));
  ctx.showNotification('Billing address saved successfully!', 'success');
}

async function saveNotificationPrefs(formData: FormData, ctx: ClientPortalContext): Promise<void> {
  const checkboxes = formData.getAll('notifications');
  const prefs = {
    projectUpdates: checkboxes.includes('project-updates'),
    invoices: checkboxes.includes('invoices'),
    messages: checkboxes.includes('messages'),
    milestones: checkboxes.includes('milestones')
  };
  console.log('Saving notification preferences:', prefs);
  sessionStorage.setItem('client_notification_prefs', JSON.stringify(prefs));
  ctx.showNotification('Notification preferences saved successfully!', 'success');
}
```

### Load Settings Methods

```typescript
// src/features/client/modules/portal-settings.ts

export function loadUserSettings(currentUser: string | null): void {
  const userData = {
    name: currentUser || 'User',
    email: currentUser || '',
    company: 'Company Name',
    phone: '',
    secondaryEmail: '',
    billing: {
      address1: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      country: ''
    }
  };

  // Populate contact info
  const nameInput = document.getElementById('contact-name') as HTMLInputElement;
  const emailInput = document.getElementById('contact-email') as HTMLInputElement;
  const companyInput = document.getElementById('contact-company') as HTMLInputElement;
  const phoneInput = document.getElementById('contact-phone') as HTMLInputElement;

  if (nameInput) nameInput.value = userData.name;
  if (emailInput) emailInput.value = userData.email;
  if (companyInput) companyInput.value = userData.company;
  if (phoneInput) phoneInput.value = userData.phone;

  // Populate billing address
  const address1Input = document.getElementById('billing-address1') as HTMLInputElement;
  const cityInput = document.getElementById('billing-city') as HTMLInputElement;
  // ... more field population
}

export function loadBillingSettings(): void {
  const savedBillingData = sessionStorage.getItem('client_billing_address');
  const billingData = savedBillingData ? JSON.parse(savedBillingData) : { ... };
  // ... populate billing fields
}

export function loadNotificationSettings(): void {
  const savedNotifications = sessionStorage.getItem('client_notification_prefs');
  // ... populate notification checkboxes
}
```

### Success Message Toast

The settings module uses the `ClientPortalContext.showNotification()` method:

```typescript
// src/features/client/modules/portal-settings.ts
ctx.showNotification('Contact information saved successfully!', 'success');

// ClientPortalContext provides this method:
interface ClientPortalContext {
  showNotification: (message: string, type: 'success' | 'error' | 'warning') => void;
  // ... other context methods
}
```

---

## Storage Keys

The settings module uses `sessionStorage` for client-side data persistence (cleared on browser close).

| Key | Storage | Purpose | Data Structure |
|-----|---------|---------|----------------|
| `clientEmail` | sessionStorage | Current user email | `string` |
| `client_contact_info` | sessionStorage | Contact details | `{ name, email, company, phone }` |
| `client_billing_address` | sessionStorage | Billing address | `{ address1, address2, city, state, zip, country }` |
| `client_notification_prefs` | sessionStorage | Notification settings | `{ projectUpdates, invoices, messages, milestones }` |
| `client_billing_view_address` | sessionStorage | Billing view data | `{ ... }` |
| `client_tax_info` | sessionStorage | Tax information | `{ taxId, businessName }` |
| `client_notification_frequency` | sessionStorage | Frequency settings | `{ frequency, quietStart, quietEnd }` |

---

## Backend Integration

**Status:** Complete

All settings forms now save to the backend API via the `/api/clients/me` endpoints.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clients/me` | GET | Get current client's profile |
| `/api/clients/me` | PUT | Update profile (name, company, phone) |
| `/api/clients/me/password` | PUT | Change password |
| `/api/clients/me/notifications` | PUT | Update notification preferences |
| `/api/clients/me/billing` | PUT | Update billing information |

### Frontend Save Methods

```typescript
// Profile Settings
private async saveProfileSettings(): Promise<void> {
  const token = localStorage.getItem('client_auth_token');

  const response = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      contact_name: contactName,
      company_name: companyName,
      phone: phone
    })
  });

  // Also handle password change if fields filled
  if (currentPassword && newPassword) {
    await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }
}

// Notification Settings
private async saveNotificationSettings(): Promise<void> {
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  const settings = {
    messages: checkboxes[0]?.checked || false,
    status: checkboxes[1]?.checked || false,
    invoices: checkboxes[2]?.checked || false,
    weekly: checkboxes[3]?.checked || false
  };

  await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/notifications`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(settings)
  });
}

// Billing Settings
private async saveBillingSettings(): Promise<void> {
  const billing = {
    company: document.getElementById('billing-company')?.value,
    address: document.getElementById('billing-address')?.value,
    address2: document.getElementById('billing-address2')?.value,
    city: document.getElementById('billing-city')?.value,
    state: document.getElementById('billing-state')?.value,
    zip: document.getElementById('billing-zip')?.value,
    country: document.getElementById('billing-country')?.value
  };

  await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/billing`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(billing)
  });
}
```

### Database Columns (clients table)

```sql
-- Added via migration 006_client_settings_columns.sql

-- Notification preferences
notification_messages INTEGER DEFAULT 1,
notification_status INTEGER DEFAULT 1,
notification_invoices INTEGER DEFAULT 1,
notification_weekly INTEGER DEFAULT 0,

-- Billing information
billing_company TEXT,
billing_address TEXT,
billing_address2 TEXT,
billing_city TEXT,
billing_state TEXT,
billing_zip TEXT,
billing_country TEXT
```

---

## Styling

### Settings Section Card

```css
.settings-section {
  background: var(--color-neutral-100);
  border: 4px solid #000000;
  padding: 1.5rem;
}

.settings-section h3 {
  margin-bottom: 1rem;
  color: var(--color-dark);
}
```

### Form Groups

```css
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-dark);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--color-dark);
  border-radius: 4px;
  background: var(--color-neutral-100);
  color: var(--color-dark);
}
```

### Password Wrapper

```css
.cp-password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.cp-password-wrapper .form-input {
  padding-right: 3rem;
}

.cp-password-toggle {
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-dark);
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.cp-password-toggle:hover {
  opacity: 1;
}
```

### Checkbox Group

```css
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.checkbox-item:hover {
  background: var(--color-neutral-100);
}

.checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `client/portal.html` | Settings tab HTML (tab-settings section) |
| `src/features/client/modules/portal-settings.ts` | Settings module (~260 lines) |
| `src/styles/client-portal/settings.css` | Settings styling |
| `server/routes/clients.ts` | Client profile API endpoints |
| `server/routes/auth.ts` | Password change endpoint |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Invoices](./INVOICES.md) - Billing relates to invoices
- [Messages](./MESSAGES.md) - Notification preferences affect messages
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Styling system
