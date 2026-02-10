# Workflow Automation System

**Status:** Complete
**Last Updated:** February 10, 2026

## Overview

The Workflow Automation System provides three types of automation:

1. **Approval Workflows**: Multi-step approval processes for proposals, invoices, contracts
2. **Event Triggers**: Automated actions triggered by system events
3. **Email Templates**: Customizable email templates with variable substitution

**Location:** Admin Dashboard → Workflows tab (with Approvals/Triggers/Email Templates subtabs)
**File:** `src/features/admin/modules/admin-workflows.ts`

---

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

### Approval Features

- Create/edit workflow definitions
- Add multiple approval steps
- Set default workflow per entity type
- Toggle workflow active status
- View pending approvals dashboard
- Bulk approve/reject operations
- Approval history modal
- Automated reminders (1/3/7 days)
- Preview workflow before saving
- Test workflow with simulation

---

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

- Conditional execution based on field values (JSON conditions)
- Priority ordering for multiple triggers
- Active/inactive toggle
- Trigger execution logs UI
- Test trigger before saving
- View logs button in header

---

## Email Templates

### Template Categories

| Category | Description |
|----------|-------------|
| `welcome` | Client welcome and onboarding |
| `invoice` | Invoice notifications |
| `contract` | Contract-related emails |
| `reminder` | Follow-up reminders |
| `notification` | General notifications |
| `general` | Miscellaneous templates |

### Template Features

- Rich HTML email content
- Plain text fallback support
- Variable interpolation with `{{variable.path}}` syntax
- Preview with sample data
- Send test email functionality
- Version history with restore capability
- System templates (non-deletable)

### Template Variables

Variables use dot notation for nested objects:

**Client Variables:**

- `{{client.name}}` - Client full name
- `{{client.email}}` - Client email
- `{{client.company}}` - Company name

**Project Variables:**

- `{{project.name}}` - Project name
- `{{project.type}}` - Project type
- `{{project.status}}` - Current status

**Invoice Variables:**

- `{{invoice.number}}` - Invoice number
- `{{invoice.amount}}` - Total amount
- `{{invoice.due_date}}` - Due date

**System Variables:**

- `{{date.today}}` - Current date
- `{{business.name}}` - Business name
- `{{business.email}}` - Business email

### Default Templates (Seeded)

1. **Welcome Email** - New client onboarding
2. **Invoice Created** - Invoice notification
3. **Invoice Reminder** - Overdue invoice reminder
4. **Contract Sent** - Contract for signing
5. **Project Update** - Status change notification
6. **General Notification** - Generic template

---

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

### email_templates

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Template name (unique) |
| `description` | TEXT | Template description |
| `category` | TEXT | Template category |
| `subject` | TEXT | Email subject line |
| `body_html` | TEXT | HTML email content |
| `body_text` | TEXT | Plain text fallback |
| `variables` | JSON | Available variables array |
| `is_active` | BOOLEAN | Active flag |
| `is_system` | BOOLEAN | System template (non-deletable) |
| `created_at` | DATETIME | Created timestamp |
| `updated_at` | DATETIME | Updated timestamp |

### email_template_versions

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `template_id` | INTEGER | FK to email_templates |
| `version_number` | INTEGER | Version number |
| `subject` | TEXT | Subject at this version |
| `body_html` | TEXT | HTML at this version |
| `body_text` | TEXT | Text at this version |
| `changed_by` | TEXT | Who made change |
| `change_reason` | TEXT | Why changed |
| `created_at` | DATETIME | Version timestamp |

### email_send_logs

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `template_id` | INTEGER | FK to email_templates |
| `recipient_email` | TEXT | Recipient address |
| `subject` | TEXT | Sent subject |
| `status` | TEXT | sent, failed, bounced |
| `error_message` | TEXT | Error if failed |
| `sent_at` | DATETIME | Send timestamp |

---

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

### Email Templates

```text
GET /api/email-templates
  Query: { category? }
  Returns: all templates (filterable by category)

GET /api/email-templates/:id
  Returns: single template with details

POST /api/email-templates
  Body: { name, description, category, subject, body_html, body_text, variables }
  Returns: created template

PUT /api/email-templates/:id
  Body: { name, description, category, subject, body_html, body_text, variables, changeReason }
  Returns: updated template

DELETE /api/email-templates/:id
  Returns: success message (fails for system templates)

GET /api/email-templates/:id/versions
  Returns: version history

POST /api/email-templates/:id/versions/:version/restore
  Returns: restored template

POST /api/email-templates/:id/preview
  Body: { sampleData }
  Returns: { subject, body_html, body_text } with variables interpolated

POST /api/email-templates/preview
  Body: { subject, body_html, body_text, sampleData }
  Returns: preview of raw content (not saved)

POST /api/email-templates/:id/test
  Body: { recipientEmail, sampleData }
  Returns: success message (sends test email)
```

