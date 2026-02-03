# Status System

**Last Updated:** February 3, 2026

---

## Color Legend - SINGLE SOURCE OF TRUTH

All status colors are defined in `src/design-system/tokens/colors.css`.

```text
┌────────┬─────────┬────────────────────────────────────────────┐
│ Color  │ Hex     │ Meaning                                    │
├────────┼─────────┼────────────────────────────────────────────┤
│ Blue   │ #3b82f6 │ Active / In Progress / Contacted           │
│ Yellow │ #fbbf24 │ Pending / New / On Hold                    │
│ Green  │ #10b981 │ Completed / Converted / Success            │
│ Red    │ #ef4444 │ Cancelled / Lost / Archived                │
│ Purple │ #8b5cf6 │ Qualified / In Review                      │
│ Gray   │ #6b7280 │ Read / Inactive                            │
└────────┴─────────┴────────────────────────────────────────────┘
```

---

## Leads

Sales pipeline for potential clients.

### Lead Statuses

```text
┌─────────────┬────────┬───────────────────────────────────────┐
│ Status      │ Color  │ Description                           │
├─────────────┼────────┼───────────────────────────────────────┤
│ new         │ Blue   │ Freshly submitted, not yet reviewed   │
│ contacted   │ Purple │ Initial contact has been made         │
│ qualified   │ Purple │ Vetted and confirmed good fit         │
│ in-progress │ Green  │ Actively in discussions/negotiations  │
│ converted   │ Green  │ Became a client with a project        │
│ lost        │ Gray   │ Declined or went elsewhere            │
│ on-hold     │ Amber  │ Temporarily paused                    │
│ cancelled   │ Gray   │ Withdrawn by either party             │
└─────────────┴────────┴───────────────────────────────────────┘
```

### Lead Status Selection

```text
┌───────────────────────────────────────────┬─────────────┐
│ Scenario                                  │ Status      │
├───────────────────────────────────────────┼─────────────┤
│ Lead just submitted intake form           │ new         │
│ Sent first email or made first call       │ contacted   │
│ Had discovery call, confirmed good fit    │ qualified   │
│ Proposal sent, actively negotiating       │ in-progress │
│ Contract signed, project created          │ converted   │
│ Client chose competitor or declined       │ lost        │
│ Client asked to pause discussions         │ on-hold     │
│ Invalid lead or withdrawn                 │ cancelled   │
└───────────────────────────────────────────┴─────────────┘
```

### Lead Workflow

```text
┌─────────────┬─────────────┬─────────────────────────┐
│ From        │ To          │ Trigger                 │
├─────────────┼─────────────┼─────────────────────────┤
│ new         │ contacted   │ First outreach made     │
│ contacted   │ qualified   │ Discovery call complete │
│ qualified   │ in-progress │ Proposal sent           │
│ in-progress │ converted   │ Contract signed         │
│ in-progress │ lost        │ Deal fell through       │
│ Any         │ on-hold     │ Client requests pause   │
│ Any         │ cancelled   │ Lead withdrawn          │
└─────────────┴─────────────┴─────────────────────────┘

Flow: new → contacted → qualified → in-progress → converted or lost
```

---

## Projects

Active work for clients.

### Project Statuses

```text
┌─────────────┬────────┬─────────────────────────────┐
│ Status      │ Color  │ Description                 │
├─────────────┼────────┼─────────────────────────────┤
│ pending     │ Yellow │ Scoping and planning phase  │
│ active      │ Blue   │ Active development underway │
│ in-progress │ Blue   │ Active development underway │
│ in-review   │ Purple │ Awaiting client approval    │
│ completed   │ Green  │ Finished and delivered      │
│ on-hold     │ Yellow │ Work temporarily paused     │
│ cancelled   │ Red    │ Project cancelled           │
└─────────────┴────────┴─────────────────────────────┘
```

### Project Status Selection

