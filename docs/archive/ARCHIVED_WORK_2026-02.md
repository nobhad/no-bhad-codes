# Archived Work - February 2026

This file contains completed work from February 2026. Items are moved here from `../current_work.md` once fully verified and operational.

---

## Completed - February 2, 2026

### Analytics Advanced Features UI

**Status:** COMPLETE

Added frontend UI for advanced analytics features including scheduled reports and metric alerts.

**New Features:**

- Create Report dialog with name, type, description fields
- Schedule Report dialog for automated report generation
- Scheduled reports list with enable/disable and delete actions
- Metric Alerts section with create, toggle, and delete
- Alert configuration: metric type, condition, threshold, notification

**Files Modified:**

- `admin/index.html` - Added scheduled reports and metric alerts sections
- `src/features/admin/modules/admin-analytics.ts` - Added CRUD for reports, schedules, alerts
- `src/styles/admin/analytics.css` - Added alerts list styling

---

### Invoice Advanced Features UI

**Status:** COMPLETE

Added frontend UI for advanced invoice features.

**New Features:**

- Apply Late Fees button to process overdue invoices
- Schedule Invoice dialog for future invoice generation
- Setup Recurring dialog for recurring invoice patterns
- Scheduled invoices list with cancel action
- Recurring invoices list with pause/resume actions

**Files:**

- `admin/index.html` - Payment Plans & Recurring section
- `src/features/admin/admin-project-details.ts` - Handlers and UI
- `src/styles/admin/project-detail.css` - Scheduling/recurring styles

---

### Client CRM Details UI

**Status:** COMPLETE

Added CRM Details and Custom Fields sections to client overview.

**New Features:**

- CRM Details section: Industry, Company Size, Acquisition Source, Website, Last Contact, Next Follow-up
- Edit CRM dialog with dropdown selections
- Custom Fields section displaying client-specific field values
- Edit Custom Fields dialog with dynamic field types

**Files:**

- `admin/index.html` - CRM and Custom Fields sections
- `src/features/admin/modules/admin-client-details.ts` - Load/render/edit functions

---

### Client CRM Table Enhancements

**Status:** COMPLETE

Added health score badges and tags display to client table.

**Changes:**

- Updated `GET /api/clients` to return `health_score` and `tags` for each client
- Added Health column to clients table with color-coded badges (green/yellow/red)
- Display client tags as pill badges under client name
- Updated Client interface with CRM fields

**Files:**

- `server/routes/clients.ts` - Updated query to include health and tags
- `src/features/admin/modules/admin-clients.ts` - Table rendering
- `admin/index.html` - Added Health column header

---

### Contract E-Signature System

**Status:** COMPLETE

Implemented complete contract e-signature system with client-facing signing page, email notifications, and audit logging.

**Frontend:**

- Contract tab in project details with Preview, Download, Request Signature buttons
- Status card showing signed/not signed status
- Signature details card (shown when signed)

**Backend Endpoints:**

- `GET /api/projects/:id/contract/pdf` - Generate contract PDF
- `POST /api/projects/:id/contract/request-signature` - Request client signature (sends email)
- `GET /api/projects/contract/by-token/:token` - Public: get contract details
- `POST /api/projects/contract/sign-by-token/:token` - Public: sign contract
- `GET /api/projects/:id/contract/signature-status` - Get signature status

**Client Signing Page:**

- `/public/sign-contract.html` - Canvas-based signature capture
- Records signer name, email, IP, user agent
- Validates token expiration
- Prevents duplicate signing

**Database (Migration 037):**

- Signature tracking columns on `projects` table
- `contract_signature_log` audit table

**Files:**

- `server/database/migrations/037_contract_signatures.sql`
- `server/routes/projects.ts`
- `public/sign-contract.html`
- `admin/index.html` - Contract tab
- `src/features/admin/admin-project-details.ts` - Contract tab logic
- `src/styles/admin/project-detail.css` - Contract tab styling

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

### Frontend Integration Plan - VERIFIED COMPLETE

**Status:** All 7 phases verified complete on February 2, 2026.

**Phases (All Complete):**

1. [x] **Phase 1: Client CRM UI** - Health badges, tags, contacts, activity, notes tabs
2. [x] **Phase 2: Project Tasks & Time Tracking UI** - Kanban/List views, time entries, charts
3. [x] **Phase 3: Proposal Enhancements UI** - Templates, versions, e-signatures
4. [x] **Phase 4: Lead Pipeline UI** - Pipeline Kanban with drag-and-drop, scoring
5. [x] **Phase 5: Enhanced Messaging UI** - Reactions, pinning, read receipts
6. [x] **Phase 6: File Management UI** - Folders, versions, comments
7. [x] **Phase 7: Analytics Dashboard UI** - KPI cards, revenue/status charts, reports

**Key Frontend Modules:**

- `src/features/admin/modules/admin-client-details.ts` - Client CRM tabs
- `src/features/admin/modules/admin-tasks.ts` - Task management
- `src/features/admin/modules/admin-time-tracking.ts` - Time entries
- `src/features/admin/modules/admin-leads.ts` - Lead pipeline
- `src/features/admin/modules/admin-files.ts` - File management
- `src/features/admin/modules/admin-messaging.ts` - Enhanced messaging
- `src/features/admin/modules/admin-proposals.ts` - Proposal management
- `src/features/admin/modules/admin-analytics.ts` - Analytics dashboard

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