---

## UI Components

### Approvals Subtab

- Pending approvals dashboard (admin + client items)
- Workflows table with name, type, entity, status, default indicator
- Add/Edit workflow modal with step configuration
- Steps management panel with drag-to-reorder
- Default workflow star icon toggle
- Preview workflow simulation view
- Approval history modal
- Bulk approve/reject toolbar

### Triggers Subtab

- Triggers table with name, event, action, status
- Add/Edit trigger modal with condition builder
- Eye/eye-off toggle for active status
- Priority reordering
- Test trigger button (generates sample context)
- View Logs button in header
- Execution logs modal with filtering

### Email Templates Subtab

- Templates table with name, category, subject, status
- Category filter buttons
- Add/Edit template modal:
  - Name and description fields
  - Category dropdown
  - Subject line input
  - HTML body editor (textarea)
  - Plain text body editor (optional)
  - Variables documentation panel
- Preview modal with sample data input
- Version history modal with restore
- Send test email dialog

---

## Files

| File | Purpose |
|------|---------|
| `src/features/admin/modules/admin-workflows.ts` | Workflows module (approvals + triggers) |
| `src/features/admin/modules/admin-email-templates.ts` | Email templates module |
| `src/features/admin/modules/index.ts` | Module exports |
| `server/routes/approvals.ts` | Approval endpoints |
| `server/routes/triggers.ts` | Trigger endpoints |
| `server/routes/email-templates.ts` | Email template endpoints |
| `server/services/trigger-service.ts` | Trigger execution |
| `server/services/email-template-service.ts` | Email template service |
| `server/database/migrations/064_email_templates.sql` | Email templates schema |
| `src/styles/admin/workflows.css` | Workflow styles (includes email templates) |

---

## Test Coverage

**Test File:** `tests/unit/server/approvals.test.ts`
**Total Tests:** 56

### Coverage Areas

| Area | Tests | Description |
|------|-------|-------------|
| Workflow Management | 14 | Create, update, delete workflows, step configuration |
| Approval Requests | 10 | Creation from templates, entity linking |
| Approval Decisions | 12 | Approve/reject/revise with comments |
| Automated Reminders | 10 | Intervals (1/3/7 days), escalation, email content |
| Bulk Operations | 6 | Approve/reject multiple items |
| Error Handling | 4 | Re-approval prevention, timeout, validation |

### Test Categories

**Workflow Tests:**

- Fetch all approval workflows
- Create workflow with steps
- Update workflow type
- Delete workflow (with usage check)
- Set default workflow per entity type
- Add/remove approval steps
- Reorder steps

**Approval Request Tests:**

- Create approval request
- Link to entity (proposal, invoice, contract)
- Instantiate workflow steps
- Track current step
- Get pending approvals

**Decision Tests:**

- Approve with comment
- Reject with reason
- Request revision
- Advance to next step (sequential)
- Complete all steps (parallel)
- Any-one approval completion

**Reminder Tests:**

- Configure reminder intervals
- Generate reminder emails
- Track reminder count
- Escalation after threshold
- Admin notification for stalled

**Bulk Tests:**

- Select multiple items
- Bulk approve selected
- Bulk reject selected
- Validation (same status required)

---

## Related Documentation

- [Proposals](./PROPOSALS.md) - Proposal approval workflows
- [Contracts](./CONTRACTS.md) - Contract approval workflows
- [Invoices](./INVOICES.md) - Invoice approval workflows
- [Projects](./PROJECTS.md) - Project entity context

---

## Change Log

### February 10, 2026 - Email Templates & Test Coverage

- Added Email Templates system (Section 6.2 complete)
- Added test coverage section (56 tests)
- Updated UI Components with Email Templates subtab
- Added email_templates database schema
- Added email template API endpoints
- Updated file locations table

### February 9, 2026 - Workflow UI Enhancements

- Added preview workflow before saving
- Added test trigger functionality
- Added trigger execution logs UI
- Added bulk approve/reject toolbar

### February 8, 2026 - Initial Documentation

- Created comprehensive WORKFLOWS.md
- Documented approval workflows and event triggers
- Added database schema and API endpoints
