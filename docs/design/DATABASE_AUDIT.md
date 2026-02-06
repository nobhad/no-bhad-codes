# Database Schema Audit

**Last Updated:** 2026-02-06

## Table of Contents

- [Summary](#summary)
- [Migration Inventory](#migration-inventory)
- [Table Overview](#table-overview)
- [Foreign Key Relationships](#foreign-key-relationships)
- [Index Analysis](#index-analysis)
- [Issues & Recommendations](#issues--recommendations)

---

## Summary

| Metric | Value |
|--------|-------|
| Database Type | SQLite |
| Total Tables | 44+ |
| Total Columns | 600+ |
| Total Indexes | 180+ |
| Foreign Key Relationships | 60+ |
| Migrations | 47 (001-047) |

### Largest Tables (by Column Count)

| Table | Columns |
|-------|---------|
| `projects` | 50+ |
| `invoices` | 40+ |
| `clients` | 35+ |
| `proposal_requests` | 30+ |

---

## Migration Inventory

### Complete Migration List (001-047)

| # | File | Purpose |
|---|------|---------|
| 001 | `initial_schema.sql` | Base tables: clients, projects, project_updates, files, messages, milestones |
| 002 | `client_intakes.sql` | client_intakes, invoices tables |
| 004 | `add_reset_tokens.sql` | Reset tokens for password recovery |
| 005 | `messaging_enhancements.sql` | Enhanced messaging: general_messages, message_threads, notification_preferences |
| 006 | `client_settings_columns.sql` | Notification & billing columns on clients |
| 007 | `project_request_columns.sql` | Project timeline and preview_url |
| 008 | `intake_form_columns.sql` | Extended project fields (features, design_level, etc.) |
| 009 | `contact_submissions.sql` | Contact form submissions table |
| 010 | `client_invitation.sql` | Invitation tokens and last_login_at |
| 011 | `fix_general_messages_thread.sql` | Added thread_id to general_messages |
| 012 | `audit_logs.sql` | Audit logging for all user actions |
| 013 | `magic_link.sql` | Magic link passwordless authentication |
| 014 | `visitor_tracking.sql` | Analytics: visitor_sessions, page_views, interaction_events |
| 015 | `client_is_admin.sql` | is_admin flag on clients table |
| 016 | `uploaded_files.sql` | Standalone uploaded_files table |
| 017 | `users_table.sql` | Separate users table (parallel to clients) |
| 018 | `client_type.sql` | client_type column (personal/business) |
| 019 | `invoice_custom_fields.sql` | Business info, payment methods, services on invoices |
| 020 | `project_price.sql` | price column on projects |
| 021 | `project_additional_fields.sql` | Repository, staging, production URLs; deposit/contract |
| 022 | `seed_data.sql` | Seed data |
| 023 | `seed_contact_submissions.sql` | Seed data |
| 024 | `seed_clients_projects.sql` | Seed data |
| 025 | `fix_project_status_constraint.sql` | cancelled_by and cancellation_reason |
| 026 | `contact_to_client.sql` | client_id and converted_at on contact_submissions |
| 027 | `invoice_deposits.sql` | invoice_credits table, deposit support |
| 028 | `invoice_enhancements.sql` | payment_plan_templates, invoice_reminders, scheduled_invoices |
| 029 | `invoice_advanced_features.sql` | invoice_payments, payment_terms_presets, tax/discount/late fees |
| 030 | `client_enhancements.sql` | CRM: client_contacts, client_activities, client_custom_fields, tags |
| 031 | `project_enhancements.sql` | project_tasks, task_dependencies, time_entries, project_templates |
| 032 | `proposal_enhancements.sql` | proposal_templates, proposal_versions, e-signatures, comments |
| 033 | `lead_enhancements.sql` | Lead scoring, pipeline_stages, lead_tasks, lead_notes, lead_sources |
| 034 | `messaging_enhancements.sql` | Additional messaging features |
| 035 | `file_enhancements.sql` | File management enhancements |
| 036 | `analytics_enhancements.sql` | Analytics improvements |
| 037 | `contract_signatures.sql` | contract_signature_log for e-signature audit trail |
| 038 | `contract_reminders.sql` | Contract reminder system |
| 039 | `welcome_sequences.sql` | Automated onboarding emails |
| 040 | `deliverable_workflows.sql` | deliverable_workflows, review_comments, history |
| 041 | `approval_workflows.sql` | Approval workflow system |
| 042 | `workflow_triggers.sql` | Event-driven automation |
| 043 | `document_requests.sql` | Document request system |
| 044 | `notification_preferences.sql` | Enhanced notification preferences |
| 045 | `knowledge_base.sql` | kb_categories, kb_articles, kb_article_feedback |
| 046 | `client_notes.sql` | Client notes functionality |
| 047 | `proposal_requests.sql` | Proposal request enhancements |

---

## Table Overview

### Core Tables

#### clients

Primary client/account table.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| email | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | |
| company_name | TEXT | |
| contact_name | TEXT | |
| phone | TEXT | |
| status | TEXT | DEFAULT 'active', CHECK ('active', 'inactive', 'pending') |
| client_type | TEXT | DEFAULT 'business', CHECK ('personal', 'business') |
| is_admin | INTEGER | DEFAULT 0 |
| health_score | INTEGER | DEFAULT 100 |
| health_status | TEXT | DEFAULT 'healthy' |
| lifetime_value | DECIMAL(10,2) | DEFAULT 0 |
| *+ 20 more columns* | | |

**Indexes:** email, status, reset_token, invitation_token, magic_link_token, is_admin, type, health_status, industry, acquisition_source

#### projects

Project/Lead tracking with full CRM fields.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| client_id | INTEGER | FK → clients.id ON DELETE CASCADE |
| project_name | TEXT | NOT NULL |
| status | TEXT | DEFAULT 'pending', CHECK (multiple values) |
| priority | TEXT | DEFAULT 'medium' |
| progress | INTEGER | DEFAULT 0 |
| budget | DECIMAL | |
| lead_score | INTEGER | DEFAULT 0 |
| pipeline_stage_id | INTEGER | FK → pipeline_stages.id |
| *+ 40 more columns* | | |

**Indexes:** client_id, status, template, health, archived, pipeline, lead_score, assigned, lead_source, expected_close

#### invoices

Full invoicing with deposits, credits, and payment tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| invoice_number | TEXT | UNIQUE NOT NULL |
| project_id | INTEGER | FK → projects.id ON DELETE CASCADE |
| client_id | INTEGER | FK → clients.id ON DELETE CASCADE |
| amount_total | DECIMAL(10,2) | NOT NULL |
| status | TEXT | DEFAULT 'draft', CHECK (multiple values) |
| invoice_type | TEXT | DEFAULT 'standard', CHECK ('standard', 'deposit') |
| *+ 35 more columns* | | |

**Indexes:** client, project, status, due_date, type, deposit_project, late_fee, payment_terms, milestone

### Messaging Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `messages` | Project-specific messages | project_id, thread_id |
| `message_threads` | Conversation threads | client_id, project_id |
| `general_messages` | Non-project messages | client_id, thread_id |
| `notification_preferences` | Per-client notification settings | client_id (UNIQUE) |

### Project Management Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `milestones` | Project milestones | project_id |
| `files` | Project files | project_id |
| `project_updates` | Status updates | project_id |
| `project_tasks` | Tasks with hierarchy | project_id, milestone_id, parent_task_id |
| `task_dependencies` | Task relationships | task_id, depends_on_task_id |
| `task_comments` | Task discussions | task_id |
| `task_checklist_items` | Task checklists | task_id |
| `time_entries` | Time tracking | project_id, task_id |
| `project_templates` | Reusable templates | - |

### Invoice & Payment Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `invoice_credits` | Deposit credits applied | invoice_id, deposit_invoice_id |
| `invoice_payments` | Payment records | invoice_id |
| `invoice_reminders` | Payment reminders | invoice_id |
| `scheduled_invoices` | Future invoices | project_id, client_id |
| `recurring_invoices` | Recurring billing | project_id, client_id |
| `payment_plan_templates` | Payment plan presets | - |
| `payment_terms_presets` | Terms presets | - |

### Proposal Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `proposal_requests` | Main proposals | client_id, project_id, template_id |
| `proposal_templates` | Reusable templates | - |
| `proposal_versions` | Version history | proposal_id |
| `proposal_signatures` | E-signature records | proposal_id |
| `signature_requests` | Pending signatures | proposal_id |
| `proposal_comments` | Discussion threads | proposal_id |
| `proposal_activities` | Activity log | proposal_id |
| `proposal_custom_items` | Line items | proposal_id |

### CRM Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `client_contacts` | Multiple contacts per client | client_id |
| `client_activities` | Activity timeline | client_id |
| `client_custom_fields` | Custom field definitions | - |
| `client_custom_field_values` | Field values | client_id, field_id |
| `tags` | Tag definitions | - |
| `client_tags` | Client-tag mapping | client_id, tag_id |
| `project_tags` | Project-tag mapping | project_id, tag_id |

### Lead Management Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `pipeline_stages` | Sales pipeline stages | - |
| `lead_scoring_rules` | Scoring criteria | - |
| `lead_tasks` | Lead-specific tasks | project_id |
| `lead_notes` | Lead notes | project_id |
| `lead_sources` | Acquisition sources | - |
| `lead_duplicates` | Duplicate detection | lead_id_1, lead_id_2 |

### Analytics Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `visitor_sessions` | Session tracking | - |
| `page_views` | Page view tracking | session_id |
| `interaction_events` | User interactions | session_id |
| `analytics_daily_summary` | Daily aggregates | - |

### Knowledge Base Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `kb_categories` | Article categories | - |
| `kb_articles` | Help articles | category_id |
| `kb_article_feedback` | User feedback | article_id |
| `kb_search_log` | Search analytics | - |

### Workflow Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `deliverable_workflows` | File approval workflow | file_id, project_id |
| `deliverable_review_comments` | Review comments | workflow_id |
| `deliverable_history` | Status history | workflow_id |

### Audit Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `audit_logs` | All user actions | - |
| `contract_signature_log` | Contract signing audit | project_id |

### Other Tables

| Table | Purpose | Key FK |
|-------|---------|--------|
| `contact_submissions` | Contact form entries | client_id |
| `client_intakes` | Intake form entries | client_id, project_id |
| `uploaded_files` | Standalone uploads | - |
| `users` | Separate user table | - |

---

## Foreign Key Relationships

### Primary Relationship Chains

```text
clients
  ├─→ projects (client_id)
  │     ├─→ milestones (project_id)
  │     ├─→ files (project_id)
  │     ├─→ messages (project_id)
  │     ├─→ invoices (project_id)
  │     ├─→ project_tasks (project_id)
  │     ├─→ time_entries (project_id)
  │     ├─→ lead_tasks (project_id)
  │     ├─→ lead_notes (project_id)
  │     └─→ proposal_requests (project_id)
  │
  ├─→ invoices (client_id)
  │     ├─→ invoice_credits (invoice_id)
  │     ├─→ invoice_payments (invoice_id)
  │     └─→ invoice_reminders (invoice_id)
  │
  ├─→ client_contacts (client_id)
  ├─→ client_activities (client_id)
  ├─→ client_tags (client_id) ←→ tags
  ├─→ message_threads (client_id)
  ├─→ general_messages (client_id)
  └─→ notification_preferences (client_id)

proposal_requests
  ├─→ proposal_versions (proposal_id)
  ├─→ proposal_signatures (proposal_id)
  ├─→ signature_requests (proposal_id)
  ├─→ proposal_comments (proposal_id)
  ├─→ proposal_activities (proposal_id)
  └─→ proposal_custom_items (proposal_id)

files
  └─→ deliverable_workflows (file_id)
        ├─→ deliverable_review_comments (workflow_id)
        └─→ deliverable_history (workflow_id)
```

### Self-Referential Relationships

| Table | Column | References |
|-------|--------|------------|
| `project_tasks` | parent_task_id | project_tasks.id |
| `messages` | reply_to | messages.id |
| `general_messages` | reply_to | general_messages.id |
| `proposal_comments` | parent_comment_id | proposal_comments.id |

### Cross-Table References

| From Table | Column | To Table |
|------------|--------|----------|
| `invoice_credits` | invoice_id | invoices |
| `invoice_credits` | deposit_invoice_id | invoices |
| `lead_duplicates` | lead_id_1, lead_id_2 | projects |
| `task_dependencies` | task_id, depends_on_task_id | project_tasks |

---

## Index Analysis

### Index Count by Category

| Category | Count |
|----------|-------|
| Primary Key | 44 |
| Foreign Key | 60+ |
| Status/Type | 25+ |
| Date/Time | 20+ |
| Composite | 10+ |
| Unique | 15+ |

### Critical Performance Indexes

| Table | Indexes | Purpose |
|-------|---------|---------|
| `clients` | email, status, is_admin, type | Auth & filtering |
| `projects` | client_id, status, pipeline, lead_score | Project queries |
| `invoices` | client, project, status, due_date | Invoice queries |
| `messages` | thread_id, project_id, is_read | Message queries |
| `visitor_sessions` | visitor_id, start_time | Analytics queries |
| `kb_articles` | category_id, slug, published | KB queries |

### Potentially Missing Indexes

| Table | Column(s) | Use Case |
|-------|-----------|----------|
| `projects` | (assigned_to, status) | Team member filtering |
| `time_entries` | (project_id, date) | Timesheet queries |
| `client_activities` | (client_id, created_at) | Timeline queries |
| `audit_logs` | (entity_type, entity_id, created_at) | Audit queries |

---

## Issues & Recommendations

### Critical Issues

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | Dual User Management | Critical | Both `clients` and `users` tables exist (migration 017) with overlapping functionality |
| 2 | Project Status Constraint | Critical | CHECK constraint excludes 'active' and 'cancelled' which are used by API |
| 3 | Boolean Inconsistency | High | SQLite uses INTEGER (0/1) but TypeScript expects boolean |
| 4 | Cascading Deletes | High | Deleting a project cascades to all related data (files, tasks, invoices) |

### High Priority Issues

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 5 | Text-Based Foreign Keys | High | `assigned_to`, `user_name` stored as TEXT without referential integrity |
| 6 | JSON Without Validation | High | Complex JSON fields (tier_data, features_data) lack schema validation |
| 7 | Missing Composite Indexes | Medium | Common multi-column queries lack optimized indexes |
| 8 | No Row-Level Security | Medium | No tenant_id or permission enforcement at database level |

### Medium Priority Issues

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 9 | Timestamp Inconsistency | Medium | Some tables use TEXT, others use DATETIME for timestamps |
| 10 | Payment Terms History | Medium | Updating payment_terms_presets loses invoice history |
| 11 | Analytics Retention | Medium | No archival/cleanup strategy for page_views, interaction_events |
| 12 | Lead/Intake Overlap | Medium | Multiple tables track similar intake/lead data |

### Low Priority Issues

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 13 | Redundant Fields | Low | is_read + read_at both store same information |
| 14 | Hardcoded Defaults | Low | Business info defaults in invoices should be config |
| 15 | Missing Audit Triggers | Low | No automatic timestamp triggers, relies on application |

### Recommendations

#### Immediate Actions

1. **Clarify User Management**
   - Choose authoritative table: `clients` or `users`
   - Consolidate authentication logic
   - Remove or archive unused table

2. **Fix Project Status**

   ```sql
   -- Update CHECK constraint to include all used statuses
   ALTER TABLE projects
   DROP CONSTRAINT IF EXISTS status_check;

   ALTER TABLE projects
   ADD CONSTRAINT status_check CHECK (
     status IN ('pending', 'active', 'in-progress', 'in-review',
                'completed', 'on-hold', 'cancelled')
   );
   ```

3. **Add Missing Indexes**

   ```sql
   CREATE INDEX idx_projects_assigned_status ON projects(assigned_to, status);
   CREATE INDEX idx_time_entries_project_date ON time_entries(project_id, date);
   CREATE INDEX idx_client_activities_timeline ON client_activities(client_id, created_at);
   CREATE INDEX idx_audit_entity_search ON audit_logs(entity_type, entity_id, created_at);
   ```

#### Short-Term Improvements

4. **Replace Text Foreign Keys**
   - Convert `assigned_to` fields to proper user_id references
   - Add `users` or `team_members` table for staff

5. **Add JSON Schema Validation**
   - Validate JSON fields before insert/update
   - Consider dedicated columns for critical JSON properties

6. **Implement Data Retention**

   ```sql
   -- Example: Archive old analytics data
   DELETE FROM page_views
   WHERE created_at < date('now', '-12 months');

   DELETE FROM interaction_events
   WHERE created_at < date('now', '-12 months');
   ```

#### Long-Term Improvements

7. **Consolidate Lead/Intake Concepts**
   - Merge `client_intakes` functionality into `projects` (leads)
   - Single source of truth for prospect data

8. **Add Event Sourcing**
   - For financial records requiring audit trail
   - Immutable event log for compliance

9. **Consider Migration to PostgreSQL**
   - Better JSON support with JSONB
   - Native boolean type
   - Row-level security
   - Better constraint enforcement

---

## Quick Reference

### Common Queries with Index Usage

```sql
-- Client lookup (uses idx_clients_email)
SELECT * FROM clients WHERE email = ?;

-- Active projects for client (uses idx_projects_client_id, idx_projects_status)
SELECT * FROM projects
WHERE client_id = ? AND status IN ('active', 'in-progress');

-- Overdue invoices (uses idx_invoices_status, idx_invoices_due_date)
SELECT * FROM invoices
WHERE status = 'sent' AND due_date < date('now');

-- Lead pipeline (uses idx_projects_pipeline, idx_projects_lead_score)
SELECT * FROM projects
WHERE pipeline_stage_id = ?
ORDER BY lead_score DESC;

-- Client activity timeline (uses idx_client_activities_client)
SELECT * FROM client_activities
WHERE client_id = ?
ORDER BY created_at DESC
LIMIT 50;
```

### Migration Best Practices

```sql
-- Always use IF NOT EXISTS for new tables
CREATE TABLE IF NOT EXISTS new_table (...);

-- Use transactions for data migrations
BEGIN TRANSACTION;
-- migration steps
COMMIT;

-- Add indexes after bulk inserts
INSERT INTO table SELECT ...;
CREATE INDEX idx_table_column ON table(column);
```

### Boolean Handling

```typescript
// Convert SQLite INTEGER to JavaScript boolean
const sqliteBoolToJs = (value: number | null): boolean => value === 1;

// Convert JavaScript boolean to SQLite INTEGER
const jsBoolToSqlite = (value: boolean): number => value ? 1 : 0;
```
