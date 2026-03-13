# Content Request System

**Status:** Complete
**Last Updated:** March 13, 2026

## Overview

The Content Request System manages per-project content gathering from clients. Admin creates a checklist of items (bios, photos, brand assets, copy, URLs, credentials) and clients submit content incrementally through the portal. Tracks completion percentage and supports admin review with accept/revision workflow.

> **Implementation Note:** Uses a two-level structure: checklists contain items. Each item has a `content_type` that determines the submission UI. Status constants are defined in `server/config/constants.ts` as the single source of truth. Workflow events are emitted on submission and review actions.

## Checklist Statuses

|Status|Description|
|--------|-------------|
|`active`|Checklist is active and accepting submissions|
|`completed`|All items accepted, checklist complete|
|`cancelled`|Checklist cancelled|

## Item Statuses

|Status|Description|
|--------|-------------|
|`pending`|Awaiting client submission|
|`submitted`|Client has submitted content, awaiting review|
|`revision_needed`|Admin requested changes|
|`accepted`|Admin accepted the submission|

## Content Types

|Type|Description|Submission UI|
|--------|-------------|-------------|
|`text`|Written content (bios, descriptions, testimonials)|Textarea|
|`file`|Files (photos, logos, PDFs)|File upload|
|`url`|Links (inspiration sites, external resources)|URL input|
|`structured`|Key-value data (billing address, brand colors)|Form fields|

## Content Categories

|Category|Description|
|--------|-------------|
|`copy`|Copy/writing (bios, service descriptions)|
|`photo`|Photography and images|
|`brand_asset`|Brand assets (logos, colors, fonts)|
|`credentials`|Access credentials (domain registrar, CMS logins)|
|`reference`|Reference material (inspiration, examples)|
|`other`|Other content types|

## Features

### 1. Checklist Management

Admin creates and manages content checklists per project:

- Create checklist with items manually or from a template
- Add/remove/reorder items
- Set due dates and required/optional flags per item
- Track completion percentage across all items

### 2. Template System

Reusable templates for common project types:

- Pre-built "Website Build Content Package" template with 10 items
- Templates can be scoped to project types (e.g., `business-site`)
- Create checklist from template with auto-calculated due dates based on start date and offset days

#### Seeded Template: Website Build Content Package

|Item|Type|Category|Required|
|--------|--------|-------------|-------------|
|Business Bio / About Us|text|copy|Yes|
|Service Descriptions|text|copy|Yes|
|Logo Files (PNG + SVG)|file|brand_asset|Yes|
|Brand Colors & Fonts|structured|brand_asset|Yes|
|High-Resolution Photos|file|photo|No|
|Website Inspiration Links|url|reference|No|
|Domain Registrar Info|structured|credentials|Yes|
|Team Member Info|structured|copy|No|
|Billing Address|structured|other|Yes|
|Testimonials|text|copy|No|

### 3. Client Submissions

Clients submit content per item through the portal:

- Type-specific submission endpoints (text, file, URL, structured data)
- Items automatically transition to `submitted` status on submission
- Clients can resubmit after revision is requested

### 4. Admin Review

Admin reviews submitted content:

- Accept item — moves to `accepted` status
- Request revision — moves to `revision_needed` with admin notes
- Workflow events emitted: `content_request.submitted`, `content_request.accepted`, `content_request.revision_needed`

### 5. Completion Tracking

Real-time completion statistics per checklist:

- Total, pending, submitted, accepted, revision needed counts
- Completion percentage (accepted / total)
- Admin overview showing all active checklists with stats

## Database Schema

```sql
CREATE TABLE content_request_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_request_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES content_request_checklists(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_required BOOLEAN DEFAULT TRUE,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  sort_order INTEGER DEFAULT 0,
  text_content TEXT,
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  structured_data JSON,
  admin_notes TEXT,
  reviewed_at DATETIME,
  submitted_at DATETIME,
  reminder_sent_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_request_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  items JSON NOT NULL,
  project_type TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Admin — Checklists

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/content-requests`|List checklists (filter by projectId/clientId)|
|GET|`/api/content-requests/overview`|Admin overview with completion stats|
|GET|`/api/content-requests/:id`|Get checklist with items|
|POST|`/api/content-requests`|Create checklist (with items or from template)|
|PUT|`/api/content-requests/:id`|Update checklist|
|DELETE|`/api/content-requests/:id`|Delete checklist|

### Admin — Items

|Method|Endpoint|Description|
|--------|----------|-------------|
|POST|`/api/content-requests/:checklistId/items`|Add item to checklist|
|PUT|`/api/content-requests/items/:itemId`|Update item|
|DELETE|`/api/content-requests/items/:itemId`|Delete item|
|POST|`/api/content-requests/items/:itemId/accept`|Accept submitted item|
|POST|`/api/content-requests/items/:itemId/request-revision`|Request revision with notes|

### Admin — Templates

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/content-requests/templates`|List templates|
|POST|`/api/content-requests/templates`|Create template|
|PUT|`/api/content-requests/templates/:id`|Update template|
|DELETE|`/api/content-requests/templates/:id`|Delete template|

### Client Portal

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/content-requests/my`|Client's active checklists|
|GET|`/api/content-requests/my/:id`|Specific checklist with items|
|POST|`/api/content-requests/items/:itemId/submit-text`|Submit text content|
|POST|`/api/content-requests/items/:itemId/submit-file`|Submit file (pass file_id)|
|POST|`/api/content-requests/items/:itemId/submit-url`|Submit URL|
|POST|`/api/content-requests/items/:itemId/submit-data`|Submit structured data|

