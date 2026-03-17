# Custom Automations

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Admin self-service automation engine that runs custom automations alongside the built-in workflow handlers. Admins define trigger events, conditions, and ordered action sequences — the engine executes them automatically when matching events fire.

Built-in automations (proposal accepted -> milestones, contract signed -> activate project) remain in code. Custom automations handle the flexible stuff: send follow-up email 3 days after X, create task when Y happens, etc.

## Architecture

### Data Flow

1. Workflow event fires (any event in the system)
2. `handleCustomAutomationEvent` in workflow-automations routes to `automationEngine.handleEvent()`
3. Engine queries active automations matching the trigger event
4. For each match: evaluates trigger conditions, checks `max_runs_per_entity`
5. Creates `automation_runs` record, executes actions sequentially
6. `wait` actions schedule future execution via `automation_scheduled_actions` table
7. Scheduler cron (every 5 min) resumes runs after wait periods complete

### Action Types (11)

| Type | Description |
|------|-------------|
| `send_email` | Send email via template or custom subject/body |
| `create_task` | Create a task with title, priority, due date offset |
| `update_status` | Update entity status (project, lead, invoice, contract) |
| `send_notification` | Send notification email to client or admin |
| `wait` | Pause execution for minutes/hours/days |
| `enroll_sequence` | Enroll entity in an email drip sequence |
| `create_invoice` | Generate an invoice |
| `assign_questionnaire` | Assign a questionnaire to client |
| `webhook` | Send HTTP request to external URL |
| `add_tag` | Add tag to client or project |
| `add_note` | Add note to client or project |

### Variable Substitution

Action configs support `{{variable}}` templates resolved at runtime:

- `{{client_name}}`, `{{client_email}}` — From trigger entity
- `{{project_name}}`, `{{project_type}}` — From associated project
- `{{invoice_number}}`, `{{amount}}` — From invoice context
- `{{trigger_date}}`, `{{trigger_event}}` — Always available

### Database Tables (Migration 124)

- `custom_automations` — Automation definitions (name, trigger_event, trigger_conditions, stop_on_error, max_runs_per_entity)
- `automation_actions` — Ordered actions per automation (action_type, action_config JSON, condition JSON)
- `automation_runs` — Execution history (status: running/completed/failed/waiting)
- `automation_action_logs` — Per-action log (status, result, error)
- `automation_scheduled_actions` — Deferred wait-step execution (execute_at)

### Seeded Templates (inactive by default)

1. **New Project Setup** (project.created) — Send welcome email, create kickoff task (+2 days), notify admin
2. **Invoice Follow-Up** (invoice.overdue) — Send reminder to client, wait 3 days, notify admin

### API Endpoints (Admin)

- `GET /api/automations` — List with run stats
- `POST /api/automations` — Create with actions
- `GET /api/automations/:id` — Get with actions
- `PUT /api/automations/:id` — Update
- `DELETE /api/automations/:id` — Delete
- `PUT /api/automations/:id/activate` — Activate
- `PUT /api/automations/:id/deactivate` — Deactivate
- `POST /api/automations/:id/actions` — Add action
- `PUT /api/automations/:id/actions/:actionId` — Update action
- `DELETE /api/automations/:id/actions/:actionId` — Delete action
- `PUT /api/automations/:id/actions/reorder` — Reorder
- `GET /api/automations/:id/runs` — Execution history
- `GET /api/automations/runs/:runId/logs` — Per-action logs
- `POST /api/automations/:id/dry-run` — Test without executing
- `POST /api/automations/:id/run-now` — Manual trigger

### Portal Routes

- `/automations` — Admin automation table
- `/automation-detail/:id` — Detail panel with runs, actions, edit, run-now

### Scheduler

- Cron: `*/5 * * * *` (every 5 minutes) — processes scheduled wait-step actions

## Key Files

- `server/services/automation-engine.ts` — Full engine (CRUD, execution, scheduling, dry-run)
- `server/services/automation-engine-types.ts` — TypeScript interfaces
- `server/routes/automations/admin.ts` — 16 admin endpoints
- `server/database/migrations/124_custom_automations.sql` — Schema + seed data
- `src/react/features/admin/automations/AutomationsTable.tsx` — Admin table
- `src/react/features/admin/automations/AutomationBuilder.tsx` — Visual builder
- `src/react/features/admin/automations/AutomationDetailPanel.tsx` — Detail with runs

## Change Log

### 2026-03-17 — Initial Implementation

- Full automation engine with 11 action types
- Event handling, condition evaluation, sequential execution
- Wait-step scheduling with cron-based resume
- Variable substitution in action configs
- Admin CRUD + visual builder + detail panel with run history
- Dry-run testing mode
- 2 seeded templates
