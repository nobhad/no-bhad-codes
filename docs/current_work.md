# Current Work

**Last Updated:** February 2, 2026

This file tracks active development work and TODOs. Completed items are moved to `archive/ARCHIVED_WORK_2026-01.md`.

---

## Completed - February 2, 2026

### Contract Tab Added to Project Details

**Status:** UI COMPLETE, Backend Partial

Added a dedicated Contract tab to the project details page with Preview, Download, and Request Signature functionality.

**Frontend Changes:**

- Added Contract tab button to project detail tabs navigation
- Created Contract tab content with:
  - Status card showing signed/not signed status
  - Action cards: Preview (opens PDF), Download (downloads PDF), Request Signature
  - Signature details card (shown when signed)
- Added CSS styling for contract tab components

**Backend Endpoints Created:**

- `GET /api/projects/:id/contract/pdf` - Generate contract PDF (already existed)
- `POST /api/projects/:id/contract/request-signature` - Request client signature
- `POST /api/projects/:id/contract/sign` - Record contract signature

**Files Modified:**

- `admin/index.html` - Added contract tab and content
- `src/features/admin/admin-project-details.ts` - Contract tab logic and handlers
- `src/styles/admin/project-detail.css` - Contract tab styling
- `server/routes/projects.ts` - Signature request/sign endpoints

**TODO:** See "Contract E-Signature System" in Features section for remaining work.

---

## Completed - February 1, 2026

### State-of-the-Art Feature Enhancement Plan - BACKEND COMPLETE

Enhancing ALL core features to professional, enterprise-grade level comparable to industry leaders (HubSpot, Salesforce, Monday.com, PandaDoc, Proposify).

**Implementation Order:**

1. [x] **Phase 1: Client Management** - CRM-grade contact management (COMPLETE)
2. [x] **Phase 4: Leads/Intake** - Scoring, pipeline, assignment (COMPLETE)
3. [x] **Phase 2: Project Management** - Tasks, time tracking, templates (COMPLETE)
4. [x] **Phase 3: Proposals** - Templates, versioning, e-signatures (COMPLETE)
5. [x] **Phase 5: Messaging** - Threads, mentions, notifications (COMPLETE)
6. [x] **Phase 6: Files** - Versioning, organization (COMPLETE)
7. [x] **Phase 7: Analytics** - Comprehensive dashboards (COMPLETE)

**ALL PHASES COMPLETE** - State-of-the-art feature enhancement plan fully implemented.

---

### Frontend Integration Plan - BASIC UI COMPLETE

Basic UI structure for Phases 1-7 has been created. However, many advanced backend features still lack frontend UI.

**Phases with Basic UI:**

1. [x] **Phase 1: Client CRM UI** - Client detail tabs (basic)
2. [x] **Phase 2: Project Tasks & Time Tracking UI** - Tasks tab, time entries
3. [x] **Phase 4: Lead Pipeline UI** - Pipeline Kanban (basic)
4. [x] **Phase 7: Analytics Dashboard UI** - KPI cards, revenue charts
5. [x] **Phase 6: File Management UI** - Folder tree (basic)
6. [x] **Phase 5: Enhanced Messaging UI** - Basic messaging
7. [x] **Phase 3: Proposal Enhancements UI** - Templates, versions (basic)

**Note:** See "Backend Features Without Frontend UI" section below for detailed gap analysis.

**Shared Components Created:**

- `src/components/kanban-board.ts` - Reusable Kanban board for tasks and leads
- `src/components/tag-input.ts` - Tag input with autocomplete
- `src/components/timeline.ts` - Activity timeline component
- `src/components/chart-simple.ts` - Simple Chart.js wrapper

**Files Created/Modified:**

Phase 7 - Analytics:

- `src/features/admin/modules/admin-analytics.ts` - Business KPIs, charts, funnel, reports
- `src/styles/admin/analytics.css` - KPI cards, funnel, reports styling

Phase 6 - Files:

- `src/features/admin/modules/admin-files.ts` - NEW: Complete file management module
- `src/styles/admin/files.css` - NEW: File management styling

Phase 5 - Messaging:

- `src/features/admin/modules/admin-messaging.ts` - Reactions, read receipts, pins
- `src/styles/shared/portal-messages.css` - Messaging enhancements styling

Phase 3 - Proposals:

- `src/features/admin/modules/admin-proposals.ts` - Templates, versions, signatures
- `src/styles/admin/proposals.css` - NEW: Proposal enhancements styling

**HTML Updates:**

- `admin/index.html` - Added containers for analytics KPIs, files tab, messaging features

---

## Completed - February 1, 2026

### Phase 1: Client Management Enhancement - COMPLETE

Implemented CRM-grade client management with contacts, activities, custom fields, tags, and health scoring.

**New Features:**

- **Multi-Contact Management** - Multiple contacts per client organization with roles (primary, billing, technical, decision_maker)
- **Activity Timeline** - Automatic and manual activity tracking (notes, calls, emails, meetings)
- **Custom Fields** - Define custom fields (text, number, date, select, boolean, url, email, phone)
- **Tags & Segmentation** - 8 default tags for client categorization (VIP, Referral, New, Returning, etc.)
- **Health Scoring** - Automatic health calculation (payment history, engagement, project success, communication)
- **CRM Fields** - Industry, company size, acquisition source, website, follow-up dates, notes
- **Client Statistics** - Comprehensive stats (projects, invoices, lifetime value, etc.)

**Database Changes (Migration 030):**

- Created `client_contacts` table for multiple contacts per client
- Created `client_activities` table for activity timeline
- Created `client_custom_fields` table for custom field definitions
- Created `client_custom_field_values` table for field values
- Created `tags` table for tag definitions
- Created `client_tags` junction table
- Added CRM columns to clients: `health_score`, `health_status`, `lifetime_value`, `acquisition_source`, `industry`, `company_size`, `website`, `last_contact_date`, `next_follow_up_date`, `notes`, `preferred_contact_method`
- Seeded 8 default tags and 4 default custom fields

**New API Endpoints (25+):**

Contact Management:

- `GET/POST /api/clients/:id/contacts` - Contact CRUD
- `PUT/DELETE /api/clients/contacts/:contactId` - Update/delete contact
- `POST /api/clients/:id/contacts/:contactId/set-primary` - Set primary contact

Activity Timeline:

- `GET/POST /api/clients/:id/activities` - Activity CRUD
- `GET /api/clients/activities/recent` - Recent activities (all clients)

Custom Fields:

- `GET/POST /api/clients/custom-fields` - Field definitions
- `PUT/DELETE /api/clients/custom-fields/:fieldId` - Update/delete field
- `GET/PUT /api/clients/:id/custom-fields` - Client field values

Tags:

- `GET/POST /api/clients/tags` - Tag CRUD
- `PUT/DELETE /api/clients/tags/:tagId` - Update/delete tag
- `GET /api/clients/:id/tags` - Client tags
- `POST/DELETE /api/clients/:id/tags/:tagId` - Add/remove tag
- `GET /api/clients/by-tag/:tagId` - Clients by tag

Health & Stats:

- `GET /api/clients/:id/health` - Health score
- `POST /api/clients/:id/health/recalculate` - Recalculate health
- `GET /api/clients/at-risk` - At-risk clients
- `GET /api/clients/:id/stats` - Comprehensive stats

CRM:

- `PUT /api/clients/:id/crm` - Update CRM fields
- `GET /api/clients/follow-up` - Clients due for follow-up

**Files Created:**

- `server/database/migrations/030_client_enhancements.sql`
- `server/services/client-service.ts`
- `docs/features/CLIENTS.md`

**Files Modified:**

- `server/routes/clients.ts` - Added 25+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for CRM types

---

### Phase 4: Leads/Intake Enhancement - COMPLETE

Implemented enterprise-grade lead scoring, pipeline management, task tracking, and analytics.

**New Features:**

- **Lead Scoring** - Configurable rules with operators (equals, contains, in, greater_than, not_empty)
- **Pipeline Management** - 7 default stages with win probability, kanban view
- **Task Management** - Follow-ups, calls, emails, meetings with due dates and reminders
- **Notes System** - Pinnable notes with author tracking
- **Lead Sources** - 9 default sources (Website, Referral, Social Media, etc.)
- **Duplicate Detection** - Automatic similarity scoring based on email, company, contact name
- **Bulk Operations** - Bulk status update, assignment, stage move
- **Analytics** - Conversion funnel, source performance, score distribution

**Database Changes (Migration 033):**

- Created `lead_scoring_rules` table with 9 default rules
- Created `pipeline_stages` table with 7 default stages
- Created `lead_tasks` table for follow-ups
- Created `lead_notes` table for notes
- Created `lead_sources` table with 9 default sources
- Created `lead_duplicates` table for duplicate tracking
- Added lead columns to projects: `lead_score`, `lead_score_breakdown`, `pipeline_stage_id`, `lead_source_id`, `assigned_to`, `expected_value`, `expected_close_date`, `lost_reason`, `lost_at`, `won_at`, `competitor`, `last_activity_at`, `next_follow_up_at`

