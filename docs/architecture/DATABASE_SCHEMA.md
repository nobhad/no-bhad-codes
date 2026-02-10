# Database Schema Documentation

**Last Updated:** February 10, 2026
**Database:** SQLite (`data/client_portal.db`)
**Total Tables:** 118 (includes new `users` table)
**Total Migrations:** 69

## Table of Contents

1. [Overview](#overview)
2. [Functional Areas](#functional-areas)
3. [Core Entity Relationships](#core-entity-relationships)
4. [Table Reference](#table-reference)
5. [Known Issues](#known-issues)
6. [Normalization Plan](#normalization-plan)

---

## Overview

This database supports a comprehensive freelance business management system including:

- Client relationship management (CRM)
- Project management with milestones and tasks
- Invoicing and payment tracking
- Contract management with e-signatures
- Proposal system with tiered pricing
- Document requests and file management
- Messaging and communication
- Approval workflows
- Analytics and reporting
- Lead pipeline management

### Key Statistics

| Metric | Value |
|--------|-------|
| Total Tables | 117 |
| High-complexity tables (40+ cols) | 3 (invoices, clients, projects) |
| Total Indexes | 150+ |
| JSON fields | 30+ (templates, configs, metadata) |
| Soft-delete enabled tables | 6 |

### Design Patterns Used

- **Soft Delete**: `deleted_at`, `deleted_by` columns on core entities
- **Audit Trail**: `audit_logs` table with comprehensive action tracking
- **Temporal Tracking**: `created_at`, `updated_at` on all tables
- **JSON Storage**: Flexible schemas for templates, configurations, metadata
- **Status State Machines**: CHECK constraints for valid status transitions

---

## Functional Areas

### 1. Core Entities (11 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Team member accounts | email, display_name, role (admin/team_member/contractor/system), is_active |
| `clients` | Client accounts | 45 cols: auth, billing, health scoring, notifications |
| `client_contacts` | Multiple contacts per client | first_name, last_name, email, role, is_primary |
| `client_activities` | Activity log | activity_type, title, metadata (JSON) |
| `client_notes` | Notes with pinning | author, content, is_pinned |
| `client_tags` | Tag associations (M:N) | client_id, tag_id |
| `client_custom_field_values` | Custom field data | field_id, field_value |
| `client_onboarding` | Onboarding progress | current_step (1-5), step_data (JSON) |
| `client_info_completeness` | Profile completion | overall_percentage, documents_*, questionnaires_* |
| `notification_preferences` | Email/notification settings | 29 cols: frequency, event toggles, quiet hours |
| `tags` | Global tag taxonomy | name, color, tag_type |

### 2. Projects (8 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `projects` | Project records | 42 cols: client_id, status, dates, budget, health |
| `milestones` | Project milestones | title, due_date, deliverables (JSON), is_completed |
| `project_tasks` | Tasks with subtasks | milestone_id, parent_task_id, assigned_to, priority |
| `task_dependencies` | Task dependencies | task_id, depends_on_task_id, dependency_type |
| `task_checklist_items` | Task checklists | task_id, content, is_completed |
| `task_comments` | Task discussions | task_id, author, content |
| `time_entries` | Time tracking | project_id, task_id, hours, billable, hourly_rate |
| `project_templates` | Project blueprints | default_milestones (JSON), default_tasks (JSON) |

### 3. Invoicing (12 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `invoices` | Invoice records | 52 cols: amounts, status, line_items (JSON), billing |
| `invoice_payments` | Payment records | amount, payment_method, payment_date |
| `invoice_reminders` | Payment reminders | reminder_type, scheduled_date, sent_at |
| `scheduled_invoices` | Future invoices | trigger_type (date/milestone), trigger_date |
| `recurring_invoices` | Recurring templates | frequency, day_of_month, next_generation_date |
| `invoice_credits` | Deposit credits | deposit_invoice_id, applied_to_invoice_id, amount |
| `payment_plan_templates` | Payment plans | payments (JSON with percentages/triggers) |
| `payment_terms_presets` | Payment terms | days_until_due, late_fee_rate, grace_period |
| `stripe_checkout_sessions` | Stripe sessions | stripe_session_id, payment_url, status |
| `stripe_payments` | Stripe payments | stripe_payment_intent_id, amount, status |
| `stripe_payment_attempts` | Failed attempts | stripe_payment_intent_id, error_message |

### 4. Messaging (9 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `message_threads` | Conversation threads | client_id, project_id, subject, thread_type, status |
| `messages` | Project messages | project_id, sender_type, message, read_at |
| `general_messages` | Full-featured messages | 23 cols: threading, reactions, mentions, soft-delete |
| `message_mentions` | @mentions | mentioned_type (user/team/all), mentioned_id |
| `message_reactions` | Emoji reactions | message_id, user_email, reaction |
| `message_subscriptions` | Thread subscriptions | notify_all, notify_mentions, muted_until |
| `message_read_receipts` | Read tracking | message_id, user_email, read_at |
| `pinned_messages` | Pinned messages | thread_id, message_id, pinned_by |
| `contact_submissions` | Inbound contacts | name, email, subject, status, converted_at |

### 5. Files (7 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `files` | File records | 25 cols: versioning, locking, access tracking |
| `file_versions` | Version history | version_number, is_current, change_comment |
| `file_folders` | Folder hierarchy | parent_folder_id (recursive), name, color |
| `file_tags` | File tag associations | file_id, tag_id |
| `file_access_log` | Access audit | user_email, access_type, ip_address |
| `file_comments` | File discussions | author_email, content, parent_comment_id |

### 6. Contracts (5 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `contract_templates` | Contract blueprints | type, content, variables (JSON) |
| `contracts` | Contract records | 29 cols: status, signature data, countersigning |
| `contract_signature_log` | Signature audit | action, actor_email, actor_ip, details (JSON) |
| `contract_reminders` | Signing reminders | reminder_type, scheduled_date, sent_at |

### 7. Proposals (5 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `proposal_requests` | Proposal records | selected_tier, base_price, final_price, status |
| `proposal_feature_selections` | Selected features | feature_id, feature_price, is_addon |
| `proposal_contract_terms_templates` | Terms templates | terms_content, version, is_default |

### 8. Workflows & Approvals (6 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `approval_workflow_definitions` | Workflow templates | entity_type, workflow_type (sequential/parallel) |
| `approval_workflow_steps` | Workflow steps | step_order, approver_type, auto_approve_after_hours |
| `approval_workflow_instances` | Active workflows | status, current_step, initiated_by |
| `approval_requests` | Pending approvals | approver_email, status, decision_comment |
| `approval_history` | Approval audit | action, actor_email, comment |
| `workflow_triggers` | Automation rules | event_type, conditions (JSON), action_config (JSON) |

### 9. Document Requests (5 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `document_requests` | Document requests | document_type, priority, status, due_date |
| `document_request_templates` | Request templates | title, document_type, days_until_due |
| `document_request_history` | Request audit | action, old_status, new_status |

### 10. Deliverables (4 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `deliverable_workflows` | Review workflows | file_id, status, version, approved_at |
| `deliverable_review_comments` | Review comments | comment_type (feedback/approval/rejection) |
| `deliverable_history` | Status history | from_status, to_status, changed_by |

### 11. Intake & Onboarding (5 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `client_intakes` | Intake submissions | company_name, email, status, client_id (after conversion) |
| `questionnaires` | Question templates | questions (JSON), auto_send_on_project_create |
| `questionnaire_responses` | Client answers | answers (JSON), status, completed_at |

### 12. Ad Hoc Requests (3 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ad_hoc_requests` | Feature/support requests | request_type, urgency, quoted_price, status |
| `ad_hoc_request_invoices` | Request-invoice links | request_id, invoice_id, amount |

### 13. Analytics (8 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `visitor_sessions` | Session tracking | session_id, visitor_id, device/browser/geo info |
| `page_views` | Page view log | session_id, url, time_on_page, scroll_depth |
| `interaction_events` | User interactions | event_type, element, timestamp |
| `analytics_daily_summary` | Pre-aggregated metrics | date, totals, breakdowns (JSON) |
| `kpi_snapshots` | Historical KPIs | kpi_type, value, change_percent |
| `dashboard_widgets` | Custom dashboards | widget_type, data_source, config (JSON) |
| `report_schedules` | Scheduled reports | frequency, recipients (JSON), format |
| `report_runs` | Report execution log | status, row_count, file_path |

### 14. Leads & Pipeline (6 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `lead_scoring_rules` | Scoring criteria | field_name, operator, points |
| `pipeline_stages` | Sales pipeline | name, win_probability, auto_convert_to_project |
| `lead_tasks` | Lead follow-ups | task_type (call/email/meeting), due_date |
| `lead_notes` | Lead notes | author, content, is_pinned |
| `lead_sources` | Lead origins | name, description, is_active |
| `lead_duplicates` | Duplicate detection | similarity_score, match_fields (JSON) |

### 15. Knowledge Base (4 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kb_categories` | Article categories | name, slug, icon, color |
| `kb_articles` | Help articles | title, content (markdown), view_count |
| `kb_article_feedback` | Article ratings | is_helpful, comment |
| `kb_search_log` | Search analytics | query, result_count, clicked_article_id |

### 16. Integrations (8 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `calendar_sync_configs` | Google Calendar sync | access_token, sync_milestones, sync_tasks |
| `calendar_event_mappings` | Synced events | entity_type, entity_id, google_event_id |
| `integration_status` | Integration health | integration_type, is_active, error_message |
| `notification_integrations` | Slack/Discord webhooks | platform, webhook_url, events |
| `notification_delivery_logs` | Webhook delivery | status, error_message, response_status |

### 17. Data Quality & Security (6 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `duplicate_detection_log` | Scan history | entity_type, duplicates_found, scan_duration_ms |
| `duplicate_resolution_log` | Merge history | resolution_type, fields_merged (JSON) |
| `validation_error_log` | Validation errors | error_type, error_message, source_ip |
| `data_quality_metrics` | Quality scores | metric_date, quality_score (0-100) |
| `rate_limit_log` | Rate limiting | ip_address, endpoint, request_count |
| `blocked_ips` | IP blocklist | ip_address, reason, expires_at |
| `audit_logs` | Action audit | 17 cols: user, action, entity, changes (JSON) |

### 18. Email Templates (3 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `email_templates` | Email blueprints | category, subject, body_html, variables (JSON) |
| `email_template_versions` | Template history | version, changed_by, change_reason |
| `email_send_logs` | Delivery log | recipient_email, status, error_message |

---

## Core Entity Relationships

```text
clients (root entity)
├── projects (1:N)
│   ├── milestones (1:N)
│   │   └── project_tasks (N:1 optional)
│   ├── project_tasks (1:N)
│   │   ├── task_dependencies (N:N self-reference)
│   │   ├── task_checklist_items (1:N)
│   │   ├── task_comments (1:N)
│   │   └── time_entries (1:N optional)
│   ├── invoices (1:N)
│   │   ├── invoice_payments (1:N)
│   │   └── stripe_payments (1:N)
│   ├── contracts (1:N)
│   ├── files (1:N)
│   │   └── file_versions (1:N)
│   ├── message_threads (1:N optional)
│   │   └── general_messages (1:N)
│   ├── document_requests (1:N)
│   ├── deliverable_workflows (1:N)
│   ├── ad_hoc_requests (1:N)
│   └── proposal_requests (1:N)
│
├── client_contacts (1:N)
├── client_activities (1:N)
├── client_notes (1:N)
├── client_intakes (1:N)
├── questionnaire_responses (1:N)
└── notification_preferences (1:1)

tags (global taxonomy)
├── client_tags (M:N with clients)
├── project_tags (M:N with projects)
└── file_tags (M:N with files)

approval_workflow_definitions (templates)
├── approval_workflow_steps (1:N)
└── approval_workflow_instances (1:N)
    ├── approval_requests (1:N)
    └── approval_history (1:N)
```

---

## Table Reference

### Largest Tables (by column count)

| Table | Columns | Primary FK | Notes |
|-------|---------|------------|-------|
| `invoices` | 52 | client_id, project_id | Wide table with all billing data |
| `clients` | 45 | - | Root entity with auth, billing, health |
| `projects` | 42 | client_id | Core project with contract fields |
| `contracts` | 29 | project_id, client_id | Signature and countersigning |
| `notification_preferences` | 29 | user_id | All notification toggles |
| `files` | 25 | project_id | Versioning, locking, access |
| `general_messages` | 23 | thread_id | Full messaging features |
| `document_requests` | 22 | client_id, project_id | Request lifecycle |
| `client_intakes` | 22 | - | Intake form data |
| `ad_hoc_requests` | 21 | project_id, client_id | Feature/support requests |

### Index Coverage

All tables have indexes on:

- Primary keys (automatic)
- Foreign key columns (JOIN performance)
- Status/type columns (filtering)
- Date columns (range queries)
- Soft-delete columns where applicable

---

## Known Issues

### 1. Data Duplication

**Contract Signature Fields**

- Duplicated in both `projects` and `contracts` tables
- Fields: signer_*, countersigner_*, signature_data, signed_pdf_path
- **Impact**: Update anomalies if data diverges

**Notification Preferences** ✅ RESOLVED

- ~~`clients` table has inline flags (notification_messages, etc.)~~
- ~~Separate `notification_preferences` table exists~~
- **Resolution**: Migration 069 removed inline flags from `clients`, consolidated to `notification_preferences` table

### 2. Wide Tables

- `invoices` (52 cols), `clients` (40 cols), `projects` (42 cols)
- **Impact**: Query performance, maintainability
- **Recommendation**: Normalize into feature-specific tables

### 3. Hardcoded Business Data

In `invoices` table:

- business_name DEFAULT 'No Bhad Codes'
- business_contact DEFAULT 'Noelle Bhaduri'
- business_email, paypal_email, venmo_handle

**Impact**: Not multi-tenant ready

### 4. Dual Message Systems

- `messages` (11 cols) - simple project messages
- `general_messages` (23 cols) - full features

**Impact**: Inconsistent messaging experience

### 5. TEXT Foreign Keys (Being Addressed)

35+ tables use TEXT for user/team references instead of INTEGER FK:

- assigned_to, uploaded_by, reviewed_by, created_by
- author, sender_name, blocked_by

**Status**: Migration 068 added `users` table and `*_user_id` INTEGER FK columns to 20+ tables.
TEXT columns retained during transition period. See [DATABASE_NORMALIZATION_PLAN.md](./DATABASE_NORMALIZATION_PLAN.md).

**Impact**: No referential integrity, no CASCADE deletes (being resolved)

### 6. Inconsistent Soft Delete

Has `deleted_at`/`deleted_by`:

- clients, projects, invoices, intakes, proposals, ad_hoc_requests

Missing:

- tasks, milestones, files, messages, contracts

---

## Normalization Plan

See [DATABASE_NORMALIZATION_PLAN.md](./DATABASE_NORMALIZATION_PLAN.md) for detailed remediation plan.

### Phase 1 - Low Risk (Completed)

- [x] Remove redundant `is_read` boolean (Migration 067)

### Phase 2 - Medium Risk (Migration Complete)

- [x] Create `users` table for team members (Migration 068)
- [x] Add INTEGER FK columns alongside TEXT columns (Migration 068)
- [ ] Update application code to use new columns (transition period)
- [ ] Remove duplicate notification preference columns from clients

### Phase 3 - Higher Risk (Planned)

- [ ] Normalize invoice table (extract business_info, payment_config)
- [ ] Consolidate signature systems (contracts only)
- [ ] Extract hardcoded business data to system_settings

### Phase 4 - Major Refactor (Deferred)

- [ ] Consolidate lead/intake systems
- [ ] Unify message tables
- [ ] Add soft-delete to all core entities

---

## Related Documentation

- [API Documentation](../API_DOCUMENTATION.md)
- [Database Normalization Plan](./DATABASE_NORMALIZATION_PLAN.md)
- [Data Quality Features](../features/DATA_QUALITY.md)
