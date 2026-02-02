# Proposal System Enhancement

**Status:** Complete
**Last Updated:** February 1, 2026

## Overview

The Proposal System provides professional-grade proposal management with templates, versioning, e-signatures, collaboration, and activity tracking comparable to PandaDoc, Proposify, and other industry leaders.

## Features

### 1. Proposal Templates

Reusable templates for different project types:

**Default Templates:**

| Template | Type | Validity | Description |
|----------|------|----------|-------------|
| Simple Website | simple-site | 30 days | Standard proposal for 3-5 page websites |
| Business Website | business-site | 30 days | Comprehensive proposal for 8-12 page sites |
| E-commerce Store | e-commerce | 30 days | Full e-commerce proposal with checkout |

**Template Features:**

- Custom tier structures per project type
- Default line items
- Terms and conditions text
- Validity period (default 30 days)
- Default template per project type

### 2. Proposal Versioning

Track proposal changes over time:

- Automatic version creation before changes
- Version history with timestamps
- Restore previous versions
- Compare versions side-by-side
- Notes per version

### 3. E-Signatures

Digital signature capture and tracking:

**Signature Methods:**

- `drawn` - Hand-drawn signature
- `typed` - Typed signature
- `uploaded` - Uploaded signature image

**Features:**

- Signature request via email
- Unique signing tokens
- IP address and user agent tracking
- View and decline tracking
- Signature expiration
- Reminder system

### 4. Comments & Collaboration

Rich commenting system:

- Client and admin comments
- Internal (admin-only) comments
- Threaded replies
- Author tracking
- Timestamps

### 5. Activity Tracking

Comprehensive activity log:

**Activity Types:**

| Type | Description |
|------|-------------|
| viewed | Proposal was viewed |
| downloaded | PDF was downloaded |
| commented | Comment was added |
| signed | Signature was captured |
| status_changed | Status was updated |
| version_created | New version created |
| version_restored | Version was restored |
| sent | Proposal was sent |
| reminder_sent | Reminder was sent |
| signature_requested | Signature was requested |
| signature_declined | Signature was declined |
| discount_applied | Discount was applied |
| discount_removed | Discount was removed |

### 6. Custom Line Items

Add custom items beyond feature selections:

**Item Types:**

- `service` - Professional service
- `product` - Physical product
- `discount` - Discount line (negative)
- `fee` - Additional fee
- `hourly` - Hourly rate item

**Features:**

- Quantity and unit price
- Custom unit labels (hour, page, item)
- Taxable/non-taxable
- Optional items (client can opt out)
- Sort order

### 7. Discounts

Apply discounts to proposals:

**Discount Types:**

- `percentage` - Percentage discount
- `fixed` - Fixed amount discount

**Features:**

- Discount reason tracking
- Automatic total recalculation
- Activity logging

### 8. Expiration & Reminders

Manage proposal validity:

- Custom expiration dates
- Automatic expiration processing
- Reminder scheduling
- Reminder tracking

### 9. Access Tokens

Client viewing without login:

- Generate unique access tokens
- Track views via token
- Link sharing capability

## Database Schema

### New Tables

```sql
-- Proposal templates
CREATE TABLE proposal_templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  tier_structure JSON,
  default_line_items JSON,
  terms_and_conditions TEXT,
  validity_days INTEGER DEFAULT 30,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME
);

-- Proposal versions
CREATE TABLE proposal_versions (
  id INTEGER PRIMARY KEY,
  proposal_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  tier_data JSON,
  features_data JSON,
  pricing_data JSON,
  notes TEXT,
  created_by TEXT,
  created_at DATETIME
);

-- E-signatures
CREATE TABLE proposal_signatures (
  id INTEGER PRIMARY KEY,
  proposal_id INTEGER NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_title TEXT,
  signer_company TEXT,
  signature_method TEXT,
  signature_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at DATETIME
);

-- Proposal comments
CREATE TABLE proposal_comments (
  id INTEGER PRIMARY KEY,
  proposal_id INTEGER NOT NULL,
  author_type TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  parent_comment_id INTEGER,
  created_at DATETIME,
  updated_at DATETIME
);

-- Proposal activities
CREATE TABLE proposal_activities (
  id INTEGER PRIMARY KEY,
  proposal_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  actor TEXT,
  actor_type TEXT,
  metadata JSON,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME
);

-- Custom line items
CREATE TABLE proposal_custom_items (
  id INTEGER PRIMARY KEY,
  proposal_id INTEGER NOT NULL,
  item_type TEXT DEFAULT 'service',
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  unit_label TEXT,
  category TEXT,
  is_taxable BOOLEAN DEFAULT TRUE,
  is_optional BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME,
  updated_at DATETIME
);

-- Signature requests
CREATE TABLE signature_requests (
  id INTEGER PRIMARY KEY,
  proposal_id INTEGER NOT NULL,
  signer_email TEXT NOT NULL,
  signer_name TEXT,
  request_token TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  sent_at DATETIME,
  viewed_at DATETIME,
  signed_at DATETIME,
  declined_at DATETIME,
  decline_reason TEXT,
  expires_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at DATETIME,
  created_at DATETIME
);
```

