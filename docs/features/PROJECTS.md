# Project Management System

**Status:** Complete
**Last Updated:** February 2, 2026

## Overview

The Project Management System provides enterprise-grade project management with tasks, time tracking, templates, dependencies, and project health metrics comparable to Monday.com, Asana, and other industry leaders.

## Project Status

Projects have the following status values:

| Status | Description |
|--------|-------------|
| `planning` | Project is in planning phase, not yet started |
| `in-progress` | Project is actively being worked on |
| `review` | Project is under review/awaiting approval |
| `completed` | Project has been completed |
| `on-hold` | Project is temporarily paused |

## Features

### 1. Task Management

Tasks within projects with full CRUD support and subtasks:

**Task Status:**

- `pending` - Not yet started
- `in_progress` - Currently being worked on
- `completed` - Finished
- `blocked` - Waiting on something
- `cancelled` - No longer needed

**Task Priority:**

- `low` - Low priority
- `medium` - Medium priority
- `high` - High priority
- `urgent` - Critical/urgent

**Features:**

- Tasks linked to milestones
- Subtask support (parent_task_id)
- Assignment to team members
- Due dates and time estimates
- Sort order for kanban/list views
- Actual hours tracking

### 2. Task Dependencies

Define dependencies between tasks:

**Dependency Types:**

- `finish_to_start` - Task B starts after Task A finishes (default)
- `start_to_start` - Task B starts when Task A starts
- `finish_to_finish` - Task B finishes when Task A finishes
- `start_to_finish` - Task B finishes when Task A starts

**Features:**

- Cyclic dependency detection
- Blocked task identification
- Dependency visualization

### 3. Task Comments

Rich commenting system for each task:

- Author tracking
- Timestamps
- Threaded discussions

### 4. Task Checklists

Checklist items within tasks:

- Multiple items per task
- Sort order support
- Completion tracking
- Completion timestamps

### 5. Time Tracking

Time entries for projects and tasks:

**Features:**

- Log hours against projects or specific tasks
- Billable vs non-billable tracking
- Hourly rate per entry
- Automatic project/task hour updates
- Date-based tracking

**Statistics:**

- Total hours (billable/non-billable)
- Hours by user
- Hours by task
- Hours by week
- Total amount earned

### 6. Project Templates

Reusable project templates:

**Default Templates:**

| Template | Type | Duration | Description |
|----------|------|----------|-------------|
| Simple Website | simple-site | 17 days | Basic informational website with 3-5 pages |
| Business Website | business-site | 38 days | Professional business website with 8-12 pages |
| E-commerce Store | e-commerce | 59 days | Full e-commerce website with product catalog and checkout |

**Template Features:**

- Default milestones with estimated days
- Default tasks linked to milestones
- Estimated hours per task
- Default hourly rate
- Create project from template with auto-calculated dates

### 7. Project Health

Automatic project health calculation:

**Health Status:**

- `on_track` - Score >= 70
- `at_risk` - Score 40-69
- `off_track` - Score < 40

**Health Factors:**

| Factor | Weight | Description |
|--------|--------|-------------|
| Schedule Health | 30% | Days remaining vs deadline |
| Budget Health | 20% | Actual vs estimated hours |
| Task Completion | 25% | Completed tasks percentage |
| Milestone Progress | 25% | Completed milestones percentage |

### 8. Burndown Charts

Visual burndown chart data:

- Dates from project start to end
- Planned hours (linear decrease)
- Actual hours worked
- Remaining hours

### 9. Velocity Tracking

Weekly velocity metrics:

- Hours completed per week
- Tasks completed per week
- Average velocity calculation

### 10. Project Tags

Tag projects for organization:

**Default Tags:**

| Tag | Color | Description |
|-----|-------|-------------|
| Rush | Red | Fast turnaround project |
| Maintenance | Orange | Ongoing maintenance project |
| Redesign | Purple | Website or app redesign |
| New Build | Green | New project from scratch |
| Complex | Pink | High complexity project |
| Simple | Cyan | Simple, straightforward project |
| Fixed Price | Blue | Fixed price contract |
| Hourly | Lime | Hourly billing |

### 11. Project Archiving

Archive completed or inactive projects:

- Archive with timestamp
- Unarchive to restore
- Archived projects excluded from active lists

## Database Schema

### New Tables

