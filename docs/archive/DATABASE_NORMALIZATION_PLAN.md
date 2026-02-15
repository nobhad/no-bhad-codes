# Database Normalization Plan

**Created:** February 10, 2026
**Last Updated:** February 11, 2026
**Status:** Phases 1-3 Complete, Phase 4 Deferred

## Executive Summary

This document outlines a phased approach to normalize the database schema, addressing:

1. TEXT foreign keys that should be INTEGER references
2. Redundant columns and data duplication
3. Wide tables that should be decomposed
4. Inconsistent patterns across the schema

### Risk Assessment

| Phase | Risk Level | Status | Tables Affected | Code Changes |
|-------|------------|--------|-----------------|--------------|
| Phase 1 | Low | ✅ Complete | 2 | Minimal |
| Phase 2 | Medium | ✅ Complete | 35+ | Moderate |
| Phase 3 | Medium-High | ✅ Complete | 5 | Significant |
| Phase 4 | High | Deferred | 15+ | Major refactor |

---

## Phase 1: Remove Redundant Boolean Fields ✅ COMPLETE

**Status:** Completed (Migration 067, Feb 10, 2026)

### Changes Made

| Table | Column Removed | Replacement |
|-------|----------------|-------------|
| `messages` | `is_read` | `read_at IS NULL` = unread |
| `general_messages` | `is_read` | `read_at IS NULL` = unread |

### Files Updated

- `server/routes/messages.ts`
- `server/routes/projects.ts`
- `server/routes/clients.ts`
- `server/routes/admin.ts`
- `server/routes/auth.ts`
- `server/services/message-service.ts`
- `server/types/database.ts`

### Query Migration Pattern

```sql
-- Before
WHERE is_read = 0
WHERE is_read = 1
UPDATE ... SET is_read = 1

-- After
WHERE read_at IS NULL
WHERE read_at IS NOT NULL
UPDATE ... SET read_at = CURRENT_TIMESTAMP
```

---

## Phase 2: Create Users Table & Migrate TEXT References ✅ COMPLETE (Migration)

**Status:** Migration Complete (Migration 068, Feb 10, 2026) - Application code updates pending
**Risk:** Medium
**Estimated Effort:** 2-3 days

### Problem Statement

35+ tables store user/team references as TEXT (email or name) instead of INTEGER foreign keys:

```sql
-- Current (problematic)
assigned_to TEXT,      -- "noelle@example.com" or "Noelle"
uploaded_by TEXT,
reviewed_by TEXT,
created_by TEXT,
author TEXT,
sender_name TEXT,
```

**Issues:**

- No referential integrity
- No CASCADE deletes when user removed
- Inconsistent format (some email, some name)
- Duplicate entries if email format changes
- Can't JOIN to get user details efficiently

### Solution

#### Step 1: Create Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT DEFAULT 'team_member' CHECK (role IN ('admin', 'team_member', 'contractor')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed with existing team members
INSERT INTO users (email, display_name, role)
VALUES
  ('nobhaduri@gmail.com', 'Noelle Bhaduri', 'admin');
```

#### Step 2: Add user_id Columns (Parallel)

Add new INTEGER columns alongside existing TEXT columns:

```sql
-- Example for project_tasks
ALTER TABLE project_tasks ADD COLUMN assigned_to_user_id INTEGER REFERENCES users(id);