## Completed - February 3, 2026

### Lead Panel UX Improvements

- **Status position** — Status badge and label moved above tabs in lead details panel; spacing tightened with `.panel-status-row` in `leads-pipeline.css`.
- **Project name clickable** — Project name in lead panel and table row now links to project details page when lead status is `in-progress` or `converted` (not just `converted`). Updated condition in `admin-leads.ts`.
- **Removed "View Project" button** — Project name link is sufficient; removed redundant button from lead details template.

### Table Icon Buttons

Converted all table action columns from text buttons to icon buttons for consistency:

- **Time Tracking** (`admin-time-tracking.ts`) — Edit/Delete buttons → icon buttons
- **Knowledge Base** (`admin-knowledge-base.ts`) — Edit/Delete buttons for categories and articles → icon buttons
- **Document Requests** (`admin-document-requests.ts`) — View/Start review/Approve/Reject/Remind/Delete → icon buttons

Added CSS variants in `admin.css`:

- `.icon-btn.icon-btn-danger:hover` — red hover state for destructive actions
- `.icon-btn.icon-btn-success:hover` — green hover state for approve actions

### Card Grid Consistency Fix

Fixed inconsistent card grid behavior where 4-card grids (`.quick-stats`, `.attention-grid`) would sometimes display as 3+1 instead of 4 across → 2×2 → 1 column.

- **Root cause:** `.attention-grid` was missing from responsive media query overrides in `admin.css`
- **Fix:** Added `.attention-grid` to all three responsive breakpoints (1200px, 1024px, 768px) alongside `.quick-stats`
- All 4-card grids now behave identically across the portal

### Dropdown Overflow Fix

Added overflow handling for project/client detail header dropdowns:

- `detail-header.css` — Added `overflow: visible; position: relative; z-index: 10;` to `.detail-title-row`
- `detail-header.css` — Added `overflow: visible; position: relative;` to `.detail-actions`

### Field Label Color Consistency

Updated all field labels on dark backgrounds to use `--portal-text-secondary` variable for consistent styling:

- **Root fix** — Changed `--label-color` in `variables.css` from `var(--color-gray-400)` to `var(--portal-text-secondary)`
- **Removed light theme rule** — Deleted unused `[data-theme="light"] .field-label` rule from `form-fields.css`
- **High specificity overrides** — Added `[data-page="admin"]` and `[data-page="client-portal"]` prefixes to field label rules in `project-detail.css`
- **Span exclusion** — Updated broad `#tab-project-detail span` color rule to exclude `.field-label` and `.meta-label` classes

### Table Alignment & Consistency Fixes

**Checkbox column alignment:**

- Increased `.bulk-select-cell` width from 44px to 56px
- Changed left padding to match text columns: `var(--space-4)` (32px)
- Updated bulk toolbar grid from 44px to 56px to match

**Invoices table checkbox column:**

- Added checkbox column header to invoices table HTML
- Updated `admin-invoices.ts` to render checkboxes in each row using `getPortalCheckboxHTML`
- Updated colspan from 7 to 8

**Table header alignment:**

- Changed `.admin-table-header` padding from `var(--space-2) var(--space-5)` to `var(--space-3) var(--space-4)` to align with table cell padding

**Table border radius (root fix):**

- Added `border-bottom-radius` and `overflow: hidden` to `.admin-table-container` by default
- When pagination follows, border-radius is removed via `:has(.table-pagination)` selector

### Files Modified (Feb 3)

- `src/features/admin/modules/admin-leads.ts` — Project name link, status position
- `src/features/admin/modules/admin-time-tracking.ts` — Icon buttons
- `src/features/admin/modules/admin-knowledge-base.ts` — Icon buttons
- `src/features/admin/modules/admin-document-requests.ts` — Icon buttons
- `src/features/admin/modules/admin-invoices.ts` — Checkbox column, colspan updates
- `src/styles/admin/leads-pipeline.css` — Status row styling
- `src/styles/pages/admin.css` — Icon button variants, card grid fixes, table alignment, border radius
- `src/styles/admin/detail-header.css` — Dropdown overflow fixes
- `src/styles/admin/table-features.css` — Bulk toolbar grid width
- `src/styles/variables.css` — Label color variable
- `src/styles/components/form-fields.css` — Field label rules
- `src/styles/admin/project-detail.css` — Field label specificity fixes
- `src/styles/admin/client-detail.css` — Field label color updates
- `admin/index.html` — Invoices table checkbox header

---

## Completed - February 5, 2026

### Table Audit Documentation

**Status:** COMPLETE

Created and updated comprehensive `docs/design/TABLE_AUDIT.md` with all 18 tables. Added UI display names (e.g., "Intake Submissions", "Client Accounts", "Contact Form Submissions"), exact `<th>` header text, HTML source locations, TypeScript module paths, nav tab identifiers. Added 3 previously missing tables: Visitors (Analytics), Project Detail Files sub-table, Project Detail Invoices sub-table. Fixed column discrepancies in Proposals and Document Requests. Added Display Name Reference quick-lookup section and Table Header Quick Reference.

---

### Table Audit Column Order Reference

**Status:** COMPLETE