### proposal_requests Table Additions

```sql
ALTER TABLE proposal_requests ADD COLUMN template_id INTEGER;
ALTER TABLE proposal_requests ADD COLUMN expiration_date DATE;
ALTER TABLE proposal_requests ADD COLUMN reminder_sent_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE proposal_requests ADD COLUMN last_viewed_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN signed_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN version_number INTEGER DEFAULT 1;
ALTER TABLE proposal_requests ADD COLUMN discount_type TEXT;
ALTER TABLE proposal_requests ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE proposal_requests ADD COLUMN discount_reason TEXT;
ALTER TABLE proposal_requests ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE proposal_requests ADD COLUMN subtotal DECIMAL(10,2);
ALTER TABLE proposal_requests ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE proposal_requests ADD COLUMN sent_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN sent_by TEXT;
ALTER TABLE proposal_requests ADD COLUMN accepted_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN rejected_at DATETIME;
ALTER TABLE proposal_requests ADD COLUMN rejection_reason TEXT;
ALTER TABLE proposal_requests ADD COLUMN validity_days INTEGER DEFAULT 30;
ALTER TABLE proposal_requests ADD COLUMN requires_signature BOOLEAN DEFAULT FALSE;
ALTER TABLE proposal_requests ADD COLUMN access_token TEXT;
```

## API Endpoints

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals/templates` | Get all templates |
| GET | `/api/proposals/templates/:templateId` | Get single template |
| POST | `/api/proposals/templates` | Create template |
| PUT | `/api/proposals/templates/:templateId` | Update template |
| DELETE | `/api/proposals/templates/:templateId` | Delete template |

### Versioning

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals/:id/versions` | Get versions |
| POST | `/api/proposals/:id/versions` | Create version |
| POST | `/api/proposals/:id/versions/:versionId/restore` | Restore version |
| GET | `/api/proposals/versions/compare` | Compare versions |

### E-Signatures

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals/:id/request-signature` | Request signature |
| POST | `/api/proposals/:id/sign` | Record signature |
| GET | `/api/proposals/:id/signature-status` | Get signature status |
| GET | `/api/proposals/sign/:token` | Get by signing token |
| POST | `/api/proposals/sign/:token/decline` | Decline signature |

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals/:id/comments` | Get comments |
| POST | `/api/proposals/:id/comments` | Add comment |
| DELETE | `/api/proposals/comments/:commentId` | Delete comment |

### Activities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals/:id/activities` | Get activities |
| POST | `/api/proposals/:id/track-view` | Track view |

### Custom Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals/:id/custom-items` | Get custom items |
| POST | `/api/proposals/:id/custom-items` | Add custom item |
| PUT | `/api/proposals/custom-items/:itemId` | Update item |
| DELETE | `/api/proposals/custom-items/:itemId` | Delete item |

### Discounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals/:id/discount` | Apply discount |
| DELETE | `/api/proposals/:id/discount` | Remove discount |

