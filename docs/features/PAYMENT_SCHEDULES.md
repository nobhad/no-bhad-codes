# Payment Schedule System

**Status:** Complete
**Last Updated:** March 16, 2026

## Overview

The Payment Schedule System tracks per-project payment installments with flexible splits (50/50, quarterly, custom percentages). Replaces manual tracking of payment plans for client projects.

> **Implementation Note:** Payment installments are stored in the `payment_schedule_installments` table, separate from invoices. An installment may optionally link to an invoice via `invoice_id`. Status constants are defined in `server/config/constants.ts` as the single source of truth.

## Installment Statuses

|Status|Description|
|--------|-------------|
|`pending`|Payment not yet due or awaiting payment|
|`paid`|Payment received and confirmed|
|`overdue`|Past due date, payment not received|
|`cancelled`|Installment cancelled|

## Payment Methods

|Method|Description|
|--------|-------------|
|`check`|Payment by check|
|`card`|Credit/debit card|
|`ach`|ACH bank transfer|
|`cash`|Cash payment|
|`other`|Other payment method|

## Features

### 1. Flexible Schedule Creation

Create payment schedules with any split structure:

- **Custom installments** — specify exact amounts and dates per installment
- **Percentage splits** — define splits as percentages with day offsets from a start date (e.g., 4x 25% quarterly)
- **Contract linking** — optionally tie installments to a contract

### 2. Client Portal View

Clients see their payment schedule in the portal:

- Read-only list of installments with status badges
- Summary card showing total, paid, pending, and overdue amounts
- Endpoints: `GET /api/payment-schedules/my` and `GET /api/payment-schedules/my/summary`

### 3. Overdue Detection

Batch operation to detect and update overdue installments:

- `POST /api/payment-schedules/check-overdue` updates all pending installments past their due date to `overdue` status
- Can be triggered manually or via scheduled task

### 4. Mark as Paid

Admin marks installments as paid with optional payment details:

- Payment date, amount, method, and reference
- Defaults paid amount to the installment amount if not specified
- **Receipt auto-generation**: When an installment with a linked `invoice_id` is marked paid, a receipt PDF is automatically generated and an email notification is sent to the client

## Database Schema

```sql
CREATE TABLE payment_schedule_installments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
  installment_number INTEGER NOT NULL,
  label TEXT,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_date DATE,
  paid_amount DECIMAL(10,2),
  payment_method TEXT,
  payment_reference TEXT,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  notes TEXT,
  reminder_sent_at DATETIME,
  reminder_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Admin

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/payment-schedules?projectId=X`|List installments by project|
|GET|`/api/payment-schedules?clientId=X`|List installments by client|
|GET|`/api/payment-schedules/overdue`|Get all overdue installments|
|GET|`/api/payment-schedules/:id`|Get single installment|
|POST|`/api/payment-schedules`|Create schedule (batch of installments)|
|POST|`/api/payment-schedules/from-split`|Create from percentage split|
|PUT|`/api/payment-schedules/:id`|Update installment|
|POST|`/api/payment-schedules/:id/mark-paid`|Mark as paid|
|DELETE|`/api/payment-schedules/:id`|Delete installment|
|POST|`/api/payment-schedules/check-overdue`|Batch update overdue|

### Client Portal

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/payment-schedules/my`|Client's installments|
|GET|`/api/payment-schedules/my/summary`|Payment summary (totals)|

## Service Methods

The `payment-schedule-service.ts` provides:

### Schedule Creation

- `createSchedule(projectId, clientId, installments[], contractId?)` — batch create installments
- `createFromSplit(projectId, clientId, totalAmount, splits[], startDate, contractId?)` — create from percentage splits

### Queries

- `getByProject(projectId)` — all installments for a project
- `getByClient(clientId)` — all installments for a client
- `getInstallment(id)` — single installment
- `getOverdue()` — all overdue installments

### Mutations

- `markPaid(id, { paidDate, paidAmount, paymentMethod, paymentReference })` — mark as paid
- `updateInstallment(id, data)` — update installment fields
- `deleteInstallment(id)` — delete installment

### Summary & Batch

- `getClientSummary(clientId)` — totals: paid, pending, overdue amounts and counts
- `checkAndUpdateOverdue()` — batch update pending to overdue where past due date

## Usage Examples

### Create Quarterly Payment Schedule

```typescript
const response = await fetch('/api/payment-schedules/from-split', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_id: 7,
    client_id: 3,
    total_amount: 4500,
    start_date: '2026-03-01',
    splits: [
      { label: 'Q1 Payment', percent: 25, offsetDays: 0 },
      { label: 'Q2 Payment', percent: 25, offsetDays: 30 },
      { label: 'Q3 Payment', percent: 25, offsetDays: 60 },
      { label: 'Q4 Payment', percent: 25, offsetDays: 90 }
    ]
  })
});
// Creates 4 installments: $1,125 each on Mar 1, Mar 31, Apr 30, May 30
```

### Mark Installment as Paid

```typescript
await fetch('/api/payment-schedules/42/mark-paid', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paid_date: '2026-03-01',
    payment_method: 'check',
    payment_reference: 'Check #1234'
  })
});
```

## SSOT Chain

- **Backend constants**: `server/config/constants.ts` — `PAYMENT_INSTALLMENT_STATUSES`, `PAYMENT_METHODS`
- **Frontend UI configs**: `src/react/features/admin/types.ts` — `PAYMENT_INSTALLMENT_STATUS_CONFIG`, `PAYMENT_METHOD_LABELS`
- **Filter options**: `src/react/features/admin/shared/filterConfigs.ts` — derived via `configToFilterOptions()`

## Files

### Created

- `server/database/migrations/107_payment_schedule_installments.sql`
- `server/database/entities/payment-schedule.ts`
- `server/services/payment-schedule-service.ts`
- `server/routes/payment-schedules.ts` (barrel)
- `server/routes/payment-schedules/admin.ts`
- `server/routes/payment-schedules/client.ts`
- `server/routes/payment-schedules/shared.ts`
- `docs/features/PAYMENT_SCHEDULES.md`

### Modified

- `server/config/constants.ts` — added status and payment method constants
- `server/database/entities/index.ts` — added payment schedule exports
- `server/app.ts` — registered payment schedule router
- `src/constants/api-endpoints.ts` — added payment schedule endpoints
- `src/react/features/admin/types.ts` — added status config and labels
- `src/react/features/admin/shared/filterConfigs.ts` — added filter config

## Change Log

### March 16, 2026 — Receipt Auto-Generation on Mark-Paid

- `POST /:id/mark-paid` now auto-generates a receipt PDF when installment has a linked `invoice_id`
- Receipt includes billing address and uses billing-preferred fields (COALESCE)
- Email notification sent to client with receipt summary
- Non-critical: receipt/email failures don't block the mark-paid operation

### March 13, 2026 — Initial Implementation

- Created payment schedule installment system
- Supports flexible splits (custom amounts, percentage-based)
- Admin CRUD + mark-paid + overdue detection
- Client portal read-only view with summary
- SSOT chain: constants.ts → types.ts → filterConfigs.ts