Added comprehensive "Column Order Reference (All Tables)" section to TABLE_AUDIT.md with numbered columns for all 14 tables showing exact left-to-right display order, header names, and data sources. Replaces the previous condensed text format with clear numbered tables for each: Leads, Clients, Contacts, Projects, Invoices, Proposals, Time Tracking, Document Requests, KB Categories, KB Articles, Visitors, Project Files, Project Invoices, and Tasks List View.

---

### Cross-Module Consistency Standardization

**Status:** COMPLETE

Standardized notification and variable naming patterns across all admin modules for consistency.

**Notifications Standardized to `showToast()`:**

- `admin-document-requests.ts`: Replaced all `alertSuccess()`/`alertError()` with `showToast()`
- `admin-knowledge-base.ts`: Replaced all `alertSuccess()`/`alertError()`/`ctx.showNotification()` with `showToast()`
- `admin-contacts.ts`: Replaced all `ctx.showNotification()`/`storedContext.showNotification()` with `showToast()`
- `admin-clients.ts`: Replaced all `ctx.showNotification()`/`storedContext?.showNotification()` with `showToast()`

**Variable Naming Standardized (removed prefixes):**

- `admin-document-requests.ts`: `drFilterState` → `filterState`, `drPaginationState` → `paginationState`, `drFilterUIContainer` → `filterUIContainer`
- `admin-knowledge-base.ts`: `kbFilterState` → `filterState`, `kbArticlesPaginationState` → `paginationState`, `kbFilterUIContainer` → `filterUIContainer`

**Files Modified:**

- `src/features/admin/modules/admin-document-requests.ts`
- `src/features/admin/modules/admin-knowledge-base.ts`
- `src/features/admin/modules/admin-contacts.ts`
- `src/features/admin/modules/admin-clients.ts`

---

### Table Column Order Analysis

**Status:** COMPLETE

Comprehensive analysis of all 14 admin tables verifying column headers match data sources.

**Created:** `docs/design/TABLE_COLUMN_ANALYSIS.md` - Full analysis document

**Discrepancies Fixed in TABLE_AUDIT.md:**

- **Tasks List View**: Removed non-existent Checklist column (6→5 cols), fixed header "Title"→"Task", corrected column order (Due Date before Assignee)
- **Project Files**: Fixed Actions from "Download + Delete" to "Preview (conditional) + Download"
- **Project Invoices**: Fixed Actions from "View + Edit" to full list of 5 conditional buttons

**Naming Inconsistency Documented:**

- Document Requests uses "Due" while all other tables use "Due Date"

**Verified All Tables Match:** Leads, Clients, Contacts, Projects, Invoices, Proposals, Time Tracking, Document Requests, KB Categories, KB Articles, Visitors

---

### Cross-Table Consistency Fix

**Status:** COMPLETE

Implemented comprehensive standardization across all admin dashboard tables based on TABLE_AUDIT.md findings.

**Phase 1 - Fixed Dead/Orphaned UI:**

- Wired Leads export button to `exportToCsv()` with LEADS_EXPORT_CONFIG
- Wired Invoices bulk actions (Mark Paid, Send, Delete) with checkbox selection

**Phase 2-4 - Shared Infrastructure:**

- Invoices: Added filter UI (`createFilterUI`), pagination, replaced custom export with shared utility
- Proposals: Replaced custom filter buttons with `createFilterUI()`, added sortable headers
- Time Tracking: Replaced custom CSV export with shared `exportToCsv()` utility

**Phase 5 - HTML Structure Normalization:**

- Renamed tbody IDs: `dr-tbody` → `document-requests-table-body`, `kb-categories-tbody` → `kb-categories-table-body`, `kb-articles-tbody` → `kb-articles-table-body`
- Fixed KB localStorage key: `admin_kb_filter` → `admin_knowledge_base_filter`
- Added loading placeholder rows to Document Requests, KB Categories, KB Articles

**Phase 6 - Toolbar Standardization:**

- Reordered buttons: Search → Filter → View Toggle → Export → Refresh → Add (last)
- Standardized labels: "Create Invoice" → "Add Invoice", "New request" → "Add Request"
- Wrapped SVGs in `<span class="icon-btn-svg">` for consistency

**Phase 8-9 - State Standardization:**

- Empty state messages: "No {entity} yet." (zero data) / "No {entity} match the current filters." (filtered empty)
- Loading states: Added `showTableLoading()` to admin-leads.ts and admin-contacts.ts

**Phase 10 - Added Pagination:**

- Document Requests: Added pagination with `createPaginationUI()`
- KB Articles: Added pagination with `createPaginationUI()`

**Phase 11 - Filter Config Consistency:**

- Added `email` to Projects filter searchFields
- Added `contact_name` to Clients filter searchFields
- Documented intentional camelCase in Proposals config (API returns camelCase)

**Final Fixes:**

- Proposals: Added pagination (`createPaginationUI`, pagination state, container)
- Document Requests: Added sortable headers (`createSortableHeaders`)
- Projects: Wired export button to `exportToCsv()`
- Empty values: Updated `formatDisplayValue()` to return `-` instead of blank
- Proposals: Changed `btn-icon` to `icon-btn` class, added row click navigation
- Leads: Changed 14px icons to 16px for consistency

**Files Modified:**

