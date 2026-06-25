# Deliverables & Design Review System

**Status:** Complete
**Last Updated:** 2026-06-25

## Overview

The Deliverables & Design Review system enables project deliverable management with version control, client feedback, annotations, and multi-round approval workflows. Designed for creative agencies and freelancers managing design deliverables.

**Access:**

- Admin: Project Details > Deliverables tab
- Client: Client Portal > Project > Deliverables tab

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| Deliverable Upload | Complete | Drag-drop upload with metadata |
| Version Management | Complete | Automatic versioning, rollback support |
| Design Rounds | Complete | Round 1, Round 2, Final tracking |
| Annotation Tools | Complete | Draw, highlight, text annotations on images |
| Commenting System | Complete | Threaded comments, internal/client visibility |
| Per-Element Approval | Complete | Track approval by design element |
| Approval Workflow | Complete | Pending > Reviewing > Approved/Revisions |
| PDF Export | Complete | Export feedback summary as PDF |

---

## Architecture

### Data Flow

```text
Admin uploads deliverable
        ↓
System creates version record
        ↓
Client receives notification
        ↓
Client adds annotations/comments
        ↓
Client approves or requests revisions
        ↓
Admin uploads new version (if revisions)
        ↓
Repeat until approved
        ↓
Deliverable locked on final approval
```

### Design Rounds

| Round | Description | Typical Use |
|-------|-------------|-------------|
| Round 1 | Initial concepts | 2-3 design options |
| Round 2 | Refined direction | Selected option refined |
| Final | Production-ready | Approved for handoff |

---

## Database Schema

Source of truth: `server/database/migrations/073_deliverables.sql` (SQLite).

### deliverables

```sql
CREATE TABLE deliverables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'design',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  round_number INTEGER NOT NULL DEFAULT 1,
  created_by_id INTEGER NOT NULL,
  reviewed_by_id INTEGER,
  review_deadline DATETIME,
  approved_at DATETIME,
  locked INTEGER NOT NULL DEFAULT 0,
  tags TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

File metadata lives on `deliverable_versions`, not on `deliverables`.

### deliverable_versions

```sql
CREATE TABLE deliverable_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by_id INTEGER NOT NULL,
  change_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
  UNIQUE(deliverable_id, version_number)
);
```

### deliverable_comments

Comments and annotations share one table. Positional fields
(`x_position`, `y_position`, `annotation_type`, `element_id`) carry the
annotation data; there is no separate annotations table.

```sql
CREATE TABLE deliverable_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  comment_text TEXT NOT NULL,
  x_position INTEGER,
  y_position INTEGER,
  annotation_type TEXT DEFAULT 'text',
  element_id TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);
```

### design_elements

```sql
CREATE TABLE design_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  revision_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
  UNIQUE(deliverable_id, name)
);
```

### deliverable_reviews

```sql
CREATE TABLE deliverable_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deliverable_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL,
  decision TEXT NOT NULL,
  feedback TEXT,
  design_elements_reviewed TEXT DEFAULT '[]',
  review_duration_minutes INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);
```

---

All routes mount under `/api/deliverables` (see `server/app.ts` and
`server/routes/deliverables/{crud,comments,elements,reviews,versions}.ts`).

### Deliverable Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deliverables/my` | List deliverables for the current user |
| POST | `/api/deliverables` | Create a deliverable |
| GET | `/api/deliverables/:id` | Get deliverable details |
| GET | `/api/deliverables/projects/:projectId/list` | List a project's deliverables |
| PUT | `/api/deliverables/:id` | Update deliverable metadata |
| POST | `/api/deliverables/:id/lock` | Lock a deliverable |
| POST | `/api/deliverables/:id/revision` | Request a revision |
| DELETE | `/api/deliverables/:id` | Delete deliverable |

### Version Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deliverables/:id/versions` | Upload new version |
| GET | `/api/deliverables/:id/versions` | Get version history |
| GET | `/api/deliverables/:id/versions/latest` | Get the latest version |

### Comments & Annotations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deliverables/:id/comments` | Add comment/annotation |
| GET | `/api/deliverables/:id/comments` | Get comments/annotations |
| DELETE | `/api/deliverables/:deliverableId/comments/:commentId` | Delete comment |