```sql
-- Project tasks with subtask support
CREATE TABLE project_tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  milestone_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  assigned_to TEXT,
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  sort_order INTEGER DEFAULT 0,
  parent_task_id INTEGER,
  created_at DATETIME,
  updated_at DATETIME,
  completed_at DATETIME
);

-- Task dependencies
CREATE TABLE task_dependencies (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL,
  depends_on_task_id INTEGER NOT NULL,
  dependency_type TEXT DEFAULT 'finish_to_start',
  created_at DATETIME
);

-- Task comments
CREATE TABLE task_comments (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME,
  updated_at DATETIME
);

-- Time entries
CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  task_id INTEGER,
  user_name TEXT NOT NULL,
  description TEXT,
  hours DECIMAL(5,2) NOT NULL,
  date DATE NOT NULL,
  billable BOOLEAN DEFAULT TRUE,
  hourly_rate DECIMAL(10,2),
  created_at DATETIME,
  updated_at DATETIME
);

-- Project templates
CREATE TABLE project_templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  default_milestones JSON,
  default_tasks JSON,
  estimated_duration_days INTEGER,
  default_hourly_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME
);

-- Project tags junction table
CREATE TABLE project_tags (
  project_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME,
  PRIMARY KEY (project_id, tag_id)
);

-- Task checklist items
CREATE TABLE task_checklist_items (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME
);
```

### Projects Table Additions

```sql
ALTER TABLE projects ADD COLUMN hourly_rate DECIMAL(10,2);
ALTER TABLE projects ADD COLUMN estimated_hours DECIMAL(6,2);
ALTER TABLE projects ADD COLUMN actual_hours DECIMAL(6,2);
ALTER TABLE projects ADD COLUMN template_id INTEGER;
ALTER TABLE projects ADD COLUMN archived_at DATETIME;
ALTER TABLE projects ADD COLUMN project_health TEXT DEFAULT 'on_track';
ALTER TABLE projects ADD COLUMN health_notes TEXT;
```

### Milestones Table Additions

```sql
ALTER TABLE milestones ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE milestones ADD COLUMN estimated_hours DECIMAL(5,2);
ALTER TABLE milestones ADD COLUMN actual_hours DECIMAL(5,2);
ALTER TABLE milestones ADD COLUMN status TEXT DEFAULT 'pending';
```

## API Endpoints

### Project CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | Get all projects |
| GET | `/api/projects/:id` | Get single project |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project (admin only) |

### Task Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/tasks` | Get tasks for project |
| POST | `/api/projects/:id/tasks` | Create task |
| GET | `/api/projects/tasks/:taskId` | Get single task |
| PUT | `/api/projects/tasks/:taskId` | Update task |
| DELETE | `/api/projects/tasks/:taskId` | Delete task |
| POST | `/api/projects/tasks/:taskId/complete` | Complete task |
| POST | `/api/projects/tasks/:taskId/move` | Move task position |

### Task Dependencies

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/tasks/:taskId/dependencies` | Add dependency |
| DELETE | `/api/projects/tasks/:taskId/dependencies/:dependsOnTaskId` | Remove dependency |
| GET | `/api/projects/:id/tasks/blocked` | Get blocked tasks |

### Task Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/tasks/:taskId/comments` | Get comments |
| POST | `/api/projects/tasks/:taskId/comments` | Add comment |
| DELETE | `/api/projects/tasks/comments/:commentId` | Delete comment |

### Task Checklists

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/tasks/:taskId/checklist` | Add checklist item |
| POST | `/api/projects/tasks/checklist/:itemId/toggle` | Toggle item |
| DELETE | `/api/projects/tasks/checklist/:itemId` | Delete item |

### Time Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/time-entries` | Get time entries |
| POST | `/api/projects/:id/time-entries` | Log time |
| PUT | `/api/projects/time-entries/:entryId` | Update entry |
| DELETE | `/api/projects/time-entries/:entryId` | Delete entry |
| GET | `/api/projects/:id/time-stats` | Get time statistics |
| GET | `/api/projects/reports/team-time` | Get team time report |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/templates` | Get all templates |
| GET | `/api/projects/templates/:templateId` | Get single template |
| POST | `/api/projects/templates` | Create template |
| POST | `/api/projects/from-template` | Create project from template |

### Project Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/health` | Get project health |
| GET | `/api/projects/:id/burndown` | Get burndown data |
| GET | `/api/projects/:id/velocity` | Get velocity data |

### Project Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/tags` | Get project tags |
| POST | `/api/projects/:id/tags/:tagId` | Add tag to project |
| DELETE | `/api/projects/:id/tags/:tagId` | Remove tag from project |

