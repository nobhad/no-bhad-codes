# Time Tracking System

**Status:** Complete
**Last Updated:** 2026-06-25

## Overview

The Time Tracking System allows logging and managing time entries for projects. Each entry tracks duration, description, billable status, and can be linked to specific tasks.

**Location:** Project Detail → Time tab
**File:** `src/react/features/admin/time-tracking/`

## Features

### Time Entry Management

- Log time entries with duration, description, and date
- Mark entries as billable/non-billable
- Link entries to specific project tasks
- Set hourly rates for billing calculations
- Edit and delete existing entries

### Summary Stats

- Stat tiles summarizing total, billable, unbilled hours, and total value
- Rendered via the `TableStats` component
- Filterable by date range (week / month / all)

### Export

- Export time entries to CSV
- Configurable columns via `TIME_ENTRIES_EXPORT_CONFIG`

## Time Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `project_id` | INTEGER | FK to projects |
| `task_id` | INTEGER | Optional FK to project_tasks |
| `user_id` | INTEGER | FK to users(id) — who logged the time |
| `description` | TEXT | Work description |
| `hours` | DECIMAL(5,2) | Duration in hours |
| `date` | DATE | Date of work (ISO) |
| `billable` | BOOLEAN | Billable flag |
| `hourly_rate` | DECIMAL(10,2) | Rate for billing |
| `created_at` | DATETIME | Timestamp |
| `updated_at` | DATETIME | Timestamp |

*The API accepts `duration_minutes` and `is_billable` as input aliases, but the underlying `time_entries` table stores `hours` and `billable`.*

## API Endpoints

```text
GET /api/projects/:id/time-entries
  Returns: all time entries for project

POST /api/projects/:id/time-entries
  Body: { description, durationMinutes, date, isBillable, taskId?, hourlyRate? }
  Returns: created entry

PUT /api/projects/:id/time-entries/:entryId
  Body: { description, durationMinutes, date, isBillable, taskId?, hourlyRate? }
  Returns: updated entry

DELETE /api/projects/:id/time-entries/:entryId
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
| `src/react/features/admin/time-tracking/` | Time tracking module |
| `src/utils/table-export.ts` | CSV export utility |
| `server/routes/projects/time-tracking.ts` | Time entry endpoints |
