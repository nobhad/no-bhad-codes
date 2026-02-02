# Lead Management System

**Status:** Complete
**Last Updated:** February 1, 2026

## Overview

The Lead Management System provides enterprise-grade lead scoring, pipeline management, task tracking, and analytics comparable to features found in HubSpot, Salesforce, and Pipedrive.

> **Implementation Note:** Leads are implemented as entries in the `projects` table with lead-specific fields (`lead_score`, `pipeline_stage_id`, etc.). The `LeadStatus` type in TypeScript defines lead-specific status values, while the database stores the status in the project's `status` column. The lead-specific tables (`lead_tasks`, `lead_notes`, `lead_scoring_rules`, etc.) provide the CRM functionality.

## Lead Statuses

Simplified pipeline stages for tracking leads through the sales funnel:

| Status | Description |
|--------|-------------|
| `new` | Freshly submitted lead, not yet reviewed |
| `contacted` | Initial contact has been made |
| `qualified` | Lead has been vetted and is a good fit |
| `in-progress` | Actively in discussions/negotiations |
| `converted` | Lead became a client with a project |
| `lost` | Lead declined or went elsewhere |
| `on-hold` | Temporarily paused |
| `cancelled` | Lead withdrawn by either party |

**Typical Flow:**

```text
new → contacted → qualified → in-progress → converted
                                    ↓
                                   lost
```

## Features

### 1. Lead Scoring

Automatic lead scoring based on configurable rules:

**Rule Operators:**

- `equals` - Exact match
- `contains` - Partial match
- `greater_than` - Numeric comparison
- `less_than` - Numeric comparison
- `in` - Match any in comma-separated list
- `not_empty` - Field has value

**Default Scoring Rules:**

| Rule | Field | Points |
|------|-------|--------|
| High Budget | budget_range in $10k+,$25k+ | +25 |
| Medium Budget | budget_range in $5k-$10k | +15 |
| Low Budget | budget_range in Under $2k,$2k-$5k | +5 |
| E-commerce | project_type = e-commerce | +20 |
| Custom App | project_type = custom | +25 |
| Business Website | project_type = business | +10 |
| Urgent Timeline | timeline in asap,1-2_weeks | +15 |
| Has Description | description not empty | +10 |
| Returning Client | client_type = returning | +20 |

### 2. Pipeline Management

Visual pipeline with drag-and-drop stages:

**Default Stages:**

| Stage | Win Probability | Color |
|-------|----------------|-------|
| New Lead | 10% | Gray |
| Contacted | 20% | Blue |
| Qualified | 40% | Purple |
| Proposal Sent | 60% | Orange |
| Negotiation | 80% | Red |
| Won | 100% | Green |
| Lost | 0% | Red |

**Features:**

- Kanban board view with leads per stage
- Total pipeline value and weighted value
- Stage-based win probability
- Auto-convert to project when moved to "Won"
- Lost reason tracking

### 3. Task Management

Follow-up tasks and reminders for each lead:

**Task Types:**

- `follow_up` - General follow-up
- `call` - Phone call
- `email` - Email outreach
- `meeting` - Scheduled meeting
- `proposal` - Send proposal
- `demo` - Product demo
- `other` - Other task

**Task Features:**

- Due date and time
- Priority (low, medium, high, urgent)
- Assignment to team member
- Reminder scheduling
- Overdue task tracking
- Upcoming task list

### 4. Notes

Rich notes system for each lead:

- Pinned notes for important info
- Author tracking
- Timestamp
- Pin/unpin toggle
- Delete capability

### 5. Lead Sources

Track where leads come from:

**Default Sources:**

- Website
- Referral
- Social Media
- Cold Outreach
- Conference/Event
- Partner
- Organic Search
- Paid Ads
- Other

### 6. Duplicate Detection

Automatic duplicate detection based on:

- Email match (50% weight)
- Company name similarity (30% weight)
- Contact name similarity (20% weight)

**Features:**

- Similarity score calculation
- Match field identification
- Resolution workflow (merge, not duplicate, dismiss)
- Pending duplicates list

### 7. Bulk Operations

Batch operations for multiple leads:

- Bulk status update
- Bulk assignment
- Bulk stage move

### 8. Analytics

Comprehensive lead analytics:

- Total leads and new this month
- Conversion rate (won/total closed)
- Average lead score
- Average days to close
- Top lead sources by performance
- Score distribution
- Conversion funnel
- Source performance comparison

## Database Schema

### New Tables

