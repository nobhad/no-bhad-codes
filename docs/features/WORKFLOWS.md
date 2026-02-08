# Workflow Automation System

**Status:** Complete
**Last Updated:** February 8, 2026

## Overview

The Workflow Automation System provides two types of automation:

1. **Approval Workflows**: Multi-step approval processes for proposals, invoices, contracts
2. **Event Triggers**: Automated actions triggered by system events

**Location:** Admin Dashboard → Workflows tab (with Approvals/Triggers subtabs)
**File:** `src/features/admin/modules/admin-workflows.ts`

## Approval Workflows

### Workflow Types

| Type | Description |
|------|-------------|
| `sequential` | Approvers must approve in order |
| `parallel` | All approvers can approve simultaneously |
| `any_one` | Any single approver can approve |

### Entity Types

Workflows can be applied to:

- `proposal` - Project proposals
- `invoice` - Client invoices
- `contract` - Project contracts
- `deliverable` - Project deliverables
- `project` - Project approvals

### Workflow Steps

Each workflow has ordered steps with:

- **Approver Type**: user, role, or client
- **Approver Value**: Email, role name, or "client"
- **Optional Flag**: Step can be skipped
- **Auto-Approve**: Hours until automatic approval

### Features

- Create/edit workflow definitions
- Add multiple approval steps
- Set default workflow per entity type
- Toggle workflow active status
- View pending approvals

## Event Triggers

### Event Types

- `lead.created` - New lead submitted
- `lead.status_changed` - Lead status updated
- `project.created` - New project created
- `project.status_changed` - Project status updated
- `invoice.created` - New invoice created
- `invoice.paid` - Invoice marked paid
- `invoice.overdue` - Invoice past due date
- `task.completed` - Task marked complete
- `file.uploaded` - File uploaded to project

### Action Types

| Action | Description |
|--------|-------------|
| `send_email` | Send email notification |
| `create_task` | Create a new task |
| `update_status` | Update entity status |
| `webhook` | Call external webhook |
| `notify` | Send in-app notification |

### Trigger Features

- Conditional execution based on field values
- Priority ordering for multiple triggers
- Active/inactive toggle
- Trigger history/logs

## Database Schema

### workflow_definitions

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Workflow name |
| `description` | TEXT | Description |
| `entity_type` | TEXT | Entity this applies to |
| `workflow_type` | TEXT | sequential, parallel, any_one |
| `is_active` | BOOLEAN | Active flag |
| `is_default` | BOOLEAN | Default for entity type |
| `created_at` | TEXT | Timestamp |
| `updated_at` | TEXT | Timestamp |

### workflow_steps

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `workflow_definition_id` | INTEGER | FK to definitions |
| `step_order` | INTEGER | Step sequence |
| `approver_type` | TEXT | user, role, client |
| `approver_value` | TEXT | Approver identifier |
| `is_optional` | BOOLEAN | Can be skipped |
| `auto_approve_after_hours` | INTEGER | Auto-approve delay |
| `created_at` | TEXT | Timestamp |

### workflow_triggers

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Trigger name |
| `description` | TEXT | Description |
| `event_type` | TEXT | Event to listen for |
| `conditions` | JSON | Conditional logic |
| `action_type` | TEXT | Action to perform |
| `action_config` | JSON | Action parameters |
| `is_active` | BOOLEAN | Active flag |
| `priority` | INTEGER | Execution order |
| `created_at` | TEXT | Timestamp |
| `updated_at` | TEXT | Timestamp |

## API Endpoints

### Approval Workflows

```text
GET /api/approvals/workflows
  Returns: all workflow definitions

POST /api/approvals/workflows
  Body: { name, description, entityType, workflowType, isDefault }
  Returns: created workflow

PUT /api/approvals/workflows/:id
  Body: { name, description, workflowType, isActive, isDefault }
  Returns: updated workflow

DELETE /api/approvals/workflows/:id
  Returns: success message

GET /api/approvals/workflows/:id/steps
  Returns: workflow steps

POST /api/approvals/workflows/:id/steps
  Body: { approverType, approverValue, isOptional, autoApproveAfterHours }
  Returns: created step

PUT /api/approvals/steps/:stepId
  Body: { approverType, approverValue, stepOrder, isOptional, autoApproveAfterHours }
  Returns: updated step

DELETE /api/approvals/steps/:stepId
  Returns: success message
```

### Event Triggers

```text
GET /api/triggers
  Returns: all triggers

GET /api/triggers/options
  Returns: available event types and action types

POST /api/triggers
  Body: { name, description, eventType, conditions, actionType, actionConfig, priority }
  Returns: created trigger

PUT /api/triggers/:id
  Body: { name, description, eventType, conditions, actionType, actionConfig, priority, isActive }
  Returns: updated trigger

DELETE /api/triggers/:id
  Returns: success message

POST /api/triggers/:id/toggle
  Returns: toggled trigger
```

## UI Components

### Approvals Tab

- Workflows table with name, type, entity, status, default indicator
- Add/Edit workflow modal
- Steps management panel
- Default workflow star icon

### Triggers Tab

- Triggers table with name, event, action, status
- Add/Edit trigger modal with condition builder
- Eye/eye-off toggle for active status
- Priority reordering

## Files

| File | Purpose |
|------|---------|
| `src/features/admin/modules/admin-workflows.ts` | Workflows module |
| `server/routes/approvals.ts` | Approval endpoints |
| `server/routes/triggers.ts` | Trigger endpoints |
| `server/services/trigger-service.ts` | Trigger execution |
| `src/styles/admin/workflows.css` | Workflow styles |
