# Invoice System

**Last Updated:** December 1, 2025

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

| Feature | Status | Description |
|---------|--------|-------------|
| Summary Cards | Complete | Total outstanding and total paid amounts |
| Invoice List from API | Complete | Dynamic list from backend with demo fallback |
| Status Badges | Complete | Visual status indicators (Pending, Paid, Overdue, etc.) |
| Preview | Complete | View invoice details in new tab |
| Download | Complete | Download invoice as PDF |
| PDF Generation | Complete | Full PDF generation with PDFKit |
| Project Association | Complete | Link invoices to specific projects |
| Demo Mode | Complete | Fallback demo data when backend unavailable |

---

## Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Express.js with TypeScript |
| Database | SQLite with async wrapper |
| Authentication | JWT tokens |
| Frontend | Vanilla TypeScript |
| API Communication | Fetch API |

### Data Flow

```
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

```
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

#### GET `/api/invoices/:id/pdf`

Download invoice as PDF.

**Authentication:** Required (JWT Bearer token)

**Response:** PDF file stream with headers:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="invoice-INV-2025-001.pdf"`

**PDF Contents:**
- Company header with logo placeholder
- Invoice number and dates (issue date, due date)
- Bill To section with client details
- Line items table with description, quantity, rate, amount
- Subtotal, tax (if applicable), and total
- Payment terms and notes

**Implementation (server/routes/invoices.ts):**

```typescript
import PDFDocument from 'pdfkit';

router.get('/:id/pdf', authenticateToken, asyncHandler(async (req, res) => {
  const invoiceId = parseInt(req.params.id);
  const invoice = await getInvoiceService().getInvoiceById(invoiceId);

  // Verify ownership
  if (req.user!.type === 'client' && invoice.clientId !== req.user!.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
  doc.fontSize(10).font('Helvetica')
     .text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' });

  // Bill To section, Line Items, Totals...
  doc.end();
}));
```

---

## Frontend Implementation

### TypeScript Module

Location: `src/features/client/client-portal.ts`

### API Base URL

```typescript
private static readonly INVOICES_API_BASE = 'http://localhost:3001/api/invoices';
```

### Key Methods

#### loadInvoices()

Fetches invoices from the API and renders the list with summary stats.

```typescript
private async loadInvoices(): Promise<void> {
  const invoicesContainer = document.querySelector('.invoices-list');
  const summaryOutstanding = document.querySelector('.summary-card:first-child .summary-value');
  const summaryPaid = document.querySelector('.summary-card:last-child .summary-value');

  try {
    const token = localStorage.getItem('client_auth_token');

    if (!token || token.startsWith('demo_token_')) {
      this.renderDemoInvoices(invoicesContainer as HTMLElement);
      return;
    }

    const response = await fetch(`${ClientPortalModule.INVOICES_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();

    // Update summary cards
    if (summaryOutstanding && data.summary) {
      summaryOutstanding.textContent = this.formatCurrency(data.summary.totalOutstanding);
    }
    if (summaryPaid && data.summary) {
      summaryPaid.textContent = this.formatCurrency(data.summary.totalPaid);
    }

    this.renderInvoicesList(invoicesContainer as HTMLElement, data.invoices || []);
  } catch (error) {
    this.renderDemoInvoices(invoicesContainer as HTMLElement);
  }
}
```

#### renderInvoicesList()

Renders invoice items with status badges and action buttons.

```typescript
private renderInvoicesList(container: HTMLElement, invoices: any[]): void {
  invoices.forEach((invoice) => {
    const invoiceElement = document.createElement('div');
    invoiceElement.className = 'invoice-item';

    const statusClass = this.getInvoiceStatusClass(invoice.status);
    const statusLabel = this.getInvoiceStatusLabel(invoice.status);

    invoiceElement.innerHTML = `
      <div class="invoice-info">
        <span class="invoice-number">${invoice.invoice_number}</span>
        <span class="invoice-date">${this.formatDate(invoice.created_at)}</span>
        <span class="invoice-project">${invoice.project_name || 'Project'}</span>
      </div>
      <div class="invoice-amount">${this.formatCurrency(invoice.amount_total)}</div>
      <span class="invoice-status ${statusClass}">${statusLabel}</span>
      <div class="invoice-actions">
        <button class="btn btn-outline btn-sm btn-preview-invoice">Preview</button>
        <button class="btn btn-outline btn-sm btn-download-invoice">Download</button>
      </div>
    `;

    container.appendChild(invoiceElement);
  });

  this.attachInvoiceActionListeners(container);
}
```

#### downloadInvoice()

Downloads invoice as PDF via blob fetch.

```typescript
private async downloadInvoice(invoiceId: number, invoiceNumber: string): Promise<void> {
  const token = localStorage.getItem('client_auth_token');

  if (!token || token.startsWith('demo_token_')) {
    alert('Invoice download not available in demo mode.');
    return;
  }

  try {
    const response = await fetch(
      `${ClientPortalModule.INVOICES_API_BASE}/${invoiceId}/pdf`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

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
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    alert('Failed to download invoice. Please try again.');
  }
}
```

#### Utility Methods

```typescript
// Get CSS class for status badge
private getInvoiceStatusClass(status: string): string {
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

// Format currency
private formatCurrency(amount: number): string {
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

| Status | Class | Color | Description |
|--------|-------|-------|-------------|
| Draft | `status-draft` | Gray | Not yet sent |
| Pending | `status-pending` | Yellow | Awaiting payment |
| Viewed | `status-pending` | Yellow | Client viewed invoice |
| Partial | `status-partial` | Blue | Partially paid |
| Paid | `status-paid` | Green | Fully paid |
| Overdue | `status-overdue` | Red | Past due date |
| Cancelled | `status-cancelled` | Gray | Invoice cancelled |

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

| File | Purpose |
|------|---------|
| `server/routes/invoices.ts` | Invoice API endpoints |
| `server/services/invoice-service.ts` | Invoice business logic |
| `src/features/client/client-portal.ts` | Frontend invoice handling (~200 lines) |
| `src/styles/pages/client-portal.css` | Invoice styling |
| `templates/pages/client-portal.ejs` | Invoices tab HTML |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [API Reference](../API_REFERENCE.md) - Complete API documentation
- [Settings](./SETTINGS.md) - Billing information
- [CSS Architecture](./CSS_ARCHITECTURE.md) - Styling system