-- Populate from existing data
UPDATE project_tasks
SET assigned_to_user_id = (SELECT id FROM users WHERE email = assigned_to)
WHERE assigned_to IS NOT NULL;
```

#### Step 3: Update Application Code

Update services to write to both columns during transition:

```typescript
// Transition period - write to both
await db.run(`
  UPDATE project_tasks
  SET assigned_to = ?, assigned_to_user_id = ?
  WHERE id = ?
`, [userEmail, userId, taskId]);
```

#### Step 4: Drop TEXT Columns

After verification, drop old TEXT columns:

```sql
-- Migration to drop TEXT columns
-- (Requires table recreation in SQLite)
```

### Tables to Update

| Table | TEXT Column | New Column |
|-------|-------------|------------|
| `project_tasks` | `assigned_to` | `assigned_to_user_id` |
| `lead_tasks` | `assigned_to` | `assigned_to_user_id` |
| `time_entries` | `user_name` | `user_id` |
| `project_updates` | `author` | `author_user_id` |
| `files` | `uploaded_by` | `uploaded_by_user_id` |
| `messages` | `sender_name` | `sender_user_id` |
| `general_messages` | `sender_name` | `sender_user_id` |
| `task_comments` | `author` | `author_user_id` |
| `client_notes` | `author` | `author_user_id` |
| `lead_notes` | `author` | `author_user_id` |
| `document_requests` | `uploaded_by`, `reviewed_by`, `created_by` | `*_user_id` |
| `file_comments` | `author_email` | `author_user_id` |
| `kb_articles` | `author_email` | `author_user_id` |
| `questionnaires` | `created_by` | `created_by_user_id` |
| `proposal_requests` | `reviewed_by` | `reviewed_by_user_id` |
| `proposal_comments` | `author_email` | `author_user_id` |
| `deliverable_workflows` | `reviewed_by`, `approved_by` | `*_user_id` |
| `deliverable_review_comments` | `author_email` | `author_user_id` |
| `duplicate_resolution_log` | `resolved_by` | `resolved_by_user_id` |
| `lead_duplicates` | `resolved_by` | `resolved_by_user_id` |
| `blocked_ips` | `blocked_by` | `blocked_by_user_id` |
| `saved_reports` | `created_by` | `created_by_user_id` |

### Rollback Plan

Keep TEXT columns for 30 days after migration. If issues arise:

1. Revert application code to use TEXT columns
2. No data loss since both columns maintained

---

## Phase 3: Remove Data Duplication ✅ COMPLETE

**Status:** Completed (Migrations 071-074, Feb 11, 2026)
**Risk:** Medium-High
**Estimated Effort:** 1-2 days

### 3.1 Remove Duplicate Notification Preferences

**Problem:** `clients` table has inline notification flags that duplicate `notification_preferences` table.

**Solution:**

```sql
-- Migration: Remove redundant columns from clients
-- Step 1: Ensure all data exists in notification_preferences
INSERT OR IGNORE INTO notification_preferences (user_id, user_type, notify_new_message, notify_invoice_created, notify_project_update, notify_weekly)
SELECT id, 'client', notification_messages, notification_invoices, notification_status, notification_weekly
FROM clients
WHERE id NOT IN (SELECT user_id FROM notification_preferences WHERE user_type = 'client');

-- Step 2: Drop columns from clients (requires table recreation in SQLite)
```

**Columns to Remove from `clients`:**

- `notification_messages`
- `notification_status`
- `notification_invoices`
- `notification_weekly`

### 3.2 Consolidate Contract Signature Data

**Problem:** Signature fields duplicated in both `projects` and `contracts` tables.

**Current State:**

```sql
-- projects table has:
contract_signed_at, contract_countersigned_at,
contract_countersigner_name, contract_countersigner_email,
contract_countersigner_ip, contract_countersigner_user_agent,
contract_countersignature_data, contract_signed_pdf_path

-- contracts table has:
signed_at, countersigned_at,
countersigner_name, countersigner_email,
countersigner_ip, countersigner_user_agent,
countersignature_data, signed_pdf_path
```

**Solution:**

1. Make `contracts` table the single source of truth
2. Update application to read from `contracts` table
3. Remove duplicate columns from `projects` table
4. Keep `projects.contract_signed_at` as denormalized cache (optional)

**Migration Steps:**

```sql
-- Step 1: Ensure all project signature data exists in contracts
UPDATE contracts
SET
  signed_at = (SELECT contract_signed_at FROM projects WHERE projects.id = contracts.project_id),
  countersigned_at = (SELECT contract_countersigned_at FROM projects WHERE projects.id = contracts.project_id)
  -- ... etc
WHERE contracts.signed_at IS NULL
  AND EXISTS (SELECT 1 FROM projects WHERE projects.id = contracts.project_id AND projects.contract_signed_at IS NOT NULL);