**New API Endpoints (35+):**

Scoring:

- `GET/POST /api/admin/leads/scoring-rules` - Scoring rule CRUD
- `PUT/DELETE /api/admin/leads/scoring-rules/:id` - Update/delete rule
- `POST /api/admin/leads/:id/calculate-score` - Calculate score
- `POST /api/admin/leads/recalculate-all` - Recalculate all

Pipeline:

- `GET /api/admin/leads/pipeline/stages` - Get stages
- `GET /api/admin/leads/pipeline` - Pipeline kanban view
- `GET /api/admin/leads/pipeline/stats` - Pipeline statistics
- `POST /api/admin/leads/:id/move-stage` - Move to stage

Tasks:

- `GET/POST /api/admin/leads/:id/tasks` - Task CRUD
- `PUT /api/admin/leads/tasks/:taskId` - Update task
- `POST /api/admin/leads/tasks/:taskId/complete` - Complete task
- `GET /api/admin/leads/tasks/overdue` - Overdue tasks
- `GET /api/admin/leads/tasks/upcoming` - Upcoming tasks

Notes:

- `GET/POST /api/admin/leads/:id/notes` - Note CRUD
- `POST /api/admin/leads/notes/:noteId/toggle-pin` - Pin/unpin
- `DELETE /api/admin/leads/notes/:noteId` - Delete note

Sources & Assignment:

- `GET /api/admin/leads/sources` - Lead sources
- `POST /api/admin/leads/:id/source` - Set source
- `POST /api/admin/leads/:id/assign` - Assign lead
- `GET /api/admin/leads/my-leads` - My assigned leads
- `GET /api/admin/leads/unassigned` - Unassigned leads

Duplicates:

- `GET /api/admin/leads/:id/duplicates` - Find duplicates
- `GET /api/admin/leads/duplicates` - All pending duplicates
- `POST /api/admin/leads/duplicates/:id/resolve` - Resolve duplicate

Bulk:

- `POST /api/admin/leads/bulk/status` - Bulk status update
- `POST /api/admin/leads/bulk/assign` - Bulk assign
- `POST /api/admin/leads/bulk/move-stage` - Bulk move

Analytics:

- `GET /api/admin/leads/analytics` - Lead analytics
- `GET /api/admin/leads/conversion-funnel` - Conversion funnel
- `GET /api/admin/leads/source-performance` - Source performance

**Files Created:**

- `server/database/migrations/033_lead_enhancements.sql`
- `server/services/lead-service.ts`
- `docs/features/LEADS.md`

**Files Modified:**

- `server/routes/admin.ts` - Added 35+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for lead types

---

### Phase 2: Project Management Enhancement - COMPLETE

Implemented enterprise-grade project management with tasks, time tracking, templates, dependencies, and project health metrics.

**New Features:**

- **Task Management** - Tasks with subtasks, priorities (low/medium/high/urgent), status (pending/in_progress/completed/blocked/cancelled)
- **Task Dependencies** - finish_to_start, start_to_start, finish_to_finish, start_to_finish with cyclic dependency detection
- **Task Comments** - Threaded comments on tasks with author tracking
- **Task Checklists** - Checklist items within tasks with completion tracking
- **Time Tracking** - Log hours against projects/tasks, billable vs non-billable, hourly rates, automatic project/task hour updates
- **Project Templates** - 3 default templates (Simple Website, Business Website, E-commerce Store) with milestones and tasks
- **Project Health** - Automatic health calculation (on_track/at_risk/off_track) based on schedule, budget, tasks, milestones
- **Burndown Charts** - Visual burndown data (planned vs actual vs remaining hours)
- **Velocity Tracking** - Weekly hours/tasks completed, average velocity
- **Project Tags** - 8 default tags (Rush, Maintenance, Redesign, New Build, Complex, Simple, Fixed Price, Hourly)
- **Project Archiving** - Archive/unarchive projects

**Database Changes (Migration 031):**

- Created `project_tasks` table with subtask support (parent_task_id)
- Created `task_dependencies` table for dependency tracking
- Created `task_comments` table for task discussions
- Created `time_entries` table for time tracking
- Created `project_templates` table with 3 default templates
- Created `project_tags` junction table
- Created `task_checklist_items` table
- Added columns to projects: `hourly_rate`, `estimated_hours`, `actual_hours`, `template_id`, `archived_at`, `project_health`, `health_notes`
- Added columns to milestones: `sort_order`, `estimated_hours`, `actual_hours`, `status`
- Seeded 3 project templates and 8 project tags

**New API Endpoints (30+):**

Task Management:

- `GET/POST /api/projects/:id/tasks` - Task CRUD
- `GET/PUT/DELETE /api/projects/tasks/:taskId` - Single task operations
- `POST /api/projects/tasks/:taskId/complete` - Complete task
- `POST /api/projects/tasks/:taskId/move` - Move task position

Dependencies:

- `POST /api/projects/tasks/:taskId/dependencies` - Add dependency
- `DELETE /api/projects/tasks/:taskId/dependencies/:dependsOnTaskId` - Remove dependency
- `GET /api/projects/:id/tasks/blocked` - Get blocked tasks

Comments & Checklists:

- `GET/POST /api/projects/tasks/:taskId/comments` - Comments
- `DELETE /api/projects/tasks/comments/:commentId` - Delete comment
- `POST /api/projects/tasks/:taskId/checklist` - Add checklist item
- `POST /api/projects/tasks/checklist/:itemId/toggle` - Toggle item
- `DELETE /api/projects/tasks/checklist/:itemId` - Delete item

Time Tracking:

- `GET/POST /api/projects/:id/time-entries` - Time entries
- `PUT/DELETE /api/projects/time-entries/:entryId` - Update/delete entry
- `GET /api/projects/:id/time-stats` - Project time statistics
- `GET /api/projects/reports/team-time` - Team time report

Templates:

- `GET /api/projects/templates` - Get all templates
- `GET /api/projects/templates/:templateId` - Get single template
- `POST /api/projects/templates` - Create template
- `POST /api/projects/from-template` - Create project from template

Health & Analytics:

- `GET /api/projects/:id/health` - Project health
- `GET /api/projects/:id/burndown` - Burndown chart data
- `GET /api/projects/:id/velocity` - Velocity data

Tags & Archive:

- `GET /api/projects/:id/tags` - Get project tags
- `POST/DELETE /api/projects/:id/tags/:tagId` - Add/remove tag
- `POST /api/projects/:id/archive` - Archive project
- `POST /api/projects/:id/unarchive` - Unarchive project

**Files Created:**

- `server/database/migrations/031_project_enhancements.sql`
- `server/services/project-service.ts`
- `docs/features/PROJECTS.md`

**Files Modified:**

- `server/routes/projects.ts` - Added 30+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for project management types

---

### Phase 3: Proposal System Enhancement - COMPLETE

Implemented professional-grade proposal management with templates, versioning, e-signatures, collaboration, and activity tracking.

**New Features:**

- **Proposal Templates** - 3 default templates (Simple Website, Business Website, E-commerce) with tier structures and default line items
- **Versioning** - Create, view, compare, and restore proposal versions with change tracking
- **E-Signatures** - Request signatures via email, capture drawn/typed/uploaded signatures, IP tracking
- **Comments/Collaboration** - Client and admin comments with threading, internal (admin-only) comments
- **Activity Tracking** - Comprehensive activity log (viewed, commented, signed, status changes, etc.)
- **Custom Line Items** - Add service/product/discount/fee items with quantity, unit price, taxable/optional flags
- **Discounts** - Percentage or fixed discounts with reason tracking, automatic total recalculation
- **Expiration & Reminders** - Custom expiration dates, automatic expiration processing, reminder tracking
- **Access Tokens** - Generate unique tokens for client viewing without login

**Database Changes (Migration 032):**

- Created `proposal_templates` table with 3 default templates
- Created `proposal_versions` table for version history
- Created `proposal_signatures` table for e-signatures
- Created `proposal_comments` table for collaboration
- Created `proposal_activities` table for activity tracking
- Created `proposal_custom_items` table for custom line items
- Created `signature_requests` table for signature request tracking
- Added columns to proposal_requests: `template_id`, `expiration_date`, `view_count`, `last_viewed_at`, `signed_at`, `version_number`, `discount_type`, `discount_value`, `discount_reason`, `tax_rate`, `subtotal`, `tax_amount`, `sent_at`, `sent_by`, `accepted_at`, `rejected_at`, `rejection_reason`, `validity_days`, `requires_signature`, `access_token`

