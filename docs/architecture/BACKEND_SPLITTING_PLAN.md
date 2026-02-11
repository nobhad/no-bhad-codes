# Backend File Splitting Plan

**Created:** February 10, 2026
**Purpose:** Reduce file sizes to stay under 25,000 token limit for Claude context

## Current State Analysis

### Files Exceeding/Approaching Token Limits

| File | Lines | Est. Tokens | Priority |
|------|-------|-------------|----------|
| `routes/invoices.ts` | 4,425 | ~35,000 | CRITICAL |
| `routes/projects.ts` | 4,411 | ~35,000 | CRITICAL |
| `services/invoice-service.ts` | 3,176 | ~25,000 | HIGH |
| `routes/admin.ts` | 2,810 | ~22,000 | HIGH |
| `services/analytics-service.ts` | 2,164 | ~17,000 | MEDIUM |
| `services/project-service.ts` | 1,796 | ~14,000 | LOW |
| `routes/clients.ts` | 1,708 | ~13,000 | LOW |

**Token Estimation:** ~8 tokens per line of TypeScript code

---

## CRITICAL: routes/invoices.ts (4,425 lines)

### Current Structure

```text
Lines 1-300:      Imports, interfaces, helper functions
Lines 300-520:    Test routes, basic CRUD setup
Lines 520-1080:   PDF Generation (560 lines)
Lines 1080-1720:  Search, CRUD operations
Lines 1720-1920:  Deposit endpoints
Lines 1920-2085:  Credit endpoints
Lines 2085-2230:  Payment plan endpoints
Lines 2230-2390:  Scheduled invoice endpoints
Lines 2390-2680:  Recurring invoice endpoints
Lines 2680-2765:  Reminder endpoints
Lines 2765-3130:  Client-facing routes
Lines 3130-3210:  Delete operations
Lines 3210-3430:  Payment terms presets
Lines 3430-3610:  Aging report
Lines 3610-3840:  Stripe integration
Lines 3840-4000:  Batch operations
Lines 4000-4425:  Additional endpoints
```

### Recommended Split

Create `server/routes/invoices/` directory:

| New File | Content | Est. Lines |
|----------|---------|------------|
| `index.ts` | Router setup, imports, exports | 50 |
| `core.ts` | CRUD operations, search, basic routes | 800 |
| `pdf.ts` | PDF generation logic | 600 |
| `deposits.ts` | Deposit invoice endpoints | 200 |
| `credits.ts` | Credit management | 200 |
| `payment-plans.ts` | Payment plan templates | 200 |
| `scheduled.ts` | Scheduled invoices | 200 |
| `recurring.ts` | Recurring invoices | 300 |
| `reminders.ts` | Reminder endpoints | 100 |
| `client-routes.ts` | Client-facing routes | 400 |
| `stripe.ts` | Stripe payment integration | 250 |
| `batch.ts` | Batch operations | 200 |
| `aging.ts` | Aging reports | 200 |
| `helpers.ts` | Shared helper functions, interfaces | 300 |

**Implementation Pattern:**

```typescript
// server/routes/invoices/index.ts
import express from 'express';
import { coreRouter } from './core';
import { pdfRouter } from './pdf';
import { depositsRouter } from './deposits';
// ... other imports

const router = express.Router();

router.use('/', coreRouter);
router.use('/', pdfRouter);
router.use('/deposit', depositsRouter);
// ... mount other routers

export { router as invoicesRouter };
```

---

## CRITICAL: routes/projects.ts (4,411 lines)

### Current Structure

```text
Lines 1-195:      Imports, access control helpers
Lines 195-730:    Core project CRUD
Lines 730-1000:   Milestone management
Lines 1000-1300:  Task endpoints
Lines 1300-1365:  Notes endpoints
Lines 1365-2485:  Files management (1,120 lines - largest section)
Lines 2485-2960:  PDF generation, intake documents
Lines 2960-3105:  Contract endpoints
Lines 3105-3160:  Tags endpoints
Lines 3160-3225:  Dependencies endpoints
Lines 3225-3280:  Checklist endpoints
Lines 3280-3475:  Comments endpoints
Lines 3475-3555:  Activity endpoints
Lines 3555-3635:  Health endpoints
Lines 3635-3665:  Status endpoints
Lines 3665-4340:  Template and generator endpoints
Lines 4340-4411:  Misc endpoints
```