```text
┌─────────────────────────────────────────┬─────────────┐
│ Scenario                                │ Status      │
├─────────────────────────────────────────┼─────────────┤
│ Gathering requirements, scoping         │ planning    │
│ Active development work                 │ in-progress │
│ Deliverables ready for client review    │ review      │
│ Project delivered and accepted          │ completed   │
│ Client requested work pause             │ on-hold     │
└─────────────────────────────────────────┴─────────────┘
```

### Project Workflow

```text
┌─────────────┬─────────────┬───────────────────┐
│ From        │ To          │ Trigger           │
├─────────────┼─────────────┼───────────────────┤
│ planning    │ in-progress │ Work begins       │
│ in-progress │ review      │ Deliverables ready│
│ review      │ completed   │ Client approves   │
│ review      │ in-progress │ Revisions needed  │
│ Any         │ on-hold     │ Work paused       │
└─────────────┴─────────────┴───────────────────┘

Flow: planning → in-progress → review → completed
```

---

## Clients

Account status for companies/individuals.

### Client Statuses

```text
┌──────────┬────────┬─────────────────────────┐
│ Status   │ Color  │ Description             │
├──────────┼────────┼─────────────────────────┤
│ active   │ Blue   │ Has active projects     │
│ inactive │ Gray   │ No recent activity      │
│ pending  │ Yellow │ Account not yet set up  │
└──────────┴────────┴─────────────────────────┘
```

### Client Status Selection

```text
┌─────────────────────────────────────────┬──────────┐
│ Scenario                                │ Status   │
├─────────────────────────────────────────┼──────────┤
│ Has one or more active projects         │ active   │
│ No projects in 6+ months                │ inactive │
│ Invited but hasn't set up account       │ pending  │
└─────────────────────────────────────────┴──────────┘
```

### Client Workflow

```text
┌──────────┬──────────┬───────────────────────────────┐
│ From     │ To       │ Trigger                       │
├──────────┼──────────┼───────────────────────────────┤
│ pending  │ active   │ Account set up, project starts│
│ active   │ inactive │ No activity for 6+ months     │
│ inactive │ active   │ New project starts            │
└──────────┴──────────┴───────────────────────────────┘

Flow: pending → active ↔ inactive
```

---

## Contacts

Contact form submissions.

### Contact Statuses

```text
┌──────────┬────────┬────────────────────┐
│ Status   │ Color  │ Description        │
├──────────┼────────┼────────────────────┤
│ new      │ Blue   │ Unread submission  │
│ read     │ Purple │ Viewed by admin    │
│ replied  │ Green  │ Response sent      │
│ archived │ Gray   │ No longer active   │
└──────────┴────────┴────────────────────┘
```

### Contact Status Selection

```text
┌─────────────────────────────────┬──────────┐
│ Scenario                        │ Status   │
├─────────────────────────────────┼──────────┤
│ Contact form just submitted     │ new      │
│ Admin has read the message      │ read     │
│ Admin has responded             │ replied  │
│ Conversation complete           │ archived │
└─────────────────────────────────┴──────────┘
```

### Contact Workflow

```text
┌──────────┬──────────┬─────────────────────┐
│ From     │ To       │ Trigger             │
├──────────┼──────────┼─────────────────────┤
│ new      │ read     │ Admin views         │
│ read     │ replied  │ Admin responds      │
│ replied  │ archived │ Done                │
│ read     │ archived │ No response needed  │
└──────────┴──────────┴─────────────────────┘

Flow: new → read → replied → archived
```

---

## Invoices

Payment tracking.

### Invoice Statuses

```text
┌───────────┬────────┬──────────────────────────┐
│ Status    │ Color  │ Description              │
├───────────┼────────┼──────────────────────────┤
│ draft     │ Gray   │ Created but not sent     │
│ sent      │ Blue   │ Sent to client           │
│ viewed    │ Blue   │ Client opened invoice    │
│ partial   │ Amber  │ Partial payment received │
│ paid      │ Green  │ Fully paid               │
│ overdue   │ Red    │ Past due date            │
│ cancelled │ Gray   │ Voided/cancelled         │
└───────────┴────────┴──────────────────────────┘
```