**New API Endpoints (35+):**

Templates:

- `GET/POST /api/proposals/templates` - Template CRUD
- `GET/PUT/DELETE /api/proposals/templates/:templateId` - Single template operations

Versioning:

- `GET/POST /api/proposals/:id/versions` - Version CRUD
- `POST /api/proposals/:id/versions/:versionId/restore` - Restore version
- `GET /api/proposals/versions/compare` - Compare versions

E-Signatures:

- `POST /api/proposals/:id/request-signature` - Request signature
- `POST /api/proposals/:id/sign` - Record signature
- `GET /api/proposals/:id/signature-status` - Get status
- `GET /api/proposals/sign/:token` - Get by token
- `POST /api/proposals/sign/:token/decline` - Decline

Comments:

- `GET/POST /api/proposals/:id/comments` - Comment CRUD
- `DELETE /api/proposals/comments/:commentId` - Delete comment

Activities:

- `GET /api/proposals/:id/activities` - Get activities
- `POST /api/proposals/:id/track-view` - Track view

Custom Items:

- `GET/POST /api/proposals/:id/custom-items` - Item CRUD
- `PUT/DELETE /api/proposals/custom-items/:itemId` - Update/delete item

Discounts:

- `POST /api/proposals/:id/discount` - Apply discount
- `DELETE /api/proposals/:id/discount` - Remove discount

Expiration & Send:

- `PUT /api/proposals/:id/expiration` - Set expiration
- `POST /api/proposals/:id/send` - Mark as sent
- `POST /api/proposals/:id/access-token` - Generate token
- `GET /api/proposals/view/:token` - Get by access token
- `POST /api/proposals/process-expired` - Process expired
- `GET /api/proposals/due-for-reminder` - Due for reminder
- `POST /api/proposals/:id/reminder-sent` - Mark reminder sent

**Files Created:**

- `server/database/migrations/032_proposal_enhancements.sql`
- `server/services/proposal-service.ts`
- `docs/features/PROPOSALS.md`

**Files Modified:**

- `server/routes/proposals.ts` - Added 35+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for proposal types

---

### Phase 5: Messaging Enhancement - COMPLETE

Implemented professional-grade messaging system with mentions, reactions, read receipts, pinned messages, internal notes, and search.

**New Features:**

- **Message Mentions** - Parse and track @user, @team, @all mentions with notification tracking
- **Message Reactions** - Add/remove emoji reactions with grouped summaries
- **Message Subscriptions** - Per-project notification preferences (all/mentions/replies) with mute/unmute
- **Read Receipts** - Individual and bulk read tracking, unread counts per user/thread
- **Pinned Messages** - Pin important messages to threads (admin only)
- **Message Editing** - Edit sent messages with timestamp tracking
- **Message Deletion** - Soft delete with who/when tracking
- **Internal Messages** - Admin-only messages not visible to clients
- **Thread Archiving** - Archive/unarchive threads (admin only)
- **Message Search** - Full-text search with project/thread filtering

**Database Changes (Migration 034):**

- Created `message_mentions` table for tracking @mentions
- Created `message_reactions` table for emoji reactions (unique per user/reaction)
- Created `message_subscriptions` table for per-project notification preferences
- Created `message_read_receipts` table for read tracking
- Created `pinned_messages` table for important messages
- Added columns to general_messages: `parent_message_id`, `is_internal`, `edited_at`, `deleted_at`, `deleted_by`, `reaction_count`, `reply_count`, `mention_count`
- Added columns to message_threads: `pinned_count`, `participant_count`, `archived_at`, `archived_by`

**New API Endpoints (25+):**

Mentions:

- `GET /api/messages/messages/:messageId/mentions` - Get message mentions
- `GET /api/messages/mentions/me` - Get my mentions

Reactions:

- `GET /api/messages/messages/:messageId/reactions` - Get reactions
- `POST /api/messages/messages/:messageId/reactions` - Add reaction
- `DELETE /api/messages/messages/:messageId/reactions/:reaction` - Remove reaction

Subscriptions:

- `GET /api/messages/projects/:projectId/subscription` - Get subscription
- `PUT /api/messages/projects/:projectId/subscription` - Update subscription
- `POST /api/messages/projects/:projectId/mute` - Mute project
- `POST /api/messages/projects/:projectId/unmute` - Unmute project

Read Receipts:

- `POST /api/messages/messages/:messageId/read` - Mark as read
- `POST /api/messages/messages/read-bulk` - Bulk mark as read
- `GET /api/messages/messages/:messageId/read-receipts` - Get receipts (admin)
- `GET /api/messages/unread-count` - Get unread count
- `GET /api/messages/threads/:threadId/unread-count` - Get thread unread count

Pinned Messages:

- `GET /api/messages/threads/:threadId/pinned` - Get pinned messages
- `POST /api/messages/messages/:messageId/pin` - Pin message (admin)
- `DELETE /api/messages/messages/:messageId/pin` - Unpin message (admin)

Edit/Delete:

- `PUT /api/messages/messages/:messageId` - Edit message
- `DELETE /api/messages/messages/:messageId` - Delete message

Thread Archiving:

- `POST /api/messages/threads/:threadId/archive` - Archive thread (admin)
- `POST /api/messages/threads/:threadId/unarchive` - Unarchive thread (admin)
- `GET /api/messages/threads/archived` - Get archived threads (admin)

Search & Internal:

- `GET /api/messages/search` - Search messages
- `POST /api/messages/threads/:threadId/internal` - Send internal message (admin)
- `GET /api/messages/threads/:threadId/internal` - Get internal messages (admin)

**Files Created:**

- `server/database/migrations/034_messaging_enhancements.sql`
- `server/services/message-service.ts`
- `docs/features/MESSAGING.md`

**Files Modified:**

- `server/routes/messages.ts` - Added 25+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for messaging types

---

### Phase 6: File Management Enhancement - COMPLETE

Implemented professional-grade file management with versioning, folders, tags, access tracking, comments, archiving, expiration, locking, and search.

**New Features:**

- **File Versioning** - Upload new versions, automatic numbering, version comments, restore previous versions
- **Folder Organization** - Hierarchical folders, nested subfolders, custom colors/icons, move files/folders
- **File Tags** - 8 default tags (Final, Draft, Review, Approved, Revision, Archive, Confidential, Client Provided)
- **Access Tracking** - Log views/downloads/previews, access counts, IP/user agent tracking, access statistics
- **File Comments** - Threaded comments, internal (admin-only) comments, author tracking
- **Archiving & Expiration** - Archive/restore files, set expiration dates, auto-archive expired files
- **File Locking** - Lock files for editing, track locker, admin force unlock
- **File Categories** - 7 categories (general, deliverable, source, asset, document, contract, invoice)
- **Search & Stats** - Full-text search, filter by folder/category, comprehensive file statistics

**Database Changes (Migration 035):**

- Created `file_versions` table for version history
- Created `file_folders` table with hierarchical structure
- Created `file_tags` junction table
- Created `file_access_log` table for tracking
- Created `file_comments` table for collaboration
- Added columns to files: `folder_id`, `version`, `is_archived`, `archived_at`, `archived_by`, `expires_at`, `access_count`, `last_accessed_at`, `download_count`, `checksum`, `is_locked`, `locked_by`, `locked_at`, `category`
- Seeded 8 default file tags

**New API Endpoints (30+):**

Versions:

- `GET /api/projects/files/:fileId/versions` - Get versions
- `POST /api/projects/files/:fileId/versions` - Upload new version
- `POST /api/projects/files/:fileId/versions/:versionId/restore` - Restore version

Folders:

- `GET /api/projects/:id/folders` - Get folders
- `POST /api/projects/:id/folders` - Create folder
- `PUT /api/projects/folders/:folderId` - Update folder
- `DELETE /api/projects/folders/:folderId` - Delete folder
- `POST /api/projects/files/:fileId/move` - Move file
- `POST /api/projects/folders/:folderId/move` - Move folder

Tags:

- `GET /api/projects/files/:fileId/tags` - Get file tags
- `POST/DELETE /api/projects/files/:fileId/tags/:tagId` - Add/remove tag
- `GET /api/projects/:id/files/by-tag/:tagId` - Files by tag

Access Tracking:

- `POST /api/projects/files/:fileId/access` - Log access
- `GET /api/projects/files/:fileId/access-log` - Get log (admin)
- `GET /api/projects/files/:fileId/access-stats` - Get stats

Comments:

- `GET/POST /api/projects/files/:fileId/comments` - Comments
- `DELETE /api/projects/files/comments/:commentId` - Delete comment

Archiving & Expiration:

- `POST /api/projects/files/:fileId/archive` - Archive
- `POST /api/projects/files/:fileId/restore` - Restore
- `GET /api/projects/:id/files/archived` - Archived files
- `PUT /api/projects/files/:fileId/expiration` - Set expiration
- `GET /api/projects/files/expiring-soon` - Expiring files
- `POST /api/projects/files/process-expired` - Process expired