### Design Elements

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deliverables/:id/elements` | Create a design element |
| GET | `/api/deliverables/:id/elements` | List design elements |

### Reviews

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deliverables/:id/reviews` | Submit a review (decision + feedback) |
| GET | `/api/deliverables/:id/reviews` | List reviews |

---

## Frontend Components

### Admin UI (`src/react/features/admin/deliverables/`)

- Deliverable list with filters (round, status, element)
- Upload modal with drag-drop
- Version history panel
- Design review modal integration

### Design Review Modal (`src/react/features/admin/design-review/DesignReviewTable.tsx`)

- Annotation canvas overlay
- Tool palette (draw, highlight, text)
- Comment thread panel
- Per-element approval checkboxes
- PDF export button

### Client Portal (Deliverables View)

- Deliverable gallery view
- Annotation tools (simplified)
- Comment submission
- Approval/revision buttons

---

## Annotation System

### Annotation Types

| Type | Description | Data Format |
|------|-------------|-------------|
| draw | Freehand drawing | SVG path data |
| highlight | Rectangular highlight | `{x, y, width, height, color}` |
| text | Text annotation | `{x, y, text, fontSize}` |

### Canvas Implementation

```typescript
// Annotation canvas overlay
interface AnnotationCanvas {
  init(deliverableId: number, imageEl: HTMLImageElement): void;
  setTool(tool: 'draw' | 'highlight' | 'text'): void;
  save(): Promise<void>;
  load(): Promise<void>;
  clear(): void;
}
```

---

## Status Workflow

```text
pending → reviewing → approved
                   ↘ revisions → pending (new version)
```

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| pending | Awaiting review | Submit for review |
| reviewing | Under client review | Approve, Request revisions |
| approved | Client approved | Locked, no changes |
| revisions | Changes requested | Upload new version |

---

## File Locations

| File | Purpose |
|------|---------|
| `server/services/deliverable-service.ts` | Backend service |
| `server/routes/deliverables.ts` | API route barrel (re-exports `deliverables/` modules) |
| `server/routes/deliverables/{crud,comments,elements,reviews,versions}.ts` | Split route handlers |
| `src/react/features/admin/deliverables/` | Admin UI |
| `src/react/features/admin/design-review/` | Review modal |
| `src/react/features/portal/files/` | Client files UI (includes deliverables) |
| `src/styles/admin/index.css` | Admin styling (includes deliverables) |
| `src/styles/client-portal/documents.css` | Client styling (includes deliverables) |

---

## Test Coverage

**Test File:** `tests/unit/server/deliverables.test.ts`
**Total Tests:** 22

### Coverage Areas

| Area | Tests | Description |
|------|-------|-------------|
| Deliverable Upload | 4 | File storage, versioning, metadata |
| Version Management | 4 | Increment versions, rollback |
| Commenting System | 4 | CRUD, threading, visibility |
| Annotation Tools | 3 | Draw, highlight, text storage |
| Approval Workflow | 4 | Status transitions, locking |
| Design Rounds | 2 | Round tracking, progression |
| Error Handling | 1 | Validation, status checks |

### Test Categories

**Upload Tests:**

- Upload deliverable with metadata
- Store file with versioning
- Track file type validation
- Set initial status to pending

**Version Tests:**

- Increment version number
- Track version changes
- Rollback to previous version
- Preserve version history

**Comment Tests:**

- Add threaded comments
- Filter internal vs client-visible
- Edit comment content
- Delete comment (soft delete)

**Annotation Tests:**

- Save draw annotation
- Save highlight annotation
- Save text annotation with position

**Approval Tests:**

- Submit for review (pending → reviewing)
- Approve deliverable (reviewing → approved)
- Request revisions (reviewing → revisions)
- Lock deliverable on approval

**Round Tests:**

- Track deliverables by round
- Progress to next round

---

## Related Documentation

- [Files](./FILES.md) - General file management
- [Workflows](./WORKFLOWS.md) - Approval workflows
- [Projects](./PROJECTS.md) - Project context
- [Client Portal](./CLIENT_PORTAL.md) - Client access

---

## Change Log

### February 10, 2026 - Initial Implementation

- Created deliverable-service.ts with full CRUD
- Created API routes for deliverables, versions, annotations, comments
- Created admin-deliverables.ts UI component
- Created design-review.ts annotation modal
- Created portal-deliverables.ts client UI
- Added 22 unit tests covering all functionality
- Created comprehensive feature documentation
