# Contracts System

**Status:** Complete (Backend + Admin UI + E-Signature UI)
**Last Updated:** February 10, 2026

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Admin UI Components](#admin-ui-components)
6. [Variable System](#variable-system)
7. [E-Signature Flow](#e-signature-flow)
8. [PDF Generation](#pdf-generation)
9. [File Locations](#file-locations)
10. [Related Documentation](#related-documentation)

---

## Overview

The Contracts System provides complete contract management for client projects, including templates, variable substitution, e-signatures, countersigning, and PDF generation with embedded signatures.

**Key Capabilities:**

- [x] Contract template system with variable placeholders
- [x] Default "Standard Service Agreement" template
- [x] Contract builder UI in project details
- [x] Live preview with variable substitution
- [x] PDF generation with branding
- [x] Client e-signature via secure token link
- [x] Admin countersign functionality
- [x] Signature audit logging
- [x] Signed PDF storage
- [ ] Rich text editor for template content (pending)

**Access:** Contract tab in Project Detail view (Admin Portal)

---

## Features

### 1. Contract Templates

Reusable templates with variable placeholders for dynamic content generation.

**Template Types:**

| Type | Description |
|------|-------------|
| `standard` | Standard service agreement |
| `custom` | Custom contract |
| `amendment` | Contract amendment |
| `nda` | Non-disclosure agreement |
| `maintenance` | Maintenance agreement |

**Default Template:**

The system seeds a "Standard Service Agreement" template with sections for:

- Project overview
- Timeline
- Payment terms
- Scope and deliverables
- Changes and revisions
- Ownership and rights
- Termination
- Contact information

### 2. Contract Builder

Admin UI for creating and customizing contracts per project.

**Features:**

- Template selection dropdown
- Section editor for contract content
- Variable auto-fill from project/client data
- Live preview panel
- Save as draft
- Preview PDF before sending

### 3. E-Signature System

Secure digital signature capture with audit trail.

**Client Signature Flow:**

1. Admin clicks "Request Signature"
2. System generates unique token with expiration
3. Client receives email with signing link
4. Client reviews contract and draws/types signature
5. Signature captured with IP and timestamp
6. Contract status updates to "signed"

**Admin Countersign Flow:**

1. After client signs, admin sees "Countersign" button
2. Admin reviews and adds countersignature
3. Both signatures embedded in PDF
4. Final signed PDF stored permanently

### 4. Contract Status Lifecycle

```text
draft → sent → viewed → signed
         ↘ expired
         ↘ cancelled
```

| Status | Description |
|--------|-------------|
| `draft` | Contract created, not sent to client |
| `sent` | Signature request sent, awaiting client |
| `viewed` | Client has viewed the contract |
| `signed` | Client has signed |
| `expired` | Signature request expired |
| `cancelled` | Contract cancelled |

**Note:** Countersigning is tracked via fields like `countersigned_at`, `countersigner_name`, and `countersignature_data` rather than a separate status.

---

## Database Schema

### contract_templates Table

```sql
CREATE TABLE contract_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'standard', 'custom', 'amendment', 'nda', 'maintenance'
  content TEXT NOT NULL,        -- Template content with {{variable}} placeholders
  variables JSON,               -- JSON array of allowed variables
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### contracts Table

```sql
CREATE TABLE contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER REFERENCES contract_templates(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,        -- Resolved contract content
  status TEXT DEFAULT 'draft',
  variables JSON,               -- JSON snapshot of resolved variables
  sent_at DATETIME,
  signed_at DATETIME,
  expires_at DATETIME,
  -- Signature fields
  signer_name TEXT,
  signer_email TEXT,
  signer_ip TEXT,
  signer_user_agent TEXT,
  signature_data TEXT,          -- Base64 encoded signature image
  -- Countersign fields
  countersigned_at DATETIME,
  countersigner_name TEXT,
  countersigner_email TEXT,
  countersigner_ip TEXT,
  countersigner_user_agent TEXT,
  countersignature_data TEXT,
  signed_pdf_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Projects Table Contract Fields

```sql
-- Contract signature tracking on projects table
contract_signature_token TEXT,
contract_signature_requested_at DATETIME,
contract_signature_expires_at DATETIME,
contract_signed_at DATETIME,
contract_signer_name TEXT,
contract_signer_email TEXT,
contract_signer_ip TEXT,
contract_signer_user_agent TEXT,
contract_signature_data TEXT,
contract_countersigned_at DATETIME,
contract_countersigner_name TEXT,
contract_countersigner_email TEXT,
contract_countersigner_ip TEXT,
contract_countersigner_user_agent TEXT,
contract_countersignature_data TEXT,
contract_signed_pdf_path TEXT
```

### contract_signature_log Table

Audit log for all contract signature actions.

```sql
CREATE TABLE contract_signature_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  action TEXT NOT NULL,         -- 'requested', 'viewed', 'signed', 'countersigned', etc.
  actor_email TEXT,
  actor_ip TEXT,
  actor_user_agent TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Contract PDF

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/contract/pdf` | Generate contract PDF |

**Response Headers:**

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="contract-ProjectName-1.pdf"
```

### Signature Request

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/contract/request-signature` | Send signature request email |

**Response:**

```json
{
  "success": true,
  "message": "Signature request sent to client@example.com"
}
```

### Public Signing Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/contract/by-token/:token` | Get contract details by token |
| POST | `/api/projects/contract/sign-by-token/:token` | Submit signature |

**GET Response:**

```json
{
  "projectId": 1,
  "projectName": "Client Website",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "price": 5000,
  "contractPdfUrl": "/api/projects/1/contract/pdf"
}
```

**POST Request Body:**

```json
{
  "signerName": "John Doe",
  "signatureData": "data:image/png;base64,..."
}
```

---

## Admin UI Components

### Contract Tab Location

Project Detail → Contract Tab (`#pd-tab-contract`)

### UI Elements

**Status Display:**

- Contract status badge (Draft / Sent / Viewed / Signed / Expired / Cancelled)
- Signed date (when applicable)
- Countersigned date (when applicable)

**Action Cards Grid:**

| Action | Icon | Description |
|--------|------|-------------|
| Preview | Eye | Preview contract PDF in new tab |
| Download | Download | Download contract PDF |
| Request Signature | Send | Send signature request to client (when unsigned) |
| View Contract | Eye | View contract (when signed) |
| Countersign | Edit | Add admin countersignature (when client signed) |

**Signature Details Card:**

Shows when contract is signed:

- Signer name
- Signed at timestamp
- Countersigner name (if applicable)
- Countersigned at timestamp (if applicable)

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.contract-tab-content` | Main container |
| `.contract-status-display` | Status section |
| `.contract-actions-grid` | Action cards grid |
| `.contract-action-card` | Individual action button |
| `.contract-action-card.primary` | Primary action (brand color) |
| `.signature-details` | Signature info container |
| `.signature-info-row` | Label/value row |

---

## Variable System

Contract templates support variable placeholders using `{{variable}}` syntax.

### Available Variables

**Client Variables:**

| Variable | Description |
|----------|-------------|
| `{{client.name}}` | Client full name |
| `{{client.email}}` | Client email address |
| `{{client.company}}` | Client company name |

**Project Variables:**

| Variable | Description |
|----------|-------------|
| `{{project.name}}` | Project name |
| `{{project.type}}` | Project type |
| `{{project.description}}` | Project description |
| `{{project.start_date}}` | Start date |
| `{{project.due_date}}` | Due date |
| `{{project.price}}` | Total price |
| `{{project.deposit_amount}}` | Deposit amount |

**Business Variables:**

| Variable | Description |
|----------|-------------|
| `{{business.name}}` | Business name |
| `{{business.owner}}` | Owner name |
| `{{business.email}}` | Business email |
| `{{business.website}}` | Business website |
| `{{business.contact}}` | Contact information |

**Date Variables:**

| Variable | Description |
|----------|-------------|
| `{{date.today}}` | Current date |

---

## E-Signature Flow

### Client Signing Process

```text
1. Admin: Click "Request Signature" in Contract tab
   ↓
2. System: Generate unique token (expires in 14 days)
   ↓
3. System: Send email to client with signing link
   ↓
4. Client: Click link → sign-contract.html?token=xxx
   ↓
5. System: Validate token, show contract preview
   ↓
6. Client: Draw/type signature, submit
   ↓
7. System: Capture signature with IP, user agent, timestamp
   ↓
8. System: Update contract status to "signed"
   ↓
9. System: Log action to contract_signature_log
```

### Token Security

- Unique cryptographic token per request
- 14-day expiration by default
- Single-use (consumed on signature)
- IP and user agent captured for audit

### Signature Storage

Signatures are stored as:

- Base64-encoded PNG data in database
- Embedded in PDF when generating signed documents
- Permanently stored in `uploads/contracts/` directory

---

## PDF Generation

Contract PDFs follow the standard template from [PDF_GENERATION.md](./PDF_GENERATION.md).

### PDF Structure

1. **Header:** Logo, business info, "CONTRACT" title
2. **Project Details:** Client, project name, dates, price
3. **Contract Content:** Template content with resolved variables
4. **Terms & Conditions:** Standard terms section
5. **Signature Blocks:** Client signature, admin countersignature
6. **Watermarks:** "DRAFT" for unsigned, "SIGNED" for signed

### Signed PDF Generation

When both parties have signed:

1. Generate PDF with embedded signatures
2. Save to `uploads/contracts/contract-{projectName}-{id}.pdf`
3. Store path in `contract_signed_pdf_path`
4. Cache for performance

---

## File Locations

| File | Purpose |
|------|---------|
| `server/routes/projects.ts` | Contract API endpoints (lines 1340-2100+) |
| `server/database/migrations/052_contract_templates.sql` | Schema |
| `server/database/migrations/053_contract_templates_seed.sql` | Default template |
| `server/database/migrations/054_contract_countersign.sql` | Countersign fields |
| `src/features/admin/admin-project-details.ts` | Contract tab UI |
| `src/styles/admin/pd-contract.css` | Contract tab styles |
| `client/sign-contract.html` | Public signing page |

---

## Test Coverage

**Test File:** `tests/unit/server/contracts.test.ts`
**Total Tests:** 49

### Coverage Areas

| Area | Tests | Description |
|------|-------|-------------|
| Template Management | 10 | CRUD operations, variable substitution, types |
| Contract Creation | 8 | From templates, variable injection, draft management |
| PDF Generation | 6 | Multi-party signature blocks, watermarks, formatting |
| E-Signature | 14 | Send, capture, IP/timestamp logging, countersigning |
| Lifecycle | 7 | Status workflows, expiry, amendments, renewals |
| Error Handling | 4 | Field validation, signed contract protection, token expiry |

### Test Categories

**Template Tests:**

- Fetch all contract templates
- Create contract template
- Update template content
- Delete template (with usage check)
- Variable substitution preview
- Template type validation

**Creation Tests:**

- Create contract from template
- Auto-fill variables from project/client
- Create custom contract (no template)
- Save as draft
- Update draft content
- Validate required fields

**PDF Tests:**

- Generate PDF with company branding
- Include client signature block
- Include admin signature block
- Add "DRAFT" watermark for unsigned
- Add "SIGNED" watermark after signature
- Embed signature images in PDF

**Signature Tests:**

- Send signature request email
- Generate unique signing token
- Client views contract (track viewed_at)
- Client signs with drawn signature
- Client signs with typed signature
- Capture IP address and user agent
- Admin countersign after client
- Both signatures embedded in PDF
- Handle expired tokens
- Handle already-signed contracts

**Lifecycle Tests:**

- Transition: draft → sent
- Transition: sent → viewed
- Transition: viewed → signed
- Contract expiration after X days
- Create amendment linked to original
- Renewal reminder for maintenance
- Cancel contract

---

## Related Documentation

- [PDF Generation](./PDF_GENERATION.md) - PDF generation standards
- [Projects](./PROJECTS.md) - Project system overview
- [Proposals](./PROPOSALS.md) - Similar e-signature pattern
- [Workflows](./WORKFLOWS.md) - Approval workflow integration

---

## Change Log

### February 10, 2026 - Documentation Created

- Created comprehensive CONTRACTS.md feature documentation
- Documented database schema, API endpoints, UI components
- Documented variable system and e-signature flow

### February 9, 2026 - System Implementation

- Contract templates table and seed data
- Contract builder UI in project details
- E-signature request and signing flow
- Admin countersign functionality
- Signed PDF generation and storage
- Signature audit logging