Locking & Category:

- `POST /api/projects/files/:fileId/lock` - Lock file
- `POST /api/projects/files/:fileId/unlock` - Unlock file
- `PUT /api/projects/files/:fileId/category` - Set category
- `GET /api/projects/:id/files/by-category/:category` - By category

Stats & Search:

- `GET /api/projects/:id/files/stats` - File statistics
- `GET /api/projects/:id/files/search` - Search files

**Files Created:**

- `server/database/migrations/035_file_enhancements.sql`
- `server/services/file-service.ts`

**Files Modified:**

- `server/routes/projects.ts` - Added 30+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for file management types
- `docs/features/FILES.md` - Updated with Phase 6 documentation

---

### Phase 7: Analytics & Reporting Enhancement - COMPLETE

Implemented comprehensive analytics and reporting system with saved reports, scheduling, dashboards, KPIs, and metric alerts.

**New Features:**

- **Saved Reports** - Create, save, and share report configurations with filters, columns, and chart types
- **Report Scheduling** - Schedule automatic report generation (daily/weekly/monthly/quarterly) with email delivery
- **Dashboard Widgets** - Customizable dashboard with drag-and-drop widgets (metrics, charts, lists, tables)
- **Dashboard Presets** - 3 default presets: Executive Overview, Sales Dashboard, Project Manager
- **KPI Snapshots** - Historical tracking of key metrics (revenue, pipeline, clients, projects, conversion)
- **KPI Trends** - Trend analysis with change percentages over time
- **Metric Alerts** - Threshold-based alerts (above/below/equals/change) with email notifications
- **Quick Analytics** - Pre-built analytics for revenue, pipeline, projects, clients, and team
- **Report Run History** - Track report executions with status and results

**Database Changes (Migration 036):**

- Created `saved_reports` table for report configurations
- Created `report_schedules` table for automated scheduling
- Created `dashboard_widgets` table for user widget configurations
- Created `kpi_snapshots` table for historical KPI tracking
- Created `report_runs` table for execution history
- Created `dashboard_presets` table with 3 default presets
- Created `metric_alerts` table for threshold-based alerts
- Added comprehensive indexes for performance

**New API Endpoints (30+):**

Saved Reports:

- `GET/POST /api/analytics/reports` - Report CRUD
- `GET/PUT/DELETE /api/analytics/reports/:id` - Single report operations
- `POST /api/analytics/reports/:id/favorite` - Toggle favorite
- `POST /api/analytics/reports/:id/run` - Run report

Report Schedules:

- `GET/POST /api/analytics/reports/:reportId/schedules` - Schedule CRUD
- `PUT/DELETE /api/analytics/schedules/:id` - Update/delete schedule
- `POST /api/analytics/schedules/process` - Process due schedules

Dashboard Widgets:

- `GET/POST /api/analytics/widgets` - Widget CRUD
- `PUT/DELETE /api/analytics/widgets/:id` - Update/delete widget
- `PUT /api/analytics/widgets/layout` - Update widget layout
- `GET /api/analytics/widgets/presets` - Get presets
- `POST /api/analytics/widgets/presets/:id/apply` - Apply preset

KPI Snapshots:

- `POST /api/analytics/kpis/snapshot` - Capture snapshot
- `GET /api/analytics/kpis/latest` - Get latest KPIs
- `GET /api/analytics/kpis/:type/trend` - Get KPI trend

Metric Alerts:

- `GET/POST /api/analytics/alerts` - Alert CRUD
- `PUT/DELETE /api/analytics/alerts/:id` - Update/delete alert
- `POST /api/analytics/alerts/check` - Check triggers

Quick Analytics:

- `GET /api/analytics/quick/revenue` - Revenue analytics
- `GET /api/analytics/quick/pipeline` - Pipeline analytics
- `GET /api/analytics/quick/projects` - Project analytics
- `GET /api/analytics/quick/clients` - Client analytics
- `GET /api/analytics/quick/team` - Team analytics
- `GET /api/analytics/report-runs` - Report run history

**Files Created:**

- `server/database/migrations/036_analytics_enhancements.sql`
- `server/services/analytics-service.ts`
- `docs/features/ANALYTICS.md`

**Files Modified:**

- `server/routes/analytics.ts` - Added 30+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces for analytics types

---

### State-of-the-Art Invoice System - COMPLETE

Implemented comprehensive, professional-grade invoice system with automation, scheduling, and advanced financial features comparable to industry leaders (Stripe, QuickBooks, FreshBooks).

**Core Invoice Features:**

- **Payment Plan Templates** - Reusable payment structures (50/50, 30/30/40, quarterly, etc.)
- **Milestone-Linked Invoices** - Link invoices to project milestones
- **Invoice Scheduling** - Schedule future invoice generation
- **Recurring Invoices** - Automated weekly/monthly/quarterly invoices
- **Payment Reminders** - Automated reminder emails based on due date
- **Scheduler Service** - Background job processing with node-cron
- **Delete/Void Invoice** - Delete drafts, void sent invoices
- **Duplicate Invoice** - Clone existing invoices as new drafts
- **Record Payment** - Record partial/full payments with method tracking
- **Invoice Search** - Filter by client, project, status, dates, amounts with pagination
- **Auto-Mark Overdue** - Scheduler daily checks and updates overdue status
- **Manual Send Reminder** - Send payment reminder email on demand

**Advanced Financial Features (NEW):**

- **Tax Support** - Invoice-level and line-item tax rates with automatic calculation
- **Discounts** - Percentage or fixed discounts at invoice or line level
- **Late Fees** - Automatic late fee calculation (flat, percentage, daily percentage)
- **Payment Terms Presets** - Net 15, Net 30, Net 60, Due on Receipt + custom terms
- **Payment History** - Full payment history tracking per invoice
- **A/R Aging Report** - Accounts receivable aging by bucket (current, 1-30, 31-60, 61-90, 90+)
- **Internal Notes** - Admin-only notes not visible to clients
- **Custom Invoice Numbers** - Custom prefix and sequential numbering (e.g., WEB-202602-0001)
- **Comprehensive Stats** - Revenue, outstanding, averages, status breakdown, monthly trends

**Database Changes (Migration 028 + 029):**

Migration 028:

- Created `payment_plan_templates` table with 5 default templates
- Created `invoice_reminders` table for reminder tracking
- Created `scheduled_invoices` table for future invoices
- Created `recurring_invoices` table for recurring patterns
- Added `milestone_id` and `payment_plan_id` columns to invoices

Migration 029:

- Created `invoice_payments` table for payment history tracking
- Created `payment_terms_presets` table with 8 default presets
- Added tax columns: `tax_rate`, `tax_amount`, `subtotal`
- Added discount columns: `discount_type`, `discount_value`, `discount_amount`
- Added late fee columns: `late_fee_rate`, `late_fee_type`, `late_fee_amount`, `late_fee_applied_at`
- Added `payment_terms_id`, `payment_terms_name` columns
- Added `internal_notes` column
- Added `invoice_prefix`, `invoice_sequence` columns

**New API Endpoints:**

Core Endpoints:

- `GET/POST/DELETE /api/invoices/payment-plans` - Template management
- `POST /api/invoices/generate-from-plan` - Generate from template
- `GET/POST /api/invoices/milestone/:id` - Milestone invoices
- `PUT /api/invoices/:id/link-milestone` - Link to milestone
- `GET/POST/DELETE /api/invoices/schedule[d]` - Scheduling
- `GET/POST/PUT/DELETE /api/invoices/recurring` - Recurring patterns
- `POST /api/invoices/recurring/:id/pause|resume` - Pause/resume
- `GET /api/invoices/:id/reminders` - View reminders
- `POST /api/invoices/reminders/:id/skip` - Skip reminder
- `DELETE /api/invoices/:id` - Delete/void invoice
- `POST /api/invoices/:id/duplicate` - Clone invoice
- `POST /api/invoices/:id/record-payment` - Record payment
- `POST /api/invoices/:id/send-reminder` - Manual reminder
- `GET /api/invoices/search` - Search with filters
- `POST /api/invoices/check-overdue` - Manual overdue check

Advanced Endpoints (NEW):

- `GET/POST /api/invoices/payment-terms` - Payment terms presets
- `POST /api/invoices/:id/apply-terms` - Apply terms to invoice
- `PUT /api/invoices/:id/tax-discount` - Update tax/discount
- `GET /api/invoices/:id/late-fee` - Calculate late fee
- `POST /api/invoices/:id/apply-late-fee` - Apply late fee
- `POST /api/invoices/process-late-fees` - Batch process late fees
- `GET /api/invoices/:id/payments` - Payment history
- `POST /api/invoices/:id/record-payment-with-history` - Record with history
- `GET /api/invoices/all-payments` - All payments report
- `GET /api/invoices/aging-report` - A/R aging report
- `PUT /api/invoices/:id/internal-notes` - Update internal notes
- `GET /api/invoices/comprehensive-stats` - Full statistics
- `POST /api/invoices/with-custom-number` - Custom invoice number