### Expiration & Send

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/proposals/:id/expiration` | Set expiration |
| POST | `/api/proposals/:id/send` | Mark as sent |
| POST | `/api/proposals/:id/access-token` | Generate access token |
| GET | `/api/proposals/view/:token` | Get by access token |
| POST | `/api/proposals/process-expired` | Process expired |
| GET | `/api/proposals/due-for-reminder` | Get due for reminder |
| POST | `/api/proposals/:id/reminder-sent` | Mark reminder sent |

## Service Methods

The `proposal-service.ts` provides the following methods:

### Template Methods

- `createTemplate(data)` - Create template
- `getTemplates(projectType)` - Get templates
- `getTemplate(templateId)` - Get single template
- `updateTemplate(templateId, data)` - Update template
- `deleteTemplate(templateId)` - Delete template

### Version Methods

- `createVersion(proposalId, createdBy, notes)` - Create version
- `getVersions(proposalId)` - Get versions
- `getVersion(versionId)` - Get single version
- `restoreVersion(proposalId, versionId)` - Restore version
- `compareVersions(versionId1, versionId2)` - Compare versions

### Signature Methods

- `requestSignature(proposalId, signerEmail, signerName, expiresInDays)` - Request signature
- `recordSignature(proposalId, data)` - Record signature
- `getProposalSignatures(proposalId)` - Get signatures
- `getSignatureStatus(proposalId)` - Get signature status
- `getSignatureRequestByToken(token)` - Get by token
- `markSignatureViewed(token)` - Mark viewed
- `declineSignature(token, reason)` - Decline signature

### Comment Methods

- `addComment(proposalId, authorType, authorName, content, authorEmail, isInternal, parentCommentId)` - Add comment
- `getComments(proposalId, includeInternal)` - Get comments
- `deleteComment(commentId)` - Delete comment

### Activity Methods

- `logActivity(proposalId, activityType, actor, actorType, metadata, ipAddress, userAgent)` - Log activity
- `getActivities(proposalId, limit)` - Get activities
- `trackView(proposalId, ipAddress, userAgent)` - Track view

### Custom Item Methods

- `addCustomItem(proposalId, data)` - Add item
- `getCustomItems(proposalId)` - Get items
- `updateCustomItem(itemId, data)` - Update item
- `deleteCustomItem(itemId)` - Delete item

### Discount Methods

- `applyDiscount(proposalId, type, value, reason)` - Apply discount
- `removeDiscount(proposalId)` - Remove discount
- `recalculateTotals(proposalId)` - Recalculate totals

### Expiration Methods

- `setExpiration(proposalId, expirationDate)` - Set expiration
- `processExpiredProposals()` - Process expired
- `getProposalsDueForReminder(daysOld)` - Get due for reminder
- `markReminderSent(proposalId)` - Mark reminder sent
- `markProposalSent(proposalId, sentBy)` - Mark as sent
- `generateAccessToken(proposalId)` - Generate access token
- `getProposalByAccessToken(token)` - Get by access token

## Usage Examples

### Create Version Before Editing

```typescript
// Save current state before making changes
await fetch('/api/proposals/123/versions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notes: 'Before pricing update'
  })
});
```

### Request Signature

```typescript
const response = await fetch('/api/proposals/123/request-signature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    signerEmail: 'client@example.com',
    signerName: 'John Doe',
    expiresInDays: 14
  })
});
```

### Submit Signature

```typescript
await fetch('/api/proposals/123/sign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    signerName: 'John Doe',
    signerEmail: 'client@example.com',
    signatureMethod: 'drawn',
    signatureData: 'base64encodedimagedata...'
  })
});
```

### Apply Discount

```typescript
await fetch('/api/proposals/123/discount', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'percentage',
    value: 10,
    reason: 'Early payment discount'
  })
});
```

## Files

### Created

- `server/database/migrations/032_proposal_enhancements.sql` - Database migration
- `server/services/proposal-service.ts` - Proposal service
- `docs/features/PROPOSALS.md` - This documentation

### Modified

- `server/routes/proposals.ts` - Added 35+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces

## Frontend UI

### Proposals List View

- View toggle: Proposals / Templates
- Filter buttons: All, Pending, Reviewed, Accepted
- Stats cards: Pending, Reviewed, Accepted, Total Value
- Table with client, project, tier, price, status dropdown, actions

### Proposal Details Panel

**Sections:**

1. **Client Information** - Name, email, company
2. **Project Details** - Project name, type, submitted date
3. **Package Selection** - Tier badge, maintenance plan
4. **Included Features** - List of tier-included features
5. **Add-ons Selected** - List of add-on features with prices
6. **Pricing** - Base, add-ons, total
7. **Client Notes** - Notes from client
8. **Admin Notes** - Editable admin notes
9. **Custom Line Items** - Add/delete custom items
10. **Discount** - Apply/remove discounts
11. **Comments** - View/add comments (internal or client-visible)
12. **Activity Log** - Recent proposal activity
13. **Version History** - Create, restore, compare versions
14. **Signature Status** - Request, resend, cancel signatures

### Templates Management

- Templates grid with cards
- Create/edit template modal
- Template fields: name, description, project type, tier, base price, default toggle
- Use/edit/delete template actions

### Files

- `src/features/admin/modules/admin-proposals.ts` - Proposal management module
- `src/styles/admin/proposals.css` - Proposal styles

---

## Change Log

### February 2, 2026 - Frontend Advanced Features

- Added Custom Line Items section with add/delete functionality
- Added Discount section with apply/remove
- Added Comments section with add comment and internal toggle
- Added Activity Log section showing recent activity
- Updated proposal details to load all advanced sections

### February 1, 2026 - Initial Implementation

- Created database migration for proposal tables
- Implemented proposal-service.ts with all methods
- Added 35+ API endpoints to proposals.ts
- Added TypeScript interfaces for all types
- Created feature documentation