- `admin/index.html`
- `src/features/admin/modules/admin-leads.ts`
- `src/features/admin/modules/admin-contacts.ts`
- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/modules/admin-clients.ts`
- `src/features/admin/modules/admin-invoices.ts`
- `src/features/admin/modules/admin-proposals.ts`
- `src/features/admin/modules/admin-time-tracking.ts`
- `src/features/admin/modules/admin-document-requests.ts`
- `src/features/admin/modules/admin-knowledge-base.ts`
- `src/utils/table-filter.ts`
- `src/utils/table-export.ts`
- `docs/design/TABLE_AUDIT.md`

---

### PDF Generation Audit & High Priority Fixes

**Status:** COMPLETE

Completed comprehensive PDF_AUDIT.md documentation and resolved all high priority issues.

**Added Missing Documentation:**

- Contract PDF endpoint (`GET /api/projects/:id/contract/pdf`) - was completely undocumented
- Contract signature request system (token generation, email notification, audit logging)
- PDF metadata settings (`setTitle`, `setAuthor`, `setSubject`, `setCreator`)
- IntakeDocument interface and helper functions with exact mapping values
- Line items table structure and column positions for Invoice PDF
- Page constants and font sizes for markdown-to-pdf script
- Code line counts for all PDF-generating files

**High Priority Fixes Applied:**

- **Consolidated BUSINESS_INFO**: Created `server/config/business.ts` as single source of truth
- **Removed unused pdfkit**: Removed `pdfkit` and `@types/pdfkit` from package.json (only pdf-lib used)
- **Fixed inconsistent website default**: All files now use `nobhad.codes`
- **Updated environment.ts**: Added missing fields (BUSINESS_OWNER, BUSINESS_TAGLINE, ZELLE_EMAIL)
- Deposit invoice title: Changed from "DEPOSIT INVOICE" to "INVOICE"

**Medium Priority Fixes Applied:**

- **Line item word wrapping**: Invoice bullet point details now wrap within column bounds
- **Centralized logo loading**: Added `getPdfLogoBytes()` with fallback paths to business.ts
- **Contract terms configurable**: Moved to `CONTRACT_TERMS` in business.ts (env override: `CONTRACT_TERMS`)

**Files Modified:**

- `server/config/business.ts` - Centralized business info, logo helper, contract terms
- `server/config/environment.ts` - Added missing business fields to schema
- `server/routes/invoices.ts` - Word-wrapped details, centralized logo, shared config
- `server/routes/proposals.ts` - Centralized logo, shared config
- `server/routes/projects.ts` - Centralized logo, contract terms from config
- `server/services/invoice-service.ts` - Import from shared config
- `scripts/markdown-to-pdf.ts` - Updated defaults to match shared config
- `package.json` - Removed pdfkit and @types/pdfkit
- `docs/design/PDF_AUDIT.md` - Comprehensive documentation update

---

### Admin UI Fixes

**Status:** COMPLETE

Fixed dropdown alignment and sidebar order issues.

**Changes:**

- **Dropdown alignment**: Table dropdowns now align left with trigger (`left: 0; right: auto; min-width: 100%`)
- **Dropdown overflow**: Changed `.admin-table-container` from `overflow: hidden` to `overflow: visible` so dropdowns overlay table
- **Sidebar order**: Reordered to logical grouping: DASHBOARD, LEADS, PROJECTS, CLIENTS, INVOICES, MESSAGES, DOCUMENTS, KNOWLEDGE, ANALYTICS, SYSTEM

**Files Modified:**

- `src/styles/shared/portal-dropdown.css` - Dropdown menu positioning
- `src/styles/pages/admin.css` - Dropdown positioning and table overflow
- `admin/index.html` - Sidebar button order

---

## Completed - February 6, 2026

### Error Handling Audit

**Status:** COMPLETE

Comprehensive audit of error handling patterns across the codebase (641 try/catch blocks total).

**Created:** `docs/design/ERROR_HANDLING_AUDIT.md`

**Issues Found & Fixed:**

- Fixed suppressed errors in `admin-system-status.ts` (4 blocks) - added console.error with module context
- Fixed suppressed errors in `admin-client-details.ts` (10 blocks) - added console.error with module context
- Fixed silent catch in `admin-auth.ts:146` - added console.warn for legacy session validation
- Fixed silent catch in `auth-store.ts:392` - added console.warn for logout API failure

**Error Logging Standards Established:**

- All catch blocks must log errors with `console.error('[ModuleName]', error)` or `console.warn` for expected failures
- Module context prefix `[ModuleName]` required for all error logs
- User-facing errors must show toast notification

**Files Modified:**

- `src/features/admin/modules/admin-system-status.ts`
- `src/features/admin/modules/admin-client-details.ts`
- `src/features/admin/admin-auth.ts`
- `src/auth/auth-store.ts`
- `docs/design/ERROR_HANDLING_AUDIT.md` (new)

---

### Messages Page Color Fix

**Status:** COMPLETE

Fixed white text on light background issue in messages page.

**Root Cause:** `--color-neutral-*` variables invert in dark theme (900 becomes light), causing white-on-white text.

**Fix:** Changed all text colors from `--color-neutral-*` to `--color-gray-*` which maintains proper contrast in all themes.

**Elements Fixed:**

- Thread list header, items, contact, preview, time
- Message content, body, sender, time
- Search input (added dark background with light text)

**Files Modified:**

- `src/styles/shared/portal-messages.css`

---

### TABLE_COLUMN_ANALYSIS Merged into TABLE_AUDIT

**Status:** COMPLETE

Merged content from TABLE_COLUMN_ANALYSIS.md into TABLE_AUDIT.md to consolidate documentation.

**Sections Added:**

- Column Verification Summary
- Column Count Quick Reference table
- Naming Conventions reference

**Files Modified:**

- `docs/design/TABLE_AUDIT.md`

**Files Deleted:**

- `docs/design/TABLE_COLUMN_ANALYSIS.md`

---

### PDF Caching & Utilities

**Status:** COMPLETE

Added in-memory PDF caching and utility functions for all PDF endpoints.

**New File Created:**

- `server/utils/pdf-utils.ts` — Shared utilities for PDF generation

**Caching Implementation:**

- TTL-based in-memory cache (default 5 minutes, configurable via `PDF_CACHE_TTL_MS`)
- LRU eviction when max entries reached (default 100, configurable via `PDF_CACHE_MAX_ENTRIES`)
- Cache key format: `{type}:{id}:{updatedAt}` — auto-invalidates when source data changes
- Response header `X-PDF-Cache: HIT|MISS` for debugging

**Utility Functions Added:**

- `getPdfCacheKey()`, `getCachedPdf()`, `cachePdf()`, `invalidatePdfCache()`, `clearPdfCache()`
- Multi-page helpers: `createPdfContext()`, `ensureSpace()`, `drawWrappedText()`, `addPageNumbers()`
- PDF/A metadata: `setPdfMetadata()` with title, author, subject, keywords, dates

**Endpoints Updated:**

- `GET /api/invoices/:id/pdf` — Invoice PDF with caching
- `GET /api/proposals/:id/pdf` — Proposal PDF with caching
- `GET /api/projects/:id/contract/pdf` — Contract PDF with caching
- `GET /api/projects/:id/intake/pdf` — Intake PDF with caching

**Files Modified:**

- `server/routes/invoices.ts` — Added pdf-utils import and caching
- `server/routes/proposals.ts` — Added pdf-utils import and caching
- `server/routes/projects.ts` — Added pdf-utils import and caching
- `docs/design/PDF_AUDIT.md` — Updated with PDF Utilities section, marked issues resolved

---

### CSS Architecture Audit

**Status:** COMPLETE

Comprehensive audit of 83 CSS files (33,555 lines).

**Created:** `docs/design/CSS_AUDIT.md`

**Current State:**

| Metric | Status |
| -------- | -------- |
| Hardcoded colors | 0 critical (3 acceptable fallbacks) |
| Z-index values | All portal files use `--z-index-portal-*` tokens |
| Standard breakpoints | All use `@custom-media` (`--mobile`, `--small-mobile`) |
| `.hidden` selector | Single source in `base/layout.css` |
| `.password-toggle` | Base styles in `shared/portal-forms.css` |
| `!important` declarations | 51 instances (most legitimate for GSAP/print) |

**Remaining (lower priority):**

- Non-standard breakpoints (900px, 1024px, 1300px) need evaluation
- Large files: `admin.css` (2,922 lines), `project-detail.css` (2,127 lines)
- Duplicate utility classes (`.text-*`, `.overview-grid`)

---

### Modals & Dialogs Audit

**Status:** COMPLETE

Comprehensive audit of all modals, dialogs, and overlay components.

**Created:** `docs/design/MODALS_AUDIT.md`

**Findings:**

- 7 modal implementation types
- 47+ files with modal code
- 20+ confirm/alert dialog instances
- 15+ form modal instances
- 3 z-index layers (9999, 10002, 10100)

**Modal Types:**

- ModalComponent (base class)
- PortalModal (lightweight factory)
- ConfirmDialog (Promise-based utilities)
- FocusTrap (accessibility utilities)
- ModalDropdown (select converter)
- Invoice modals (feature-specific)
- Admin module modals (dynamic)

---

### Forms Audit

**Status:** COMPLETE

Comprehensive audit of all forms, validation patterns, and accessibility.

**Created:** `docs/design/FORMS_AUDIT.md`

**Findings:**

- 9 major HTML forms across the codebase
- 11 field types (text, email, password, tel, number, date, url, checkbox, radio, textarea, select)
- 30+ validation functions in 3 layers (HTML5, client-side, server-side)
- 10 pre-defined validation schemas
- 7 CSS files dedicated to form styling

---

### Database Schema Audit

**Status:** COMPLETE

Comprehensive audit of database tables, relationships, and indexes.

**Created:** `docs/design/DATABASE_AUDIT.md`

**Statistics:**

- 44+ tables across 47 migrations
- 600+ columns total
- 180+ indexes
- 60+ foreign key relationships

---

### Form Label Associations Fix

**Status:** COMPLETE

Fixed accessibility issue from Forms Audit.

- Fixed missing label association in `admin/index.html` line 2067
- Added `<label for="file-comment-input" class="sr-only">` and `aria-label` to file comment textarea
- All other forms already had proper associations

---

### Audit Critical & High Priority Fixes

**Status:** COMPLETE

Implemented fixes for all critical and high priority issues from the database, forms, and modals audits.

**Phase 1 - Database Critical Fixes:**

- Removed deprecated `users` table and dead code
  - Deleted unused `/auth/register` endpoint from `api.ts`
  - Fixed avatar upload to use `clients` table instead of `users`
  - Fixed status metrics endpoint to query `clients` instead of `users`
  - Deleted unused `server/models/User.ts`
  - Created migration `048_drop_deprecated_users_table.sql`
- Fixed project status CHECK constraint
  - Created migration `049_fix_project_status_constraint.sql`
  - Added 'active' and 'cancelled' to allowed status values

**Phase 2 - Database High Priority Fixes:**

- Fixed boolean handling in `row-helpers.ts`
  - Updated `getBoolean()` and `getBooleanOrNull()` to handle SQLite's 0/1 representation
  - Removed unused `sqliteBoolToJs/jsBoolToSqlite` from `database.ts`

**Phase 3 - Forms High Priority Fixes:**

- Created reusable password toggle component
  - New file: `src/components/password-toggle.ts`
  - Features: icon updates (eye/eye-off), ARIA labels, `initPasswordToggle()` and `initAllPasswordToggles()`
  - Updated `admin-login.ts` to use new component
  - Updated `client/set-password.html` with toggle buttons and component import
  - Exported from `src/components/index.ts`

**Files Modified:**

- `server/routes/api.ts` - Removed dead registration code, fixed status metrics
- `server/routes/uploads.ts` - Fixed avatar upload table reference
- `server/database/row-helpers.ts` - Fixed boolean handling
- `server/types/database.ts` - Removed unused boolean helpers
- `src/features/main-site/admin-login.ts` - Use password toggle component
- `client/set-password.html` - Added toggle buttons, use component
- `src/components/index.ts` - Export password toggle

**Files Created:**

- `server/database/migrations/048_drop_deprecated_users_table.sql`
- `server/database/migrations/049_fix_project_status_constraint.sql`
- `src/components/password-toggle.ts`

**Files Deleted:**

- `server/models/User.ts`

---

### Soft Delete Documentation Update

**Status:** COMPLETE

Updated all documentation to reflect soft delete system.

**Documentation Updated:**

- `docs/API_DOCUMENTATION.md` - Added Soft Delete & Recovery System section with 5 new endpoints
- `docs/ARCHITECTURE.md` - Added soft-delete-service.ts and query-helpers.ts to file listings
- `docs/features/CLIENTS.md` - Added soft delete behavior section and change log entry
- `docs/features/PROJECTS.md` - Added soft delete behavior section and change log entry
- `docs/features/INVOICES.md` - Added soft delete behavior section (paid invoice protection)
- `docs/features/PROPOSALS.md` - Added soft delete behavior section and DELETE endpoint documentation
- `docs/features/LEADS.md` - Added soft delete behavior section
- `docs/design/DATABASE_AUDIT.md` - Added migrations 048, 049, 050

---

### 30-Day Soft Delete Recovery System

**Status:** COMPLETE

Implemented soft delete with 30-day recovery.

**Core Pattern:**

- Added `deleted_at` and `deleted_by` columns to: clients, projects, invoices, client_intakes, proposal_requests
- Converted DELETE endpoints to soft delete via `softDeleteService`
- Added `WHERE deleted_at IS NULL` to all SELECT queries using `notDeleted()` helper
- Added admin API endpoints for viewing/restoring deleted items
- Added scheduled cleanup job (daily at 2 AM) to permanently delete items older than 30 days

**Cascade Behavior:**

- Deleting client cascades to: projects, proposals, voids unpaid invoices (keeps paid)
- Deleting project cascades to: proposals (keeps invoices)
- Paid invoices cannot be deleted

**Files Created:**

- `server/database/migrations/050_soft_delete_system.sql`
- `server/services/soft-delete-service.ts`
- `server/database/query-helpers.ts`

**Files Modified:**

- `server/routes/clients.ts` - Soft delete endpoint, query updates
- `server/routes/projects.ts` - Soft delete endpoint, query updates
- `server/routes/invoices.ts` - Soft delete endpoint
- `server/routes/proposals.ts` - New DELETE endpoint, query updates
- `server/routes/admin.ts` - New deleted items management endpoints
- `server/services/scheduler-service.ts` - Daily cleanup job

**Admin API Endpoints:**

- `GET /api/admin/deleted-items` - List deleted items (optional ?type= filter)
- `GET /api/admin/deleted-items/stats` - Get counts by entity type
- `POST /api/admin/deleted-items/:type/:id/restore` - Restore a deleted item
- `DELETE /api/admin/deleted-items/:type/:id/permanent` - Force permanent delete
- `POST /api/admin/deleted-items/cleanup` - Manual cleanup trigger

---

### Audit Re-do: Accessibility & Reusable Components

**Status:** COMPLETE

Re-audited and completed all remaining issues.

**Accessibility Audit:**

- WCAG 1.4.1 (Use of Color): PASS - All badges include text labels as non-color indicator
- WCAG 1.4.3 (Contrast): REVIEWED - All badge colors pass AA (4.5:1+), purple/gray borderline but acceptable
- Skip links: Already implemented on all pages

**Reusable Components - Status Badges:**

- Migrated inline badge markup to `getStatusBadgeHTML()` in admin-contacts, admin-projects, project-details/invoices
- Added invoice-specific status CSS (draft, sent, viewed, partial, paid, overdue)

**Reusable Components - Dropdowns:**

- Verified all form selects already use `initModalDropdown()`
- Project details status dropdown marked as intentional exception (custom auto-save behavior)

**Color Contrast Analysis:**

- Blue/Yellow/Green/Red badges: 4.6-12.5:1 ✅ PASS
- Purple/Gray badges: 4.4-4.5:1 ⚠️ Borderline (acceptable with semibold weight)

**Files Modified:**

- `src/features/admin/modules/admin-contacts.ts`
- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/project-details/invoices.ts`
- `src/styles/shared/portal-badges.css`
- `docs/design/ACCESSIBILITY_AUDIT.md`
- `docs/design/REUSABLE_COMPONENTS_AUDIT.md`

