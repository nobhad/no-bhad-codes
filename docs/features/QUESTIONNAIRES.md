# Questionnaires

**Status:** Complete
**Last Updated:** February 11, 2026

## Overview

The questionnaires feature allows admins to create and send discovery questionnaires to clients. Clients can complete questionnaires through the client portal, with progress saving and submission tracking.

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `questionnaires` | Questionnaire templates with configurable questions |
| `questionnaire_responses` | Client responses with status tracking |

### questionnaires

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Internal name for reference |
| description | TEXT | Description shown to client |
| project_type | TEXT | Optional: 'website', 'branding', 'ecommerce', etc. |
| questions | JSON | Array of question objects |
| is_active | BOOLEAN | Whether available for sending |
| auto_send_on_project_create | BOOLEAN | Auto-send when project created |
| display_order | INTEGER | Order in admin list |
| created_by | TEXT | Admin who created |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### questionnaire_responses

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| questionnaire_id | INTEGER | FK to questionnaires |
| client_id | INTEGER | FK to clients |
| project_id | INTEGER | Optional FK to projects |
| answers | JSON | Client's answers |
| status | TEXT | 'pending', 'in_progress', 'completed' |
| started_at | DATETIME | When client first opened |
| completed_at | DATETIME | When client submitted |
| due_date | DATE | Optional due date |
| reminder_count | INTEGER | Number of reminders sent |
| reminder_sent_at | DATETIME | When last reminder was sent |

### Question Types

Questions are stored as JSON arrays with the following structure:

```json
{
  "id": "q1",
  "type": "text | textarea | select | multiselect",
  "question": "Question text here",
  "options": ["Option 1", "Option 2"],
  "required": true
}
```

| Type | Description |
|------|-------------|
| `text` | Single-line text input |
| `textarea` | Multi-line text input |
| `select` | Single-select dropdown |
| `multiselect` | Multi-select checkboxes |

## API Endpoints

### Client Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questionnaires/my-responses` | Get all responses for authenticated client |
| GET | `/api/questionnaires/responses/:id` | Get specific response with questionnaire details |
| POST | `/api/questionnaires/responses/:id/save` | Save progress on a response |
| POST | `/api/questionnaires/responses/:id/submit` | Submit completed response |

### Admin Endpoints - Questionnaire CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questionnaires` | Get all questionnaires |
| GET | `/api/questionnaires/:id` | Get specific questionnaire |
| POST | `/api/questionnaires` | Create new questionnaire |
| PUT | `/api/questionnaires/:id` | Update questionnaire |
| DELETE | `/api/questionnaires/:id` | Delete questionnaire |

### Admin Endpoints - Responses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questionnaires/responses/pending` | Get all pending responses |
| POST | `/api/questionnaires/:id/send` | Send questionnaire to client |
| GET | `/api/questionnaires/client/:clientId/responses` | Get responses for specific client |
| POST | `/api/questionnaires/responses/:id/remind` | Send reminder for response |
| DELETE | `/api/questionnaires/responses/:id` | Delete a response |

## Components

### Admin Portal

**File:** `src/features/admin/modules/admin-questionnaires.ts`

- Questionnaire management table
- Create/edit questionnaire modal with question builder
- Send questionnaire to client modal
- Response status tracking

### Client Portal

**File:** `src/features/client/modules/portal-questionnaires.ts`

- Questionnaire list with status indicators
- Questionnaire form with auto-save
- Progress tracking
- Submit confirmation

## Styles

- `src/styles/admin/questionnaires.css` - Admin portal styles
- `src/styles/client-portal/questionnaires.css` - Client portal styles

## Default Questionnaires

Three default questionnaires are seeded on first migration:

1. **Website Discovery** - Goals, target audience, page count, features
2. **Branding Discovery** - Brand values, emotions, competitors, style preferences
3. **Project Kickoff** - Timeline, urgency, success criteria, communication preferences

## Workflow

1. Admin creates questionnaire template with questions
2. Admin sends questionnaire to client (optionally with due date)
3. Client receives notification and accesses via portal
4. Client completes questionnaire with auto-save progress
5. Client submits completed questionnaire
6. Admin reviews responses in client detail view

## Save to Files (Planned)

**Status:** Planned
**Priority:** Medium

Generate PDF and export raw data when questionnaire is completed.

### Requirements

- On questionnaire completion (submit):
  1. Generate PDF of Q&A (formatted questions and answers)
  2. Keep raw JSON data export available
  3. PDF auto-saves to project Files tab under "Forms" folder
- Both formats available for download from admin portal

### PDF Format

- Questionnaire title and description
- Client name and completion date
- Each question with client's answer
- Multi-select answers shown as bulleted list
- Professional formatting matching other PDFs

### API Endpoints (Planned)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questionnaires/responses/:id/pdf` | Download response as PDF |
| GET | `/api/questionnaires/responses/:id/json` | Download raw JSON data |

### File Naming Convention

- PDF: `{questionnaire-name}-{client-name}-{date}.pdf`
- JSON: `{questionnaire-name}-{client-name}-{date}.json`

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Where clients complete questionnaires
- [Clients](./CLIENTS.md) - Client management features
- [Database Schema](../architecture/DATABASE_SCHEMA.md) - Full schema reference
