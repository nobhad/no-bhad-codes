# Proposal Builder

**Last Updated:** January 28, 2026

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [User Flow](#user-flow)
4. [Tier System](#tier-system)
5. [Feature Customization](#feature-customization)
6. [Maintenance Options](#maintenance-options)
7. [Admin Management](#admin-management)
8. [API Endpoints](#api-endpoints)
9. [Database Schema](#database-schema)
10. [File Locations](#file-locations)
11. [Related Documentation](#related-documentation)

---

## Overview

The Proposal Builder is a tiered pricing system that allows clients to customize their project after completing the terminal intake form. It provides a GOOD/BETTER/BEST tier structure with mix-and-match feature customization.

**Key Features:**

- [x] Three-tier pricing structure (Good/Better/Best)
- [x] Feature customization with add-ons
- [x] Maintenance plan selection
- [x] Real-time price calculation
- [x] Animated step transitions
- [x] PDF proposal generation with branding
- [x] Admin proposal management panel
- [x] Convert proposals to invoices

**Access:** Appears after terminal intake completion at `/client/intake.html`

---

## Architecture

### Technology Stack

|Component|Technology|
|-----------|------------|
|Frontend|Vanilla TypeScript|
|Styling|CSS with CSS Variables|
|Animations|GSAP|
|PDF Generation|PDFKit|
|Build Tool|Vite|

### Module Structure

```text
src/features/client/
├── proposal-builder.ts           # Main module (~500 lines)
├── proposal-builder-ui.ts        # UI rendering functions (~600 lines)
├── proposal-builder-data.ts      # Tier configurations and pricing logic (~400 lines)
└── proposal-builder-types.ts     # TypeScript type definitions (~200 lines)

src/features/admin/modules/
└── admin-proposals.ts            # Admin proposal management (~350 lines)

server/routes/
└── proposals.ts                  # API endpoints (~830 lines)

server/database/migrations/
└── 025_proposal_requests.sql     # Database schema

src/styles/pages/
└── proposal-builder.css          # Proposal builder styles
```

---

## User Flow

### Step 1: Tier Selection

User selects one of three pricing tiers:

|Tier|Name|Description|
|------|------|-------------|
|`good`|Foundation|Essential features for simple projects|
|`better`|Professional|Recommended - balanced features and value|
|`best`|Premium|Full-featured with all capabilities|

Each tier displays:

- Tier name and tagline
- Price range (min-max)
- List of included features
- Highlighted "Recommended" badge (for Better tier)

### Step 2: Feature Customization

User can add optional features as add-ons:

- Included features shown with checkmarks
- Available add-ons shown with prices
- Add/remove add-ons updates total price
- Price bar shows running total

### Step 3: Maintenance Selection

User selects an ongoing maintenance plan:

|Option|Name|Description|
|--------|------|-------------|
|`diy`|DIY|Self-managed, no support|
|`essential`|Essential|Basic updates and security|
|`standard`|Standard|Regular updates and support|
|`premium`|Premium|Priority support and enhancements|

### Step 4: Summary & Submit

Final review showing:

- Selected tier with base price
- All included features
- Add-ons with individual prices
- Maintenance plan selection
- Total calculated price
- Notes textarea for client comments
- Submit button to create proposal

---

## Tier System

### Type Definitions

```typescript
export type TierId = 'good' | 'better' | 'best';

export interface ProposalTier {
  id: TierId;
  name: string;
  tagline: string;
  priceRange: {
    min: number;
    max: number;
  };
  baseFeatures: string[]; // Feature IDs included in this tier
  highlighted?: boolean; // Show as recommended
  description?: string;
}
```

### Configuration by Project Type

Tier configurations are defined in `proposal-builder-data.ts` based on project type:

```typescript
export function getTierConfiguration(projectType: ProjectType): TierConfiguration {
  // Returns tiers, features, and maintenance options for project type
}
```

Supported project types:

- `simple-site` - Simple informational website
- `business-site` - Business website with CMS
- `portfolio` - Portfolio/showcase site
- `ecommerce` - E-commerce with shopping cart
- `web-app` - Custom web application
- `browser-extension` - Browser extension
- `other` - Custom/other project

---

## Feature Customization

### Feature Categories

|Category|Description|
|----------|-------------|
|`design`|Visual design and UI features|
|`development`|Technical functionality|
|`support`|Support and maintenance features|
|`marketing`|SEO and marketing features|

### Feature Definition

```typescript
export interface ProposalFeature {
  id: string;
  name: string;
  description: string;
  price: number; // Add-on price when not included in tier
  category: FeatureCategory;
  tiers: TierId[]; // Which tiers include this feature
  isRequired?: boolean; // Cannot be removed
  requiresFeature?: string; // Depends on another feature
}
```

### Price Calculation

```typescript
export interface PriceBreakdown {
  tierBasePrice: number;
  tierName: string;
  addedFeatures: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  maintenanceOption: {
    name: string;
    price: number;
    billingCycle: BillingCycle;
  } | null;
  subtotal: number;
  total: number;
}
```

---

## Maintenance Options

### Option Types

```typescript
export type MaintenanceId = 'diy' | 'essential' | 'standard' | 'premium';
export type BillingCycle = 'monthly' | 'annual';

export interface MaintenanceOption {
  id: MaintenanceId;
  name: string;
  price: number;
  billingCycle: BillingCycle;
  features: string[];
  highlighted?: boolean;
  description?: string;
}
```

### Standard Options

|ID|Name|Price|Features|
|----|------|-------|----------|
|`diy`|DIY|$0/mo|Self-managed|
|`essential`|Essential|$50/mo|Security updates, backups|
|`standard`|Standard|$150/mo|+ Content updates, support|
|`premium`|Premium|$300/mo|+ Priority support, enhancements|

---

## Admin Management

### Proposals Tab

The Admin Dashboard includes a Proposals tab for managing client proposals:

**Features:**

- List all proposals with status badges
- Filter by status (pending, reviewed, accepted, rejected, converted)
- View proposal details including selected features
- Update proposal status
- Add admin notes
- Accept or reject proposals
- Convert accepted proposals to invoices

### Status Flow

```text
pending → reviewed → accepted → converted (to invoice)
                  ↘ rejected
```

### Actions

|Action|Endpoint|Description|
|--------|----------|-------------|
|View|GET `/proposals/:id`|View proposal details|
|Update Status|PUT `/proposals/admin/:id`|Update status/notes|
|Accept|PUT `/proposals/admin/:id`|Set status to `accepted`|
|Reject|PUT `/proposals/admin/:id`|Set status to `rejected`|
|Convert|POST `/proposals/admin/:id/convert`|Create invoice from proposal|
|Download PDF|GET `/proposals/:id/pdf`|Generate branded PDF|

---

## API Endpoints

See [API Documentation](../API_DOCUMENTATION.md#proposal-builder-endpoints) for full endpoint reference.

### Key Endpoints

|Endpoint|Method|Description|
|----------|--------|-------------|
|`/proposals`|POST|Create new proposal|
|`/proposals/:id`|GET|Get proposal details|
|`/proposals/:id/pdf`|GET|Download PDF|
|`/proposals/admin/list`|GET|List all (admin)|
|`/proposals/admin/:id`|PUT|Update status (admin)|
|`/proposals/admin/:id/convert`|POST|Convert to invoice (admin)|

---

## Database Schema

### Tables

**proposal_requests:**

|Column|Type|Description|
|--------|------|-------------|
|`id`|INTEGER|Primary key|
|`project_id`|INTEGER|FK to projects|
|`client_id`|INTEGER|FK to clients|
|`project_type`|TEXT|Project type identifier|
|`selected_tier`|TEXT|good/better/best|
|`base_price`|REAL|Tier base price|
|`final_price`|REAL|Total calculated price|
|`maintenance_option`|TEXT|Maintenance plan ID|
|`status`|TEXT|pending/reviewed/accepted/rejected/converted|
|`client_notes`|TEXT|Client comments|
|`admin_notes`|TEXT|Admin notes|
|`created_at`|DATETIME|Creation timestamp|
|`reviewed_at`|DATETIME|Review timestamp|
|`reviewed_by`|TEXT|Admin email|

**proposal_feature_selections:**

|Column|Type|Description|
|--------|------|-------------|
|`id`|INTEGER|Primary key|
|`proposal_request_id`|INTEGER|FK to proposal_requests|
|`feature_id`|TEXT|Feature identifier|
|`feature_name`|TEXT|Display name|
|`feature_price`|REAL|Price for this feature|
|`feature_category`|TEXT|design/development/support/marketing|
|`is_included_in_tier`|INTEGER|1 if included in selected tier|
|`is_addon`|INTEGER|1 if added as extra|

---

## File Locations

|File|Purpose|
|------|---------|
|`src/features/client/proposal-builder.ts`|Main module class|
|`src/features/client/proposal-builder-ui.ts`|UI rendering|
|`src/features/client/proposal-builder-data.ts`|Tier configurations|
|`src/features/client/proposal-builder-types.ts`|TypeScript types|
|`src/features/admin/modules/admin-proposals.ts`|Admin management|
|`server/routes/proposals.ts`|API endpoints|
|`server/database/migrations/025_proposal_requests.sql`|DB schema|
|`src/styles/pages/proposal-builder.css`|Styles|

---

## Related Documentation

- [Terminal Intake](./TERMINAL_INTAKE.md) - Intake form that precedes proposal builder
- [Admin Dashboard](./ADMIN_DASHBOARD.md) - Admin proposal management
- [Invoices](./INVOICES.md) - Invoice system (proposals convert to invoices)
- [API Documentation](../API_DOCUMENTATION.md#proposal-builder-endpoints) - Full API reference
