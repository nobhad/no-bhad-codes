# Task Management System

**Status:** Complete
**Last Updated:** February 9, 2026

## Overview

The Task Management System provides project-level and global task tracking with Kanban and List views. Tasks can be associated with specific projects or viewed across all projects from the Admin Dashboard.

## Task Locations

### 1. Global Tasks (Dashboard)

Accessible from the Admin Dashboard sidebar under "Tasks". Shows all tasks across all active projects.

- **File:** `src/features/admin/modules/admin-global-tasks.ts`
- **API:** `GET /api/admin/tasks`
- **Views:** Kanban board, List table

### 2. Project Tasks (Project Detail)

Accessible from Project Detail → Tasks tab. Shows tasks for a specific project.

- **File:** `src/features/admin/modules/admin-tasks.ts`
- **API:** `GET /api/projects/:id/tasks`
- **Views:** Kanban board, List table

## Task Statuses

| Status | Label | Color |
|--------|-------|-------|
| `pending` | To Do | Secondary text |
| `in_progress` | In Progress | Primary |
| `blocked` | Blocked | On-hold (amber) |
| `completed` | Done | Active (green) |
| `cancelled` | Cancelled | Danger (red) |

## Task Priorities

| Priority | Color | Sort Order |
|----------|-------|------------|
| `urgent` | Danger (red) | 1 (highest) |
| `high` | On-hold (amber) | 2 |
| `medium` | Primary (blue) | 3 |
| `low` | Neutral | 4 (lowest) |

### Priority Auto-Escalation

Task priorities automatically escalate based on due date proximity.

**Escalation Rules:**

| Days Until Due | Minimum Priority |
|----------------|------------------|
| ≤ 1 (tomorrow/overdue) | urgent |
| ≤ 3 | high |
| ≤ 7 | medium |
| > 7 | no change |

**Behavior:**

- Only escalates UP (never downgrades priority)
- Excludes completed and cancelled tasks
- Excludes tasks without due dates
- Runs automatically daily at 6 AM
- Can be triggered manually via API

**API Endpoint:**

```text
POST /api/projects/:id/tasks/escalate-priorities
  Returns: { message, tasksUpdated }
```

**Service File:** `server/services/priority-escalation-service.ts`

## Features

### Kanban Board

- Drag-and-drop between status columns
- Cards show: title, project name, priority badge, due date, assignee
- Status updates via drag-and-drop call `PUT /api/projects/:projectId/tasks/:taskId`

### List View

- Sortable table with all task fields
- Quick actions: edit, delete, mark complete
- Bulk selection and actions

### View Toggle

- Toggle between Kanban and List views
- Uses `createViewToggle` component
- Icons: Board (columns) / List (rows)

## Database Schema

Tasks are stored in `project_tasks` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `project_id` | INTEGER | FK to projects |
| `title` | TEXT | Task title |
| `description` | TEXT | Optional description |
| `status` | TEXT | pending, in_progress, blocked, completed, cancelled |
| `priority` | TEXT | low, medium, high, urgent |
| `assigned_to` | TEXT | Assignee name |
| `due_date` | TEXT | ISO date string |
| `estimated_hours` | REAL | Estimated hours |
| `actual_hours` | REAL | Tracked hours |
| `created_at` | TEXT | Timestamp |
| `updated_at` | TEXT | Timestamp |

## API Endpoints

### Global Tasks

```text
GET /api/admin/tasks
  Query: status, priority, limit
  Returns: tasks from all active projects
```

### Project Tasks

```text
GET /api/projects/:id/tasks
  Returns: tasks for specific project

POST /api/projects/:id/tasks
  Body: { title, description, status, priority, dueDate, assignedTo, estimatedHours }
  Returns: created task

PUT /api/projects/:projectId/tasks/:taskId
  Body: { title, description, status, priority, dueDate, assignedTo, estimatedHours, actualHours }
  Returns: updated task

DELETE /api/projects/:projectId/tasks/:taskId
  Returns: success message

POST /api/projects/:id/tasks/escalate-priorities
  Returns: { message, tasksUpdated }
  Note: Auto-escalates priorities based on due dates
```

## Components

### Kanban Board

```typescript
import { createKanbanBoard } from 'src/components/kanban-board';

const board = createKanbanBoard({
  containerId: 'tasks-kanban-container',
  columns: [
    { id: 'pending', title: 'To Do', items: [] },
    { id: 'in_progress', title: 'In Progress', items: [] },
    { id: 'blocked', title: 'Blocked', items: [] },
    { id: 'completed', title: 'Done', items: [] }
  ],
  onItemMove: async (itemId, newStatus) => {
    // Update task status via API
  }
});
```

### View Toggle

```typescript
import { createViewToggle } from 'src/components/view-toggle';

createViewToggle(mountElement, {
  options: [
    { id: 'kanban', label: 'Board', icon: BOARD_ICON },
    { id: 'list', label: 'List', icon: LIST_ICON }
  ],
  activeId: 'kanban',
  onChange: (viewId) => renderView(viewId)
});
```

## Files

| File | Purpose |
|------|---------|
| `src/features/admin/modules/admin-global-tasks.ts` | Global tasks module |
| `src/features/admin/modules/admin-tasks.ts` | Project tasks module |
| `src/components/kanban-board.ts` | Reusable Kanban component |
| `src/components/view-toggle.ts` | View toggle component |
| `server/routes/admin.ts` | Global tasks endpoint |
| `server/routes/projects.ts` | Project tasks endpoints |
| `server/services/project-service.ts` | Task service methods |
| `server/services/priority-escalation-service.ts` | Priority auto-escalation logic |
| `server/services/scheduler-service.ts` | Daily escalation job (6 AM) |

## Change Log

### February 9, 2026

- Added priority auto-escalation feature
- Tasks automatically escalate to urgent/high/medium based on due date proximity
- Added `POST /api/projects/:id/tasks/escalate-priorities` endpoint
- Added daily scheduled job at 6 AM

### February 8, 2026

- Documented Global Tasks feature
- Feature fully implemented with Kanban + List views

### February 6, 2026

- Added `GET /api/admin/tasks` endpoint for global task view
- Added `getAllTasks()` method to project-service
