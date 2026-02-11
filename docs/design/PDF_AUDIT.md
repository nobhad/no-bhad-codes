# Complete PDF Generation Audit

**Last Updated:** 2026-02-06

## Table of Contents

- [Summary](#summary)
- [Dependencies](#dependencies)
- [Architecture Overview](#architecture-overview)
- [PDF Endpoints](#pdf-endpoints)
  - [Proposal PDF](#1-proposal-pdf)
  - [Invoice PDF](#2-invoice-pdf)
  - [Contract PDF](#3-contract-pdf)
  - [Intake Form PDF](#4-intake-form-pdf)
- [Utility Scripts](#utility-scripts)
  - [Markdown to PDF](#markdown-to-pdf-converter)
- [Client-Side Integrations](#client-side-integrations)
  - [Admin Dashboard](#admin-dashboard-integrations)
  - [Client Portal](#client-portal-integrations)
- [Styling & Formatting](#styling--formatting)
  - [Page Layout](#page-layout)
  - [Typography](#typography)
  - [Color Scheme](#color-scheme)
  - [Logo & Branding](#logo--branding)
- [Data Sources](#data-sources)
- [Environment Variables](#environment-variables)
- [Security & Authorization](#security--authorization)
- [Error Handling](#error-handling)
- [File Download Mechanisms](#file-download-mechanisms)
- [Current State](#current-state)

---

## Summary

| Metric | Value |
|--------|-------|
| Total PDF Endpoints | 5 (+ 1 preview) |
| PDF Generation Library | pdf-lib v1.17.1 |
| Client-Side PDF Generation | None (all server-side) |
| Total Lines of PDF Code | ~2,085 |
| Environment Variables | 9 |
| Database Tables Used | 6 (proposals, invoices, projects, clients, files, contract_signature_log) |
| Config File | `server/config/business.ts` (centralized branding) |

### PDF Types Generated

| # | PDF Type | Endpoint | Trigger Location |
|---|----------|----------|------------------|
| 1 | Proposal | `GET /api/proposals/:id/pdf` | Admin proposals, Client portal |
| 2 | Invoice | `GET /api/invoices/:id/pdf` | Admin projects, Client portal |
| 3 | Invoice Preview | `POST /api/invoices/preview` | Admin invoice creation |
| 4 | Contract | `GET /api/projects/:id/contract/pdf` | Admin projects, Email links |
| 5 | Intake Form | `GET /api/projects/:id/intake/pdf` | Admin project files |

---

## Dependencies

### package.json

```json
{
  "dependencies": {
    "pdf-lib": "^1.17.1"
  }
}
```

**Notes:**

- `pdf-lib` — Primary library, used for all PDF generation
- pdfkit was previously installed but never used; removed in Feb 2026 cleanup

### Library Imports Used

```typescript
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
```

| Import | Purpose |
|--------|---------|
| `PDFDocument` | Create and modify PDF documents |
| `StandardFonts` | Embed Helvetica, HelveticaBold, ZapfDingbats |
| `rgb` | Define colors for text, backgrounds, borders |

---

## Architecture Overview

### Server-Side Only

All PDF generation is server-side. No client-side PDF libraries (jsPDF, pdfmake) are used.

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client Request │────▶│  Express Route  │────▶│   pdf-lib       │
│  (Browser)      │     │  (Auth + Data)  │     │   Generation    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │  PDF Response   │◀─────────────┘
                        │  (Binary Blob)  │
                        └─────────────────┘
```

### File Structure

```text
server/
├── config/
│   └── business.ts       # Centralized BUSINESS_INFO (single source of truth)
├── routes/
│   ├── proposals.ts      # Lines 605-851: Proposal PDF generation
│   ├── invoices.ts       # Lines 506-901: Invoice PDF generation (generateInvoicePdf function)
│   │                     # Lines 911-989: Invoice preview endpoint
│   └── projects.ts       # Lines 1327-1599: Contract PDF generation
│                         # Lines 2055-2468: Intake form PDF generation
├── utils/
│   └── pdf-utils.ts      # Shared PDF utilities: caching, multi-page, PDF/A helpers
└── services/
    └── invoice-service.ts  # Uses BUSINESS_INFO for invoice operations

scripts/
└── markdown-to-pdf.ts  # CLI tool for markdown → PDF conversion (635 lines)

public/images/
└── avatar_pdf.png      # Logo embedded in all PDFs
```

---

## PDF Endpoints

### 1. Proposal PDF

**File:** `server/routes/proposals.ts`
**Lines:** 605-851
**Endpoint:** `GET /api/proposals/:id/pdf`

#### Request

```http
GET /api/proposals/123/pdf
Authorization: Bearer <token>
```

#### Response Headers

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="proposal-ProjectName-123.pdf"
```

#### Authorization

- Requires authentication
- Admin: Full access
- Client: Own proposals only (via `client_id` match)

#### Data Sources

| Table | Fields Used |
|-------|-------------|
| `proposal_requests` | id, project_id, client_id, project_type, selected_tier, base_price, final_price, maintenance_option, status, client_notes, admin_notes, created_at |
| `proposal_feature_selections` | proposal_request_id, feature_id, feature_name, feature_price, feature_category, is_included_in_tier, is_addon |
| `projects` | id, project_name, description |
| `clients` | id, contact_name, email, company_name |

#### PDF Metadata

```typescript
pdfDoc.setTitle(`Proposal - ${projectName}`);
pdfDoc.setAuthor(BUSINESS_INFO.name);
```

#### PDF Layout

```text
┌────────────────────────────────────────────────────────┐
│ PROPOSAL                                      [LOGO]   │
│                                               Business │
│                                               Owner    │
│                                               Tagline  │
│                                               Email    │
│                                               Website  │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ Prepared For:              Prepared By:                │
│ Client Name                No Bhad Codes               │
│ Client Company             Date: January 15, 2026      │
│ client@email.com                                       │
│                                                        │
│ Project Details                    (blue section head) │
│ Project: Website Redesign                              │
│ Project Type: Business Website                         │
│                                                        │
│ Selected Package                   (blue section head) │
│ BETTER Tier                                            │
│ Base Price: $5,000                                     │
│                                                        │
│ Included Features:                                     │
│ • Responsive Design                                    │
│ • Contact Form                                         │
│ • SEO Optimization                                     │
│                                                        │
│ Add-Ons:                                               │
│ • Blog Integration - $500                              │
│ • E-commerce Module - $1,200                           │
│                                                        │
│ Maintenance Plan: Standard Plan                        │
│                                                        │
│ Pricing Summary                    (blue section head) │
│ Base Package Price:                         $5,000     │
│ Add-Ons:                                    $1,700     │
│ ─────────────────────────────────────────────────────  │
│ Total:                                      $6,700     │
│                                                        │
│ Client Notes: (if provided)                            │
│ Additional notes from client...                        │
│                                                        │
│ ─────────────────────────────────────────────────────  │
│ This proposal is valid for 30 days from the date above │
│ Questions? Contact us at email@business.com            │
└────────────────────────────────────────────────────────┘
```

#### Feature Categorization

| Type | Filter Criteria | Display |
|------|-----------------|---------|
| Included Features | `is_included_in_tier = true` | Bullet list, no price |
| Add-Ons | `is_addon = true` | Bullet list with price |

#### Code Structure

```typescript
// Key functions in proposals.ts
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  // 1. Validate ID
  // 2. Fetch proposal + features from DB
  // 3. Check authorization (admin or client owner)
  // 4. Create PDFDocument
  // 5. Embed fonts (Helvetica, HelveticaBold)
  // 6. Embed logo image
  // 7. Draw header with logo and title
  // 8. Draw "Prepared For" / "Prepared By" columns
  // 9. Draw project details section
  // 10. Draw pricing summary with add-ons
  // 11. Draw maintenance info
  // 12. Draw notes section
  // 13. Draw footer with validity and contact
  // 14. Serialize and send response
});
```

---

### 2. Invoice PDF

**File:** `server/routes/invoices.ts`
**Lines:** 510-901 (generation function), 2832-2932 (endpoint)
**Endpoint:** `GET /api/invoices/:id/pdf`

#### Request

```http
GET /api/invoices/456/pdf
GET /api/invoices/456/pdf?preview=true  # Inline display
Authorization: Bearer <token>
```

#### Response Headers

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="INV-2026-001.pdf"
# OR for preview:
Content-Disposition: inline; filename="INV-2026-001.pdf"
```

#### Authorization

- Requires authentication
- Admin: Full access
- Client: Own invoices only (via project → client relationship)

#### Data Sources

| Table | Fields Used |
|-------|-------------|
| `invoices` | id, invoice_number, issued_date, due_date, project_id, client_id, amount_total, tax, discount, status, notes, terms, line_items (JSON), is_deposit, deposit_percentage |
| `projects` | id, client_id |
| `clients` | id, name, email, company, address, city, state, zip, phone |

#### Invoice PDF Data Interface

```typescript
interface InvoicePdfData {
  invoiceNumber: string;
  issuedDate: string;
  dueDate?: string;
  clientName: string;
  clientCompany?: string;
  clientEmail: string;
  clientAddress?: string;
  clientCityStateZip?: string;
  clientPhone?: string;
  projectId?: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    details?: string[];  // Bullet points under line item
  }>;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  notes?: string;
  terms?: string;
  isDeposit?: boolean;
  depositPercentage?: number;
  credits?: Array<{ depositInvoiceNumber: string; amount: number }>;
  totalCredits?: number;
}
```

#### PDF Layout

```text
┌────────────────────────────────────────────────────────┐
│ INVOICE                              [LOGO] No Bhad    │
│                                             Codes      │
│                                             Noelle     │
│                                             Tagline    │
│                                             Email      │
│                                             Website    │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ BILL TO:                    INVOICE DETAILS:           │
│ Client Name                 Invoice #: INV-2026-001    │
│ Client Company              Date: 01/15/2026           │
│ 123 Street Address          Due: 02/15/2026            │
│ City, State ZIP             Project #: 42              │
│ client@email.com                                       │
│ (555) 123-4567                                         │
│                                                        │
│ ┌──────────────────────────────────────────────────┐   │
│ │ DESCRIPTION          │ QTY │  RATE   │  AMOUNT   │   │
│ ├──────────────────────────────────────────────────┤   │
│ │ Web Development      │  1  │ $5,000  │  $5,000   │   │
│ │   • Feature detail 1                             │   │
│ │   • Feature detail 2                             │   │
│ │ Additional Service   │  2  │   $500  │  $1,000   │   │
│ └──────────────────────────────────────────────────┘   │
│                                                        │
│                              Subtotal:      $6,000.00  │
│                              Discount:       -$500.00  │
│                              Tax (8%):        $440.00  │
│                              ────────────────────────  │
│                              TOTAL:        $5,940.00   │
│                                                        │
│ PAYMENT INSTRUCTIONS                                   │
│ ─────────────────────────────────────────────────────  │
│ Zelle: zelle@email.com                                 │
│ Venmo: @venmohandle                                    │
│ Bank Transfer: Contact for details                     │
│                                                        │
│ ─────────────────────────────────────────────────────  │
│ Thank you for your business!                           │
│ Questions? Contact email@business.com                  │
└────────────────────────────────────────────────────────┘
```

#### PDF Metadata

```typescript
pdfDoc.setTitle(`Invoice ${data.invoiceNumber}`);
pdfDoc.setAuthor(BUSINESS_INFO.name);
pdfDoc.setSubject('Invoice');
pdfDoc.setCreator('NoBhadCodes');
```

#### Special Features

1. **Invoice Title:** All invoices (including deposits) display "INVOICE" as the title
2. **Credits Applied:** Lists deposit credits with invoice numbers, shows as green text
3. **Line Item Details:** Bullet points under each line item description (gray, 9pt)
4. **Preview vs Download:** Query param `?preview=true` controls Content-Disposition
5. **Amount Due Label:** Shows "AMOUNT DUE:" when credits are applied, "TOTAL:" otherwise

#### Line Items Table Structure

```text
┌──────────────────────────────────────────────────────────────┐
│ DESCRIPTION               │ QTY │  RATE      │    AMOUNT     │ ← Dark header (white text)
├──────────────────────────────────────────────────────────────┤
│ Web Development           │  1  │  $5,000.00 │     $5,000.00 │ ← Description bold, amount bold
│   • Custom design                                            │ ← Detail bullets (9pt, gray)
│   • Responsive layout                                        │
│ Hosting Setup             │  1  │    $500.00 │       $500.00 │
└──────────────────────────────────────────────────────────────┘
```

**Column Positions (from left margin):**

- DESCRIPTION: `leftMargin + 7`
- QTY: `rightMargin - 144`
- RATE: `rightMargin - 94`
- AMOUNT: Right-aligned to `rightMargin`

#### Code Structure

```typescript
// generateInvoicePdf function (lines 548-901)
async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  // 1. Create PDFDocument with metadata
  // 2. Add LETTER page (612x792)
  // 3. Embed fonts (Helvetica, HelveticaBold)
  // 4. Draw INVOICE title (28pt, left side)
  // 5. Embed and draw logo (right side, if exists)
  // 6. Draw business info block (right of logo)
  // 7. Draw divider line
  // 8. Draw BILL TO section (left column)
  // 9. Draw invoice details (right column: #, date, due, project)
  // 10. Draw line items table header (dark background)
  // 11. Loop through line items, draw description/qty/rate/amount
  // 12. Draw detail bullets under each line item (if any)
  // 13. Draw totals section (subtotal, discount, tax)
  // 14. Draw credits applied section (if any, green text)
  // 15. Draw final total (TOTAL or AMOUNT DUE)
  // 16. Draw payment instructions (Zelle, Venmo, bank)
  // 17. Draw footer separator and thank you message
  // 18. Return serialized PDF bytes
}
```

---

### 3. Contract PDF

**File:** `server/routes/projects.ts`
**Lines:** 1327-1599
**Endpoint:** `GET /api/projects/:id/contract/pdf`

#### Request

```http
GET /api/projects/123/contract/pdf
Authorization: Bearer <token>
```

#### Response Headers

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="contract-ProjectName-123.pdf"
```

#### Authorization

- Requires authentication
- Admin: Full access to all contracts
- Client: Own project contracts only (via `client_id` match)

#### Data Sources

| Table | Fields Used |
|-------|-------------|
| `projects` | id, project_name, project_type, description, start_date, due_date, timeline, price, deposit_amount, contract_signed_at, created_at, client_id |
| `clients` | id, contact_name, email, company_name, phone, address |

#### PDF Metadata

```typescript
pdfDoc.setTitle(`Contract - ${projectName}`);
pdfDoc.setAuthor(BUSINESS_INFO.name);
```

#### PDF Layout

```text
┌────────────────────────────────────────────────────────┐
│ CONTRACT                             [LOGO] No Bhad    │
│                                             Codes      │
│                                             Noelle     │
│                                             Tagline    │
│                                             Email      │
│                                             Website    │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ Client:                       Service Provider:        │
│ Client Name                   Business Name            │
│ Client Company                Contract Date: 01/15/26  │
│ client@email.com                                       │
│                                                        │
│ 1. PROJECT SCOPE                                       │
│ ─────────────────────────────────────────────────────  │
│ Project Name: Website Redesign                         │
│ Project Type: Business Website                         │
│ Description: Full description with word wrapping...    │
│                                                        │
│ 2. TIMELINE                                            │
│ ─────────────────────────────────────────────────────  │
│ Start Date: January 15, 2026                           │
│ Target Completion: March 15, 2026                      │
│ Estimated Timeline: 2-3 months                         │
│                                                        │
│ 3. PAYMENT TERMS                                       │
│ ─────────────────────────────────────────────────────  │
│ Total Project Cost: $5,000                             │
│ Deposit Amount: $2,500                                 │
│ Payment is due according to the agreed milestones...   │
│                                                        │
│ 4. TERMS AND CONDITIONS                                │
│ ─────────────────────────────────────────────────────  │
│ 1. All work will be performed professionally...        │
│ 2. Client agrees to provide timely feedback...         │
│ 3. Changes to scope may require adjustments...         │
│ 4. Client retains ownership upon full payment...       │
│ 5. Service Provider may showcase in portfolio...       │
│                                                        │
│ 5. SIGNATURES                                          │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ Client:                       Service Provider:        │
│ _____________________         _____________________    │
│ Client Name                   Business Name            │
│ Date: _______________         Date: _______________    │
│                                                        │
│ ─────────────────────────────────────────────────────  │
│ Questions? Contact email@business.com                  │
└────────────────────────────────────────────────────────┘
```

#### Contract Sections

| Section | Content |
|---------|---------|
| 1. Project Scope | Project name, type, description (word-wrapped) |
| 2. Timeline | Start date, target completion, estimated timeline |
| 3. Payment Terms | Total cost, deposit amount, payment terms text |
| 4. Terms and Conditions | 5 standard terms (hardcoded) |
| 5. Signatures | Two signature blocks with lines and date fields |

#### Standard Terms (Hardcoded)

```typescript
const terms = [
  '1. All work will be performed in a professional manner and according to industry standards.',
  '2. Client agrees to provide timely feedback and necessary materials to avoid project delays.',
  '3. Changes to the scope of work may require additional time and cost adjustments.',
  '4. Client retains ownership of all final deliverables upon full payment.',
  '5. Service Provider retains the right to showcase the completed project in their portfolio.'
];
```

#### Signature Request System

The contract PDF endpoint is complemented by a signature request system:

**Endpoint:** `POST /api/projects/:id/contract/request-signature`
**Lines:** 1601-1720

| Feature | Details |
|---------|---------|
| Token Generation | 32-byte random hex token |
| Token Expiry | 7 days from request |
| Database Fields | `contract_signature_token`, `contract_signature_requested_at`, `contract_signature_expires_at` |
| Audit Logging | Logs to `contract_signature_log` table |
| Email Notification | Sends HTML email with sign and preview links |

**Email Template Features:**

- Professional HTML styling with inline CSS
- "Sign Contract" button (primary CTA)
- "Preview Contract" button (secondary)
- Expiration date warning banner
- Business branding

#### Code Structure

```typescript
router.get('/:id/contract/pdf', authenticateToken, async (req, res) => {
  // 1. Parse project ID
  // 2. Fetch project with client info via JOIN
  // 3. Check if project exists (404 if not)
  // 4. Authorization check (admin or client owner)
  // 5. Create PDFDocument
  // 6. Set metadata (title, author)
  // 7. Add LETTER size page (612x792)
  // 8. Embed fonts (Helvetica, HelveticaBold)
  // 9. Draw header with logo and "CONTRACT" title
  // 10. Draw business info block
  // 11. Draw divider line
  // 12. Draw client/provider info columns
  // 13. Draw Section 1: Project Scope
  // 14. Draw Section 2: Timeline
  // 15. Draw Section 3: Payment Terms
  // 16. Draw Section 4: Terms and Conditions
  // 17. Draw Section 5: Signatures
  // 18. Draw footer
  // 19. Serialize and send PDF
});
```

---

### 4. Intake Form PDF

**File:** `server/routes/projects.ts`
**Lines:** 2055-2468
**Endpoint:** `GET /api/projects/:id/intake/pdf`

#### Request

```http
GET /api/projects/789/intake/pdf
Authorization: Bearer <token>
```

#### Response Headers

```http
Content-Type: application/pdf
Content-Disposition: inline; filename="nobhadcodes_intake_clientname.pdf"
```

**Note:** Uses `inline` disposition (opens in browser) and includes company/client name in filename.

#### Authorization

- Requires authentication
- Admin: Full access
- Client: Own project intake forms only

#### Data Sources

| Source | Data |
|--------|------|
| `projects` table | id, project_name, client_id, company_name, client_name |
| `clients` table | contact_name, email, company_name |
| `files` table | file path lookup for intake JSON |
| Disk file | JSON intake form data |

#### PDF Metadata

```typescript
const pdfTitle = `NoBhadCodes Intake - ${clientOrCompanyName}`;
pdfDoc.setTitle(pdfTitle);
pdfDoc.setAuthor(BUSINESS_INFO.name);
pdfDoc.setSubject('Project Intake Form');
pdfDoc.setCreator('NoBhadCodes');
```

#### File Lookup Patterns

The endpoint searches for intake files with these name patterns:

```text
intake_*
admin_project_*
project_intake_*
nobhadcodes_intake_*
```

#### IntakeDocument Interface

```typescript
interface IntakeDocument {
  projectId: number;
  projectName: string;
  submittedAt: string;
  clientInfo: {
    name: string;
    email: string;
    companyName?: string;
  };
  projectDetails: {
    type: string;
    timeline: string;
    budget: string;
    description: string;
    features?: string[];
  };
  technicalInfo?: {
    techComfort?: string;
    domainHosting?: string;
  };
}
```

#### Helper Functions

```typescript
function formatDate(dateStr: string): string
// Converts ISO date to "January 15, 2026 at 10:30 AM"
// Includes hour and minute in 12-hour format

function formatTimeline(code: string): string
// Maps:
// 'asap' → 'As Soon As Possible'
// '1-month' → '1 Month'
// '1-3-months' → '1-3 Months'
// '3-6-months' → '3-6 Months'
// 'flexible' → 'Flexible'

function formatBudget(code: string): string
// Maps:
// 'under-2k' → 'Under $2,000'
// '2k-5k' → '$2,000 - $5,000'
// '2.5k-5k' → '$2,500 - $5,000'
// '5k-10k' → '$5,000 - $10,000'
// '10k-25k' → '$10,000 - $25,000'
// '25k+' → '$25,000+'

function formatProjectType(code: string): string
// Maps:
// 'simple-site' → 'Simple Website'
// 'business-site' → 'Business Website'
// 'portfolio' → 'Portfolio Website'
// 'e-commerce' / 'ecommerce' → 'E-commerce Store'
// 'web-app' → 'Web Application'
// 'browser-extension' → 'Browser Extension'
// 'other' → 'Custom Project'
// Fallback: Title-case the hyphenated string

function decodeHtml(text: string): string
// Decodes HTML entities:
// &amp; → &
// &#x2F; → /
// &lt; → <
// &gt; → >
// &quot; → "
// &#39; → '
```

#### PDF Layout

```text
┌────────────────────────────────────────────────────────┐
│ INTAKE                               [LOGO] No Bhad    │
│                                             Codes      │
│                                             Noelle     │
│                                             Tagline    │
│                                             Email      │
│                                             Website    │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ PREPARED FOR:                 DATE: Jan 15, 2026       │
│ Client Name                   PROJECT #: 789           │
│ Company Name                                           │
│ client@email.com                                       │
│                                                        │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ Project Details                                        │
│ Project Name: My New Website                           │
│ Project Type: Business Website                         │
│ Timeline: 1-3 Months                                   │
│ Budget: $5,000 - $10,000                               │
│                                                        │
│ Project Description                                    │
│ Full description of the project with automatic         │
│ word wrapping for long text content...                 │
│                                                        │
│ Requested Features (if any)                            │
│ •  Contact Form                                        │
│ •  Blog Integration                                    │
│ •  User Authentication                                 │
│                                                        │
│ Technical Information (if any)                         │
│ Technical Comfort: Intermediate                        │
│ Domain/Hosting: I have both                            │
│                                                        │
│ ─────────────────────────────────────────────────────  │
│ No Bhad Codes • Noelle Bhaduri • email • website       │
└────────────────────────────────────────────────────────┘
```

#### Content Sections

| Section | Displayed When |
|---------|----------------|
| Project Details | Always (name, type, timeline, budget) |
| Project Description | Always (word-wrapped) |
| Requested Features | When `projectDetails.features` array exists and has items |
| Technical Information | When `technicalInfo` object exists with `techComfort` or `domainHosting` |

---

## Utility Scripts

### Markdown to PDF Converter

**File:** `scripts/markdown-to-pdf.ts`
**Lines:** 1-635
**Usage:** CLI tool (not an API endpoint)

#### Command

```bash
npx ts-node scripts/markdown-to-pdf.ts <input.md> [output.pdf]
```

#### Purpose

Converts markdown proposal/contract documents to branded, printable PDFs with form fields for signatures.

#### Page Constants

```typescript
const PAGE_WIDTH = 612;   // Letter size
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 45;   // 0.625 inch margins (slightly smaller than API PDFs)
const CONTENT_WIDTH = 522; // PAGE_WIDTH - (PAGE_MARGIN * 2)

// Font sizes
const FONT_SIZE_H1 = 18;
const FONT_SIZE_H2 = 14;
const FONT_SIZE_H3 = 11;
const FONT_SIZE_H4 = 10;
const FONT_SIZE_BODY = 9;
const FONT_SIZE_SMALL = 8;

// Line heights (very tight spacing)
const LINE_HEIGHT = 11;
const LINE_HEIGHT_SMALL = 9;
```

#### Supported Markdown Features

| Markdown | Rendered As |
|----------|-------------|
| `# Heading` | H1 (18pt bold, centered) |
| `## Heading` | H2 (14pt bold, 14pt space above) |
| `### Heading` | H3 (11pt bold, 12pt space above) |
| `#### Heading` | H4 (10pt bold, conditional spacing) |
| `**bold**` | Bold text |
| `*italic*` | Stripped (rendered as regular) |
| `` `code` `` | Stripped (rendered as regular) |
| `[text](url)` | Text only (URL stripped) |
| `- item` | Bullet point (• character) |
| `  - nested` | Nested bullet (indented up to 30px) |
| `- [x] item` | Checked checkbox (interactive form field) |
| `- [ ] item` | Unchecked checkbox (interactive form field) |
| `\| table \|` | Table with borders and styled cells |
| `**Signature:** ____` | Signature line (drawn line, no form field) |
| `**Printed Name:** ____` | Text field with invisible border over underline |
| `**Date:** ____` | Date field with invisible border over underline |
| `<!-- pagebreak -->` | Explicit page break (only way to break pages) |
| `---` | Section divider (12pt spacing, no line) |

**Important:** Auto page breaks are disabled. Pages only break at explicit `<!-- pagebreak -->` markers.

#### Form Fields Generated

```typescript
// Checkbox fields
const checkbox = form.createCheckBox(`checkbox_${checkboxCount}`);
checkbox.addToPage(page, {
  x: PAGE_MARGIN + 12,
  y: y - 9,
  width: 9,
  height: 9,
  borderWidth: 1,
  borderColor: rgb(0, 0, 0),
  backgroundColor: rgb(1, 1, 1)
});
if (checked) checkbox.check();

// Text fields (for signatures, names, dates)
const textField = form.createTextField(`field_${textFieldCount}`);
textField.addToPage(page, {
  x: fieldStartX,
  y: y - 4,
  width: fieldWidth,  // 200 for name, 100 for date
  height: 14,
  borderWidth: 0  // Invisible border, underline drawn separately
});
```

#### Special Image Support

- **Logo:** `public/images/avatar_pdf.png` (header, centered)
- **Sprout emoji:** `public/images/sprout.png` (inline in text and tables)

**Logo Search Order:**

```typescript
const logoPaths = [
  'public/images/avatar_pdf.png',
  'public/images/pdf-header-logo.png',
  'public/images/avatar_small-1.png'
];
```

#### Table Rendering

Tables are rendered with:

- Header row: Gray background (`rgb(0.94, 0.94, 0.94)`), black border
- Body rows: White background, black border
- Cell alignment: First column left-aligned, subsequent columns centered
- Checkmarks: Drawn as two lines forming a check symbol
- Dashes: Centered in cell
- Sprout emojis: Drawn as embedded PNG image (12x12)

---

## Client-Side Integrations

### Admin Dashboard Integrations

#### 1. Invoice PDF Download (Project Detail)

**File:** `src/features/admin/modules/admin-projects.ts`
**Lines:** 1684-1690

```typescript
// Opens PDF in new tab
window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
```

#### 2. Invoice PDF Preview

**File:** `src/features/admin/modules/admin-projects.ts`
**Line:** 1665

```typescript
// Opens PDF inline for preview
window.open(`/api/invoices/${invoiceId}/pdf?preview=true`, '_blank');
```

#### 3. Intake PDF Download

**File:** `src/features/admin/modules/admin-projects.ts`
**Lines:** 1252-1254

```typescript
// Download intake form as PDF
const response = await fetch(`/api/projects/${projectId}/intake/pdf`);
```

#### 4. Intake PDF Preview

**File:** `src/features/admin/modules/admin-projects.ts`
**Lines:** 1290-1295

```typescript
// Open intake PDF in new tab
window.open(`/api/projects/${projectId}/intake/pdf`, '_blank');
```

#### 5. Invoice Table PDF Link

**File:** `src/features/admin/project-details/invoices.ts`
**Line:** 93

```html
<a href="/api/invoices/${inv.id}/pdf" class="btn btn-outline btn-sm" target="_blank">PDF</a>
```

### Client Portal Integrations

#### 1. Invoice Download

**File:** `src/features/client/modules/portal-invoices.ts`
**Lines:** 195-225

```typescript
async function downloadInvoice(invoiceId: number, invoiceNumber: string) {
  const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
    credentials: 'include'  // Include auth cookie
  });
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${invoiceNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

#### 2. Invoice Preview

**File:** `src/features/client/modules/portal-invoices.ts`
**Lines:** 188-193

```typescript
function previewInvoice(invoiceId: number) {
  window.open(`/api/invoices/${invoiceId}/pdf?preview=true`, '_blank');
}
```

---

## Styling & Formatting

### Page Layout

| Property | Value |
|----------|-------|
| Page Size | 612 x 792 points (Letter / 8.5" x 11") |
| Margins | 54 points (0.75 inch) all sides |
| Content Width | 504 points (612 - 54 - 54) |

### Unified Header Layout (All PDFs)

All four PDF types (Proposal, Invoice, Contract, Intake) share the **exact same header layout**:

```text
┌────────────────────────────────────────────────────────┐
│ [TITLE]                              [LOGO] Business   │  y - 11: 15pt bold name
│                                             Owner      │  y - 34: 10pt owner
│                                             Tagline    │  y - 54: 9pt tagline
│                                             Email      │  y - 70: 9pt email
│                                             Website    │  y - 86: 9pt website
│ ─────────────────────────────────────────────────────  │  y - 120: divider
└────────────────────────────────────────────────────────┘
```

**Header Constants (shared across all PDFs):**

```typescript
const leftMargin = 54;
const rightMargin = width - 54;
let y = height - 43;                    // Start 0.6 inch from top
const logoHeight = 100;                 // ~1.4 inch
const logoX = rightMargin - logoWidth - 150;
const textStartX = logoX + logoWidth + 18;

// Title: left side, 28pt bold
page.drawText(titleText, { x: leftMargin, y: y - 20, size: 28, font: helveticaBold });

// Business info: right side, stacked
page.drawText(BUSINESS_INFO.name, { x: textStartX, y: y - 11, size: 15, font: helveticaBold });
page.drawText(BUSINESS_INFO.owner, { x: textStartX, y: y - 34, size: 10, font: helvetica });
page.drawText(BUSINESS_INFO.tagline, { x: textStartX, y: y - 54, size: 9, font: helvetica });
page.drawText(BUSINESS_INFO.email, { x: textStartX, y: y - 70, size: 9, font: helvetica });
page.drawText(BUSINESS_INFO.website, { x: textStartX, y: y - 86, size: 9, font: helvetica });

y -= 120;  // Account for logo height
// Divider line
y -= 21;   // Gap after divider
```

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Main Title | Helvetica | 28pt | Bold |
| Section Headers | Helvetica | 14pt | Bold |
| Subsection Headers | Helvetica | 11pt | Bold |
| Field Labels | Helvetica | 10pt | Bold |
| Body Text | Helvetica | 10pt | Regular |
| Secondary Text | Helvetica | 9pt | Regular |
| Fine Print | Helvetica | 7-8pt | Regular |
| Table Header | Helvetica | 9pt | Bold |
| Table Body | Helvetica | 9pt | Regular |

### Embedded Fonts

```typescript
const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
const zapfDingbats = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);  // Checkmarks
```

### Color Scheme

| Use Case | RGB Value | Hex Equivalent |
|----------|-----------|----------------|
| Black text | `rgb(0, 0, 0)` | `#000000` |
| Dark headings | `rgb(0.15, 0.15, 0.15)` | `#262626` |
| Medium gray labels | `rgb(0.3, 0.3, 0.3)` | `#4D4D4D` |
| Secondary text | `rgb(0.45, 0.45, 0.45)` | `#737373` |
| Divider lines | `rgb(0.8, 0.8, 0.8)` | `#CCCCCC` |
| Table header bg | `rgb(0.25, 0.25, 0.25)` | `#404040` |
| Table header text | `rgb(1, 1, 1)` | `#FFFFFF` |
| Table borders | `rgb(0.7, 0.7, 0.7)` | `#B3B3B3` |

### Logo & Branding

**Primary Logo Path:**

```text
public/images/avatar_pdf.png
```

**Fallback Paths (checked in order):**

```text
public/images/avatar_pdf.png
public/images/pdf-header-logo.png
public/images/avatar_small-1.png
```

**Logo Dimensions:**

| PDF Type | Max Height | Position |
|----------|------------|----------|
| Proposal | 100pt | Top left |
| Invoice | 120pt | Top right |
| Intake | 100pt | Top left |

**Embedding:**

```typescript
const logoBytes = fs.readFileSync(logoPath);
const logoImage = await pdfDoc.embedPng(logoBytes);
const logoAspect = logoImage.width / logoImage.height;
const logoHeight = 100;
const logoWidth = logoHeight * logoAspect;
page.drawImage(logoImage, { x, y, width: logoWidth, height: logoHeight });
```

---

## Data Sources

### Database Tables

| Table | Used By | Fields |
|-------|---------|--------|
| `proposal_requests` | Proposal PDF | id, project_id, client_id, project_type, selected_tier, base_price, final_price, maintenance_option, status, client_notes, created_at |
| `proposal_feature_selections` | Proposal PDF | proposal_request_id, feature_id, feature_name, feature_price, feature_category, is_included_in_tier, is_addon |
| `invoices` | Invoice PDF | id, invoice_number, issued_date, due_date, project_id, client_id, amount_total, tax, discount, status, notes, terms, line_items (JSON), is_deposit, deposit_percentage |
| `projects` | All PDFs | id, project_name, project_type, description, client_id, start_date, due_date, timeline, price, deposit_amount, contract_signed_at, created_at |
| `clients` | All PDFs | id, contact_name, email, company_name, phone, address |
| `files` | Intake PDF | id, project_id, file_name, file_path |
| `contract_signature_log` | Contract PDF system | project_id, action, actor_email, details (audit trail) |

### File System

| File Type | Location | Used By |
|-----------|----------|---------|
| Logo PNG | `public/images/avatar_pdf.png` | All PDFs |
| Sprout PNG | `public/images/sprout.png` | Markdown script |
| Intake JSON | `uploads/projects/{id}/intake_*.json` | Intake PDF |

---

## Environment Variables

| Variable | Default | Used In |
|----------|---------|---------|
| `BUSINESS_NAME` | 'No Bhad Codes' | All PDFs |
| `BUSINESS_OWNER` | 'Noelle Bhaduri' | All PDFs |
| `BUSINESS_CONTACT` | 'Noelle Bhaduri' | All PDFs |
| `BUSINESS_TAGLINE` | 'Web Development & Design' | All PDFs |
| `BUSINESS_EMAIL` | `'nobhaduri@gmail.com'` | All PDFs |
| `BUSINESS_WEBSITE` | 'nobhad.codes' | All PDFs |
| `VENMO_HANDLE` | '@nobhaduri' | Invoice PDF |
| `ZELLE_EMAIL` | `'nobhaduri@gmail.com'` | Invoice PDF |
| `PAYPAL_EMAIL` | '' (empty) | Invoice PDF (optional) |

### Usage in Code

All server routes import from the centralized config:

```typescript
// server/config/business.ts - Single source of truth
export const BUSINESS_INFO: BusinessInfo = {
  name: process.env.BUSINESS_NAME || 'No Bhad Codes',
  owner: process.env.BUSINESS_OWNER || 'Noelle Bhaduri',
  contact: process.env.BUSINESS_CONTACT || 'Noelle Bhaduri',
  tagline: process.env.BUSINESS_TAGLINE || 'Web Development & Design',
  email: process.env.BUSINESS_EMAIL || 'nobhaduri@gmail.com',
  website: process.env.BUSINESS_WEBSITE || 'nobhad.codes',
  venmoHandle: process.env.VENMO_HANDLE || '@nobhaduri',
  zelleEmail: process.env.ZELLE_EMAIL || 'nobhaduri@gmail.com',
  paypalEmail: process.env.PAYPAL_EMAIL || ''
};

// Usage in route files:
import { BUSINESS_INFO } from '../config/business.js';
```

**Files using shared config:**

- `server/routes/invoices.ts`
- `server/routes/proposals.ts`
- `server/routes/projects.ts`
- `server/services/invoice-service.ts`

**Standalone script (mirrors shared config defaults):**

- `scripts/markdown-to-pdf.ts` - Has its own copy for CLI independence

---

## PDF Utilities

**File:** `server/utils/pdf-utils.ts`

Shared utilities for PDF generation including caching, multi-page support, and PDF/A compliance helpers.

### PDF Caching

In-memory TTL-based cache with LRU eviction to reduce repeated PDF generation.

**Configuration (Environment Variables):**

| Variable | Default | Description |
|----------|---------|-------------|
| `PDF_CACHE_TTL_MS` | 300000 (5 min) | Cache entry time-to-live |
| `PDF_CACHE_MAX_ENTRIES` | 100 | Maximum cached PDFs (LRU eviction) |

**Cache Key Format:** `{type}:{id}:{updatedAt}`

**Usage:**

```typescript
import { getPdfCacheKey, getCachedPdf, cachePdf } from '../utils/pdf-utils.js';

// Check cache first
const cacheKey = getPdfCacheKey('invoice', invoiceId, invoice.updatedAt);
const cachedPdf = getCachedPdf(cacheKey);
if (cachedPdf) {
  res.setHeader('X-PDF-Cache', 'HIT');
  return res.send(Buffer.from(cachedPdf));
}

// Generate PDF...
const pdfBytes = await generatePdf(data);

// Cache the result
cachePdf(cacheKey, pdfBytes, invoice.updatedAt);
res.setHeader('X-PDF-Cache', 'MISS');
```

**Cache Response Header:** All PDF endpoints now include `X-PDF-Cache: HIT` or `X-PDF-Cache: MISS`.

**Cache Functions:**

| Function | Purpose |
|----------|---------|
| `getPdfCacheKey(type, id, updatedAt)` | Generate cache key |
| `getCachedPdf(cacheKey)` | Retrieve cached PDF (null if expired/missing) |
| `cachePdf(cacheKey, data, updatedAt)` | Store PDF in cache |
| `invalidatePdfCache(type, id?)` | Invalidate cache entries |
| `clearPdfCache()` | Clear entire cache |
| `getPdfCacheStats()` | Get cache size/max/TTL |

### Multi-Page Support Utilities

Helpers for automatic page breaks and content flow. **Now integrated into `invoices.ts` and `proposals.ts` (Feb 2026).**

**Page Dimensions:**

```typescript
export const PAGE_DIMENSIONS = {
  LETTER: { width: 612, height: 792 },
  A4: { width: 595, height: 842 }
};

export const PAGE_MARGINS = {
  top: 54, bottom: 54, left: 54, right: 54
};
```

**Multi-Page Context:**

```typescript
interface PdfPageContext {
  pdfDoc: PDFDocument;
  currentPage: PDFPage;
  pageNumber: number;
  y: number;  // Current vertical position
  fonts: { regular: PDFFont; bold: PDFFont };
  // ... dimensions and margins
}
```

**Helper Functions:**

| Function | Purpose |
|----------|---------|
| `createPdfContext(pdfDoc, options?)` | Initialize context with standard layout |
| `ensureSpace(ctx, requiredSpace, onNewPage?)` | Check/create new page if needed |
| `drawWrappedText(ctx, text, options)` | Draw text with word wrap and page breaks |
| `addPageNumbers(pdfDoc, options?)` | Add "Page X of Y" to all pages |

### PDF/A Compliance Helpers

**Metadata Function:**

```typescript
setPdfMetadata(pdfDoc, {
  title: 'Invoice INV-2026-001',
  author: 'No Bhad Codes',
  subject: 'Invoice',
  creator: 'NoBhadCodes PDF Generator',
  keywords: ['invoice', 'payment'],
  creationDate: new Date(),
  modificationDate: new Date()
});
```

**PDF/A Compliance Status:**

| Requirement | Status |
|-------------|--------|
| Fonts embedded | Yes (pdf-lib automatic) |
| No JavaScript | Yes |
| No external references | Yes |
| Color space defined | Yes (RGB) |
| XMP metadata stream | No (requires additional library) |
| PDF version 1.4+ | Yes (pdf-lib uses 1.7) |

Current implementation achieves "PDF/A-like" compliance suitable for most archival purposes.

---

## Security & Authorization

### Authentication

All PDF endpoints require a valid JWT token via:

- `Authorization: Bearer <token>` header, OR
- HttpOnly cookie (for browser requests)

### Authorization Matrix

| Endpoint | Admin | Client (Own) | Client (Other) | Unauthenticated |
|----------|-------|--------------|----------------|-----------------|
| Proposal PDF | Yes | Yes | No (403) | No (401) |
| Invoice PDF | Yes | Yes | No (403) | No (401) |
| Invoice Preview | Yes | No | No | No (401) |
| Contract PDF | Yes | Yes | No (403) | No (401) |
| Intake PDF | Yes | Yes | No (403) | No (401) |
| Contract Signature Request | Yes | No | No | No (401) |

### Authorization Code Pattern

```typescript
// Check if admin or owner
if (req.user?.role !== 'admin') {
  const client = await getClientByUserId(req.user?.id);
  if (!client || client.id !== resource.client_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
}
```

### Security Measures

1. **File Path Validation:** Intake JSON paths validated against expected patterns
2. **HTML Entity Decoding:** Prevents injection in rendered text
3. **Blob URL Cleanup:** `URL.revokeObjectURL()` called after download
4. **No User-Controlled Paths:** File paths constructed from database IDs only

---

## Error Handling

### HTTP Status Codes

| Code | Condition |
|------|-----------|
| 200 | Success - PDF returned |
| 400 | Invalid ID format |
| 401 | Not authenticated |
| 403 | Not authorized (not admin, not owner) |
| 404 | Resource not found (invoice, proposal, project, intake file) |
| 500 | PDF generation failed |

### Error Response Format

```json
{
  "error": "Descriptive error message"
}
```

### Common Error Scenarios

| Scenario | Response |
|----------|----------|
| Invoice not found | `404: { error: 'Invoice not found' }` |
| Proposal not found | `404: { error: 'Proposal not found' }` |
| Intake file not found | `404: { error: 'Intake form not found' }` |
| Logo file missing | Continues without logo (graceful degradation) |
| PDF generation crash | `500: { error: 'Failed to generate PDF' }` |

---

## File Download Mechanisms

### Browser Download (Blob Method)

```typescript
// Used in client portal for authenticated downloads
const response = await fetch(url, { credentials: 'include' });
const blob = await response.blob();
const objectUrl = window.URL.createObjectURL(blob);
const anchor = document.createElement('a');
anchor.href = objectUrl;
anchor.download = filename;
anchor.click();
URL.revokeObjectURL(objectUrl);
```

### Direct Link (New Tab)

```html
<!-- Used in admin tables -->
<a href="/api/invoices/${id}/pdf" target="_blank">Download PDF</a>
```

### Inline Preview vs Attachment Download

```typescript
// Server-side header control
const disposition = req.query.preview === 'true' ? 'inline' : 'attachment';
res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
```

---

## Current State

### Architecture

| Area | Implementation |
|------|----------------|
| PDF Library | pdf-lib (pure JS, no pdfkit) |
| Business Info | Centralized in `server/config/business.ts` |
| Logo Loading | `getPdfLogoBytes()` helper with fallback paths |
| Line Item Wrapping | Word wrapping implemented in invoices.ts |
| Contract Terms | Configurable via `CONTRACT_TERMS` in business.ts |
| Caching | TTL-based in-memory cache via `server/utils/pdf-utils.ts` |
| Multi-page Support | Integrated: invoices.ts and proposals.ts use `PdfPageContext`, `ensureSpace()`, `addPageNumbers()` |
| Metadata | `setPdfMetadata()` helper for PDF/A compliance |

### Open Issues

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | Full PDF/A-1b compliance | Low | Would require XMP metadata library |

### Potential Improvements

| # | Improvement | Priority | Notes |
|---|-------------|----------|-------|
| 1 | Add watermark for draft/preview PDFs | Low | Visual indicator for unpaid invoices |
| 2 | Implement PDF/A for long-term archival | Low | May be overkill for current use case |
| 3 | Add PDF password protection option | Low | For sensitive documents |
| 4 | Add PDF thumbnails/previews | Low | Show preview before download |
| 5 | Add digital signature support | Low | For legally binding contracts |

### Testing Endpoints

**File:** `server/routes/invoices.ts`

| Endpoint | Lines | Purpose |
|----------|-------|---------|
| `GET /api/invoices/test` | 287-293 | Health check |
| `POST /api/invoices/test-create` | 307-348 | Create test invoice |
| `GET /api/invoices/test-get/:id` | 364-395 | Retrieve test invoice |

### Code Line Counts

| File | PDF Section Lines | Total File Lines |
|------|-------------------|------------------|
| `server/routes/invoices.ts` | ~500 (lines 506-989) | ~1200+ |
| `server/routes/proposals.ts` | ~250 (lines 605-851) | ~1316 |
| `server/routes/projects.ts` | ~700 (lines 1327-1599, 2055-2468) | ~2500+ |
| `scripts/markdown-to-pdf.ts` | 635 (entire file) | 635 |
| **Total PDF Code** | **~2,085 lines** | - |

---

## Quick Reference

### Generate Proposal PDF

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://<api-host>:4001/api/proposals/123/pdf \
  -o proposal.pdf
```

### Generate Invoice PDF

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://<api-host>:4001/api/invoices/456/pdf \
  -o invoice.pdf
```

### Generate Contract PDF

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://<api-host>:4001/api/projects/123/contract/pdf \
  -o contract.pdf
```

### Generate Intake PDF

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://<api-host>:4001/api/projects/789/intake/pdf \
  -o intake.pdf
```

### Request Contract Signature

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://<api-host>:4001/api/projects/123/contract/request-signature
```

### Convert Markdown to PDF

```bash
npx ts-node scripts/markdown-to-pdf.ts proposal.md output.pdf
```
