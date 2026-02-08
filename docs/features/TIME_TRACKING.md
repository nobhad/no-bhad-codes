# Time Tracking System

**Status:** Complete
**Last Updated:** February 8, 2026

## Overview

The Time Tracking System allows logging and managing time entries for projects. Each entry tracks duration, description, billable status, and can be linked to specific tasks.

**Location:** Project Detail → Time tab
**File:** `src/features/admin/modules/admin-time-tracking.ts`

## Features

### Time Entry Management

- Log time entries with duration, description, and date
- Mark entries as billable/non-billable
- Link entries to specific project tasks
- Set hourly rates for billing calculations
- Edit and delete existing entries

### Weekly Chart

- Bar chart showing hours logged per day for the current week
- Visual overview of time distribution
- Uses `createBarChart` component

### Export

- Export time entries to CSV
- Configurable columns via `TIME_ENTRIES_EXPORT_CONFIG`

## Time Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `project_id` | INTEGER | FK to projects |
| `task_id` | INTEGER | Optional FK to project_tasks |
| `user_email` | TEXT | Who logged the time |
| `user_name` | TEXT | Display name |
| `description` | TEXT | Work description |
| `duration_minutes` | INTEGER | Duration in minutes |
| `date` | TEXT | Date of work (ISO) |
| `is_billable` | BOOLEAN | Billable flag |
| `hourly_rate` | REAL | Rate for billing |
| `created_at` | TEXT | Timestamp |
| `updated_at` | TEXT | Timestamp |

## API Endpoints

```text
GET /api/projects/:id/time-entries
  Returns: all time entries for project

POST /api/projects/:id/time-entries
  Body: { description, durationMinutes, date, isBillable, taskId?, hourlyRate? }
  Returns: created entry

PUT /api/projects/:projectId/time-entries/:entryId
  Body: { description, durationMinutes, date, isBillable, taskId?, hourlyRate? }
  Returns: updated entry

DELETE /api/projects/:projectId/time-entries/:entryId
  Returns: success message
```

## UI Components

### Log Time Dialog

Multi-field dialog with:

- Duration (hours/minutes)
- Description (textarea)
- Date picker
- Task selector (optional)
- Billable checkbox
- Hourly rate (if billable)

### Time Entries Table

| Column | Description |
|--------|-------------|
| Date | Entry date |
| Description | Work description |
| Task | Linked task (if any) |
| Duration | Hours:minutes |
| Billable | Yes/No indicator |
| Actions | Edit, Delete |

## Files

| File | Purpose |
|------|---------|
| `src/features/admin/modules/admin-time-tracking.ts` | Time tracking module |
| `src/components/chart-simple.ts` | Bar chart component |
| `src/utils/table-export.ts` | CSV export utility |
| `server/routes/projects.ts` | Time entry endpoints |