-- Step 2: Update application code to use contracts table

-- Step 3: Drop duplicate columns from projects (requires table recreation)
```

---

## Phase 4: Normalize Wide Tables

**Status:** Planned
**Risk:** High
**Estimated Effort:** 3-5 days

### 4.1 Normalize Invoices Table (52 columns)

**Problem:** Single table with 52 columns handling:

- Core invoice data
- Line items (JSON)
- Business information (hardcoded)
- Payment configuration
- Late fee configuration
- Billing address (duplicates client data)

**Proposed Schema:**

```sql
-- Keep invoices table lean (core data only)
invoices (
  id, invoice_number, project_id, client_id,
  status, invoice_type,
  subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
  amount_total, amount_paid, currency,
  issued_date, due_date, paid_date,
  internal_notes,
  payment_terms_id, payment_plan_id,
  created_at, updated_at, deleted_at, deleted_by
)

-- Extract line items to proper table
invoice_line_items (
  id, invoice_id,
  description, quantity, unit_price, amount,
  sort_order, created_at
)

-- Extract late fee config
invoice_late_fees (
  id, invoice_id,
  late_fee_type, late_fee_amount, late_fee_rate,
  applied_at, created_at
)

-- Move business info to system settings
system_settings (
  key, value, created_at, updated_at
)
-- Keys: business_name, business_contact, business_email, business_website, venmo_handle, paypal_email
```

**Benefits:**

- Invoices table reduced from 52 to ~25 columns
- Line items queryable (currently JSON)
- Business info configurable, not hardcoded
- Late fees trackable separately

### 4.2 Extract Hardcoded Business Data

**Problem:** Business defaults hardcoded in `invoices` schema:

```sql
business_name TEXT DEFAULT 'No Bhad Codes',
business_contact TEXT DEFAULT 'Noelle Bhaduri',
business_email TEXT DEFAULT 'nobhaduri@gmail.com',
venmo_handle TEXT DEFAULT '@nobhad',
paypal_email TEXT DEFAULT 'nobhaduri@gmail.com'
```

**Solution:**

```sql
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default values
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('business_name', 'No Bhad Codes', 'Company name for invoices'),
  ('business_contact', 'Noelle Bhaduri', 'Primary contact name'),
  ('business_email', 'nobhaduri@gmail.com', 'Business email address'),
  ('business_website', 'nobhad.codes', 'Company website'),
  ('payment_venmo', '@nobhad', 'Venmo handle for payments'),
  ('payment_paypal', 'nobhaduri@gmail.com', 'PayPal email for payments');
```

---

## Phase 5: Consolidate Lead/Intake Systems (Deferred)

**Status:** Deferred - Requires Major Refactor
**Risk:** Very High
**Estimated Effort:** 1-2 weeks

### Problem Statement

Three overlapping systems for tracking prospects:

1. **`client_intakes`** - Website intake form submissions
2. **`projects` with status='pending'** - Leads (projects before conversion)
3. **Lead-specific tables** - `lead_tasks`, `lead_notes`, `lead_sources`, `lead_scoring_rules`

**Current Confusion:**

- A "lead" is defined as a `project` with `status='pending'`
- But `client_intakes` has separate status tracking
- `lead_tasks` duplicates `project_tasks` structure
- No clear data flow from intake → lead → project

### Proposed Solution (Future)

1. **Define Clear Data Model:**

```text
Intake (website form)
  → Lead (qualified prospect, in pipeline)
    → Project (converted, work begins)
```

2. **Single Tasks Table:**

- Merge `lead_tasks` into `project_tasks`
- Add `task_context` column (lead/project/ad_hoc)

3. **Single Notes Table:**

- Merge `lead_notes`, `client_notes` into unified `notes` table
- Add `entity_type`, `entity_id` columns

4. **Clear Conversion Flow:**

```sql
-- Intake to Lead conversion
UPDATE client_intakes SET status = 'converted', project_id = ? WHERE id = ?;
UPDATE projects SET status = 'pending', lead_source_id = ? WHERE id = ?;

