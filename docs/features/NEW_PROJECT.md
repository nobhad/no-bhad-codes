# New Project Request Form

## Table of Contents

1. [Overview](#overview)
2. [Form Fields](#form-fields)
3. [Validation](#validation)
4. [Form Submission](#form-submission)
5. [Backend Integration](#backend-integration)
6. [Styling](#styling)
7. [File Locations](#file-locations)

---

## Overview

The New Project Request form allows existing clients to submit requests for additional projects. The form collects project details, budget, timeline, and requirements.

**Access:** Client Portal > + NEW PROJECT button

---

## Form Fields

### Project Name

```html
<div class="form-group">
  <label for="project-name">Project Name</label>
  <input type="text" id="project-name" class="form-input"
         placeholder="e.g., Company Website Redesign" required>
</div>
```

### Project Type

Dropdown selection for project category:

| Value | Label |
|-------|-------|
| `website` | New Website |
| `redesign` | Website Redesign |
| `webapp` | Web Application |
| `ecommerce` | E-Commerce Site |
| `maintenance` | Maintenance & Updates |
| `other` | Other |

```html
<div class="form-group">
  <label for="project-type">Project Type</label>
  <select id="project-type" class="form-select" required>
    <option value="">Select a project type</option>
    <option value="website">New Website</option>
    <option value="redesign">Website Redesign</option>
    <option value="webapp">Web Application</option>
    <option value="ecommerce">E-Commerce Site</option>
    <option value="maintenance">Maintenance & Updates</option>
    <option value="other">Other</option>
  </select>
</div>
```

### Estimated Budget

Budget range selection:

| Value | Label |
|-------|-------|
| `1k-2.5k` | $1,000 - $2,500 |
| `2.5k-5k` | $2,500 - $5,000 |
| `5k-10k` | $5,000 - $10,000 |
| `10k-25k` | $10,000 - $25,000 |
| `25k+` | $25,000+ |

```html
<div class="form-group">
  <label for="project-budget">Estimated Budget</label>
  <select id="project-budget" class="form-select" required>
    <option value="">Select a budget range</option>
    <option value="1k-2.5k">$1,000 - $2,500</option>
    <option value="2.5k-5k">$2,500 - $5,000</option>
    <option value="5k-10k">$5,000 - $10,000</option>
    <option value="10k-25k">$10,000 - $25,000</option>
    <option value="25k+">$25,000+</option>
  </select>
</div>
```

### Desired Timeline

Timeline preference selection:

| Value | Label |
|-------|-------|
| `asap` | As soon as possible |
| `1-2months` | 1-2 months |
| `3-6months` | 3-6 months |
| `flexible` | Flexible |

```html
<div class="form-group">
  <label for="project-timeline">Desired Timeline</label>
  <select id="project-timeline" class="form-select" required>
    <option value="">Select a timeline</option>
    <option value="asap">As soon as possible</option>
    <option value="1-2months">1-2 months</option>
    <option value="3-6months">3-6 months</option>
    <option value="flexible">Flexible</option>
  </select>
</div>
```

### Project Description

Free-form text area for detailed requirements:

```html
<div class="form-group">
  <label for="project-description">Project Description</label>
  <textarea id="project-description" class="form-textarea" rows="5"
            placeholder="Tell me about your project goals, requirements, and any specific features you need..."
            required></textarea>
</div>
```

---

## Validation

### Required Fields

All fields are required for submission:

- Project Name
- Project Type
- Estimated Budget
- Desired Timeline
- Project Description

### Client-Side Validation

```typescript
const form = document.getElementById('new-project-form') as HTMLFormElement;

form.addEventListener('submit', (e) => {
  e.preventDefault();

  // Check all required fields
  const projectName = document.getElementById('project-name') as HTMLInputElement;
  const projectType = document.getElementById('project-type') as HTMLSelectElement;
  const projectBudget = document.getElementById('project-budget') as HTMLSelectElement;
  const projectTimeline = document.getElementById('project-timeline') as HTMLSelectElement;
  const projectDescription = document.getElementById('project-description') as HTMLTextAreaElement;

  // Validate
  if (!projectName.value.trim()) {
    showError('Please enter a project name');
    return;
  }

  if (!projectType.value) {
    showError('Please select a project type');
    return;
  }

  // ... additional validation

  // Submit form
  submitProjectRequest({
    name: projectName.value,
    type: projectType.value,
    budget: projectBudget.value,
    timeline: projectTimeline.value,
    description: projectDescription.value
  });
});
```

---

## Form Submission

### Submit Handler

```typescript
async function submitProjectRequest(data: ProjectRequestData): Promise<void> {
  try {
    const response = await fetch('/api/projects/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to submit project request');
    }

    // Show success message
    showSuccess('Project request submitted successfully!');

    // Reset form
    form.reset();

    // Navigate to dashboard
    switchTab('dashboard');

  } catch (error) {
    showError('Failed to submit project request. Please try again.');
    console.error('Project request error:', error);
  }
}
```

### Success Flow

1. Form data validated
2. Request sent to API
3. Success toast displayed
4. Form reset
5. Redirect to dashboard
6. New project appears in project list (pending status)

---

## Backend Integration

### API Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/request` | POST | Submit project request |

### Request Payload

```typescript
interface ProjectRequestData {
  name: string;
  type: 'website' | 'redesign' | 'webapp' | 'ecommerce' | 'maintenance' | 'other';
  budget: '1k-2.5k' | '2.5k-5k' | '5k-10k' | '10k-25k' | '25k+';
  timeline: 'asap' | '1-2months' | '3-6months' | 'flexible';
  description: string;
}
```

### Response

```typescript
interface ProjectRequestResponse {
  success: boolean;
  project: {
    id: number;
    name: string;
    status: 'pending';
    created_at: string;
  };
  message: string;
}
```

### Database Schema

```sql
CREATE TABLE project_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  budget TEXT NOT NULL,
  timeline TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by INTEGER,
  notes TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
```

### Email Notifications

When a project request is submitted:

**To Client:**
```typescript
await emailService.sendProjectRequestConfirmation(clientEmail, {
  clientName: 'John Doe',
  projectName: 'Company Website Redesign',
  submittedAt: new Date().toISOString(),
  portalUrl: 'https://portal.nobhadcodes.com'
});
```

**To Admin:**
```typescript
await emailService.sendAdminNotification({
  type: 'new_project_request',
  clientName: 'John Doe',
  projectName: 'Company Website Redesign',
  budget: '$5,000 - $10,000',
  timeline: '1-2 months',
  adminUrl: 'https://admin.nobhadcodes.com/requests'
});
```

---

## Styling

### Form Container

```css
.new-project-form {
  background: var(--color-neutral-100);
  border: 4px solid #000000;
  padding: 2rem;
  max-width: 800px;
}

.form-intro {
  margin-bottom: 1.5rem;
  color: var(--color-text-muted);
}
```

### Form Elements

```css
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-dark);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--color-dark);
  border-radius: 4px;
  background: var(--color-neutral-100);
  color: var(--color-dark);
  font-size: 1rem;
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* Dropdown arrow */
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}
```

### Submit Button

```css
.new-project-form .btn-secondary {
  width: 100%;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  margin-top: 1rem;
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `templates/pages/client-portal.ejs:337-393` | New Project form HTML |
| `src/features/client/client-portal.ts` | Form submission handler |
| `src/styles/pages/client-portal.css` | Form styling |
| `server/routes/projects.ts` | Project request API |
| `server/services/email-service.ts` | Email notifications |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Messages](./MESSAGES.md) - Project discussions happen in messages