**Files Created:**

- `server/database/migrations/028_invoice_enhancements.sql`
- `server/database/migrations/029_invoice_advanced_features.sql`
- `server/services/scheduler-service.ts`

**Files Modified:**

- `server/services/invoice-service.ts` - Added ~35 new methods
- `server/routes/invoices.ts` - Added 25+ new endpoints
- `server/app.ts` - Integrated scheduler service
- `src/types/api.ts` - Added new TypeScript interfaces
- `docs/features/INVOICES.md` - Updated feature documentation
- `docs/API_DOCUMENTATION.md` - Added all new endpoints

---

## Completed - January 31, 2026

### Bug Fixes

**Sidebar Badge Display:**

- Reverted CSS changes that incorrectly applied collapsed sidebar badge styling to expanded sidebar
- Badges now display inline (with text) in expanded sidebar, and as positioned numbers when collapsed
- File: `src/styles/pages/admin.css`

**Deposit Invoice Creation:**

- Fixed missing `client_id` in `/api/admin/leads` SQL query
- Projects loaded from admin dashboard now include `client_id` field
- Deposit invoice creation now works correctly
- File: `server/routes/admin.ts`

**Invoice Credits Table:**

- Created `invoice_credits` table (migration 027 was partially applied)
- Invoice PDF generation now works for deposit invoices
- Added indexes for efficient credit queries

---

## Pending Verification

Recent fixes that need user testing:

### High Priority

- [x] **Deposit Invoice Creation** - VERIFIED January 31, 2026
  - Create deposit invoice from project details
  - PDF preview/download works

- [ ] **Intake PDF Preview** - Test intake JSON files open as branded PDF
  - Navigate to a project with intake form data
  - Click Preview on the JSON file
  - Verify it opens as a branded PDF (not raw JSON)
  - Check logo, headers, and formatting match contract PDFs

- [ ] **Contract PDF Generation** - Test `GET /api/projects/:id/contract/pdf`
  - Navigate to a project with contract data
  - Download contract PDF and verify branding/content

- [ ] **Edit Project Modal Dropdowns** - Verify dropdowns populate on re-open
  - Open Edit Project modal
  - Close without saving
  - Re-open the modal
  - Verify Type and Status dropdowns show correct values

### Medium Priority

- [ ] **Client Budget Display** - Verify budget ranges show proper formatting
  - Navigate to project details in admin
  - Verify budget shows "Under $2k" (not "Under 2k")
  - Verify ranges show en-dashes: "$2k-$5k"

- [ ] **Client Portal Profile Settings** - Test profile update refresh
  - Update contact name, company, or phone in client portal settings
  - Save and verify values refresh immediately (no page reload needed)

- [ ] **Client Portal Project Request** - Test project list refresh
  - Submit a new project request in client portal
  - Verify new project appears in dashboard immediately (no page reload needed)

### Lower Priority

- [ ] **Account Activation Welcome Flow** - Test welcome email + portal message
  - Invite a new client (or use existing pending invitation)
  - Click invitation link and set password
  - Verify welcome email received with "Add Billing Info" CTA
  - Verify system message appears in portal inbox

- [ ] **Client Invitation UX** - Test create client without inviting, then invite later
  - Create a new client in admin (without checking "Send invitation email")
  - Verify "Not Invited" status badge appears with small send icon button next to it
  - Verify same icon button appears on Client Details page next to Status
  - Click the icon button and verify invitation is sent
  - Verify icon button disappears after invitation sent (status updates to "Invited")
  - **January 29 Update:** Changed from purple text button to icon-only button matching `.icon-btn` pattern

---

## Completed - January 30, 2026

### Deposit Invoice & Credit System

**Status:** COMPLETE

Implemented deposit invoices and credit application system for tracking deposits and applying them as credits to subsequent invoices.

**Database Changes (Migration 027):**

- Added `invoice_type` column to invoices ('standard' or 'deposit')
- Added `deposit_for_project_id` and `deposit_percentage` columns
- Created `invoice_credits` table for tracking applied credits
- Added `default_deposit_percentage` column to projects

**Backend Features:**

- Create deposit invoices with percentage tracking
- Get available deposits for a project (paid but not fully applied)
- Apply deposit credit to standard invoices
- Get credits applied to an invoice
- Edit draft invoices (before sending)
- PDF generation shows "DEPOSIT INVOICE" title for deposit type
- PDF shows credit line items and adjusted totals

**Frontend Features (Admin Project Details):**

- Invoice type selection when creating invoices (Standard/Deposit)
- Deposit badge on invoice list items
- Edit button for draft invoices
- Apply Credit button for outstanding invoices
- Credit selection dialog with available deposits

**API Endpoints:**

- `POST /api/invoices/deposit` - Create deposit invoice
- `GET /api/invoices/deposits/:projectId` - Get available deposits
- `POST /api/invoices/:id/apply-credit` - Apply deposit credit
- `GET /api/invoices/:id/credits` - Get credits for invoice
- `PUT /api/invoices/:id` - Edit draft invoices

**Files Modified:**

- `server/database/migrations/027_invoice_deposits.sql` - New migration
- `server/services/invoice-service.ts` - New deposit/credit methods
- `server/routes/invoices.ts` - New endpoints, PDF updates
- `src/features/admin/admin-project-details.ts` - UI for deposits/credits
- `src/features/admin/admin-dashboard.ts` - Exposed delegate methods
- `src/types/api.ts` - New TypeScript types
- `src/utils/confirm-dialog.ts` - Added select field support
- `src/styles/admin/project-detail.css` - Deposit badge styling

---

### PDF Generation & File Naming Overhaul

**Status:** COMPLETE

Replaced PDFKit with pdf-lib for reliable PDF generation, and implemented consistent file naming conventions with NoBhadCodes branding.

**PDF Generation:**

- Switched from PDFKit to pdf-lib for intake PDF generation
- Fixed footer positioning issue (was appearing on page 2)
- Added PDF metadata (title, author, subject) for proper browser tab titles
- Direct URL preview instead of blob URL for proper download filenames

**File Naming Convention:**

- All uploaded files now prefixed with `nobhadcodes_`
- Underscores instead of spaces in filenames
- Uses client name OR company name (company takes priority)
- Timestamp suffix for uniqueness
- Format: `nobhadcodes_{description}_{timestamp}.{ext}`

**Intake Files:**

- JSON files: `nobhadcodes_intake_{client_name}_{date}.json`
- PDF downloads: `nobhadcodes_intake_{client_name}.pdf`

**Project Names:**

- Auto-generated format: `{Company/Client Name} {Type} Site`
- Example: "Hedgewitch Horticulture Business Site" (no dash)

**Files Modified:**

- `server/config/uploads.ts` - Added `sanitizeFilename()` function
- `server/routes/projects.ts` - Rewrote PDF generation with pdf-lib
- `server/routes/intake.ts` - Updated intake file naming
- `server/routes/admin.ts` - Updated admin project file naming
- `src/features/admin/modules/admin-projects.ts` - Direct URL preview for intake PDFs

---

### Complete pdf-lib Migration for All PDFs

**Status:** COMPLETE

Migrated all PDF generation from PDFKit to pdf-lib for consistency and better control. Increased logo size by 50% for better visibility.

**Changes:**

- **Invoice PDF** - Migrated to pdf-lib with 75pt logo
- **Contract PDF** - Migrated to pdf-lib with 75pt logo
- **Intake PDF** - Updated to 75pt logo (already used pdf-lib)
- **Proposal PDF** - Migrated to pdf-lib with 75pt logo
- Removed all PDFKit imports from codebase

**Header Template (all PDFs):**

| Element | Size | Y-Offset |
|---------|------|----------|
| Logo | 75pt height | 0 (preserves aspect ratio) |
| Business Name | 16pt bold | 0 |
| Owner | 10pt | -20pt |
| Tagline | 9pt | -36pt |
| Email | 9pt | -50pt |
| Website | 9pt | -64pt |
| Title | 28pt bold | -25pt (right-aligned) |

**Files Modified:**

- `server/routes/invoices.ts` - Removed PDFKit, uses pdf-lib exclusively
- `server/routes/projects.ts` - Contract PDF now uses pdf-lib
- `server/routes/proposals.ts` - Proposal PDF now uses pdf-lib

**Documentation:**

- Created [PDF_GENERATION.md](./features/PDF_GENERATION.md) - Complete PDF system documentation
- Updated [INVOICES.md](./features/INVOICES.md) - References new PDF docs