---

### Modal Audit Fixes Completed

**Status:** COMPLETE

Implemented all modal audit recommendations.

**Changes:**

- Centralized modal sizes via `--modal-width-*` variables
- Unified overlay open/close lifecycle with `modal-utils` across admin modules
- Added `.closing` animation for admin/portal overlays
- Added `aria-describedby` to confirm/alert/prompt dialogs
- Standardized portal modal show/hide to use shared utilities

**Resolved Issues:**

- Auto-opening admin modals blocking login
- Hardcoded z-index values (now tokenized via `--z-index-portal-*`)
- Mixed modal patterns (standardized via `modal-utils`)
- Inconsistent close animation timing (standardized with `.closing`)
- Dropdown positioning (aligned to shared portal dropdown tokens)
- Missing `aria-describedby` in dialogs
- Inconsistent modal sizing (centralized with `--modal-width-*`)

**Files Modified:**

- `src/utils/modal-utils.ts`
- `src/components/portal-modal.ts`
- `src/utils/confirm-dialog.ts`
- `src/styles/admin/modals.css`
- `src/styles/shared/confirm-dialog.css`
- `src/styles/variables.css`
- `src/features/admin/admin-dashboard.ts`
- `src/features/admin/modules/admin-projects.ts`
- `src/features/admin/modules/admin-clients.ts`
- `src/features/admin/modules/admin-document-requests.ts`
- `src/features/admin/modules/admin-files.ts`
- `src/features/admin/modules/admin-leads.ts`
- `src/features/admin/modules/admin-contacts.ts`
- `src/features/admin/project-details/actions.ts`