### Project Archive

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/archive` | Archive project |
| POST | `/api/projects/:id/unarchive` | Unarchive project |

## Service Methods

The `project-service.ts` provides the following methods:

### Task Methods

- `createTask(projectId, data)` - Create task
- `getTasks(projectId, options)` - Get tasks with filters
- `getTask(taskId)` - Get single task with details
- `updateTask(taskId, data)` - Update task
- `deleteTask(taskId)` - Delete task
- `moveTask(taskId, newPosition, milestoneId)` - Reorder task
- `completeTask(taskId)` - Mark complete

### Dependency Methods

- `addDependency(taskId, dependsOnTaskId, type)` - Add dependency
- `removeDependency(taskId, dependsOnTaskId)` - Remove dependency
- `getBlockedTasks(projectId)` - Get blocked tasks

### Comment Methods

- `addTaskComment(taskId, author, content)` - Add comment
- `getTaskComments(taskId)` - Get comments
- `deleteTaskComment(commentId)` - Delete comment

### Checklist Methods

- `addChecklistItem(taskId, content)` - Add item
- `toggleChecklistItem(itemId)` - Toggle completion
- `deleteChecklistItem(itemId)` - Delete item

### Time Tracking Methods

- `logTime(projectId, data)` - Log time entry
- `getTimeEntries(projectId, options)` - Get entries
- `updateTimeEntry(entryId, data)` - Update entry
- `deleteTimeEntry(entryId)` - Delete entry
- `getProjectTimeStats(projectId)` - Get statistics
- `getTeamTimeReport(startDate, endDate)` - Team report

### Template Methods

- `createTemplate(data)` - Create template
- `getTemplates(projectType)` - Get templates
- `getTemplate(templateId)` - Get single template
- `createProjectFromTemplate(templateId, clientId, projectName, startDate)` - Create from template

### Health Methods

- `calculateProjectHealth(projectId)` - Calculate health
- `getProjectBurndown(projectId)` - Get burndown data
- `getProjectVelocity(projectId)` - Get velocity data

### Tag Methods

- `addTagToProject(projectId, tagId)` - Add tag
- `removeTagFromProject(projectId, tagId)` - Remove tag
- `getProjectTags(projectId)` - Get tags

### Archive Methods

- `archiveProject(projectId)` - Archive
- `unarchiveProject(projectId)` - Unarchive

## Usage Examples

### Create Task

```typescript
const response = await fetch('/api/projects/123/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Design homepage mockup',
    description: 'Create initial mockup for homepage',
    priority: 'high',
    estimatedHours: 8,
    dueDate: '2026-02-15',
    assignedTo: 'designer@example.com'
  })
});
```

### Log Time

```typescript
await fetch('/api/projects/123/time-entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 456,
    userName: 'developer@example.com',
    hours: 2.5,
    date: '2026-02-01',
    description: 'Implemented responsive navigation',
    billable: true,
    hourlyRate: 125
  })
});
```

### Create Project from Template

```typescript
const response = await fetch('/api/projects/from-template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: 1,
    clientId: 42,
    projectName: 'Acme Corp Website',
    startDate: '2026-02-10'
  })
});
const { projectId, milestoneIds, taskIds } = await response.json();
```

### Get Project Health

```typescript
const response = await fetch('/api/projects/123/health');
const { health } = await response.json();
// {
//   status: 'at_risk',
//   score: 65,
//   factors: { scheduleHealth: 60, budgetHealth: 70, taskCompletion: 80, milestoneProgress: 50 },
//   issues: ['Less than 1 week until deadline', '2 task(s) are blocked']
// }
```

## Files

### Created

- `server/database/migrations/031_project_enhancements.sql` - Database migration
- `server/services/project-service.ts` - Project service
- `docs/features/PROJECTS.md` - This documentation

### Modified

- `server/routes/projects.ts` - Added 30+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces

## Change Log

### February 2, 2026 - Contract Reminders & Project Delete

- Added contract reminder system:
  - New `contract_reminders` table for tracking scheduled reminders
  - Automatic reminder scheduling when signature is requested (initial, 3-day, 7-day, 14-day)
  - Automatic reminder cancellation when contract is signed
  - Email templates for each reminder type
  - Integrated with scheduler service
- Added DELETE endpoint for projects (`DELETE /api/projects/:id`)
- Added delete button to project detail header in admin UI
- Delete cascades to related records (files, milestones, tasks, time entries, tags, messages)
- Invoices are preserved for financial records (project_id set to NULL)

### February 1, 2026 - Initial Implementation

- Created database migration for project tables
- Implemented project-service.ts with all methods
- Added 30+ API endpoints to projects.ts
- Added TypeScript interfaces for all types
- Created feature documentation