### Recommended Split

Create `server/routes/projects/` directory:

| New File | Content | Est. Lines |
|----------|---------|------------|
| `index.ts` | Router setup, exports | 50 |
| `core.ts` | CRUD, access helpers | 600 |
| `milestones.ts` | Milestone management | 300 |
| `tasks.ts` | Task endpoints | 350 |
| `files.ts` | File management | 500 |
| `file-comments.ts` | File comments | 200 |
| `file-folders.ts` | Folder management | 200 |
| `file-versions.ts` | Version management | 200 |
| `pdf.ts` | PDF generation, intake docs | 500 |
| `contract.ts` | Contract endpoints | 150 |
| `tags.ts` | Tag management | 60 |
| `dependencies.ts` | Task dependencies | 80 |
| `checklist.ts` | Checklist items | 80 |
| `comments.ts` | Task comments | 200 |
| `activity.ts` | Activity log | 100 |
| `health.ts` | Health scoring | 100 |
| `templates.ts` | Project templates | 400 |
| `helpers.ts` | Shared access control, utils | 200 |

---

## HIGH: services/invoice-service.ts (3,176 lines)

### Current Structure

```text
Lines 1-450:      Interfaces and types (massive type definitions)
Lines 450-700:    InvoiceService class - core methods
Lines 700-1200:   CRUD operations
Lines 1200-1800:  Payment processing
Lines 1800-2400:  Recurring/scheduled logic
Lines 2400-3176:  Reporting and analytics
```

### Recommended Split

Create `server/services/invoice/` directory:

| New File | Content | Est. Lines |
|----------|---------|------------|
| `types.ts` | All interfaces and types | 450 |
| `invoice-service.ts` | Core InvoiceService class | 700 |
| `payment-service.ts` | Payment processing | 600 |
| `recurring-service.ts` | Recurring invoice logic | 600 |
| `reporting-service.ts` | Reports, analytics | 500 |
| `index.ts` | Re-exports | 30 |

**Benefits:**
- Types can be imported separately without loading business logic
- Each service is focused on one domain
- Easier to test individual components

---

## HIGH: routes/admin.ts (2,810 lines)

### Current Structure

```text
Lines 1-350:      Dashboard stats, overview
Lines 350-1450:   Lead management (extensive)
Lines 1450-1670:  Admin project creation
Lines 1670-1780:  KPI routes
Lines 1780-1845:  Workflow routes
Lines 1845-1950:  Settings routes
Lines 1950-2020:  Notification routes
Lines 2020-2060:  Tag routes
Lines 2060-2115:  Client portal routes
Lines 2115-2170:  Cache routes
Lines 2170-2240:  Misc admin routes
Lines 2240-2810:  Recent activity, additional endpoints
```

### Recommended Split

Create `server/routes/admin/` directory:

| New File | Content | Est. Lines |
|----------|---------|------------|
| `index.ts` | Router setup, exports | 50 |
| `dashboard.ts` | Stats, overview | 350 |
| `leads.ts` | Lead management | 500 |
| `projects.ts` | Admin project creation | 250 |
| `kpi.ts` | KPI endpoints | 120 |
| `workflows.ts` | Workflow admin | 70 |
| `settings.ts` | Admin settings | 120 |
| `notifications.ts` | Notification management | 80 |
| `tags.ts` | Tag management | 50 |
| `cache.ts` | Cache management | 60 |
| `activity.ts` | Recent activity | 300 |
| `misc.ts` | Miscellaneous endpoints | 200 |

---

## MEDIUM: services/analytics-service.ts (2,164 lines)

### Recommended Split