### Invoice Status Selection

```text
┌─────────────────────────────────────┬───────────┐
│ Scenario                            │ Status    │
├─────────────────────────────────────┼───────────┤
│ Invoice created, not ready to send  │ draft     │
│ Invoice emailed to client           │ sent      │
│ Client opened invoice link          │ viewed    │
│ Some payment received               │ partial   │
│ Full amount paid                    │ paid      │
│ Past due date, unpaid               │ overdue   │
│ Invoice voided or cancelled         │ cancelled │
└─────────────────────────────────────┴───────────┘
```

### Invoice Workflow

```text
┌───────────┬───────────┬───────────────────┐
│ From      │ To        │ Trigger           │
├───────────┼───────────┼───────────────────┤
│ draft     │ sent      │ Invoice sent      │
│ sent      │ viewed    │ Client opens      │
│ viewed    │ partial   │ Partial payment   │
│ viewed    │ paid      │ Full payment      │
│ partial   │ paid      │ Remaining paid    │
│ sent      │ overdue   │ Past due date     │
│ Any       │ cancelled │ Invoice voided    │
└───────────┴───────────┴───────────────────┘

Flow: draft → sent → viewed → paid
```

---

## Threads

Message conversations.

### Thread Statuses

```text
┌──────────┬────────┬────────────────────┐
│ Status   │ Color  │ Description        │
├──────────┼────────┼────────────────────┤
│ active   │ Green  │ Open conversation  │
│ closed   │ Gray   │ Conversation ended │
│ archived │ Gray   │ Stored for records │
└──────────┴────────┴────────────────────┘
```

### Thread Status Selection

```text
┌───────────────────────────────────┬──────────┐
│ Scenario                          │ Status   │
├───────────────────────────────────┼──────────┤
│ Ongoing conversation              │ active   │
│ Issue resolved, no more messages  │ closed   │
│ Old thread stored for reference   │ archived │
└───────────────────────────────────┴──────────┘
```

### Thread Workflow

```text
┌──────────┬──────────┬─────────────────┐
│ From     │ To       │ Trigger         │
├──────────┼──────────┼─────────────────┤
│ active   │ closed   │ Issue resolved  │
│ closed   │ archived │ Record keeping  │
│ closed   │ active   │ Reopened        │
└──────────┴──────────┴─────────────────┘

Flow: active → closed → archived
```

---

## CSS Implementation

### Primary Status Variables (USE THESE)

Defined in `src/design-system/tokens/colors.css`:

```text
┌────────────────────┬─────────┬────────────────────────────────────────┐
│ Variable           │ Hex     │ Used For                               │
├────────────────────┼─────────┼────────────────────────────────────────┤
│ --status-active    │ #3b82f6 │ active, in-progress, contacted         │
│ --status-pending   │ #fbbf24 │ pending, new, on-hold                  │
│ --status-completed │ #10b981 │ completed, converted, replied, success │
│ --status-cancelled │ #ef4444 │ cancelled, lost, archived              │
│ --status-qualified │ #8b5cf6 │ qualified, in-review                   │
│ --status-inactive  │ #6b7280 │ read, inactive                         │
└────────────────────┴─────────┴────────────────────────────────────────┘
```

Each variable also has RGB and background variants:

- `--status-active-rgb: 59, 130, 246`
- `--status-active-bg: rgba(59, 130, 246, 0.15)`

### CSS Code