---

### Admin Modals Safety Guard + Overlay Fixes

**Status:** COMPLETE

Prevented auto-opening modals from blocking the admin login.

**Changes:**

- Call `hideAllAdminModals()` once on page load to clear any open modals
- Forced `.hidden` to win over modal display rules
- Ensured preview modal starts hidden by default
- Fixed `/api/admin/leads` 500 by removing non-existent `projects.features` column

**Note:** Removed MutationObserver-based modal guard - it caused infinite loops and page crashes.

**Files Modified:**

- `src/features/admin/admin-dashboard.ts`
- `src/styles/admin/modals.css`
- `src/features/admin/modules/admin-projects.ts`
- `server/routes/admin.ts`

---

### Edit Project Modal Dropdown Fix

**Status:** COMPLETE

Fixed missing dropdowns in edit project modal.

**Root Cause:** `initProjectModalDropdowns()` was called before `setupEditProjectModalHandlers()` which creates the dropdown elements. The type dropdown was also being double-wrapped with `initModalDropdown`.

**Changes:**

- Reordered function calls: `setupEditProjectModalHandlers()` now runs before `initProjectModalDropdowns()`
- Simplified `initProjectModalDropdowns()` to directly set value on the select created by `createFilterSelect`
- Removed unnecessary `initModalDropdown` wrapping logic for type dropdown

