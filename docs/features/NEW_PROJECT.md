# New Project Request Form

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [HTML Structure](#html-structure)
4. [Form Fields](#form-fields)
5. [Validation](#validation)
6. [Form Submission](#form-submission)
7. [Backend Integration](#backend-integration)
8. [Styling](#styling)
9. [File Locations](#file-locations)

---

## Overview

The New Project Request form allows existing clients to submit requests for additional projects. The form collects project details, budget, timeline, and requirements.

**Access:** Client Portal > + NEW PROJECT button (`tab-new-project`)

---

## Features

| Feature | Description |
|---------|-------------|
| Project Name | Custom name for the project |
| Project Type | Dropdown selection of project categories |
| Budget Range | Predefined budget options |
| Timeline | Desired completion timeline |
| Description | Free-form project requirements |
| Required Fields | All fields required for submission |
| Form Reset | Form clears after successful submission |

---

## HTML Structure

### Complete New Project Tab

```html
<!-- templates/pages/client-portal.ejs:337-393 -->
<div class="tab-content" id="tab-new-project">
    <div class="page-header">
        <h2>Start a New Project</h2>
    </div>

    <form class="new-project-form" id="new-project-form">
        <p class="form-intro">Ready to start something new? Fill out the form below to request a new project.</p>

        <div class="form-group">
            <label for="project-name">Project Name</label>
            <input type="text" id="project-name" class="form-input"
                   placeholder="e.g., Company Website Redesign" required>
        </div>

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

        <div class="form-group">
            <label for="project-description">Project Description</label>
            <textarea id="project-description" class="form-textarea" rows="5"
                      placeholder="Tell me about your project goals, requirements, and any specific features you need..."
                      required></textarea>
        </div>

        <button type="submit" class="btn btn-secondary">Submit Project Request</button>
    </form>
</div>
```

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

| Property | Value |
|----------|-------|
| ID | `project-name` |
| Type | `text` |
| Required | Yes |
| Placeholder | "e.g., Company Website Redesign" |

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

| Property | Value |
|----------|-------|
| ID | `project-description` |
| Rows | 5 |
| Required | Yes |
| Placeholder | Detailed prompt for requirements |

---

## Validation

### Required Fields

All fields are required for submission:

- [x] Project Name
- [x] Project Type
- [x] Estimated Budget
- [x] Desired Timeline
- [x] Project Description

### Client-Side Validation

**Status:** Complete

```typescript
// Form validation and submission is handled by setupSettingsFormHandlers()
const newProjectForm = document.getElementById('new-project-form') as HTMLFormElement;
if (newProjectForm) {
  newProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await this.submitProjectRequest();
  });
}
```

---

## Form Submission

### Submit Handler

**Status:** Complete

```typescript
private async submitProjectRequest(): Promise<void> {
  const token = localStorage.getItem('client_auth_token');

  if (!token || token.startsWith('demo_token_')) {
    alert('Project requests cannot be submitted in demo mode.');
    return;
  }

  const name = (document.getElementById('project-name') as HTMLInputElement)?.value;
  const projectType = (document.getElementById('project-type') as HTMLSelectElement)?.value;
  const budget = (document.getElementById('project-budget') as HTMLSelectElement)?.value;
  const timeline = (document.getElementById('project-timeline') as HTMLSelectElement)?.value;
  const description = (document.getElementById('project-description') as HTMLTextAreaElement)?.value;

  if (!name || !projectType || !description) {
    alert('Please fill in all required fields');
    return;
  }

  const response = await fetch(`${ClientPortalModule.PROJECTS_API_BASE}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name, projectType, budget, timeline, description })
  });

  const data = await response.json();

  if (response.ok) {
    alert(data.message || 'Project request submitted successfully!');
    form.reset();
    this.switchTab('dashboard');
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

**Status:** Complete

### API Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/request` | POST | Submit project request (clients only) |

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

Project requests are stored in the `projects` table with `status = 'pending'`:

```sql
-- New columns added via migration 007_project_request_columns.sql
ALTER TABLE projects ADD COLUMN project_type TEXT;
ALTER TABLE projects ADD COLUMN budget_range TEXT;
ALTER TABLE projects ADD COLUMN timeline TEXT;
ALTER TABLE projects ADD COLUMN preview_url TEXT;
```

Projects created via the request form have these characteristics:
- `status` = 'pending'
- `priority` = 'medium'
- `project_type`, `budget_range`, `timeline` populated from form

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

### Focus States

```css
.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}
```

### Error States

```css
.form-input.error,
.form-select.error,
.form-textarea.error {
  border-color: #dc2626;
}

.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
```

---

## File Locations

| File | Lines | Purpose |
|------|-------|---------|
| `templates/pages/client-portal.ejs` | 337-393 | New Project form HTML |
| `src/features/client/client-portal.ts` | 290-347 | Form submission handler |
| `src/styles/pages/client-portal.css` | - | Form styling |
| `server/routes/projects.ts` | - | Project request API |
| `server/services/email-service.ts` | - | Email notifications |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Messages](./MESSAGES.md) - Project discussions happen in messages
- [CSS Architecture](./CSS_ARCHITECTURE.md) - Form styling system