```css
:root {
  /* Primary status variables - USE THESE */
  --status-active: #3b82f6;              /* Blue - Active/In Progress */
  --status-active-rgb: 59, 130, 246;
  --status-active-bg: rgba(59, 130, 246, 0.15);

  --status-pending: #fbbf24;             /* Yellow - Pending/On Hold */
  --status-pending-rgb: 251, 191, 36;
  --status-pending-bg: rgba(251, 191, 36, 0.15);

  --status-completed: #10b981;           /* Green - Completed/Success */
  --status-completed-rgb: 16, 185, 129;
  --status-completed-bg: rgba(16, 185, 129, 0.15);

  --status-cancelled: #ef4444;           /* Red - Cancelled/Lost */
  --status-cancelled-rgb: 239, 68, 68;
  --status-cancelled-bg: rgba(239, 68, 68, 0.15);

  --status-qualified: #8b5cf6;           /* Purple - Qualified/Review */
  --status-qualified-rgb: 139, 92, 246;
  --status-qualified-bg: rgba(139, 92, 246, 0.15);

  --status-inactive: #6b7280;            /* Gray - Inactive/Read */
  --status-inactive-rgb: 107, 114, 128;
  --status-inactive-bg: rgba(107, 114, 128, 0.15);
}
```

### Usage in Components

**Status Badges** (`src/styles/shared/portal-badges.css`):

```css
.status-badge.status-active { background: var(--status-active); }
.status-badge.status-pending { background: var(--status-pending); }
.status-badge.status-completed { background: var(--status-completed); }
```

**Status Dots** (`src/styles/admin/client-detail.css`):

```css
.project-status.status-active::before { background: var(--status-active); }
.project-status.status-pending::before { background: var(--status-pending); }
```

### Legacy Variables (Deprecated)

These map to the primary variables for backwards compatibility:

```text
--color-status-new       → --status-pending
--color-status-pending   → --status-pending
--color-status-read      → --status-qualified
--color-status-responded → --status-completed
--color-status-completed → --status-completed
--color-status-archived  → --status-inactive
--color-status-overdue   → --status-cancelled
```

---

## TypeScript Types

```typescript
// Lead statuses - sales pipeline
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'in-progress'
  | 'converted'
  | 'lost'
  | 'on-hold'
  | 'cancelled';

// Project statuses - work lifecycle
export type ProjectStatus =
  | 'planning'
  | 'in-progress'
  | 'review'
  | 'completed'
  | 'on-hold';

// Client statuses - account state
export type ClientStatus = 'active' | 'inactive' | 'pending';

// Contact form statuses
export type ContactStatus = 'new' | 'read' | 'replied' | 'archived';

// Invoice statuses - payment lifecycle
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled';

// Message thread statuses
export type ThreadStatus = 'active' | 'closed' | 'archived';
```

---

## File References

```text
┌─────────────────────┬────────────────────────────────────────┐
│ Purpose             │ File                                   │
├─────────────────────┼────────────────────────────────────────┤
│ Status variables    │ src/design-system/tokens/colors.css    │
│ Status badges       │ src/styles/shared/portal-badges.css    │
│ Status dots         │ src/styles/admin/client-detail.css     │
│ TypeScript types    │ src/types/api.ts                       │
│ Server types        │ server/types/database.ts               │
│ Dropdown options    │ src/utils/table-dropdown.ts            │
│ Filter options      │ src/utils/table-filter.ts              │
└─────────────────────┴────────────────────────────────────────┘
```

---

## Change Log

```text
┌──────────────┬────────────────────────────────────────────────────┐
│ Date         │ Change                                             │
├──────────────┼────────────────────────────────────────────────────┤
│ Feb 3, 2026  │ Centralized status colors with --status-* vars     │
│ Feb 3, 2026  │ Fixed active=blue, completed=green consistency     │
│ Feb 3, 2026  │ Added status dots to project list items            │
│ Feb 2, 2026  │ Simplified lead statuses (removed pending, active) │
│ Feb 2, 2026  │ Created comprehensive status documentation         │
│ Feb 2, 2026  │ Added all CSS status color variables               │
└──────────────┴────────────────────────────────────────────────────┘
```