**Files Modified:**

- `src/features/admin/modules/admin-projects.ts`

---

### Page Heading Structure Fix

**Status:** COMPLETE

WCAG accessibility fix - converted all page-title H2 to H1.

**Issue:** WCAG 2.4.1 requires each page/view to have exactly one H1 as the primary heading. All main tabs in admin and portal were using H2.

**Changes:**

- Converted 10 `.page-title h2` to `h1` in admin/index.html (Dashboard, Leads, Projects, Clients, Invoices, Messages, Analytics, Document Requests, Knowledge Base, System Status)
- Converted 9 `.page-title h2` to `h1` in client/portal.html (Dashboard, Files, Messages, Invoices, Document Requests, Help, Settings, New Project, Project Preview)
- Updated CSS to support both h1 and h2 in `.page-title` selectors

**Files Modified:**

- `admin/index.html`
- `client/portal.html`
- `src/styles/admin/project-detail.css`
- `src/styles/client-portal/layout.css`
- `docs/design/UX_UI_IMPLEMENTATION_PLAN.md`

---

### Audit Outstanding Tasks

**Status:** COMPLETE

Completed multiple audit fixes.

**Tasks Completed:**

1. **Composite Database Indexes** - Added migration `051_composite_indexes.sql` with 11 new indexes for common query patterns (projects, time_entries, client_activities, audit_logs, invoices, general_messages, page_views, interaction_events)

2. **Analytics Data Retention** - Added scheduled cleanup job to `scheduler-service.ts` that deletes page_views and interaction_events older than 365 days (configurable via `analyticsRetentionDays`)

3. **Form Required Attributes** - Updated `contact-form.ts` to use HTML5 `required` attribute instead of `data-required` for consistency with existing forms

4. **Modal Fieldset/Legend** - Added fieldset/legend elements to Add Client modal and Add Project modal for screen reader accessibility. Added CSS styling for fieldset/legend in `admin/modals.css`

**Files Modified:**

- `server/database/migrations/051_composite_indexes.sql` (new)
- `server/services/scheduler-service.ts`
- `src/modules/ui/contact-form.ts`
- `src/styles/admin/modals.css`
- `admin/index.html`
- `docs/design/DATABASE_AUDIT.md`
- `docs/design/FORMS_AUDIT.md`
- `docs/design/ACCESSIBILITY_AUDIT.md`