```sql
-- Lead scoring rules
CREATE TABLE lead_scoring_rules (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  field_name TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold_value TEXT NOT NULL,
  points INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME
);

-- Pipeline stages
CREATE TABLE pipeline_stages (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  sort_order INTEGER DEFAULT 0,
  win_probability DECIMAL(3,2) DEFAULT 0,
  is_won BOOLEAN DEFAULT FALSE,
  is_lost BOOLEAN DEFAULT FALSE,
  auto_convert_to_project BOOLEAN DEFAULT FALSE,
  created_at DATETIME
);

-- Lead tasks
CREATE TABLE lead_tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'follow_up',
  due_date DATE,
  due_time TIME,
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  priority TEXT DEFAULT 'medium',
  reminder_at DATETIME,
  completed_at DATETIME,
  completed_by TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

-- Lead notes
CREATE TABLE lead_notes (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME,
  updated_at DATETIME
);

-- Lead sources
CREATE TABLE lead_sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME
);

-- Duplicate tracking
CREATE TABLE lead_duplicates (
  id INTEGER PRIMARY KEY,
  lead_id_1 INTEGER NOT NULL,
  lead_id_2 INTEGER NOT NULL,
  similarity_score DECIMAL(3,2),
  match_fields JSON,
  status TEXT DEFAULT 'pending',
  resolved_at DATETIME,
  resolved_by TEXT,
  created_at DATETIME
);
```

### Projects Table Additions

```sql
ALTER TABLE projects ADD COLUMN lead_score INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN lead_score_breakdown JSON;
ALTER TABLE projects ADD COLUMN pipeline_stage_id INTEGER;
ALTER TABLE projects ADD COLUMN lead_source_id INTEGER;
ALTER TABLE projects ADD COLUMN assigned_to TEXT;
ALTER TABLE projects ADD COLUMN expected_value DECIMAL(10,2);
ALTER TABLE projects ADD COLUMN expected_close_date DATE;
ALTER TABLE projects ADD COLUMN lost_reason TEXT;
ALTER TABLE projects ADD COLUMN lost_at DATETIME;
ALTER TABLE projects ADD COLUMN won_at DATETIME;
ALTER TABLE projects ADD COLUMN competitor TEXT;
ALTER TABLE projects ADD COLUMN last_activity_at DATETIME;
ALTER TABLE projects ADD COLUMN next_follow_up_at DATETIME;
```

## API Endpoints

### Lead Scoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/leads/scoring-rules` | Get all scoring rules |
| POST | `/api/admin/leads/scoring-rules` | Create scoring rule |
| PUT | `/api/admin/leads/scoring-rules/:id` | Update scoring rule |
| DELETE | `/api/admin/leads/scoring-rules/:id` | Delete scoring rule |
| POST | `/api/admin/leads/:id/calculate-score` | Calculate score for lead |
| POST | `/api/admin/leads/recalculate-all` | Recalculate all scores |

### Pipeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/leads/pipeline/stages` | Get pipeline stages |
| GET | `/api/admin/leads/pipeline` | Get pipeline view (kanban) |
| GET | `/api/admin/leads/pipeline/stats` | Get pipeline statistics |
| POST | `/api/admin/leads/:id/move-stage` | Move lead to stage |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/leads/:id/tasks` | Get tasks for lead |
| POST | `/api/admin/leads/:id/tasks` | Create task |
| PUT | `/api/admin/leads/tasks/:taskId` | Update task |
| POST | `/api/admin/leads/tasks/:taskId/complete` | Complete task |
| GET | `/api/admin/leads/tasks/overdue` | Get overdue tasks |
| GET | `/api/admin/leads/tasks/upcoming` | Get upcoming tasks |

### Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/leads/:id/notes` | Get notes for lead |
| POST | `/api/admin/leads/:id/notes` | Add note |
| POST | `/api/admin/leads/notes/:noteId/toggle-pin` | Pin/unpin note |
| DELETE | `/api/admin/leads/notes/:noteId` | Delete note |

### Sources & Assignment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/leads/sources` | Get lead sources |
| POST | `/api/admin/leads/:id/source` | Set lead source |
| POST | `/api/admin/leads/:id/assign` | Assign lead |
| GET | `/api/admin/leads/my-leads` | Get my assigned leads |
| GET | `/api/admin/leads/unassigned` | Get unassigned leads |

