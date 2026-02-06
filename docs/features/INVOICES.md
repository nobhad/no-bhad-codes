# Invoice System

**Last Updated:** February 6, 2026

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Backend API](#backend-api)
5. [Frontend Implementation](#frontend-implementation)
6. [HTML Structure](#html-structure)
7. [Invoice Status](#invoice-status)
8. [Styling](#styling)
9. [File Locations](#file-locations)
10. [Related Documentation](#related-documentation)

---

## Overview

The Invoice System provides clients with a complete view of their payment history, outstanding balances, and invoice details. Invoices are generated automatically when project milestones are reached or manually by administrators.

**Access:** Client Portal > Invoices tab (`tab-invoices`)

---

## Features

|Feature|Status|Description|
|---------|--------|-------------|
|Summary Cards|Complete|Total outstanding and total paid amounts|
|Invoice List from API|Complete|Dynamic list from backend with demo fallback|
|Status Badges|Complete|Visual status indicators (Pending, Paid, Overdue, etc.)|
|Preview|Complete|View invoice details in new tab|
|Download|Complete|Download invoice as PDF|
|PDF Generation|Complete|Full PDF generation with pdf-lib (see [PDF_GENERATION.md](./PDF_GENERATION.md))|
|Project Association|Complete|Link invoices to specific projects|
|Demo Mode|Complete|Fallback demo data when backend unavailable|
|Deposit Invoices|Complete|Create deposit invoices with percentage tracking|
|Credit Application|Complete|Apply paid deposits as credits to standard invoices|
|Edit Draft Invoices|Complete|Modify invoice line items and notes before sending|
|Payment Plan Templates|Complete|Reusable payment structures (50/50, 30/30/40, etc.)|
|Milestone-Linked Invoices|Complete|Link invoices to project milestones|
|Invoice Scheduling|Complete|Schedule future invoice generation|
|Recurring Invoices|Complete|Automated recurring invoices (weekly/monthly/quarterly)|
|Payment Reminders|Complete|Automated reminder emails based on due date|
|Scheduler Service|Complete|Background job processing for automation|
|Delete/Void Invoice|Complete|Delete drafts or void sent invoices|
|Duplicate Invoice|Complete|Clone existing invoice as new draft|
|Record Payment|Complete|Record partial or full payments with method tracking|
|Invoice Search|Complete|Search with filters, date range, pagination|
|Auto-Mark Overdue|Complete|Scheduler automatically marks past-due invoices|
|Manual Reminder|Complete|Send payment reminder on demand|
|**Tax Support**|Complete|Invoice-level and line-item tax rates with calculation|
|**Discounts**|Complete|Percentage or fixed discounts at invoice or line level|
|**Late Fees**|Complete|Automatic late fee calculation (flat, percentage, daily)|
|**Payment Terms Presets**|Complete|Net 15, Net 30, Net 60, Due on Receipt, custom terms|
|**Payment History**|Complete|Full payment history tracking per invoice|
|**A/R Aging Report**|Complete|Accounts receivable aging by bucket (current, 1-30, 31-60, 61-90, 90+)|
|**Internal Notes**|Complete|Admin-only notes not visible to clients|
|**Custom Invoice Numbers**|Complete|Custom prefix and sequential numbering|
|**Comprehensive Stats**|Complete|Revenue, outstanding, averages, status breakdown, monthly trends|

---

## Architecture

### Technology Stack

|Component|Technology|
|-----------|------------|
|Backend|Express.js with TypeScript|
|Database|SQLite with async wrapper|
|Authentication|HttpOnly cookies (JWT); Bearer fallback|
|Frontend|Vanilla TypeScript|
|API Communication|Fetch API|

### Data Flow

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client Portal │ ──> │  Invoices API    │ ──> │  Database       │
│   (TypeScript)  │     │  (Express)       │     │  (SQLite)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        v                       v
┌─────────────────┐     ┌──────────────────┐
│  Summary Cards  │     │  Email Service   │
│  Invoice List   │     │  (Notifications) │
└─────────────────┘     └──────────────────┘
```

---

## Backend API

### Base URL

```text
/api/invoices
```

### Endpoints

#### GET `/api/invoices/me`

Get all invoices for the authenticated client with summary statistics.

**Authentication:** Required (JWT Bearer token)

**Response (200 OK):**

```json
{
  "success": true,
  "invoices": [
    {
      "id": 1,
      "invoice_number": "INV-2025-001",
      "client_id": 5,
      "project_id": 1,
      "amount_total": 2500.00,
      "amount_paid": 0,
      "status": "sent",
      "due_date": "2025-12-30T00:00:00.000Z",
      "created_at": "2025-11-30T10:00:00.000Z",
      "project_name": "Website Redesign"
    }
  ],
  "count": 1,
  "summary": {
    "totalOutstanding": 2500.00,
    "totalPaid": 1500.00
  }
}
```

---

#### GET `/api/invoices/:id`

Get a specific invoice by ID.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "invoice": {
    "id": 1,
    "invoice_number": "INV-2025-001",
    "line_items": [...],
    ...
  }
}
```

---

#### GET `/api/invoices/client/:clientId`

Get all invoices for a specific client (admin use).

---

#### GET `/api/invoices/project/:projectId`

Get all invoices for a specific project.

---

#### POST `/api/invoices`

Create a new invoice.

**Authentication:** Required
**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "lineItems": [
    {
      "description": "Website Design",
      "quantity": 1,
      "rate": 2500,
      "amount": 2500
    }
  ],
  "notes": "Payment due within 30 days",
  "terms": "Net 30"
}
```

---

#### PUT `/api/invoices/:id/status`

Update invoice status.

**Request:**

```json
{
  "status": "paid",
  "paymentData": {
    "amountPaid": 2500,
    "paymentMethod": "bank_transfer",
    "paymentReference": "TXN-12345"
  }
}
```

**Valid Statuses:** `draft`, `sent`, `viewed`, `partial`, `paid`, `overdue`, `cancelled`

---

#### POST `/api/invoices/:id/send`

Send invoice to client (triggers email notification).

---

#### POST `/api/invoices/:id/pay`

Mark invoice as paid.

---

#### PUT `/api/invoices/:id`

Update a draft invoice.

**Authentication:** Required (Admin only)

**Request:**

```json
{
  "lineItems": [
    {
      "description": "Updated service description",
      "quantity": 1,
      "rate": 2500,
      "amount": 2500
    }
  ],
  "notes": "Updated payment notes"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Invoice updated successfully"
}
```

**Notes:**

- Only draft invoices can be edited
- Returns 400 error if invoice status is not 'draft'

---

#### POST `/api/invoices/deposit`

Create a deposit invoice for a project.

**Authentication:** Required (Admin only)

**Request:**

```json
{
  "projectId": 1,
  "clientId": 5,
  "amount": 1000,
  "percentage": 50,
  "description": "Project deposit"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Deposit invoice created successfully",
  "invoice": {
    "id": 15,
    "invoice_number": "INV-2026-015",
    "invoice_type": "deposit",
    "amount_total": 1000
  }
}
```

---

#### GET `/api/invoices/deposits/:projectId`

Get available deposits for a project (paid but not fully applied).

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "deposits": [
    {
      "invoice_id": 10,
      "invoice_number": "INV-2026-010",
      "total_amount": 1000,
      "amount_applied": 500,
      "available_amount": 500,
      "paid_date": "2026-01-15T10:00:00Z"
    }
  ]
}
```

---

#### POST `/api/invoices/:id/apply-credit`

Apply a deposit credit to an invoice.

**Authentication:** Required (Admin only)

**Request:**

```json
{
  "depositInvoiceId": 10,
  "amount": 500
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Credit applied successfully"
}
```

**Error Responses:**

- `400` - Credit amount exceeds available balance
- `404` - Invoice or deposit not found

---

#### GET `/api/invoices/:id/credits`

Get credits applied to an invoice.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "credits": [
    {
      "id": 1,
      "invoice_id": 15,
      "deposit_invoice_id": 10,
      "deposit_invoice_number": "INV-2026-010",
      "amount": 500,
      "applied_at": "2026-01-20T14:30:00Z"
    }
  ],
  "totalCredits": 500
}
```

---

#### GET `/api/invoices/:id/pdf`

Download or preview invoice as PDF.

**Authentication:** Required (JWT Bearer token)

**Query Parameters:**

- `preview=true` - Opens inline in browser tab
- `preview=false` (default) - Downloads as file attachment

**Response:** PDF file with headers:

- `Content-Type: application/pdf`
- `Content-Disposition: inline|attachment; filename="INV-2026-001.pdf"`

**PDF Contents:**

- Professional header with 75pt logo (aspect ratio preserved)
- Business name, owner, tagline, email, website
- "INVOICE" title (28pt, right-aligned)
- Invoice number and dates
- Bill To section with client details
- Line items table
- Totals section
- Payment methods (Zelle, Venmo)
- Terms and notes

**Implementation:** Uses pdf-lib library. See [PDF_GENERATION.md](./PDF_GENERATION.md) for full documentation.

```typescript
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib';

// PDF generated with pdf-lib, sent as Buffer
const pdfBytes = await generateInvoicePdf(pdfData);
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `${disposition}; filename="${invoiceNumber}.pdf"`);
res.send(Buffer.from(pdfBytes));
```

---

### Payment Plan Templates

#### GET `/api/invoices/payment-plans`

Get all payment plan templates.

**Response (200 OK):**

```json
{
  "success": true,
  "templates": [
    {
      "id": 1,
      "name": "50/50 Split",
      "description": "50% upfront, 50% on completion",
      "payments": [
        { "percentage": 50, "trigger": "upfront" },
        { "percentage": 50, "trigger": "completion" }
      ],
      "isDefault": true
    }
  ]
}
```

#### POST `/api/invoices/payment-plans`

Create a new payment plan template.

#### DELETE `/api/invoices/payment-plans/:id`

Delete a payment plan template.

#### POST `/api/invoices/generate-from-plan`

Generate invoices from a payment plan template for a project.

---

### Milestone-Linked Invoices

#### POST `/api/invoices/milestone/:milestoneId`

Create an invoice linked to a specific milestone.

#### GET `/api/invoices/milestone/:milestoneId`

Get all invoices linked to a milestone.

#### PUT `/api/invoices/:id/link-milestone`

Link an existing invoice to a milestone.

---

### Invoice Scheduling

#### POST `/api/invoices/schedule`

Schedule a future invoice for automatic generation.

#### GET `/api/invoices/scheduled`

Get all scheduled invoices (optionally filter by project).

#### DELETE `/api/invoices/scheduled/:id`

Cancel a scheduled invoice.

---

### Recurring Invoices

#### POST `/api/invoices/recurring`

Create a recurring invoice pattern.

**Frequency Options:** `weekly`, `monthly`, `quarterly`

#### GET `/api/invoices/recurring`

Get all recurring invoice patterns.

#### PUT `/api/invoices/recurring/:id`

Update a recurring invoice pattern.

#### POST `/api/invoices/recurring/:id/pause`

Pause a recurring invoice.

#### POST `/api/invoices/recurring/:id/resume`

Resume a paused recurring invoice.

#### DELETE `/api/invoices/recurring/:id`

Delete a recurring invoice pattern.

---

### Payment Reminders

#### GET `/api/invoices/:id/reminders`

Get all scheduled reminders for an invoice.

**Reminder Types:**

|Type|When|
|------|------|
|`upcoming`|3 days before due|
|`due`|On due date|
|`overdue_3`|3 days overdue|
|`overdue_7`|7 days overdue|
|`overdue_14`|14 days overdue|
|`overdue_30`|30 days overdue|

#### POST `/api/invoices/reminders/:id/skip`

Skip a scheduled reminder.

---

### Advanced Features

#### Tax & Discount

|Method|Endpoint|Description|
|--------|----------|-------------|
|PUT|`/api/invoices/:id/tax-discount`|Update tax rate and discount|

#### Late Fees

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/invoices/:id/late-fee`|Get late fee information|
|POST|`/api/invoices/:id/apply-late-fee`|Apply late fee to invoice|
|POST|`/api/invoices/process-late-fees`|Process late fees for all overdue invoices|

#### Payment History

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/invoices/:id/payments`|Get payment history for invoice|
|POST|`/api/invoices/:id/record-payment`|Record a payment|
|POST|`/api/invoices/:id/record-payment-with-history`|Record payment with full history tracking|
|GET|`/api/invoices/all-payments`|Get all payments across invoices|

#### Payment Terms

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/invoices/payment-terms`|Get all payment term presets|
|POST|`/api/invoices/payment-terms`|Create a payment term preset|
|POST|`/api/invoices/:id/apply-terms`|Apply payment terms to invoice|

#### A/R Aging Report

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/invoices/aging-report`|Get accounts receivable aging report|

#### Internal Notes

|Method|Endpoint|Description|
|--------|----------|-------------|
|PUT|`/api/invoices/:id/internal-notes`|Update internal notes (admin only)|

#### Custom Invoice Numbers

|Method|Endpoint|Description|
|--------|----------|-------------|
|POST|`/api/invoices/with-custom-number`|Create invoice with custom number|
|GET|`/api/invoices/number/:invoiceNumber`|Get invoice by invoice number|

#### Statistics

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/invoices/comprehensive-stats`|Get comprehensive invoice statistics|

#### Other Operations

|Method|Endpoint|Description|
|--------|----------|-------------|
|POST|`/api/invoices/:id/duplicate`|Duplicate an invoice as draft|
|POST|`/api/invoices/search`|Search invoices with filters|
|POST|`/api/invoices/check-overdue`|Check and mark overdue invoices|
|POST|`/api/invoices/:id/send-reminder`|Send manual payment reminder|
|POST|`/api/invoices/:id/generate/intake/:intakeId`|Generate invoice from intake form|

---

## Frontend Implementation

### TypeScript Module

Location: `src/features/client/modules/portal-invoices.ts`

### API Base URL

```typescript
const INVOICES_API_BASE = '/api/invoices';
```

### Key Methods

#### loadInvoices()

Fetches invoices from the API and renders the list with summary stats.

```typescript
// src/features/client/modules/portal-invoices.ts
import { formatCurrency } from '../../../utils/format-utils';

export async function loadInvoices(ctx: ClientPortalContext): Promise<void> {
  const invoicesContainer = document.querySelector('.invoices-list');
  const summaryOutstanding = document.querySelector('.summary-card:first-child .summary-value');
  const summaryPaid = document.querySelector('.summary-card:last-child .summary-value');

  if (!invoicesContainer) return;

  try {
    // Demo mode check using context
    if (ctx.isDemo()) {
      renderDemoInvoices(invoicesContainer as HTMLElement, ctx);
      return;
    }

    const response = await fetch(`${INVOICES_API_BASE}/me`, {
      credentials: 'include' // HttpOnly cookie authentication
    });

    if (!response.ok) {
      throw new Error('Failed to fetch invoices');
    }

    const data = await response.json();

    // Update summary cards
    if (summaryOutstanding && data.summary) {
      summaryOutstanding.textContent = formatCurrency(data.summary.totalOutstanding);
    }
    if (summaryPaid && data.summary) {
      summaryPaid.textContent = formatCurrency(data.summary.totalPaid);
    }

    renderInvoicesList(invoicesContainer as HTMLElement, data.invoices || [], ctx);
  } catch (error) {
    console.error('Error loading invoices:', error);
    renderDemoInvoices(invoicesContainer as HTMLElement, ctx);
  }
}
```

#### renderInvoicesList()

Renders invoice items with status badges and action buttons.

```typescript
// src/features/client/modules/portal-invoices.ts
function renderInvoicesList(
  container: HTMLElement,
  invoices: PortalInvoice[],
  ctx: ClientPortalContext
): void {
  // Clear existing items
  const existingItems = container.querySelectorAll('.invoice-item');
  existingItems.forEach((item) => item.remove());

  const noInvoicesMsg = container.querySelector('.no-invoices-message');
  if (noInvoicesMsg) noInvoicesMsg.remove();

  if (invoices.length === 0) {
    const noInvoices = document.createElement('p');
    noInvoices.className = 'no-invoices-message';
    noInvoices.textContent =
      'No invoices yet. Your first invoice will appear here once your project begins.';
    container.appendChild(noInvoices);
    return;
  }

  invoices.forEach((invoice) => {
    const invoiceElement = document.createElement('div');
    invoiceElement.className = 'invoice-item';
    invoiceElement.dataset.invoiceId = String(invoice.id);

    const statusClass = getInvoiceStatusClass(invoice.status);
    const statusLabel = getInvoiceStatusLabel(invoice.status);

    invoiceElement.innerHTML = `
      <div class="invoice-info">
        <span class="invoice-number">${ctx.escapeHtml(invoice.invoice_number)}</span>
        <span class="invoice-date">${ctx.formatDate(invoice.created_at)}</span>
        <span class="invoice-project">${ctx.escapeHtml(invoice.project_name || 'Project')}</span>
      </div>
      <div class="invoice-amount">${formatCurrency(invoice.amount_total)}</div>
      <span class="invoice-status ${statusClass}">${statusLabel}</span>
      <div class="invoice-actions">
        <button class="btn btn-outline btn-sm btn-preview-invoice"
                data-invoice-id="${invoice.id}">Preview</button>
        <button class="btn btn-outline btn-sm btn-download-invoice"
                data-invoice-id="${invoice.id}"
                data-invoice-number="${ctx.escapeHtml(invoice.invoice_number)}">Download</button>
      </div>
    `;

    container.appendChild(invoiceElement);
  });

  attachInvoiceActionListeners(container, ctx);
}
```

#### downloadInvoice()

Downloads invoice as PDF via blob fetch.

```typescript
// src/features/client/modules/portal-invoices.ts
async function downloadInvoice(
  invoiceId: number,
  invoiceNumber: string,
  ctx: ClientPortalContext
): Promise<void> {
  if (ctx.isDemo()) {
    alert('Invoice download not available in demo mode.');
    return;
  }

  try {
    const response = await fetch(`${INVOICES_API_BASE}/${invoiceId}/pdf`, {
      credentials: 'include' // HttpOnly cookie authentication
    });

    if (!response.ok) {
      throw new Error('Failed to download invoice');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    alert('Failed to download invoice. Please try again.');
  }
}
```

#### Utility Methods

```typescript
// src/features/client/modules/portal-invoices.ts

// Get CSS class for status badge
function getInvoiceStatusClass(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'status-draft',
    sent: 'status-pending',
    viewed: 'status-pending',
    partial: 'status-partial',
    paid: 'status-paid',
    overdue: 'status-overdue',
    cancelled: 'status-cancelled'
  };
  return statusMap[status] || 'status-pending';
}

// Get display label for invoice status
function getInvoiceStatusLabel(status: string): string {
  const labelMap: Record<string, string> = {
    draft: 'Draft',
    sent: 'Pending',
    viewed: 'Viewed',
    partial: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled'
  };
  return labelMap[status] || 'Pending';
}

// Format currency (imported from shared utils)
// src/utils/format-utils.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
}
```

---

## HTML Structure

### Invoices Tab

```html
<!-- templates/pages/client-portal.ejs -->
<div class="tab-content" id="tab-invoices">
  <div class="page-header">
    <h2>Invoices</h2>
  </div>

  <!-- Invoice Summary -->
  <div class="invoice-summary">
    <div class="summary-card cp-shadow">
      <span class="summary-label">Total Outstanding</span>
      <span class="summary-value">$0.00</span>
    </div>
    <div class="summary-card cp-shadow">
      <span class="summary-label">Total Paid</span>
      <span class="summary-value">$0.00</span>
    </div>
  </div>

  <!-- Invoices List -->
  <div class="invoices-list cp-shadow">
    <h3>Invoice History</h3>
    <!-- Invoice items rendered dynamically -->
    <p class="no-invoices-message">
      No invoices yet. Your first invoice will appear here once your project begins.
    </p>
  </div>
</div>
```

### Invoice Item (Rendered Dynamically)

```html
<div class="invoice-item" data-invoice-id="1">
  <div class="invoice-info">
    <span class="invoice-number">INV-2025-001</span>
    <span class="invoice-date">Nov 30, 2025</span>
    <span class="invoice-project">Website Redesign</span>
  </div>
  <div class="invoice-amount">$2,500.00</div>
  <span class="invoice-status status-pending">Pending</span>
  <div class="invoice-actions">
    <button class="btn btn-outline btn-sm btn-preview-invoice">Preview</button>
    <button class="btn btn-outline btn-sm btn-download-invoice">Download</button>
  </div>
</div>
```

---

## Invoice Status

### Status Types

|Status|Class|Color|Description|
|--------|-------|-------|-------------|
|Draft|`status-draft`|Gray|Not yet sent|
|Pending|`status-pending`|Yellow|Awaiting payment|
|Viewed|`status-pending`|Yellow|Client viewed invoice|
|Partial|`status-partial`|Blue|Partially paid|
|Paid|`status-paid`|Green|Fully paid|
|Overdue|`status-overdue`|Red|Past due date|
|Cancelled|`status-cancelled`|Gray|Invoice cancelled|

---

## Deposit Invoices & Credits

### Invoice Types

|Type|Description|
|------|-------------|
|`standard`|Regular invoice for services|
|`deposit`|Upfront deposit payment (tracked separately)|

### Creating a Deposit Invoice

Deposit invoices are created through the admin project details view:

1. Navigate to Project Details > Invoices tab
2. Click "Create Invoice"
3. Select "Deposit Invoice" from the type dropdown
4. Enter description and amount
5. Optionally set deposit percentage

**Database Fields:**

- `invoice_type`: 'deposit' (default: 'standard')
- `deposit_for_project_id`: Links to project
- `deposit_percentage`: Optional percentage value

### Applying Deposit Credits

When a deposit invoice is paid, it can be applied as credit to standard invoices:

1. View outstanding invoice in project details
2. Click "Apply Credit" button
3. Select from available paid deposits
4. Enter credit amount (up to available balance)
5. Credit is recorded and invoice total adjusted

**Credit Tracking (invoice_credits table):**

- `invoice_id`: Invoice receiving the credit
- `deposit_invoice_id`: Deposit invoice being applied
- `amount`: Credit amount applied
- `applied_at`: Timestamp
- `applied_by`: Admin who applied

### PDF Generation for Deposits

**Deposit Invoice PDF:**

- Title shows "DEPOSIT INVOICE" instead of "INVOICE"
- Shows deposit percentage if applicable
- Clear labeling that this is a deposit payment

**Standard Invoice with Credits:**

After line items, shows credit section:

```text
DEPOSIT CREDITS APPLIED:
  Credit from INV-2026-001     -$500.00
                               ─────────
                               TOTAL DUE:  $1,500.00
```

---

## Styling

### Summary Cards

```css
.invoice-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  background: var(--color-neutral-100);
  border: 4px solid #000000;
  padding: 1.5rem;
  text-align: center;
}

.summary-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-dark);
}
```

### Invoice List

```css
.invoices-list {
  background: var(--color-neutral-300);
  border: 4px solid #000000;
  padding: 1.5rem;
}

.invoice-item {
  display: grid;
  grid-template-columns: 2fr 1fr auto auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-neutral-200);
}
```

### Status Badges

```css
.invoice-status {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-pending { background: #fef3c7; color: #92400e; }
.status-paid { background: #d1fae5; color: #065f46; }
.status-overdue { background: #fee2e2; color: #991b1b; }
.status-draft { background: var(--color-neutral-200); color: var(--color-dark); }
```

---

## File Locations

|File|Purpose|
|------|---------|
|`server/routes/invoices.ts`|Invoice API endpoints + PDF generation|
|`server/services/invoice-service.ts`|Invoice business logic|
|`src/features/client/modules/portal-invoices.ts`|Frontend invoice handling (~250 lines)|
|`src/styles/client-portal/invoices.css`|Invoice styling|
|`client/portal.html`|Invoices tab HTML (tab-invoices section)|

---

## Scheduler Service

The scheduler service (`server/services/scheduler-service.ts`) handles automated invoice tasks.

### Configuration

|Environment Variable|Default|Description|
|---------------------|---------|-------------|
|`SCHEDULER_ENABLED`|`true`|Enable/disable scheduler|
|`SCHEDULER_REMINDERS`|`true`|Enable payment reminders|
|`SCHEDULER_SCHEDULED`|`true`|Enable scheduled invoice generation|
|`SCHEDULER_RECURRING`|`true`|Enable recurring invoice generation|

### Scheduled Jobs

|Job|Schedule|Description|
|-----|----------|-------------|
|Reminder Check|Every hour at :00|Processes due payment reminders|
|Invoice Generation|Daily at 1:00 AM|Generates scheduled and recurring invoices|

### Reminder Email Sequence

When an invoice is sent, reminders are automatically scheduled:

1. **3 days before due** - "Payment Reminder: Invoice Due Soon"
2. **On due date** - "Payment Due Today"
3. **3 days overdue** - "Payment Overdue"
4. **7 days overdue** - "URGENT: Payment Overdue"
5. **14 days overdue** - "FINAL NOTICE"
6. **30 days overdue** - "COLLECTION NOTICE"

---

## Database Schema

### New Tables (Migration 028)

#### payment_plan_templates

|Column|Type|Description|
|--------|------|-------------|
|`id`|INTEGER|Primary key|
|`name`|TEXT|Template name|
|`description`|TEXT|Template description|
|`payments`|JSON|Array of payment definitions|
|`is_default`|BOOLEAN|Default template flag|
|`created_at`|DATETIME|Creation timestamp|

#### invoice_reminders

|Column|Type|Description|
|--------|------|-------------|
|`id`|INTEGER|Primary key|
|`invoice_id`|INTEGER|FK to invoices|
|`reminder_type`|TEXT|Type (upcoming, due, overdue_*)|
|`scheduled_date`|DATE|When to send|
|`sent_at`|DATETIME|When sent (null if pending)|
|`status`|TEXT|pending, sent, skipped, failed|
|`created_at`|DATETIME|Creation timestamp|

#### scheduled_invoices

|Column|Type|Description|
|--------|------|-------------|
|`id`|INTEGER|Primary key|
|`project_id`|INTEGER|FK to projects|
|`client_id`|INTEGER|FK to clients|
|`scheduled_date`|DATE|Generation date|
|`trigger_type`|TEXT|date or milestone_complete|
|`trigger_milestone_id`|INTEGER|FK to milestones (optional)|
|`line_items`|JSON|Invoice line items|
|`notes`|TEXT|Invoice notes|
|`terms`|TEXT|Invoice terms|
|`status`|TEXT|pending, generated, cancelled|
|`generated_invoice_id`|INTEGER|FK to generated invoice|
|`created_at`|DATETIME|Creation timestamp|

#### recurring_invoices

|Column|Type|Description|
|--------|------|-------------|
|`id`|INTEGER|Primary key|
|`project_id`|INTEGER|FK to projects|
|`client_id`|INTEGER|FK to clients|
|`frequency`|TEXT|weekly, monthly, quarterly|
|`day_of_month`|INTEGER|1-28 for monthly|
|`day_of_week`|INTEGER|0-6 for weekly|
|`line_items`|JSON|Invoice line items|
|`notes`|TEXT|Invoice notes|
|`terms`|TEXT|Invoice terms|
|`start_date`|DATE|Start date|
|`end_date`|DATE|End date (optional)|
|`next_generation_date`|DATE|Next generation date|
|`last_generated_at`|DATETIME|Last generation timestamp|
|`is_active`|BOOLEAN|Active status|
|`created_at`|DATETIME|Creation timestamp|

### Schema Updates to invoices Table

|Column|Type|Description|
|--------|------|-------------|
|`milestone_id`|INTEGER|FK to milestones (optional)|
|`payment_plan_id`|INTEGER|FK to payment_plan_templates (optional)|

---

## All Implementation Files

|File|Purpose|
|------|---------|
|`server/routes/invoices.ts`|Invoice API endpoints + PDF generation|
|`server/services/invoice-service.ts`|Invoice business logic (~800 lines)|
|`server/services/scheduler-service.ts`|Automated task scheduling|
|`server/database/migrations/028_invoice_enhancements.sql`|New tables migration|
|`src/features/client/modules/portal-invoices.ts`|Frontend invoice handling (~250 lines)|
|`src/styles/client-portal/invoices.css`|Invoice styling|
|`client/portal.html`|Invoices tab HTML (tab-invoices section)|

---

## Soft Delete Behavior

When an invoice is deleted via `DELETE /api/invoices/:id`:

- **Paid invoices cannot be deleted** - Returns 400 error to protect financial records
- Unpaid invoices are soft-deleted (marked with `deleted_at` timestamp)
- Invoice can be restored within 30 days via admin panel
- After 30 days, permanent deletion occurs automatically

**Related API Endpoints:**

- `DELETE /api/invoices/:id` - Soft delete an invoice (unpaid only)
- `GET /api/admin/deleted-items?type=invoice` - List deleted invoices
- `POST /api/admin/deleted-items/invoice/:id/restore` - Restore an invoice

**Change Log Entry (February 6, 2026):**

- Converted hard delete to soft delete with 30-day recovery window
- Paid invoices now blocked from deletion
- Added `deleted_at` and `deleted_by` columns
- All queries now filter out soft-deleted invoices

---

## Related Documentation

- [PDF Generation](./PDF_GENERATION.md) - Complete PDF system documentation
- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [API Reference](../API_REFERENCE.md) - Complete API documentation
- [Settings](./SETTINGS.md) - Billing information
- [CSS Architecture](../design/CSS_ARCHITECTURE.md) - Styling system
