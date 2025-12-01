# Invoice System

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Invoice Summary](#invoice-summary)
4. [Invoice List](#invoice-list)
5. [Invoice Status](#invoice-status)
6. [Backend Integration](#backend-integration)
7. [Styling](#styling)
8. [File Locations](#file-locations)

---

## Overview

The Invoice System provides clients with a complete view of their payment history, outstanding balances, and invoice details. Invoices are generated automatically when project milestones are reached or manually by administrators.

**Access:** Client Portal > Invoices tab

---

## Features

| Feature | Description |
|---------|-------------|
| Summary Cards | Total outstanding and total paid amounts |
| Invoice History | Chronological list of all invoices |
| Status Badges | Visual status indicators |
| Preview | View invoice details |
| Download | Download invoice as PDF |
| Project Association | Link invoices to specific projects |

---

## Invoice Summary

Two summary cards at the top of the invoices section:

### Total Outstanding

```html
<div class="summary-card cp-shadow">
  <span class="summary-label">Total Outstanding</span>
  <span class="summary-value">$0.00</span>
</div>
```

### Total Paid

```html
<div class="summary-card cp-shadow">
  <span class="summary-label">Total Paid</span>
  <span class="summary-value">$0.00</span>
</div>
```

---

## Invoice List

### List Structure

```html
<div class="invoices-list cp-shadow">
  <h3>Invoice History</h3>
  <div class="invoice-item">
    <div class="invoice-info">
      <span class="invoice-number">INV-2025-001</span>
      <span class="invoice-date">Nov 30, 2025</span>
      <span class="invoice-project">Your Website Project</span>
    </div>
    <div class="invoice-amount">$2,500.00</div>
    <span class="invoice-status status-pending">Pending</span>
    <div class="invoice-actions">
      <button class="btn btn-outline btn-sm">Preview</button>
      <button class="btn btn-outline btn-sm">Download</button>
    </div>
  </div>
  <p class="no-invoices-message">
    No invoices yet. Your first invoice will appear here once your project begins.
  </p>
</div>
```

### Invoice Item Data

| Field | Description |
|-------|-------------|
| `invoice-number` | Unique invoice identifier (INV-YYYY-XXX) |
| `invoice-date` | Invoice generation date |
| `invoice-project` | Associated project name |
| `invoice-amount` | Total amount due |
| `invoice-status` | Current payment status |

---

## Invoice Status

### Status Types

| Status | Class | Color | Description |
|--------|-------|-------|-------------|
| Pending | `status-pending` | Yellow | Awaiting payment |
| Paid | `status-paid` | Green | Payment received |
| Overdue | `status-overdue` | Red | Past due date |
| Draft | `status-draft` | Gray | Not yet sent |

### Status Badge Styling

```css
.invoice-status {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-paid {
  background: #d1fae5;
  color: #065f46;
}

.status-overdue {
  background: #fee2e2;
  color: #991b1b;
}

.status-draft {
  background: var(--color-neutral-200);
  color: var(--color-dark);
}
```

---

## Backend Integration

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/invoices` | GET | List invoices for client |
| `/api/invoices/:id` | GET | Get invoice details |
| `/api/invoices/:id/pdf` | GET | Download invoice PDF |
| `/api/invoices` | POST | Create invoice (admin) |
| `/api/invoices/:id/status` | PUT | Update status (admin) |

### Database Schema

```sql
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id INTEGER NOT NULL,
  project_id INTEGER,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'draft',
  due_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);
```

### Invoice Generator Service

```typescript
// server/services/invoice-generator.ts
export class InvoiceGenerator {
  static async generatePDF(invoiceId: number): Promise<Buffer> {
    const invoice = await InvoiceService.getById(invoiceId);
    const items = await InvoiceService.getItems(invoiceId);

    // Generate PDF using template
    const pdf = await renderTemplate('invoice', {
      invoice,
      items,
      company: getCompanyInfo()
    });

    return pdf;
  }

  static generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const count = await InvoiceService.getCountForYear(year);
    return `INV-${year}-${String(count + 1).padStart(3, '0')}`;
  }
}
```

### Email Notifications

Invoices trigger email notifications:

```typescript
// When invoice is created
await emailService.sendInvoiceNotification(clientEmail, {
  clientName: 'John Doe',
  invoiceNumber: 'INV-2025-001',
  amount: '$2,500.00',
  dueDate: 'December 15, 2025',
  projectName: 'Website Redesign',
  portalUrl: 'https://portal.nobhadcodes.com/invoices'
});
```

---

## Styling

### Invoice Summary Cards

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

.summary-label {
  display: block;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.summary-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-dark);
}
```

### Invoice Item

```css
.invoice-item {
  display: grid;
  grid-template-columns: 2fr 1fr auto auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-neutral-200);
}

.invoice-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.invoice-number {
  font-weight: 600;
}

.invoice-date,
.invoice-project {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.invoice-amount {
  font-weight: 700;
  font-size: 1.125rem;
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `templates/pages/client-portal.ejs:183-219` | Invoices tab HTML |
| `src/features/client/client-portal.ts` | Invoice event handlers |
| `src/styles/pages/client-portal.css` | Invoice styling |
| `server/routes/invoices.ts` | Invoice API endpoints |
| `server/services/invoice-service.ts` | Invoice business logic |
| `server/services/invoice-generator.ts` | PDF generation |
| `server/templates/invoice.html` | Invoice PDF template |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Main portal overview
- [Settings](./SETTINGS.md) - Billing information