## Service Methods

The `content-request-service.ts` provides:

### Checklist CRUD

- `createChecklist(projectId, clientId, data, items?)` — create with optional items
- `createFromTemplate(projectId, clientId, templateId, startDate?)` — create from template
- `getChecklist(id)` — get with items and completion stats
- `getByProject(projectId)` / `getByClient(clientId)` — list checklists
- `updateChecklist(id, data)` / `deleteChecklist(id)`

### Item CRUD

- `addItem(checklistId, projectId, clientId, data)` — add item
- `updateItem(itemId, data)` / `deleteItem(itemId)`
- `getItemsByChecklist(checklistId)` — list items

### Client Submissions

- `submitText(itemId, text)` — submit text content
- `submitFile(itemId, fileId)` — submit uploaded file
- `submitUrl(itemId, url)` — submit URL
- `submitStructured(itemId, data)` — submit JSON data

### Admin Review

- `acceptItem(itemId)` — accept submission
- `requestRevision(itemId, notes)` — request changes with notes

### Stats & Templates

- `calculateStats(items)` — completion stats from items array
- `getAdminOverview()` — all active checklists with stats
- `getTemplates(includeInactive?)` / `getTemplate(id)` / `createTemplate(data)` / `updateTemplate(id, data)` / `deleteTemplate(id)`

## Usage Examples

### Create Checklist from Template

```typescript
const response = await fetch('/api/content-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_id: 7,
    client_id: 3,
    template_id: 1,
    start_date: '2026-03-15'
  })
});
// Creates checklist with 10 items from "Website Build Content Package" template
```

### Client Submits Text Content

```typescript
await fetch('/api/content-requests/items/42/submit-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Emily Gold is the co-founder of Hedgewitch Horticulture...'
  })
});
```

### Admin Requests Revision

```typescript
await fetch('/api/content-requests/items/42/request-revision', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notes: 'Please expand the bio to include your certifications and years of experience.'
  })
});
```

## Workflow Events

|Event|Trigger|
|--------|-------------|
|`content_request.submitted`|Client submits any content item|
|`content_request.accepted`|Admin accepts a submitted item|
|`content_request.revision_needed`|Admin requests revision on an item|

## SSOT Chain

- **Backend constants**: `server/config/constants.ts` — `CONTENT_REQUEST_ITEM_STATUSES`, `CONTENT_TYPES`, `CONTENT_CATEGORIES`, `CONTENT_CHECKLIST_STATUSES`
- **Frontend UI configs**: `src/react/features/admin/types.ts` — `CONTENT_REQUEST_ITEM_STATUS_CONFIG`, `CONTENT_TYPE_LABELS`, `CONTENT_CATEGORY_LABELS`
- **Filter options**: `src/react/features/admin/shared/filterConfigs.ts` — derived via `configToFilterOptions()` and `labelsToFilterOptions()`

## Files

### Created

- `server/database/migrations/108_content_request_system.sql`
- `server/database/entities/content-request.ts`
- `server/services/content-request-service.ts`
- `server/routes/content-requests.ts` (barrel)
- `server/routes/content-requests/admin.ts`
- `server/routes/content-requests/client.ts`
- `server/routes/content-requests/shared.ts`
- `docs/features/CONTENT_REQUESTS.md`

### Modified

- `server/config/constants.ts` — added content request constants
- `server/database/entities/index.ts` — added content request exports
- `server/services/workflow-trigger-service.ts` — added 3 content request event types
- `server/app.ts` — registered content request router
- `src/constants/api-endpoints.ts` — added content request endpoints
- `src/react/features/admin/types.ts` — added status config and labels
- `src/react/features/admin/shared/filterConfigs.ts` — added filter configs

## Change Log

### March 13, 2026 — Feature Parity & Portal UI

- Added `content_request_history` audit trail table (migration 110)
- Added `priority` column to items (migration 111, uses shared `PRIORITY_LEVELS`)
- Added `rejected` status to item statuses
- Added `rejectItem()` service method + `POST /items/:itemId/reject` endpoint
- Added `getItemHistory()` + `GET /items/:itemId/history` endpoint
- Added `bulkDeleteChecklists()` + `POST /bulk-delete` endpoint
- Added `bulkCreateByProjectType()` + `POST /from-project-type` endpoint
- All submission and review methods now log audit history with actor tracking
- Portal view: `ContentChecklistView.tsx` with type-specific submission UI
- Portal route: `/content-requests` and `/requests-hub` (unified tab view)

### March 13, 2026 — Initial Implementation

- Created content request checklist + item system
- Two-level structure: checklists contain items
- Four content types: text, file, URL, structured data
- Six categories: copy, photo, brand_asset, credentials, reference, other
- Admin review workflow: accept or request revision
- Template system with seeded "Website Build Content Package"
- Client portal submission endpoints per content type
- Workflow events for automation integration
- SSOT chain: constants.ts → types.ts → filterConfigs.ts