---

### Wireframe Preview System

**Status:** COMPLETE (Documentation Only)

Implemented a wireframe preview system using screenshots uploaded via the existing Files system. No code changes required.

**Approach:**

- Use existing file upload and preview infrastructure
- Screenshots of wireframes with naming convention: `{project-slug}_{page}_{tier}.png`
- Use `wf_` or `wireframe_` prefix to group files

**Documentation:**

- Created [WIREFRAMES.md](./features/WIREFRAMES.md) feature documentation

---

## In Progress - January 29, 2026

### Client Invitation Icon Button

**Status:** IMPLEMENTED - Awaiting Verification

Changed the "Invite" button in clients table from purple text button to icon-only button:

**Changes Made:**

- Clients table: Replaced `.btn-invite-inline` with `.icon-btn .icon-btn-invite` (icon-only)
- Added `.status-cell-wrapper` for inline display of status + icon button
- Client Details page: Added invite icon button next to Status field (if not invited)
- Project Details page: Added invite icon button next to Client name (if not invited)
- Icon button disappears once client is invited
- Consistent styling with other admin icon buttons

**Files Modified:**

- `src/features/admin/modules/admin-clients.ts` - Table render + details page
- `src/features/admin/admin-project-details.ts` - Project detail client info
- `src/styles/pages/admin.css` - New `.icon-btn-invite` styles
- `src/styles/admin/project-detail.css` - Positioning for project detail invite button

---

## Known Issues (Unfixed)

*No critical known issues at this time.*

### Recently Fixed

- **Detail Modal Focus Trap** - FIXED January 30, 2026
  - Added `manageFocusTrap()` to detail modal in `admin-dashboard.ts`
  - Proper keyboard navigation (Tab/Shift+Tab cycles through focusable elements)
  - Focus restoration when modal closes
  - Escape key closes modal via focus trap handler

---

## Tiered Proposal Builder - Pending Testing

**Status:** IMPLEMENTED - Awaiting User Testing

### Testing Checklist

- [ ] **Database Migration** - Run migration to create proposal tables
- [ ] **Intake Flow Integration** - Complete intake and verify proposal builder appears
- [ ] **Tier Selection (Step 1)** - Verify tier cards display correctly
- [ ] **Feature Customization (Step 2)** - Verify add-ons work
- [ ] **Maintenance Options (Step 3)** - Verify maintenance cards
- [ ] **Summary & Submit (Step 4)** - Verify final review and submission
- [ ] **Admin Proposals Panel** - Verify admin can manage proposals

---

## Deferred Items

Low-priority items deferred for future work:

### Global Event Listeners - DEFERRED

**Reason:** App is not a true SPA - handlers are added once during init and persist. No hot-reload or navigation-based re-initialization that would cause handler accumulation.

**If Revisited:** Track handler references and remove them during module/component teardown.

### AbortController - DEFERRED

**Reason:** High complexity, requires careful refactoring. Current behavior is stable; race conditions rare in practice.

**If Revisited:** Use `AbortController` to cancel in-flight fetches when newer requests supersede them.

### Form Placeholders - DEFERRED

**Reason:** UX polish task, not functional issue. Forms work correctly.

**If Revisited:** Audit all forms and add descriptive placeholders and format hints.

---

## Backend Features Without Frontend UI

**Analysis Date:** February 2, 2026

The backend has ~250+ API endpoints. The frontend currently uses ~24 of them. This section documents the gap.

### HIGH PRIORITY - Invoice Advanced Features

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Late Fees | `POST /api/invoices/:id/apply-late-fee`, `GET /:id/late-fee`, `POST /process-late-fees` | No UI |
| Credits & Deposits | `POST /:id/apply-credit`, `GET /:id/credits`, `POST /deposit` | No UI |
| Aging Reports | `GET /aging-report`, `GET /comprehensive-stats` | No UI |
| Invoice Reminders | `GET /:id/reminders`, `POST /:id/send-reminder`, `POST /reminders/:id/skip` | No UI |
| Payment Plans | `GET /payment-plans`, `POST /schedule`, `GET /scheduled`, `POST /recurring` | No UI |
| Payment History | `GET /all-payments`, `POST /:id/record-payment-with-history` | No UI |

### HIGH PRIORITY - Client CRM Features

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Health Scoring | `GET /api/clients/:id/health`, `POST /:id/health/recalculate`, `GET /at-risk` | No UI |
| Activity Timeline | `GET /:id/activities`, `POST /:id/activities` | No UI |
| Contact Management | `GET /:id/contacts`, `POST /:id/contacts`, `PUT/DELETE /contacts/:id` | No UI |
| Custom Fields | `GET/POST/PUT/DELETE /custom-fields`, `GET/PUT /:id/custom-fields` | No UI |
| Tags & Segmentation | `GET/POST/PUT/DELETE /tags`, tag assignment endpoints | Partial |
| CRM Fields | `PUT /:id/crm`, `GET /follow-up` | No UI |

### MEDIUM PRIORITY - Analytics Features

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Saved Reports | `GET/POST/PUT/DELETE /api/analytics/reports` | No UI |
| Report Scheduling | `GET/POST/PUT/DELETE /reports/:id/schedules` | No UI |
| Metric Alerts | `GET/POST/PUT/DELETE /alerts`, `POST /alerts/check` | No UI |
| Dashboard Widgets | `GET/POST/PUT/DELETE /widgets`, `PUT /widgets/layout` | No UI |
| KPI Tracking | `POST /kpis/snapshot`, `GET /kpis/latest`, `GET /kpis/:type/trend` | No UI |

### MEDIUM PRIORITY - Lead/Pipeline Features

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Lead Scoring Rules | `GET/POST/PUT/DELETE /api/admin/leads/scoring-rules` | No UI |
| Pipeline Management | `GET /pipeline`, `GET /pipeline/stages`, `POST /:id/move-stage` | Partial |
| Lead Tasks | `GET /tasks/overdue`, `GET /tasks/upcoming`, `POST /:id/tasks` | No UI |
| Lead Notes | `POST /:id/notes`, `POST /notes/:id/toggle-pin` | No UI |
| Conversion Funnel | `GET /conversion-funnel`, `GET /duplicates` | No UI |

### MEDIUM PRIORITY - Proposal Features

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Templates | `GET/POST/PUT/DELETE /api/proposals/templates` | Partial |
| Versioning | `GET /:id/versions`, `POST /:id/versions/:id/restore` | Partial |
| E-Signatures | `POST /:id/request-signature`, `POST /:id/sign` | Partial |
| Comments | `GET/POST/DELETE /comments` | No UI |
| Custom Items | `GET/POST/PUT/DELETE /custom-items`, discount endpoints | No UI |

### LOW PRIORITY - Messaging Features

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Reactions | `POST/DELETE /api/messages/:id/reactions` | No UI |
| Mentions | `GET /mentions`, `POST /:id/mentions`, `GET /mentions/me` | No UI |
| Read Receipts | `GET /:id/read-receipts`, `POST /read-bulk` | No UI |
| Pinning | `POST /:id/pin`, `GET /threads/:id/pinned` | No UI |
| Search | `GET /search` | No UI |

### LOW PRIORITY - File Management Features

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Versioning | `GET /files/:id/versions`, `POST /:id/versions/:id/restore` | Partial |
| Locking | `POST /files/:id/lock`, `POST /:id/unlock` | No UI |
| Access Logs | `GET /files/:id/access-log`, `GET /:id/access-stats` | No UI |
| Expiration | `POST /files/:id/expiration`, `GET /files/expiring-soon` | No UI |

### LOW PRIORITY - Project Analytics

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Velocity | `GET /api/projects/:id/velocity` | No UI |
| Burndown | `GET /:id/burndown` | No UI |
| Time Stats | `GET /:id/time-stats`, `GET /reports/team-time` | No UI |
| Task Dependencies | `POST/DELETE /:id/tasks/:id/dependencies` | No UI |

---

## TODOs

### UI/CSS Fixes

- [x] **Sidebar Badge Clipping** - FIXED January 30, 2026
  - Added `overflow: visible` to sidebar buttons and badges
  - File: `src/styles/pages/admin.css`

- [x] **Project Detail Tabs Not Responsive** - FIXED January 30, 2026
  - Added horizontal scroll on mobile with styled scrollbar
  - Added reduced padding on mobile tabs and tab content
  - File: `src/styles/admin/project-detail.css`

- [x] **Files Table Not Responsive** - FIXED January 30, 2026
  - Added card-style layout on mobile (stacked rows with labels)
  - Added `data-label` attributes to table cells
  - Files: `src/styles/admin/project-detail.css`, `src/features/admin/modules/admin-projects.ts`

### Code Quality

