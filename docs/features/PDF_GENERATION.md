# PDF Generation System

**Last Updated:** January 30, 2026

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Document Types](#document-types)
4. [Header Template](#header-template)
5. [File Locations](#file-locations)
6. [API Endpoints](#api-endpoints)
7. [Implementation Details](#implementation-details)
8. [Styling Reference](#styling-reference)

---

## Overview

All PDF documents in the system are generated using **pdf-lib**, a pure JavaScript library that works in both Node.js and browsers. PDFs follow a consistent header template with the business logo, contact information, and document title.

**Key Features:**

- Consistent branding across all document types
- Logo with preserved aspect ratio
- Professional layout with proper spacing
- Environment-variable-based business information

---

## Technology Stack

|Component|Technology|Purpose|
|-----------|------------|---------|
|PDF Library|pdf-lib|Pure JS PDF generation|
|Fonts|StandardFonts (Helvetica)|Embedded PDF fonts|
|Image Format|PNG|Logo embedding|
|Server|Express.js|API endpoints|

**Why pdf-lib over PDFKit:**

- Pure JavaScript (no native dependencies)
- Better control over precise positioning
- Consistent behavior across environments
- Smaller bundle size

---

## Document Types

|Document|Route|Endpoint|Title|
|----------|-------|----------|-------|
|Invoice|`server/routes/invoices.ts`|`GET /api/invoices/:id/pdf`|INVOICE|
|Contract|`server/routes/projects.ts`|`GET /api/projects/:id/contract/pdf`|CONTRACT|
|Intake|`server/routes/projects.ts`|`GET /api/projects/:id/intake/pdf`|INTAKE|
|Proposal|`server/routes/proposals.ts`|`GET /api/proposals/:id/pdf`|PROPOSAL|

---

## Header Template

All PDFs use a consistent header template:

```text
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  [LOGO]    No Bhad Codes                              DOCUMENT    │
│  100pt     Noelle Bhaduri                             TITLE       │
│            Web Development & Design                   (28pt)      │
│            nobhaduri@gmail.com                                    │
│            nobhad.codes                                           │
│                                                                    │
│ ────────────────────────────────────────────────────────────────── │
│                                                                    │
│  [Document content...]                                             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Header Specifications

All elements are top-aligned using cap-height offsets:

|Element|Size|Font|Color (RGB)|Y-Offset|Notes|
|---------|------|------|-------------|----------|-------|
|Logo|100pt height|-|-|0 (top)|Aspect ratio preserved|
|Business Name|15pt|Helvetica-Bold|(0.1, 0.1, 0.1)|-11pt|Cap height offset for top alignment|
|Owner Name|10pt|Helvetica|(0.2, 0.2, 0.2)|-34pt||
|Tagline|9pt|Helvetica|(0.4, 0.4, 0.4)|-54pt||
|Email|9pt|Helvetica|(0.4, 0.4, 0.4)|-70pt||
|Website|9pt|Helvetica|(0.4, 0.4, 0.4)|-86pt||
|Document Title|28pt|Helvetica-Bold|(0.15, 0.15, 0.15)|-20pt|Cap height offset for top alignment|

### Layout Constants

```typescript
// Page size: LETTER (612 x 792 points)
const leftMargin = 54;      // 0.75 inch
const rightMargin = 558;    // width - 0.75 inch
const headerY = 749;        // height - 43pt (0.6 inch from top)
const logoHeight = 100;     // ~1.4 inch for prominent branding
const headerOffset = 120;   // Space after header before content
```

### Logo Handling

```typescript
// Logo path and size
const logoPath = join(process.cwd(), 'public/images/avatar_pdf.png');
const logoHeight = 100; // ~1.4 inch for prominent branding

// Preserve aspect ratio - only set height, calculate width
if (existsSync(logoPath)) {
  const logoBytes = readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);
  const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
  page.drawImage(logoImage, {
    x: leftMargin,
    y: y - logoHeight,  // Top of logo aligns with y
    width: logoWidth,
    height: logoHeight
  });
  textStartX = leftMargin + logoWidth + 18; // 0.25 inch gap
}
```

---

## File Locations

|File|Purpose|
|------|---------|
|`server/routes/invoices.ts`|Invoice PDF generation|
|`server/routes/projects.ts`|Contract and Intake PDF generation|
|`server/routes/proposals.ts`|Proposal PDF generation|
|`public/images/avatar_pdf.png`|Business logo for PDFs|

---

## API Endpoints

### Invoice PDF

```http
GET /api/invoices/:id/pdf?preview=true|false
```

**Query Parameters:**

- `preview=true` - Opens inline in browser
- `preview=false` (default) - Downloads as attachment

**Response Headers:**

```http
Content-Type: application/pdf
Content-Disposition: inline|attachment; filename="INV-2026-001.pdf"
```

### Contract PDF

```http
GET /api/projects/:id/contract/pdf
```

**Response Headers:**

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="contract-ProjectName-1.pdf"
```

### Intake PDF

```http
GET /api/projects/:id/intake/pdf
```

**Response Headers:**

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="intake-ProjectName-1.pdf"
```

### Proposal PDF

```http
GET /api/proposals/:id/pdf
```

**Response Headers:**

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="proposal-ProjectName-1.pdf"
```

---

## Implementation Details

### Common Header Function Pattern

Each PDF route implements the header using this pattern:

```typescript
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

// Business info from environment variables
const BUSINESS_INFO = {
  name: process.env.BUSINESS_NAME || 'No Bhad Codes',
  owner: process.env.BUSINESS_OWNER || 'Noelle Bhaduri',
  tagline: process.env.BUSINESS_TAGLINE || 'Web Development & Design',
  email: process.env.BUSINESS_EMAIL || 'nobhaduri@gmail.com',
  website: process.env.BUSINESS_WEBSITE || 'nobhad.codes'
};

async function generatePdf(data: PdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFLibDocument.create();
  const page = pdfDoc.addPage([612, 792]); // LETTER
  const { width, height } = page.getSize();

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Layout
  const leftMargin = 54;
  const rightMargin = width - 54;
  let y = height - 43;

  // Logo (100pt, preserve aspect ratio)
  const logoPath = join(process.cwd(), 'public/images/avatar_pdf.png');
  let textStartX = leftMargin;
  const logoHeight = 100;

  if (existsSync(logoPath)) {
    const logoBytes = readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, {
      x: leftMargin,
      y: y - logoHeight,
      width: logoWidth,
      height: logoHeight
    });
    textStartX = leftMargin + logoWidth + 18;
  }

  // Business info - offset by cap height for top alignment with logo
  page.drawText(BUSINESS_INFO.name, {
    x: textStartX, y: y - 11, size: 15,  // 15pt cap height ~11pt
    font: helveticaBold, color: rgb(0.1, 0.1, 0.1)
  });
  page.drawText(BUSINESS_INFO.owner, {
    x: textStartX, y: y - 34, size: 10,
    font: helvetica, color: rgb(0.2, 0.2, 0.2)
  });
  page.drawText(BUSINESS_INFO.tagline, {
    x: textStartX, y: y - 54, size: 9,
    font: helvetica, color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText(BUSINESS_INFO.email, {
    x: textStartX, y: y - 70, size: 9,
    font: helvetica, color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText(BUSINESS_INFO.website, {
    x: textStartX, y: y - 86, size: 9,
    font: helvetica, color: rgb(0.4, 0.4, 0.4)
  });

  // Document title (right-aligned, top-aligned with logo)
  const titleText = 'DOCUMENT_TITLE';
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 28);
  page.drawText(titleText, {
    x: rightMargin - titleWidth, y: y - 20, size: 28,  // 28pt cap height ~20pt
    font: helveticaBold, color: rgb(0.15, 0.15, 0.15)
  });

  y -= 120; // Move past header (100pt logo + spacing)

  // Divider line
  page.drawLine({
    start: { x: leftMargin, y: y },
    end: { x: rightMargin, y: y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  y -= 21;

  // Document content continues...

  return await pdfDoc.save();
}
```

### Sending PDF Response

```typescript
const pdfBytes = await generatePdf(data);

res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
res.setHeader('Content-Length', pdfBytes.length);
res.send(Buffer.from(pdfBytes));
```

---

## Styling Reference

### Color Palette

|Purpose|RGB|Hex (approx)|
|---------|-----|--------------|
|Primary text|(0.1, 0.1, 0.1)|#1a1a1a|
|Secondary text|(0.2, 0.2, 0.2)|#333333|
|Muted text|(0.4, 0.4, 0.4)|#666666|
|Title text|(0.15, 0.15, 0.15)|#262626|
|Line color|(0.7, 0.7, 0.7)|#b3b3b3|
|Section headers|(0, 0.4, 0.8)|#0066cc|

### Typography

|Element|Font|Size|
|---------|------|------|
|Document title|Helvetica-Bold|28pt|
|Section headers|Helvetica-Bold|14pt|
|Subsection headers|Helvetica-Bold|12pt|
|Body text|Helvetica|10pt|
|Small text|Helvetica|9pt|
|Footer text|Helvetica|9pt|

---

## Related Documentation

- [Invoices Feature](./INVOICES.md) - Invoice system overview
- [Proposal Builder](./PROPOSAL_BUILDER.md) - Proposal creation flow
- [Client Portal](./CLIENT_PORTAL.md) - PDF access from client view
- [Admin Dashboard](./ADMIN_DASHBOARD.md) - PDF management from admin view
