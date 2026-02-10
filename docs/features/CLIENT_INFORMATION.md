# Client Information Collection System

**Status:** Complete
**Last Updated:** February 10, 2026

## Overview

The Client Information Collection System provides a streamlined approach to gathering all necessary client data through a unified onboarding wizard, document collection portal, and questionnaire system.

**Key Capabilities:**

- Multi-step onboarding wizard (5 steps)
- Document upload and categorization
- Custom questionnaire builder and responses
- Information completeness tracking
- Automated reminder system

**Access:**

- Admin: Client Detail > Information tab
- Client: Portal > Onboarding section

---

## Features

### 1. Unified Onboarding Wizard

A 5-step guided process for gathering initial client information:

| Step | Name | Fields Collected |
|------|------|------------------|
| 1 | Basic Info | Company name, contact, email, phone |
| 2 | Project Overview | Project type, description, goals |
| 3 | Requirements | Features needed, timeline, budget range |
| 4 | Assets Checklist | Logo, content, domain info availability |
| 5 | Review & Submit | Confirmation of all entered data |

**Features:**

- Progress indicator (Step X of 5)
- Save progress and resume later
- Skip optional steps
- Back navigation between steps
- Completion celebration

### 2. Document Collection Portal

Centralized document management for client submissions:

**Document Categories:**

| Category | Examples |
|----------|----------|
| Brand Assets | Logo files, brand guidelines, fonts |
| Content | Copy, images, product photos |
| Legal | Business license, contracts, agreements |
| Technical | Hosting credentials, API keys, DNS info |

**Features:**

- Required vs optional document indicators
- Status tracking per document
- Bulk upload support
- File type validation (pdf, doc, docx, png, jpg, etc.)
- Size limits (max 10MB per file)
- Preview uploaded documents
- Admin approval workflow

### 3. Document Request Templates

Pre-configured templates for common document requests:

**Template Types:**

- Brand Assets Package
- Content Collection
- Legal Documents
- Technical Information

**Features:**

- One-click "Request Standard Documents" by project type
- Custom request builder for non-standard needs
- Due date automation (X days from project start)
- Batch send to client

### 4. Questionnaires

Dynamic questionnaire system for gathering structured information:

**Question Types:**

| Type | Description |
|------|-------------|
| `text` | Single-line text input |
| `textarea` | Multi-line text input |
| `select` | Single-choice dropdown |
| `multiselect` | Multi-choice selection |
| `file` | File upload |
| `number` | Numeric input |
| `date` | Date picker |
| `rating` | 1-5 star rating |

**Features:**

- Conditional questions (show if previous answer = X)
- Required vs optional questions
- Admin questionnaire builder UI
- Client questionnaire completion UI
- Auto-send questionnaire on project creation
- Response export to PDF

### 5. Information Status Dashboard

Track overall information completeness:

- Overall percentage complete
- Category breakdown (Basic, Documents, Questionnaires)
- Missing items highlighted
- Automatic reminders for incomplete items
- Admin view of all clients' status

---

## Database Schema

### onboarding_sessions Table

```sql
CREATE TABLE onboarding_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'step_1',
  step_1_data JSON,
  step_2_data JSON,
  step_3_data JSON,
  step_4_data JSON,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### questionnaires Table

```sql
CREATE TABLE questionnaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  questions JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### questionnaire_responses Table

```sql
CREATE TABLE questionnaire_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id),
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  answers JSON NOT NULL,
  status TEXT DEFAULT 'in_progress',
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### document_template_categories Table

```sql
CREATE TABLE document_template_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Onboarding

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/onboarding/:clientId` | Get onboarding session |
| POST | `/api/onboarding/create` | Create new session |
| PUT | `/api/onboarding/:sessionId/step/:step` | Save step data |
| POST | `/api/onboarding/:sessionId/complete` | Complete onboarding |

### Questionnaires

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questionnaires` | List all questionnaires |
| GET | `/api/questionnaires/:id` | Get questionnaire details |
| POST | `/api/questionnaires` | Create questionnaire |
| PUT | `/api/questionnaires/:id` | Update questionnaire |
| DELETE | `/api/questionnaires/:id` | Delete questionnaire |