-- Lead to Project conversion
UPDATE projects SET status = 'active', won_at = CURRENT_TIMESTAMP WHERE id = ?;
```

### Why Deferred

- High risk of data loss if migration fails
- Requires updating significant business logic
- Current system works, just confusing
- Lower priority than other improvements

---

## Implementation Checklist

### Phase 1 ✅

- [x] Create migration 067_database_normalization.sql
- [x] Remove `is_read` from messages table
- [x] Remove `is_read` from general_messages table
- [x] Update all queries to use `read_at IS NULL`
- [x] Update TypeScript types
- [x] Run migration successfully
- [x] Document changes

### Phase 2 (In Progress - Code Updates Underway)

- [x] Create `users` table migration (Migration 068)
- [x] Seed initial team members (system@nobhad.codes, nobhaduri@gmail.com)
- [x] Add `*_user_id` columns to affected tables (20+ tables updated)
- [x] Write data migration script (populates user_id from TEXT values)
- [x] Remove duplicate notification columns from clients (Migration 069)
- [x] Create user-service.ts with lookup helpers
- [x] Update project_tasks writes (project-service.ts, task-generator.ts)
- [x] Update lead_tasks writes (lead-service.ts)
- [x] Update workflow-trigger-service.ts
- [x] Update time_entries writes (project-service.ts)
- [x] Update document_requests writes (document-request-service.ts)
- [x] Update remaining tables (note: some store user TYPE not email)
- [x] Test thoroughly
- [x] Remove TEXT columns (Migration 070 completed)
- [x] Update all affected queries

### Phase 3 ✅ COMPLETE (Feb 11, 2026)

- [x] Audit notification preferences usage
- [x] Migrate inline notification flags to notification_preferences (Migration 069)
- [x] Remove redundant columns from clients (Migration 069)
- [x] Hardcoded business data - addressed via `server/config/business.ts`
- [x] Create `system_settings` table for centralized settings (Migration 071)
- [x] Create `invoice_line_items` table (Migration 072)
- [x] Migrate line items from JSON to table (`server/scripts/migrate-line-items.ts`)
- [x] Add signature tracking columns to contracts table (Migration 074)
- [x] Update `invoice-service.ts` with line items table methods
- [x] Update `contract-service.ts` with signature handling methods
- [x] Create `settings-service.ts` for centralized settings
- [x] Create `/api/settings` routes

### Phase 4 ✅ COMPLETE (Feb 12-14, 2026)

- [x] Slim invoices table (remove redundant columns) - Migration 075
- [x] Consolidate lead/intake overlap (single source of truth) - Migration 086
- [x] Unify message tables (messages vs general_messages) - Migration 085
- [x] Add soft-delete to core entities - Already implemented via soft-delete-service.ts

### Phase 5 (Completed via Phase 4)

- [x] Design unified lead/intake model - Leads now stored in projects table with `source_type` column
- [x] Plan data migration strategy - Migrations 085 and 086 handle this
- [x] Implement with feature flag - N/A, direct migration
- [x] Gradual rollout - Complete

---

## Rollback Procedures

### General Approach

1. All migrations include DOWN section where possible
2. Keep deprecated columns for 30 days before final removal
3. Maintain backup before each migration
4. Feature flags for new code paths during transition

### Backup Command

```bash
# Before any migration
cp data/client_portal.db data/client_portal.db.backup.$(date +%Y%m%d_%H%M%S)
```

### Restore Command

```bash
# If migration fails
mv data/client_portal.db data/client_portal.db.failed
cp data/client_portal.db.backup.YYYYMMDD_HHMMSS data/client_portal.db
```

---

## Success Metrics

After all phases complete:

| Metric | Before | After |
|--------|--------|-------|
| Tables with TEXT user refs | 35+ | 0 |
| Redundant boolean columns | 2 | 0 |
| Duplicate data patterns | 3 | 0 |
| Invoices table columns | 52 | ~25 |
| Clients table columns | 45 | ~35 |
| Hardcoded business data | 5 values | 0 (in system_settings) |

---

## Related Documentation

- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Full schema reference
- [current_work.md](../current_work.md) - Active work tracking
- Migration files: `server/database/migrations/`