### Duplicates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/leads/:id/duplicates` | Find duplicates for lead |
| GET | `/api/admin/leads/duplicates` | Get all pending duplicates |
| POST | `/api/admin/leads/duplicates/:id/resolve` | Resolve duplicate |

### Bulk Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/leads/bulk/status` | Bulk update status |
| POST | `/api/admin/leads/bulk/assign` | Bulk assign |
| POST | `/api/admin/leads/bulk/move-stage` | Bulk move to stage |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/leads/analytics` | Get lead analytics |
| GET | `/api/admin/leads/conversion-funnel` | Get conversion funnel |
| GET | `/api/admin/leads/source-performance` | Get source performance |

## Service Methods

The `lead-service.ts` provides the following methods:

### Scoring Methods

- `getScoringRules(includeInactive)` - Get scoring rules
- `createScoringRule(data)` - Create rule
- `updateScoringRule(ruleId, data)` - Update rule
- `deleteScoringRule(ruleId)` - Delete rule
- `calculateLeadScore(projectId)` - Calculate score
- `updateAllLeadScores()` - Recalculate all

### Pipeline Methods

- `getPipelineStages()` - Get stages
- `moveToStage(projectId, stageId)` - Move lead
- `getPipelineView()` - Get kanban view
- `getPipelineStats()` - Get statistics

### Task Methods

- `createTask(projectId, data)` - Create task
- `getTasks(projectId)` - Get tasks
- `updateTask(taskId, data)` - Update task
- `completeTask(taskId, completedBy)` - Complete task
- `getOverdueTasks()` - Get overdue
- `getUpcomingTasks(days)` - Get upcoming

### Note Methods

- `addNote(projectId, author, content)` - Add note
- `getNotes(projectId)` - Get notes
- `togglePinNote(noteId)` - Pin/unpin
- `deleteNote(noteId)` - Delete note

### Source & Assignment Methods

- `getLeadSources(includeInactive)` - Get sources
- `setLeadSource(projectId, sourceId)` - Set source
- `assignLead(projectId, assignee)` - Assign
- `getMyLeads(assignee)` - Get assigned
- `getUnassignedLeads()` - Get unassigned

### Duplicate Methods

- `findDuplicates(projectId)` - Find duplicates
- `getAllPendingDuplicates()` - Get pending
- `resolveDuplicate(id, status, resolvedBy)` - Resolve

### Bulk Methods

- `bulkUpdateStatus(projectIds, status)` - Bulk status
- `bulkAssign(projectIds, assignee)` - Bulk assign
- `bulkMoveToStage(projectIds, stageId)` - Bulk move

### Analytics Methods

- `getLeadAnalytics()` - Get analytics
- `getConversionFunnel()` - Get funnel
- `getSourcePerformance()` - Get source stats

## Files

### Created

- `server/database/migrations/033_lead_enhancements.sql` - Database migration
- `server/services/lead-service.ts` - Lead service
- `docs/features/LEADS.md` - This documentation

### Modified

- `server/routes/admin.ts` - Added 35+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces

## Usage Examples

### Calculate Lead Score

```typescript
const response = await fetch('/api/admin/leads/123/calculate-score', {
  method: 'POST'
});
const { score, breakdown } = await response.json();
// { score: 75, breakdown: [{ ruleName: 'High Budget', points: 25, matched: true }, ...] }
```

### Move Lead in Pipeline

```typescript
await fetch('/api/admin/leads/123/move-stage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stageId: 3 })
});
```

### Create Follow-up Task

```typescript
const response = await fetch('/api/admin/leads/123/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Follow up on proposal',
    taskType: 'call',
    dueDate: '2026-02-15',
    priority: 'high'
  })
});
```

### Get Pipeline View

```typescript
const response = await fetch('/api/admin/leads/pipeline');
const { stages, totalValue, weightedValue } = await response.json();
// stages: [{ id: 1, name: 'New Lead', leads: [...] }, ...]
```

## Change Log

### February 2, 2026 - Simplified Lead Statuses

- Simplified `LeadStatus` type to 8 values: new, contacted, qualified, in-progress, converted, lost, on-hold, cancelled
- Removed redundant statuses: pending, active, completed (these are better suited for projects/clients)
- Updated all type definitions, UI components, API routes, and CSS styles
- Updated documentation with status definitions and typical flow

### February 1, 2026 - Initial Implementation

- Created database migration for lead tables
- Implemented lead-service.ts with all methods
- Added 35+ API endpoints to admin.ts
- Added TypeScript interfaces for all types
- Created feature documentation