### Questionnaire Responses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questionnaires/:id/responses` | Get all responses |
| GET | `/api/questionnaires/client/:clientId` | Get client's responses |
| POST | `/api/questionnaires/:id/respond` | Submit response |
| PUT | `/api/questionnaires/responses/:responseId` | Update response |

### Information Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/client-info/:clientId/status` | Get completeness status |
| GET | `/api/client-info/dashboard` | Admin status dashboard |
| POST | `/api/client-info/:clientId/remind` | Send reminder |

---

## Admin UI Components

### Questionnaire Builder

- Question list with drag-to-reorder
- Add question modal (type selection)
- Conditional logic builder
- Preview questionnaire
- Save as template

### Client Information Dashboard

- Status cards by client
- Completeness percentage bars
- Filter by status (complete, in progress, not started)
- Bulk reminder send

### Response Viewer

- Questionnaire name and description
- Question-answer pairs
- File attachment links
- Response timestamp
- Export to PDF

---

## Client Portal UI

### Onboarding Wizard

- Step indicator at top
- Form fields for current step
- Previous/Next buttons
- Save progress indicator
- Completion screen

### Document Upload

- Category tabs
- Upload dropzone
- File list with status
- Remove uploaded files
- Submit all button

### Questionnaire Completion

- Progress bar
- Question cards
- Input fields by type
- Required field indicators
- Submit button

---

## File Locations

| File | Purpose |
|------|---------|
| `server/routes/questionnaires.ts` | Questionnaire API routes |
| `server/routes/client-info.ts` | Client info API routes |
| `server/services/questionnaire-service.ts` | Questionnaire business logic |
| `server/services/client-info-service.ts` | Client info business logic |
| `server/database/migrations/057_questionnaires.sql` | Questionnaire schema |
| `server/database/migrations/058_client_onboarding.sql` | Onboarding schema |
| `src/features/admin/modules/admin-questionnaires.ts` | Admin questionnaire UI |
| `src/features/client/modules/portal-onboarding-wizard.ts` | Client onboarding UI |
| `src/features/client/modules/portal-questionnaires.ts` | Client questionnaire UI |
| `src/styles/client-portal/onboarding.css` | Onboarding styles |
| `src/styles/client-portal/questionnaires.css` | Questionnaire styles |

---

## Test Coverage

**Test File:** `tests/unit/server/client-information.test.ts`
**Total Tests:** 40

### Coverage Areas

| Area | Tests | Description |
|------|-------|-------------|
| Onboarding Wizard | 12 | Session creation, step saves, completion |
| Document Collection | 10 | Upload, validation, categorization |
| Questionnaires | 10 | CRUD, question types, conditional logic |
| Status Tracking | 8 | Completeness calculation, reminders |

### Test Categories

**Onboarding Tests:**

- Create onboarding session
- Initialize with step 1
- Save step data
- Navigate between steps
- Complete onboarding
- Resume saved session

**Document Tests:**

- Upload document to category
- Validate file type
- Validate file size
- List documents by category
- Bulk upload handling
- Document approval

**Questionnaire Tests:**

- Create questionnaire with questions
- Multiple question types
- Conditional question logic
- Submit response
- Partial save and resume
- Complete questionnaire

**Status Tests:**

- Calculate completeness percentage
- Category breakdown
- Missing item detection
- Send reminder
- Admin dashboard aggregation

---

## Related Documentation

- [Document Requests](./DOCUMENT_REQUESTS.md) - Document request templates
- [Client Portal](./CLIENT_PORTAL.md) - Client-facing interface
- [Clients](./CLIENTS.md) - Client management
- [Projects](./PROJECTS.md) - Project context

---

## Change Log

### February 10, 2026 - Documentation Created

- Created comprehensive CLIENT_INFORMATION.md
- Documented database schema, API endpoints, UI components
- Added test coverage section with 40 tests

### February 9, 2026 - System Complete

- Onboarding wizard implemented
- Questionnaire builder and responses
- Document categories and templates
- Status tracking dashboard
- Test suite completed
