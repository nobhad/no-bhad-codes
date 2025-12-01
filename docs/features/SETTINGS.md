# User Settings

## Table of Contents

1. [Overview](#overview)
2. [Settings Sections](#settings-sections)
3. [Account Section](#account-section)
4. [Notification Preferences](#notification-preferences)
5. [Billing Information](#billing-information)
6. [Password Visibility Toggle](#password-visibility-toggle)
7. [Backend Integration](#backend-integration)
8. [Styling](#styling)
9. [File Locations](#file-locations)

---

## Overview

The Settings page allows clients to manage their account information, notification preferences, and billing details. Settings are organized into three responsive columns that stack vertically on smaller screens.

**Access:** Client Portal > Settings tab

---

## Settings Sections

### Grid Layout

The settings page uses a 3-column responsive grid:

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

### Section Cards

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

### Profile Fields

| Field | Type | Purpose |
|-------|------|---------|
| Full Name | text | Display name |
| Email | email | Login and notifications |
| Company | text | Company/organization name |
| Phone | tel | Contact number |

### Password Fields

| Field | Type | Purpose |
|-------|------|---------|
| Current Password | password | Verify identity |
| New Password | password | New password |
| Confirm Password | password | Verify new password |

### Account Form HTML

```html
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

    <!-- Password Fields -->
    <div class="form-group">
      <label for="current-password">Current Password</label>
      <div class="cp-password-wrapper">
        <input type="password" id="current-password" class="form-input" autocomplete="current-password">
        <button type="button" class="cp-password-toggle" data-target="current-password">
          <svg><!-- Eye icon --></svg>
        </button>
      </div>
    </div>
    <div class="form-group">
      <label for="new-password">New Password</label>
      <div class="cp-password-wrapper">
        <input type="password" id="new-password" class="form-input" autocomplete="new-password">
        <button type="button" class="cp-password-toggle" data-target="new-password">
          <svg><!-- Eye icon --></svg>
        </button>
      </div>
    </div>
    <div class="form-group">
      <label for="confirm-password">Confirm New Password</label>
      <div class="cp-password-wrapper">
        <input type="password" id="confirm-password" class="form-input" autocomplete="new-password">
        <button type="button" class="cp-password-toggle" data-target="confirm-password">
          <svg><!-- Eye icon --></svg>
        </button>
      </div>
    </div>

    <button type="submit" class="btn btn-secondary">Save Changes</button>
  </form>
</div>
```

---

## Notification Preferences

Email notification settings with checkbox options.

### Notification Options

| Option | Default | Description |
|--------|---------|-------------|
| New message | Checked | When receiving a new message |
| Project status change | Checked | When project status updates |
| New invoice | Checked | When invoice is generated |
| Weekly summary | Unchecked | Weekly project progress email |

### Checkbox Group HTML

```html
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

### Checkbox Styling

```css
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

/* No background transform on hover for notification cards */
.checkbox-group .checkbox-item:hover {
  background: transparent;
}
```

---

## Billing Information

Company and address information for invoicing.

### Billing Fields

| Field | Type | Purpose |
|-------|------|---------|
| Company Name | text | Business name for invoices |
| Street Address | text | Primary address line |
| Address Line 2 | text | Apt, Suite, etc. |
| City | text | City name |
| State / Province | text | State or province |
| ZIP / Postal Code | text | Postal code |
| Country | text | Country name |

### Billing Form HTML

```html
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

---

## Password Visibility Toggle

Eye icon buttons to show/hide password fields.

### Toggle Implementation

```typescript
// Setup password visibility toggles
const passwordToggles = document.querySelectorAll('.cp-password-toggle');

passwordToggles.forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const targetId = (toggle as HTMLElement).dataset.target;
    const input = document.getElementById(targetId) as HTMLInputElement;

    if (input) {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      // Update icon (optional: swap between eye and eye-off icons)
      toggle.classList.toggle('showing', !isPassword);
    }
  });
});
```

### Toggle Styling

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

---

## Backend Integration

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/profile` | GET | Get user profile |
| `/api/users/profile` | PUT | Update profile |
| `/api/users/password` | PUT | Change password |
| `/api/users/notifications` | GET | Get notification prefs |
| `/api/users/notifications` | PUT | Update notification prefs |
| `/api/users/billing` | GET | Get billing info |
| `/api/users/billing` | PUT | Update billing info |

### Database Schema

```sql
-- User profiles (extends auth users)
CREATE TABLE user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  company TEXT,
  phone TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  email_messages BOOLEAN DEFAULT 1,
  email_status_changes BOOLEAN DEFAULT 1,
  email_invoices BOOLEAN DEFAULT 1,
  email_weekly_summary BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Billing information
CREATE TABLE billing_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  company_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Styling

### Settings Section

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

---

## File Locations

| File | Purpose |
|------|---------|
| `templates/pages/client-portal.ejs:221-334` | Settings tab HTML |
| `src/features/client/client-portal.ts` | Settings form handlers |
| `src/styles/pages/client-portal.css` | Settings styling |
| `server/routes/users.ts` | User API endpoints |
| `server/routes/auth.ts` | Password change endpoint |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Invoices](./INVOICES.md) - Billing relates to invoices
- [Messages](./MESSAGES.md) - Notification preferences affect messages