---

### Accessibility & Validation Enhancements

**Status:** COMPLETE

Completed remaining audit tasks.

**Tasks Completed:**

1. **aria-activedescendant for Listboxes** - Added unique IDs to thread items and aria-activedescendant updates on selection in both `admin-messaging.ts` and `portal-messages.ts` for enhanced screen reader support

2. **JSON Schema Validation** - Added comprehensive JSON validators to `shared/validation/validators.ts` for complex database fields (tier_data, features_data, pricing_data, line_items). Applied validation in `proposal-service.ts`

**Files Modified:**

- `src/features/admin/modules/admin-messaging.ts`
- `src/features/client/modules/portal-messages.ts`
- `shared/validation/validators.ts`
- `shared/validation/index.ts`
- `server/services/proposal-service.ts`
- `docs/design/DATABASE_AUDIT.md`

---

### Admin UI for Deleted Items

**Status:** COMPLETE

Created admin UI module for viewing and managing soft-deleted items.

**Files Created:**

- `src/features/admin/modules/admin-deleted-items.ts` - Admin module for deleted items management

**Files Modified:**

- `src/features/admin/modules/index.ts` - Added module loader
- `server/routes/admin.ts` - Added API endpoints for deleted items

**API Endpoints Added:**

- `GET /api/admin/deleted-items` - List all soft-deleted items (optional type filter)
- `GET /api/admin/deleted-items/stats` - Get counts by entity type
- `POST /api/admin/deleted-items/:type/:id/restore` - Restore a soft-deleted item
- `DELETE /api/admin/deleted-items/:type/:id/permanent` - Permanently delete an item

**Features:**

- Table view of all deleted items
- Filter by entity type (client, project, invoice, lead, proposal)
- Days until permanent deletion column with urgency indicators
- Restore button per row
- Permanent delete with confirmation dialog

---

### PDF Multi-Page Support

**Status:** COMPLETE

Added multi-page overflow handling to invoice and proposal PDF generation.

**Files Modified:**

- `server/routes/invoices.ts` - Integrated PdfPageContext for page break detection
- `server/routes/proposals.ts` - Integrated PdfPageContext for page break detection

**Features:**

- Automatic page breaks when content exceeds page height
- Continuation headers on subsequent pages
- Page numbers for multi-page documents
- Maintained existing PDF layout and styling

---

### Form Error Display Unification

**Status:** COMPLETE

Unified contact form error display to use inline errors instead of popup errors.

**Files Modified:**

- `src/modules/ui/contact-form.ts` - Changed from showTemporaryFieldError (popups) to showFieldError (inline)

**Features:**

- Inline error messages with ARIA attributes for accessibility
- Focus management on first error field
- Consistent error pattern across all forms

---

### Status Color Differentiation

**Status:** COMPLETE

Fixed NEW vs ON-HOLD/PENDING using same color.

**Files Modified:**

- `src/design-system/tokens/colors.css` - Added `--status-new: #06b6d4` (cyan)
- `src/styles/shared/portal-badges.css` - Separated NEW badge styling

**Result:**

- NEW badges are now cyan
- PENDING/ON-HOLD badges remain yellow

---

### PDF Batch Export

**Status:** COMPLETE

Added bulk PDF export for invoices as ZIP file.

**Files Created:**

- None (feature added to existing files)

**Files Modified:**

- `server/routes/invoices.ts` - Added `POST /api/invoices/export-batch` endpoint
- `src/features/admin/modules/admin-invoices.ts` - Added "Download PDFs" bulk action
- `package.json` - Added `archiver` dependency

**Features:**

- Select multiple invoices via checkboxes
- Click "Download PDFs" bulk action
- Generates ZIP file with all selected invoice PDFs
- Includes manifest.json with export summary
- Maximum 100 invoices per export

**API Endpoint:**

- `POST /api/invoices/export-batch` - Body: `{ invoiceIds: number[] }`

---

### Audit Documentation Cleanup

**Status:** COMPLETE

Cleaned up all audit files to reflect current state only (no fix logs).

**Files Modified:**

- `docs/design/FORMS_AUDIT.md` - Added validation layer usage guide, removed resolved issues
- `docs/design/ACCESSIBILITY_AUDIT.md` - Moved completed items to "Completed Enhancements"
- `docs/design/DATABASE_AUDIT.md` - Removed resolved issues log, consolidated open issues
- `docs/design/PDF_AUDIT.md` - Removed completed batch export from improvements

---

### Lint Fix: admin-deleted-items.ts

**Status:** COMPLETE

Removed unused `storedContext` variable that was declared but never read.

**Files Modified:**

- `src/features/admin/modules/admin-deleted-items.ts` - Removed unused variable and its assignments

**Changes:**

- Removed `storedContext` module-level variable
- Updated `setDeletedItemsContext()` to be a no-op (context passed directly to functions)
- Removed assignment from `cleanupDeletedItems()`

---

### Analytics Label Consistency Verification

**Status:** VERIFIED - No Issue

Verified that analytics page headings are consistent (was listed as potential issue).

**Finding:**

- Section titles correctly use `tab-section-heading` class
- Card titles correctly use plain `h3` elements
- No inconsistency exists - removed from current_work.md

---