| New File | Content | Est. Lines |
|----------|---------|------------|
| `types.ts` | Analytics interfaces | 200 |
| `visitor-analytics.ts` | Visitor tracking | 500 |
| `business-analytics.ts` | Revenue, projects | 500 |
| `report-service.ts` | Report generation | 500 |
| `kpi-service.ts` | KPI calculations | 400 |
| `index.ts` | Re-exports | 30 |

---

## Implementation Strategy

### Phase 1: Extract Types (Low Risk)

1. Create `types.ts` files for each domain
2. Move interfaces/types out of service files
3. Update imports across codebase

**Files to create:**
- `server/types/invoice-types.ts`
- `server/types/project-types.ts`
- `server/types/analytics-types.ts`

### Phase 2: Split Routes (Medium Risk)

1. Create route directories
2. Extract routes by domain
3. Update `app.ts` imports
4. Test each endpoint

**Order:**
1. `invoices/` - Most critical, largest file
2. `projects/` - Second largest
3. `admin/` - Third largest

### Phase 3: Split Services (Higher Risk)

1. Extract service classes
2. Update dependency injection
3. Update route imports
4. Comprehensive testing

---

## Code Quality Improvements

### 1. Remove Duplicate Code

**Current Issue:** PDF generation logic duplicated in invoices.ts and projects.ts

**Solution:** Create `server/utils/pdf-generator.ts`

```typescript
// server/utils/pdf-generator.ts
export class PdfGenerator {
  static async generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> { }
  static async generateIntakePdf(data: IntakeDocument): Promise<Uint8Array> { }
  static async generateContractPdf(data: ContractData): Promise<Uint8Array> { }
}
```

### 2. Consolidate Helper Functions

**Current Issue:** Access control helpers repeated in multiple files

**Solution:** Create `server/middleware/access-control.ts`

```typescript
// server/middleware/access-control.ts
export async function canAccessProject(req: AuthenticatedRequest, projectId: number): Promise<boolean>
export async function canAccessInvoice(req: AuthenticatedRequest, invoiceId: number): Promise<boolean>
export async function canAccessFile(req: AuthenticatedRequest, fileId: number): Promise<boolean>
export async function isUserAdmin(req: AuthenticatedRequest): Promise<boolean>
```

### 3. Extract Response Transformers

**Current Issue:** Snake case conversion functions in invoices.ts (lines 127-295)

**Solution:** Create `server/utils/transformers.ts`

```typescript
// server/utils/transformers.ts
export function toSnakeCase<T>(obj: T): Record<string, unknown>
export function toCamelCase<T>(obj: Record<string, unknown>): T
```

### 4. Standardize Error Handling

**Current Issue:** Error responses inconsistent across routes

**Solution:** Create `server/utils/api-response.ts`

```typescript
// server/utils/api-response.ts
export function successResponse<T>(res: Response, data: T, status = 200)
export function errorResponse(res: Response, message: string, status = 400)
export function notFoundResponse(res: Response, entity: string)
export function forbiddenResponse(res: Response)
```

---

## File Size Guidelines

### Target Limits

| File Type | Max Lines | Max Tokens |
|-----------|-----------|------------|
| Route file | 800 | 6,000 |
| Service file | 1,000 | 8,000 |
| Types file | 500 | 4,000 |
| Utility file | 300 | 2,400 |

### Monitoring

Add to CI/CD:

```bash
# Check for files exceeding limits
find server -name "*.ts" -exec wc -l {} \; | awk '$1 > 1000 {print "WARNING: " $2 " has " $1 " lines"}'
```

---

## Migration Checklist

### For Each File Split

- [ ] Create new directory structure
- [ ] Extract types to separate file
- [ ] Extract routes/functions by domain
- [ ] Update all import statements
- [ ] Update app.ts router mounting
- [ ] Run TypeScript compiler (no errors)
- [ ] Run ESLint (no errors)
- [ ] Test all affected endpoints
- [ ] Update API documentation if needed

---

## Related Documentation

- [Database Schema](./DATABASE_SCHEMA.md)
- [API Documentation](../API_DOCUMENTATION.md)