- [ ] **Component Refactoring Opportunities** - Replace manual DOM manipulation with reusable components
  - See: [COMPONENT_REFACTORING_OPPORTUNITIES.md](./COMPONENT_REFACTORING_OPPORTUNITIES.md)

### Features

- [x] **Convert Contact to Client** - IMPLEMENTED January 30, 2026
  - Added `client_id` and `converted_at` columns to `contact_submissions` table (migration 026)
  - Added "Convert to Client" button in contact detail panel
  - Created endpoint `POST /api/admin/contact-submissions/:id/convert-to-client`
  - Sends invitation email when converting
  - Shows "Converted to Client" badge after conversion

- [ ] **Contract E-Signature System** - PARTIAL (UI Complete, Backend Needs Work)
  - Contract tab added to project details with Preview, Download, Request Signature buttons
  - Backend endpoints created: `POST /api/projects/:id/contract/request-signature`, `POST /api/projects/:id/contract/sign`
  - **TODO - Email Integration:**
    - [ ] Integrate email service to send contract signature request emails
    - [ ] Create email template for contract signature requests
    - [ ] Include project name, contract preview link, signature deadline
  - **TODO - Client Signing Page:**
    - [ ] Create client-facing signature page at `/sign-contract/:token`
    - [ ] Capture signature (drawn/typed/uploaded)
    - [ ] Record signer IP address and user agent
  - **TODO - Database:**
    - [ ] Add columns: `contract_signer_name`, `contract_signer_ip`, `contract_signature_data`
    - [ ] Add columns: `contract_signature_token`, `contract_signature_requested_at`, `contract_signature_expires_at`
  - **TODO - Post-Signature:**
    - [ ] Send confirmation email after signing
    - [ ] Add signature audit log
  - **Files:** `server/routes/projects.ts` (lines 1519-1630)

### Main Site (Last Priority)

- [ ] **Projects Section Redesign** - Sal Costa-style portfolio
  - See: `docs/design/salcosta/`
  - Code implementation COMPLETE - just needs assets
  - **Pending Assets:**
    - [ ] Create CRT TV title cards (Looney Tunes style, 4:3 aspect ratio) for `/public/projects/{project-id}-title.png`
    - [ ] Store project screenshots: `{project-id}-hero.webp`, `{project-id}-desktop-1.webp`, etc.
    - [ ] Update `portfolio.json` with heroImage and screenshots paths
    - [ ] Optimize images (WebP format, appropriate sizes)
    - [ ] Create OG images for social sharing (1200x630)

- [ ] **SEO Optimization** - DO NOT DO UNTIL AFTER 2 PROJECTS COMPLETED

---

## Future Plans

### Reference Documents

- [CRM_CMS_DEEP_DIVE.md](./CRM_CMS_DEEP_DIVE.md) - Gap analysis vs state-of-the-art CRM/CMS
- [CLIENT_PORTAL_DEEP_DIVE.md](./CLIENT_PORTAL_DEEP_DIVE.md) - Whole-portal audit
- [TABLES_ARCHIVE_DELETE_AUDIT.md](./TABLES_ARCHIVE_DELETE_AUDIT.md) - Tables, archive & delete audit
- [COMPONENT_REFACTORING_OPPORTUNITIES.md](./COMPONENT_REFACTORING_OPPORTUNITIES.md) - Component refactoring

---

### TIER 0: Quick UX Wins (Admin Portal)

**Status:** Partially Complete - January 29, 2026

**Completed:**

- [x] **Project Status Inline Dropdown** - Replace plain text with dropdown (like leads)
- [x] **Invoice Quick Actions** - "Mark Paid" and "Send Reminder" buttons
- [x] **Lead Convert Button** - "Convert" button for pending/qualified/contacted leads
- [x] **Client Invite Icon Button** - Icon button in table + detail pages for uninvited clients
- [x] **Project Detail Invite Cue** - Invite icon on project detail page for uninvited clients

**Pending (Medium Priority):**

- [ ] **Contact Quick Reply** - Inline "Reply" button opens small modal from contacts table
  - Location: `admin-dashboard.ts` contacts rendering
  - Shows message preview on hover

- [ ] **Client Action Menu** - "..." menu for active clients with Reset Password, Resend Invite, View Projects
  - Location: `admin-clients.ts` table rendering
  - Replace single invite button with menu when status is "Active"

- [ ] **File Batch Operations** - Checkboxes for multi-select + "Download All" button
  - Location: `portal-files.ts`
  - Add checkbox column, batch action bar

**Pending (Lower Priority):**

- [ ] **Milestone Inline Toggle** - Checkbox to mark complete directly from list
  - Location: `admin-project-details.ts` milestone rendering

- [ ] **Visual "Action Required" Badges** - Red/yellow badges for overdue items
  - Show on projects with: overdue milestones, unpaid invoices, unread messages
  - Locations: Project cards, project table, sidebar

- [ ] **Quick Search on Tables** - Search box above each table (leads, projects, clients)
  - Instant filter as you type
  - Preserve existing filter state

---

### TIER 1: Automation & Reminders (Foundation)

**Status:** Partially Complete - February 1, 2026

- [x] **1.1 Scheduled Job System** - COMPLETE February 1, 2026
  - Added `node-cron` for recurring tasks
  - Created `server/services/scheduler-service.ts`
  - Hourly reminder checks, daily invoice generation

- [x] **1.2 Invoice Reminders** - COMPLETE February 1, 2026
  - Auto-send reminder emails for overdue invoices
  - Configurable reminder sequence (3, 7, 14, 30 days overdue)
  - Upcoming payment reminders (3 days before due)

- [ ] **1.3 Contract Reminders**
  - Remind clients to sign contracts
  - Escalation if not signed within X days

- [ ] **1.4 Welcome Sequences**
  - Automated onboarding emails for new clients
  - Introduce portal features, next steps

- [ ] **1.5 Workflow Triggers**
  - Formalize events (`intake.completed`, `proposal.accepted`, etc.)
  - Define actions for each trigger

---

### TIER 2: Client Portal Data & UX (P0 - Fix Placeholders)

**Gap:** Dashboard project cards, stats, and recent activity are STATIC (not API-driven)

- [ ] **2.1 Dashboard from API**
  - Add `GET /api/client/dashboard` endpoint
  - Return project count, pending invoice count, unread message count
  - Replace static project cards with real data
  - Replace static quick stats with real data

- [ ] **2.2 Activity Feed**
  - Aggregate messages, file uploads, project updates, invoice events
  - Replace static "Recent Activity" with real data

- [ ] **2.3 Notification Preferences (API-backed)**
  - Always load/save via `PUT/GET …/me/notifications`
  - Remove sessionStorage-only paths

- [ ] **2.4 Unread Badges**
  - Badges on Messages, Invoices, Files in sidebar
  - Update counts from API

- [ ] **2.5 Knowledge Base**
  - Searchable help (FAQs, how-to) in portal
  - Self-service support

- [ ] **2.6 Client-Facing Timeline**
  - Visual timeline/Gantt view of milestones
  - Show project progress

---

### TIER 3: Messaging & Files

- [ ] **3.1 Thread List / Thread Switcher**
  - List all threads (general + project-specific)
  - Allow switching between threads (currently shows first thread only)

- [ ] **3.2 Real-Time Messages**
  - WebSockets or SSE for new messages
  - Optional toast when not on Messages tab

- [ ] **3.3 Dynamic File Filter**
  - Populate "Files by project" dropdown from API (currently hardcoded)

- [ ] **3.4 Document Requests**
  - Admin requests specific docs from client
  - Client sees "requested" vs "received" status
  - Reminders for missing documents

---

### TIER 4: Payments & Financial

**Status:** Partially Complete - February 1, 2026

- [ ] **4.1 Online Payments (Stripe)**
  - "Pay Now" button on invoices in portal
  - Webhook for payment confirmation

- [x] **4.2 Payment Reminders** - COMPLETE February 1, 2026
  - Automated reminder engine with email
  - Include link to portal invoices
  - Configurable reminder sequence

- [x] **4.3 Deposit / Payment Plans** - COMPLETE January 30, 2026
  - Deposit invoices with percentage tracking
  - Apply deposit credits to standard invoices
  - Payment plan templates (50/50, 30/30/40, etc.) - Added February 1, 2026

- [x] **4.4 Recurring Invoices** - COMPLETE February 1, 2026
  - Weekly, monthly, quarterly frequency options
  - Pause/resume functionality
  - Automated generation via scheduler

---

### TIER 5: Approvals & Documents

- [ ] **5.1 Deliverable Tracking**
  - Draft → Review → Approve / Request Revision workflow
  - Per-deliverable status

- [ ] **5.2 Approval Workflows**
  - Sequential or parallel approvals
  - Due dates and audit trail

- [ ] **5.3 E-Signatures**
  - Contract (and optionally proposal) signing in-portal
  - Integrate provider (DocuSign, Adobe Sign) or lighter widget

---

### TIER 6: Admin Tables & Actions (from TABLES_ARCHIVE_DELETE_AUDIT.md)

**Quick Wins:**

- [ ] **6.1 Proposals Filter** - Add "Rejected" and "Converted" to filter tabs
- [ ] **6.2 Export Per Table** - Wire leads/contacts/projects export into UI (service exists)
- [ ] **6.3 Contact Restore** - "Restore" button when status = archived
- [ ] **6.4 Project Delete in UI** - Delete button using existing `DELETE /api/projects/:id`
- [ ] **6.5 Proposals Search** - Simple client/project name search

**Medium:**

- [ ] **6.6 Pagination UI** - Server-side pagination for large tables
- [ ] **6.7 "Show Archived" Toggle** - Include archived contacts in list
- [ ] **6.8 Bulk Archive** - Row checkboxes + "Archive selected"
- [ ] **6.9 Bulk Delete** - Row selection + bulk delete
- [ ] **6.10 Column Visibility** - Hide/show columns

---

### TIER 7: CRM & Reporting

- [ ] **7.1 Kanban Pipeline View**
  - Visual project/lead pipeline
  - Drag-and-drop status changes

- [ ] **7.2 Business Metrics Dashboard**
  - Revenue, pipeline, active projects, client counts
  - Pipeline value + conversion rates

- [ ] **7.3 Client Health Metrics**
  - Payment behavior, response time, engagement

- [ ] **7.4 Lead Scoring**
  - Score leads from behavior and attributes
  - Prioritize outreach

---

### TIER 8: Integrations & API

- [ ] **8.1 Webhooks**
  - Outbound events (`project.status_changed`, `invoice.paid`, etc.)
  - Enable Zapier, internal tools

- [ ] **8.2 Public API**
  - Documented REST API for clients, projects, invoices
  - Enables integrations and automation

- [ ] **8.3 Third-Party Integrations**
  - Email (Gmail/Outlook)
  - Calendar
  - Accounting (QuickBooks/Xero)

---

### TIER 9: Security & Polish

- [ ] **9.1 MFA / 2FA**
  - Two-factor authentication for admin and client

- [ ] **9.2 SSO**
  - Single sign-on integration

- [ ] **9.3 Virtual Tour / Walkthrough**
  - First-time user onboarding in portal

- [ ] **9.4 Visual Proofing & Annotations**
  - Annotations on preview iframe
  - "Request changes" from preview

- [ ] **9.5 Profile Refresh After Save**
  - Update header/sidebar name immediately after profile save

---

### Component Refactoring (from COMPONENT_REFACTORING_OPPORTUNITIES.md)

**Status:** Focus trap complete, button/modal refactoring deferred

**Completed:**

- [x] Replace `alert()` with `showToast()` and `alertDialog()` utilities
- [x] Replace `prompt()` with `multiPromptDialog()` utility
- [x] Add `manageFocusTrap()` to detail modal in `admin-dashboard.ts` - January 30, 2026

**Deferred (Low Priority):**

- [ ] Replace manual button creation with `ButtonComponent` (5 files, 10+ instances)
  - **Reason:** Buttons use specific classes and structures (status dots, carets) tightly coupled to dropdown/chat systems. Refactoring carries risk of breaking existing functionality with marginal benefit.
- [ ] Replace manual modal handling with `ModalComponent` (2 files, 3 instances)
  - **Reason:** Existing modals work correctly. Full refactor would require updating HTML templates and all content injection code.

---

## Reference

### Files Modified Today (February 1, 2026)

**Invoice System Enhancement:**

- `server/database/migrations/028_invoice_enhancements.sql` - NEW: Payment plans, reminders, scheduling, recurring tables
- `server/services/scheduler-service.ts` - NEW: Background job service with node-cron, auto-overdue check
- `server/services/invoice-service.ts` - Added ~30 new methods for all invoice features
- `server/routes/invoices.ts` - Added 20+ new API endpoints
- `server/app.ts` - Integrated scheduler service with graceful shutdown
- `src/types/api.ts` - Added TypeScript interfaces for new features

**Frontend Integration:**

- `src/features/admin/admin-project-details.ts` - Added duplicate, delete, record payment UI
- `src/features/admin/admin-dashboard.ts` - Added delegate methods for new invoice actions

**Documentation:**

- `docs/API_DOCUMENTATION.md` - Added all new invoice endpoints
- `docs/features/INVOICES.md` - Added new features, scheduler service, database schema
- `docs/current_work.md` - Updated completed work and tier progress

---

### Files Modified (January 31, 2026)

**Bug Fixes:**

- `src/styles/pages/admin.css` - Reverted sidebar badge styling (show inline in expanded sidebar)
- `server/routes/admin.ts` - Added `client_id` to `/api/admin/leads` SQL query
- `server/routes/invoices.ts` - Added error logging for PDF generation
- `server/services/invoice-service.ts` - Removed debug logging
- `src/features/admin/modules/admin-projects.ts` - Removed debug logging, added clientId validation

**Database:**

- Created `invoice_credits` table manually (migration 027 was partially applied)
- Created indexes `idx_invoice_credits_invoice` and `idx_invoice_credits_deposit`

---

### Files Modified (January 30, 2026)

**Deposit Invoice & Credit System:**

- `server/database/migrations/027_invoice_deposits.sql` - New migration for deposit tracking
- `server/services/invoice-service.ts` - Added deposit/credit methods
- `server/routes/invoices.ts` - New endpoints, PDF updates for deposits/credits
- `src/features/admin/admin-project-details.ts` - UI for deposit invoices and credits
- `src/features/admin/admin-dashboard.ts` - Exposed delegate methods for invoice actions
- `src/types/api.ts` - Added InvoiceCreditResponse, DepositSummaryResponse types
- `src/utils/confirm-dialog.ts` - Added select field support to multiPromptDialog
- `src/styles/admin/project-detail.css` - Added deposit badge styling

**UI/CSS Responsive Fixes:**

- `src/styles/admin/project-detail.css` - Added responsive media queries for tabs, files table, overview grids
- `src/features/admin/modules/admin-projects.ts` - Added `data-label` attributes to files table cells for mobile
- `src/styles/pages/admin.css` - Fixed sidebar badge clipping with `overflow: visible`

**PDF Generation & File Naming:**

- `server/config/uploads.ts` - Added `sanitizeFilename()` with NoBhadCodes branding
- `server/routes/projects.ts` - Rewrote intake PDF generation with pdf-lib
- `server/routes/intake.ts` - Updated intake file naming with client/company name
- `server/routes/admin.ts` - Updated admin project file naming
- `src/features/admin/modules/admin-projects.ts` - Direct URL preview for proper download filenames
- `src/features/admin/modules/admin-leads.ts` - Changed Convert button to icon button

**Accessibility - Focus Trap:**

- `src/features/admin/admin-dashboard.ts` - Added `manageFocusTrap()` to detail modal for proper keyboard navigation and focus restoration

---

### Files Modified (January 29, 2026)

**Intake PDF Feature:**

- `server/routes/projects.ts` - Added `GET /api/projects/:id/intake/pdf` endpoint
- `src/features/admin/modules/admin-projects.ts` - Updated `openFilePreview()` to detect intake files

**Edit Modal Fix:**

- `src/features/admin/modules/admin-projects.ts` - Fixed class name check from `modal-dropdown` to `custom-dropdown`

**Elastic Bounce Fix:**

- `src/styles/shared/portal-layout.css` - Added `overscroll-behavior: none` to html/body for admin and client portal

**Client Invitation Icon Button:**

- `src/features/admin/modules/admin-clients.ts` - Changed invite button to icon-only, added to details page
- `src/features/admin/admin-project-details.ts` - Added invite icon button next to client name
- `src/styles/pages/admin.css` - Added `.icon-btn-invite` and `.status-cell-wrapper` styles
- `src/styles/admin/project-detail.css` - Positioning for project detail invite button

**CSS Pattern Compliance:**

- `src/features/admin/modules/admin-messaging.ts` - Replaced hardcoded `#666` with `var(--portal-text-muted)`
- `src/features/admin/admin-dashboard.ts` - Replaced hardcoded `#666` with `var(--portal-text-muted)`

**UX Improvements - Inline Actions:**

- `src/features/admin/modules/admin-projects.ts` - Added inline status dropdown (like leads table)
- `src/features/admin/admin-project-details.ts` - Added "Mark Paid" and "Send Reminder" invoice buttons
- `src/features/admin/admin-dashboard.ts` - Added delegate methods for invoice actions
- `src/features/admin/modules/admin-leads.ts` - Added "Convert" button for qualified leads
- `src/utils/table-dropdown.ts` - Added PROJECT_STATUS_OPTIONS
- `admin/index.html` - Added Actions column to leads table
