# State of the Art Roadmap

**Status:** In Progress — Phase 1-6 Complete
**Last Updated:** 2026-03-17
**Goal:** Close every meaningful gap between this platform and the best-in-class tools (HoneyBook, Dubsado, Moxie, Plutio, Bloom, Productive)

---

## Table of Contents

- [Phase 0: Foundation Fixes (Verified Gaps)](#phase-0-foundation-fixes-verified-gaps)
  - [0B. Client Proposal Experience (View + Accept)](#0b-client-proposal-experience-view--accept)
  - [0C. Maintenance Tier Activation System](#0c-maintenance-tier-activation-system)
  - [0D. Portal Contract Signing Bug](#0d-portal-contract-signing--missing-event-emission-verified-bug)
  - [0E. Webhook Dispatch for Slack/Discord](#0e-webhook-dispatch-for-slackdiscord)
  - [0F. Automations Use DB Email Templates](#0f-automations-use-db-email-templates)
  - [0G. Payment Schedule to Invoice Cascade](#0g-payment-schedule-to-invoice-cascade)
  - [0J. Export/CSV Missing onClick](#0j-exportcsv-buttons-most-admin-tables)
  - [0K. Admin Invoice Management Endpoint](#0k-admin-invoice-management-endpoint)
  - [0L. Create Modal Backend Gaps (2 Entities)](#0l-create-modal-backend-gaps-2-entities--verified)
  - [0M. LeadDetailPanel Not Wired](#0m-leaddetailpanel-not-wired)
  - [0N. Missing Design Documentation](#0n-missing-design-documentation)
  - [0O. Security Hardening](#0o-security-hardening)
  - [0P. Add Prefill Endpoint to Frontend Constants](#0p-add-prefill-endpoint-to-frontend-constants)
- [Phase 1: Unified Client Experience](#phase-1-unified-client-experience)
  - [1-Pre. Idempotency Guards](#1-pre-idempotency-guards-in-workflow-automations-do-first)
  - [1A. In-Portal Contract Signing](#1a-in-portal-contract-signing-prerequisite)
  - [1B. Embedded Stripe Payments](#1b-embedded-stripe-payments-prerequisite)
  - [1C. Unified Project Agreement Flow](#1c-unified-project-agreement-flow-the-big-payoff)
  - [1D. Guided Client Onboarding Checklist](#1d-guided-client-onboarding-checklist)
- [Phase 2: Lead Nurture and Follow-Up](#phase-2-lead-nurture-and-follow-up)
  - [2A. Email Drip Sequences](#2a-email-drip-sequences)
  - [2B. Meeting Request System](#2b-meeting-request-system)
- [Phase 3: Admin Self-Service Automations](#phase-3-admin-self-service-automations)
  - [3A. Automation Engine (Backend)](#3a-automation-engine-backend)
  - [3B. Automation Builder (Admin UI)](#3b-automation-builder-admin-ui)
- [Phase 4: Revenue Intelligence](#phase-4-revenue-intelligence)
  - [4A. Expense Tracking and Profitability](#4a-expense-tracking-and-profitability)
  - [4B. Retainer and Recurring Project Management](#4b-retainer-and-recurring-project-management)
- [Phase 5: Post-Project and Client Satisfaction](#phase-5-post-project-and-client-satisfaction)
  - [5A. Feedback Surveys and Testimonial Collection](#5a-feedback-surveys-and-testimonial-collection)
  - [5B. Embeddable Widgets](#5b-embeddable-widgets)
- [Phase 6: AI-Powered Features](#phase-6-ai-powered-features)
  - [6A. AI Proposal Drafting](#6a-ai-proposal-drafting)
  - [6B. AI Email Response Drafting](#6b-ai-email-response-drafting)
  - [6C. Semantic Search](#6c-semantic-search)
- [Phase 7: Multi-Currency and Tax Compliance](#phase-7-multi-currency-and-tax-compliance)
  - [7A. Multi-Currency Support](#7a-multi-currency-support)
  - [7B. Tax Jurisdiction Handling](#7b-tax-jurisdiction-handling)
- [Cross-Cutting Concerns](#cross-cutting-concerns)
  - [Scheduled Task Runner](#scheduled-task-runner-cron-consolidation)
  - [Testing Strategy Per Phase](#testing-strategy-per-phase)
- [Implementation Priority and Dependencies](#implementation-priority-and-dependencies)
- [Intentional Exclusions](#intentional-exclusions)
- [Change Log](#change-log)

---

## Phase 0: Foundation Fixes (Verified Gaps)

**Every item below has been verified against the actual codebase with file paths and line numbers. Items from earlier audits that proved false (orphaned services, broken delete buttons, prop passing issues, console.log) have been removed.**

**All Phase 0 items are fixes/completions of EXISTING code, not new features.**

---

### ~~0A. Wire Orphaned Services to API Routes~~ — REMOVED (Verified FALSE)

**Audit correction:** All 4 services (proposal-prefill, dynamic-questionnaire, intake-checklist, project-completion) DO have API routes registered in `server/routes/projects/core.ts` (lines 468-906) and `server/routes/proposals/core.ts` (line 468). They use dynamic `import()` to lazy-load the services. This was incorrectly flagged as missing.

---

### 0B. Client Proposal Experience (View + Accept)

**Problem:** Clients can see proposal cards in the portal but cannot click through to view full proposal content or accept/decline. The backend `POST /api/proposals/:id/accept` endpoint exists but zero frontend code calls it. `onNavigate('proposal-detail')` is fired from the card but no route handles it.

#### New React Components

**File: `src/react/features/portal/proposals/ProposalDetail.tsx`**

Full proposal detail view for clients.

```typescript
interface ProposalDetailProps {
  proposalId: number;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

**What it shows:**

- Project name and proposal title
- Selected tier with label (Good / Better / Best) and pricing
- Feature list (categorized: included features vs addons)
- Scope description
- Maintenance plan selected (DIY / Essential / Standard / Premium) with what's included
- Timeline and validity
- Total price breakdown
- PDF download button

**Acceptance UI (shown if status === 'sent' or 'viewed'):**

- "Accept Proposal" button (primary, prominent)
- "Decline" link (secondary, smaller)
- Accept confirmation modal: "By accepting this proposal, you agree to the scope and pricing described above. You'll be guided through contract signing and deposit payment next."
- Decline modal: optional reason textarea → `POST /api/proposals/:id/decline` (if endpoint exists, otherwise just update status)

**After acceptance:** Redirect to agreements flow (Phase 1C) or show success message with next steps.

**File: `src/react/features/portal/proposals/ProposalFeatureList.tsx`**

Reusable feature list display component.

```typescript
interface ProposalFeatureListProps {
  features: Array<{ id: string; name: string; category: string; included: boolean }>;
  addons: Array<{ id: string; name: string; price: number }>;
}
```

- Grouped by category (Design, Development, Content, SEO, etc.)
- Checkmark icon for included features
- Addon features shown with "+ $X" price labels

**File: `src/react/features/portal/proposals/MaintenancePlanCard.tsx`**

Displays the selected maintenance tier.

```typescript
interface MaintenancePlanCardProps {
  selectedTier: 'diy' | 'essential' | 'standard' | 'premium';
  proposalTier: 'good' | 'better' | 'best';  // Affects whether maintenance is included
}
```

- Shows tier name, monthly price, annual price
- Feature list for the selected tier
- If Best tier: "3 months included" badge
- If not Best: "Add-on" badge with pricing

#### Route Registration

**File: `src/react/app/PortalRoutes.tsx`** — add:

```typescript
const ProposalDetail = lazyNamed(() =>
  import('../features/portal/proposals/ProposalDetail').then(m => ({ ProposalDetail: m.ProposalDetail }))
);

// Add route:
<Route path="/proposal-detail/:id" element={
  <LazyTabRoute tabId="proposal-detail">
    <ProposalDetail {...commonProps} />
  </LazyTabRoute>
} />
```

**Fix existing `PortalProposals.tsx`:** Update the card `onClick` to navigate to `/proposal-detail/:id` instead of calling a nonexistent tab.

#### API Needs

- `GET /api/proposals/my/:id` — client endpoint to get full proposal with features, maintenance, pricing (may already exist, verify)
- `POST /api/proposals/:id/accept` — already exists
- `POST /api/proposals/:id/decline` — may need to be created if not existing
- `POST /api/proposals/:id/view` — mark as viewed (may already exist)

#### Testing (0B)

- Integration test: client fetches proposal detail → correct data shape
- Integration test: client accepts proposal → status updated, event emitted
- Component test: `ProposalDetail` renders tier, features, pricing
- Component test: accept button triggers confirmation modal
- Component test: `MaintenancePlanCard` shows "3 months included" for Best tier

---

### 0C. Maintenance Tier Activation System

**Problem:** The 4 maintenance tiers (DIY $0/mo, Essential $50/mo, Standard $150/mo, Premium $300/mo) are defined in `proposal-templates.json`, validated on proposal creation, stored in `proposal_requests.maintenance_option`, displayed on the PDF, read in `workflow-automations.ts` — **and then completely ignored**. No recurring invoices, no maintenance contracts, no post-project activation, no client visibility.

This is the biggest functional gap. The pricing model is designed to convert one-time project revenue into recurring maintenance revenue, but the conversion never happens.

#### What Exists (Storage Only)

- `proposal_requests.maintenance_option` column (diy/essential/standard/premium)
- Full tier definitions in `proposal-templates.json` (pricing, features, descriptions)
- `MaintenanceOptionDefinition` interface in `proposal-templates.ts`
- Prefill service recommends maintenance based on questionnaire answers
- PDF renders selected tier
- `contract_template_types` includes 'maintenance'
- Recurring invoice infrastructure exists (`recurring-service.ts`, `scheduled_invoices` table)

#### What's Missing (Everything After Storage)

**Database changes — Migration: `118_maintenance_activation.sql`**

(Renumber from here — this takes the 118 slot since it's Phase 0, push contract signing to 119)

```sql
-- Track maintenance on the project itself (not just the proposal)
ALTER TABLE projects ADD COLUMN maintenance_tier TEXT
  CHECK(maintenance_tier IN ('diy', 'essential', 'standard', 'premium'));
ALTER TABLE projects ADD COLUMN maintenance_status TEXT DEFAULT 'inactive'
  CHECK(maintenance_status IN ('inactive', 'pending', 'active', 'paused', 'expired'));
ALTER TABLE projects ADD COLUMN maintenance_start_date TEXT;
ALTER TABLE projects ADD COLUMN maintenance_end_date TEXT;
ALTER TABLE projects ADD COLUMN maintenance_contract_id INTEGER
  REFERENCES contracts(id);
ALTER TABLE projects ADD COLUMN maintenance_recurring_invoice_id INTEGER
  REFERENCES recurring_invoices(id);
ALTER TABLE projects ADD COLUMN maintenance_included_months INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN maintenance_included_until TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_maintenance
  ON projects(maintenance_status, maintenance_tier);
```

#### Workflow Automation Changes

**File: `server/services/workflow-automations.ts`** — modify `handleProposalAccepted`:

Currently reads `maintenance_option` at line ~105 and does nothing with it. Add:

```typescript
// After creating project + contract + payment schedule:
if (proposal.maintenance_option && proposal.maintenance_option !== 'diy') {
  // 1. Copy maintenance tier to project
  await db.run(
    `UPDATE projects SET
      maintenance_tier = ?,
      maintenance_status = 'pending'
    WHERE id = ?`,
    [proposal.maintenance_option, projectId]
  );

  // 2. If Best tier: 3 months included, calculate end date
  if (proposal.selected_tier === 'best') {
    const inclusionMonths = 3;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + inclusionMonths);
    await db.run(
      `UPDATE projects SET
        maintenance_included_months = ?,
        maintenance_included_until = ?
      WHERE id = ?`,
      [inclusionMonths, endDate.toISOString().split('T')[0], projectId]
    );
  }

  logger.info(`Maintenance tier '${proposal.maintenance_option}' set for project ${projectId}`);
}
```

**New handler: `handleProjectCompleted`** — activates maintenance after project delivery:

```typescript
async function handleProjectCompleted(data: { entityId?: number | null }): Promise<void> {
  const projectId = data.entityId;
  if (!projectId) return;

  const project = await db.get(
    'SELECT id, client_id, maintenance_tier, maintenance_status, maintenance_included_months, selected_tier FROM projects WHERE id = ?',
    [projectId]
  );

  if (!project || !project.maintenance_tier || project.maintenance_tier === 'diy') return;
  if (project.maintenance_status !== 'pending') return;  // Already activated or manually managed

  // 1. Look up tier pricing from config
  const tierConfig = getMaintenanceTierConfig(project.maintenance_tier);
  if (!tierConfig) return;

  // 2. Determine billing start date
  let billingStartDate: string;
  if (project.maintenance_included_months > 0) {
    // Best tier: billing starts AFTER included months
    const start = new Date();
    start.setMonth(start.getMonth() + project.maintenance_included_months);
    billingStartDate = start.toISOString().split('T')[0];
  } else {
    // Good/Better tier: billing starts immediately
    billingStartDate = new Date().toISOString().split('T')[0];
  }

  // 3. Create recurring invoice
  const recurringInvoice = await recurringService.create({
    clientId: project.client_id,
    projectId: projectId,
    frequency: 'monthly',
    amount: tierConfig.monthlyPrice,
    description: `${tierConfig.displayName} — Monthly Maintenance`,
    startDate: billingStartDate,
    endDate: null,  // Ongoing until cancelled
    autoSend: true
  });

  // 4. Generate maintenance contract (if template exists)
  const maintenanceTemplate = await db.get(
    "SELECT id FROM contract_templates WHERE type = 'maintenance' AND is_default = 1 LIMIT 1"
  );
  let contractId = null;
  if (maintenanceTemplate) {
    contractId = await contractService.generateFromTemplate(maintenanceTemplate.id, {
      projectId, clientId: project.client_id,
      variables: {
        maintenance_tier: tierConfig.displayName,
        monthly_price: tierConfig.monthlyPrice.toString(),
        annual_price: tierConfig.annualPrice.toString(),
        features: tierConfig.features.map(f => f.name).join(', ')
      }
    });
  }

  // 5. Update project
  await db.run(
    `UPDATE projects SET
      maintenance_status = 'active',
      maintenance_start_date = ?,
      maintenance_contract_id = ?,
      maintenance_recurring_invoice_id = ?
    WHERE id = ?`,
    [new Date().toISOString().split('T')[0], contractId, recurringInvoice.id, projectId]
  );

  // 6. Send maintenance activation email to client
  await sendMaintenanceActivationEmail(project.client_id, project, tierConfig);

  // 7. Emit event
  await workflowTriggerService.emit('maintenance.activated', {
    entityId: projectId,
    triggeredBy: 'workflow-automation',
    tier: project.maintenance_tier
  });

  logger.info(`Maintenance activated for project ${projectId}: tier=${project.maintenance_tier}`);
}

// Register handler:
workflowTriggerService.on('project.completed', handleProjectCompleted);
```

#### Helper: Tier Config Lookup

**File: `server/config/proposal-templates.ts`** — add exported function:

```typescript
export function getMaintenanceTierConfig(tier: string): MaintenanceOptionDefinition | null {
  // Read from proposal-templates.json maintenance.options
  const templates = loadProposalTemplates();
  return templates.maintenance?.options?.find(o => o.name === tier) ?? null;
}
```

#### Client Portal Visibility

**File: `src/react/features/portal/maintenance/MaintenancePlan.tsx`**

```typescript
interface MaintenancePlanProps {
  projectId: number;
  getAuthToken?: () => string | null;
}
```

- Shows current maintenance tier and status (Active / Pending / Paused)
- Feature list for the active tier
- If Best tier with included months: "Included until [date] — billing starts [date]"
- Monthly/annual price display
- Maintenance contract link (if exists)
- "Change Plan" or "Cancel Plan" contact admin CTA (not self-service initially)

**Where it appears:**

- Project detail view (client portal) — new "Maintenance" section
- Dashboard — maintenance status card for active projects

#### API Endpoints

```text
GET /api/portal/projects/:id/maintenance          — Client's maintenance plan status
GET /api/admin/projects/:id/maintenance            — Admin maintenance management
PUT /api/admin/projects/:id/maintenance            — Admin update tier/status
POST /api/admin/projects/:id/maintenance/pause     — Pause maintenance billing
POST /api/admin/projects/:id/maintenance/resume    — Resume maintenance billing
POST /api/admin/projects/:id/maintenance/cancel    — Cancel maintenance
```

#### Edge Cases

- **DIY tier selected:** No maintenance activation. Project gets `maintenance_tier = 'diy'` but `maintenance_status` stays `inactive`. No recurring invoices.
- **Best tier with 3 months included:** Maintenance activates on project completion. First recurring invoice generated 3 months later. Client gets email: "Your included maintenance period ends [date]. Billing will begin automatically."
- **Client selected Essential but project is Best tier:** Tier controls included months (Best = 3 months included regardless of selected maintenance tier). The selected tier determines the recurring price after inclusion expires.
- **Project never completes:** Maintenance stays `pending`. Admin can manually activate.
- **Admin pauses maintenance:** Recurring invoice suspended. Status → 'paused'. Can resume.
- **Maintenance contract template doesn't exist:** Skip contract generation, proceed with recurring invoice only. Log warning.

#### Testing (0C)

- Unit test: `handleProjectCompleted` with maintenance_tier='essential' → recurring invoice created, status='active'
- Unit test: `handleProjectCompleted` with maintenance_tier='diy' → no action
- Unit test: `handleProjectCompleted` with Best tier → billing starts 3 months out
- Unit test: `handleProjectCompleted` called twice → idempotent (second call sees status='active', skips)
- Unit test: `getMaintenanceTierConfig('standard')` returns correct pricing
- Integration test: complete project → verify recurring invoice exists with correct amount and start date
- Component test: `MaintenancePlan` shows included months for Best tier
- Component test: `MaintenancePlanCard` (from 0B) displays correct tier features

---

### 0D. Portal Contract Signing — Missing Event Emission (VERIFIED BUG)

**Problem:** Portal contract signing saves to DB but **never emits `contract.signed` event**, so the project never transitions to 'active' status.

**Verified:** Two signing paths exist:

1. **Email-link signing** (`POST /api/projects/contract/sign-by-token/:token` in `server/routes/projects/contracts.ts` line 740-942) — **WORKS FULLY.** Saves signature, emits `contract.signed` event (line 918), triggers `handleContractSigned()` which sets project to 'active', sends notification emails.

2. **Portal in-app signing** (`POST /api/contracts/sign` in `server/routes/contracts/client.ts` line 191-273) — **BROKEN.** Saves signature data to DB via `contractService.signContractFromPortal()`, creates audit log entry, but **does NOT emit `contract.signed` event**. Zero references to `workflowTriggerService.emit()` in the handler. Project stays 'pending' forever.

#### Fix (1 line + import)

**File: `server/routes/contracts/client.ts`** — add after line 272 (after signature is saved):

```typescript
// Emit event to trigger project activation + notifications
await workflowTriggerService.emit('contract.signed', {
  entityId: contractId,
  projectId,
  signerName,
  signerEmail: clientEmail,
  triggeredBy: clientEmail
});
```

**Import at top of file:** `import { workflowTriggerService } from '../../services/workflow-trigger-service.js';`

#### Testing (0D)

- Unit test: portal sign → verify `contract.signed` event emitted
- Integration test: portal sign → verify project status changes to 'active'
- Regression test: email-link signing still works after change

---

### 0E. Webhook Dispatch for Slack/Discord

**Problem:** Webhook configuration (URLs, channels) is stored in the database via `/api/integrations/notifications` CRUD endpoints. But **no code ever sends messages to these webhooks**. The config is saved and forgotten.

#### Implementation

**File: `server/services/integrations/webhook-dispatch-service.ts`** (new)

```typescript
class WebhookDispatchService {
  // Get all active webhook configs for an event type
  async getWebhooksForEvent(eventType: string): Promise<WebhookConfig[]>

  // Dispatch to all configured webhooks
  async dispatch(eventType: string, payload: Record<string, unknown>): Promise<{ sent: number; failed: number }>

  // Format message per platform
  private formatSlackPayload(eventType: string, payload: Record<string, unknown>): object
  private formatDiscordPayload(eventType: string, payload: Record<string, unknown>): object
}

export const webhookDispatchService = new WebhookDispatchService();
```

**Integration with events — add to `workflow-automations.ts`:**

```typescript
// At the end of EVERY event handler, dispatch to webhooks:
async function dispatchWebhooks(eventType: string, context: Record<string, unknown>): Promise<void> {
  try {
    await webhookDispatchService.dispatch(eventType, context);
  } catch (err) {
    logger.error(`Webhook dispatch failed for ${eventType}`, err);
    // Non-blocking: webhook failure should never break the main flow
  }
}

// Call at the end of each handler:
// e.g., in handleProposalAccepted:
await dispatchWebhooks('proposal.accepted', { proposalId, clientId, projectId, tier: proposal.selected_tier });
```

**Events to dispatch (start with high-value ones):**

- `proposal.accepted` — "New proposal accepted: [project] by [client] ($[amount])"
- `contract.signed` — "Contract signed: [project] by [client]"
- `invoice.paid` — "Invoice paid: #[number] for $[amount]"
- `project.completed` — "Project completed: [project]"
- `lead.created` — "New lead: [name] ([email])"
- `message.created` (from client only) — "New message from [client]: [preview]"

#### Message Format (Slack)

```json
{
  "text": "Invoice Paid",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Invoice Paid* :white_check_mark:\nInvoice #2026-03-001 for *$2,500.00*\nClient: Hedgewitch Horticulture\nProject: Website Redesign"
      }
    }
  ]
}
```

#### Testing (0E)

- Unit test: `dispatch` sends to all configured webhooks for event type
- Unit test: `dispatch` with no webhooks configured → no-op
- Unit test: webhook failure → logged but doesn't throw
- Unit test: Slack payload format matches Slack API schema
- Integration test: trigger event → verify HTTP POST to webhook URL

---

### 0F. Automations Use DB Email Templates

**Problem:** The email template system has full CRUD (`/api/email-templates`), admin can create/edit templates with variable substitution. But `workflow-automations.ts` hardcodes all email HTML inline instead of querying templates.

#### Implementation

**Step 1:** Identify all hardcoded emails in `workflow-automations.ts` — each `sendEmail()` call with inline HTML.

**Step 2:** For each, create (or verify existing) email template in a seed migration:

```sql
INSERT OR IGNORE INTO email_templates (name, slug, subject, body, variables, category)
VALUES
  ('Proposal Accepted', 'proposal-accepted', 'Proposal Accepted — {{project_name}}', '...', '["client_name","project_name","tier","amount"]', 'workflow'),
  ('Contract Ready', 'contract-ready', 'Your Contract is Ready — {{project_name}}', '...', '["client_name","project_name","signing_url"]', 'workflow'),
  ('Invoice Created', 'invoice-created', 'New Invoice — {{invoice_number}}', '...', '["client_name","invoice_number","amount","due_date"]', 'workflow'),
  ('Project Completed', 'project-completed', 'Project Complete — {{project_name}}', '...', '["client_name","project_name"]', 'workflow'),
  ('Maintenance Activated', 'maintenance-activated', 'Your Maintenance Plan is Active — {{project_name}}', '...', '["client_name","project_name","tier_name","monthly_price"]', 'workflow');
```

**Step 3:** Replace hardcoded emails with template lookups:

```typescript
// Before (hardcoded):
await sendEmail({
  to: clientEmail,
  subject: `Your contract for ${projectName} is ready`,
  html: `<div>...hardcoded HTML...</div>`
});

// After (template-driven):
const template = await db.get(
  "SELECT * FROM email_templates WHERE slug = ? AND deleted_at IS NULL",
  ['contract-ready']
);
if (template) {
  const html = substituteVariables(template.body, {
    client_name: clientName,
    project_name: projectName,
    signing_url: signingUrl
  });
  await sendEmail({ to: clientEmail, subject: substituteVariables(template.subject, vars), html });
} else {
  // Fallback to hardcoded (backward compat during migration)
  await sendEmail({ ... });
}
```

**Step 4:** Add `substituteVariables` helper if not already in email service:

```typescript
function substituteVariables(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value ?? ''),
    template
  );
}
```

#### Testing (0F)

- Unit test: `substituteVariables` replaces all occurrences
- Unit test: `substituteVariables` handles missing variables gracefully (empty string)
- Integration test: trigger workflow event → verify email uses DB template content, not hardcoded

---

### 0G. Payment Schedule to Invoice Cascade

**Problem:** `workflow-automations.ts` creates payment schedule installments (via `createFromSplit`) but these installments are NOT automatically converted to invoices. The milestone-completed handler only creates invoices when deliverables have explicit prices. If installments exist without corresponding milestones, they sit unprocessed.

#### Implementation

**Option A (Recommended): Auto-generate invoice when installment due date arrives**

Add to scheduled task runner:

```typescript
taskRunner.register({
  name: 'installment-invoicing',
  schedule: '0 7 * * *',  // Daily at 7 AM
  handler: () => paymentScheduleService.generateDueInvoices(),
  enabled: true
});
```

**Service method:**

```typescript
async generateDueInvoices(): Promise<{ generated: number; skipped: number }> {
  // Find installments that are due (or overdue) and have no linked invoice
  const dueInstallments = await db.all(`
    SELECT i.*, p.project_name, c.email as client_email, c.contact_name
    FROM payment_schedule_installments i
    JOIN projects p ON p.id = i.project_id
    JOIN clients c ON c.id = i.client_id
    WHERE i.status = 'pending'
      AND i.due_date <= date('now', '+3 days')
      AND NOT EXISTS (
        SELECT 1 FROM invoices inv
        WHERE inv.project_id = i.project_id
          AND inv.total_amount = i.amount
          AND inv.notes LIKE '%' || i.label || '%'
          AND inv.deleted_at IS NULL
      )
  `);

  let generated = 0;
  for (const installment of dueInstallments) {
    const invoice = await invoiceService.createFromInstallment(installment);
    if (invoice) {
      generated++;
      await workflowTriggerService.emit('invoice.created', {
        entityId: invoice.id, triggeredBy: 'installment-auto'
      });
    }
  }
  return { generated, skipped: dueInstallments.length - generated };
}
```

**`createFromInstallment` in invoice service:**

```typescript
async createFromInstallment(installment: PaymentInstallment): Promise<Invoice> {
  return this.create({
    clientId: installment.clientId,
    projectId: installment.projectId,
    lineItems: [{
      description: installment.label || `Payment Installment #${installment.installmentNumber}`,
      quantity: 1,
      unit_price: installment.amount,
      amount: installment.amount,
      sort_order: 1
    }],
    dueDate: installment.dueDate,
    notes: `Auto-generated from payment schedule: ${installment.label}`
  });
}
```

#### Testing (0G)

- Unit test: `generateDueInvoices` creates invoice for due installment
- Unit test: `generateDueInvoices` skips installments that already have invoices (idempotent)
- Unit test: `generateDueInvoices` only picks up installments due within 3 days
- Integration test: create payment schedule → advance date → verify invoice generated

---

### ~~0H. Admin Table Delete Button Wiring~~ — REMOVED (Verified FALSE)

**Audit correction:** All 7 tables (Proposals, Email Templates, Ad-Hoc Requests, Deliverables, Document Requests, KB Articles, KB Categories) have fully functional delete buttons with `onClick` handlers, API calls, and `window.confirm()` dialogs. Verified at ProposalsTable.tsx:537, EmailTemplatesManager.tsx:339, DocumentRequestsTable.tsx:550, AdHocRequestsTable.tsx:591, DeliverablesTable.tsx:551, ArticlesTable.tsx:394, CategoriesTable.tsx:313. CreateEntityModals.tsx cancel buttons also work correctly via `handleCancel()` → `reset()` → `onOpenChange(false)`.

---

### ~~0I. Portal Prop Passing and Minor Fixes~~ — REMOVED (Verified FALSE)

**Audit correction:** `PortalRequestsHub` doesn't explicitly pass props to children, but `LazyTabRoute` injects `getAuthToken` and `showNotification` via `React.cloneElement()` at the TabPanel level. Child components receive props correctly through this mechanism. `PaymentScheduleView` uses `usePortalData` hook which gets auth from React context, not from props. The `console.log` at `createTabs.tsx:636` is inside a JSDoc comment, not executable code. No production console.log statements found.

---

### 0J. Export/CSV Buttons (Most Admin Tables)

**Problem:** Most admin tables have an "Export to CSV" button but many are missing the `onClick` binding. The `useExport` hook and `table-export` utility exist and work — InvoicesTable.tsx (line 357) correctly uses `onClick={exportCsv}`. But other tables like ContactsTable.tsx (line 389) render the button without an onClick handler.

**Affected:** ALL 22 admin tables (Clients, Contacts, Contracts, Proposals, Invoices, Projects, Leads, Deliverables, Document Requests, Questionnaires, Email Templates, Workflows, Ad-Hoc Requests, Approvals, Deleted Items, Knowledge Base Articles, KB Categories, Global Tasks, Time Tracking, Design Reviews, Messaging, Files).

#### Implementation

**File: `src/react/hooks/useExport.ts`** (may already exist — verify and complete)

```typescript
function useExport<T>(data: T[], columns: ExportColumn[], filename: string) {
  const exportToCsv = useCallback(() => {
    const headers = columns.map(c => c.label).join(',');
    const rows = data.map(item =>
      columns.map(c => {
        const value = c.accessor(item);
        // Escape commas and quotes in CSV values
        const escaped = String(value ?? '').replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [data, columns, filename]);

  return { exportToCsv };
}
```

**Per-table wiring pattern:**

```typescript
const { exportToCsv } = useExport(filteredData, EXPORT_COLUMNS, 'contacts');
// Wire to button:
<button onClick={exportToCsv}>Export CSV</button>
```

Each table needs a `EXPORT_COLUMNS` constant defining which columns to export and how to access them.

#### Testing (0J)

- Unit test: CSV generation with special characters (commas, quotes, newlines)
- Unit test: empty data produces headers-only CSV
- Component test: click export → blob download triggered

---

### 0K. Admin Invoice Management Endpoint

**Problem:** Frontend references `/api/admin/invoices` but the endpoint doesn't exist. Invoices only have client-facing routes at `/api/invoices`. Admin cannot centrally manage all invoices.

#### Implementation

**File: `server/routes/admin/invoices.ts`** (new)

```text
GET  /api/admin/invoices                         — List all invoices with client/project joins
GET  /api/admin/invoices/stats                   — Invoice stats (total, paid, outstanding, overdue)
PUT  /api/admin/invoices/:id/status              — Quick status update
POST /api/admin/invoices/bulk-delete             — Bulk soft delete
POST /api/admin/invoices/bulk-status             — Bulk status change
```

**Mount in:** `server/routes/admin/index.ts`

The existing `/api/invoices` routes handle individual invoice CRUD. The admin routes add list-all + bulk operations.

---

### 0L. Create Modal Backend Gaps (2 Entities — Verified)

**Problem:** 2 admin entities have broken create flows. (Original claim of 4 was partially false — Deliverables and Questionnaires work.)

**Verified status:**

1. **Design Reviews** — DesignReviewTable uses `CreateDeliverableModal` (wrong modal!) and posts to `/api/admin/deliverables` (wrong endpoint). `server/routes/admin/design-reviews.ts` only has GET and PATCH — **no POST endpoint**. **BROKEN.**
2. **Workflows** — WorkflowsTable has no create modal. `server/routes/admin/workflows.ts` only has GET, bulk-status, bulk-delete — **no POST endpoint for creating individual workflows**. **BROKEN.**
3. ~~**Questionnaires**~~ — Uses a dedicated create page (not modal) that navigates to `questionnaire-create`. `POST /api/questionnaires` exists at `server/routes/questionnaires/admin.ts` lines 193-228. **WORKS.**
4. ~~**Deliverables**~~ — `CreateDeliverableModal` posts to `POST /api/admin/deliverables` which exists at `server/routes/admin/deliverables.ts` lines 42-71. **WORKS.**

#### Action Items

1. **Design Reviews:** Create `POST /api/admin/design-reviews` endpoint. Fix DesignReviewTable to use correct modal (or create a `CreateDesignReviewModal`).
2. **Workflows:** Create `POST /api/admin/workflows` endpoint for individual workflow creation. Add a create modal or navigation to a workflow builder.

---

### 0M. LeadDetailPanel Not Wired

**Problem:** `src/react/features/admin/leads/LeadDetailPanel.tsx` was built but LeadsTable.tsx never imports or uses it. Row clicks on the leads table don't open a detail panel.

#### Fix

Import and wire in `LeadsTable.tsx` following the same pattern as `ContactsTable.tsx`:

```typescript
import { LeadDetailPanel } from './LeadDetailPanel';

// In table row click handler:
const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
// ...
{selectedLead && (
  <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
)}
```

---

### 0N. Missing Design Documentation

**Problem:** CLAUDE.md mandates three design docs in `/docs/design/`: `CSS_ARCHITECTURE.md`, `UX_GUIDELINES.md`, and `ANIMATIONS.md`. Only ANIMATIONS.md exists (as a CSS token file). The other two are missing entirely.

#### Action Items

1. **Create `docs/design/CSS_ARCHITECTURE.md`** — Document the 843 CSS variables, semantic class catalog, component organization, `--app-color-*` naming convention, and usage examples
2. **Create `docs/design/UX_GUIDELINES.md`** — Document typography standards, icon usage (Lucide), spacing standards, button standards, and user preferences from CLAUDE.md

These are documentation tasks, not code tasks, but they're required by the project's own rules.

---

### 0O. Security Hardening

**Problem:** Security audit found several medium/high issues that should be addressed.

#### High Priority

1. **Remove or secure demo user scripts** — `server/scripts/create-demo-user.ts` and `create-test-user.ts` have hardcoded passwords visible in source. Either delete from production deployment or move passwords to env vars.
2. **Standardize bcrypt rounds** — Some files use 10 rounds, production code uses 12. Standardize to 12 everywhere. Files: `create-demo-user.ts`, `intake.ts`.

#### Medium Priority

3. **Form input accessibility** — ~10 form inputs in portal (settings, questionnaires, content-requests) lack explicit `<label>` associations. Add `htmlFor` and `id` attributes.

---

### 0P. Add Prefill Endpoint to Frontend Constants

**Problem:** `GET /api/proposals/prefill/:projectId` exists on the backend but is NOT in `src/constants/api-endpoints.ts`. No frontend code references it. The proposal builder cannot use prefill data.

#### Fix

Add to `api-endpoints.ts`:

```typescript
PROPOSALS: {
  // ... existing
  PREFILL: (projectId: number) => `/api/proposals/prefill/${projectId}`,
}
```

Then integrate into the admin proposal builder UI to auto-populate fields.

---

## Phase 0 Summary (After Verification)

**Removed (verified false):** ~~0A (orphaned services)~~, ~~0H (delete buttons)~~, ~~0I (portal prop passing)~~

**12 verified items remain:**

```text
CRITICAL (blocks Phase 1):
0B. Client Proposal View + Accept        3 React components + 1 route registration
0C. Maintenance Tier Activation          1 migration + workflow handler + React component + API
0D. Portal Signing Event Bug             1 line fix + import (missing workflowTriggerService.emit)
0G. Installment → Invoice Cascade        1 service method + 1 cron job

HIGH (broken integrations):
0E. Webhook Dispatch (Slack/Discord)     1 new dispatch service + event hooks
0F. Email Templates in Automations       1 seed migration + refactor 7 notification handlers
0K. Admin Invoice Endpoint               1 route file + mount in admin barrel
0L. Create Modal Backends (2 entities)   Design Reviews POST + Workflows POST

MEDIUM (UI completeness):
0J. Export/CSV Missing onClick           Wire useExport hook to ~15 tables (some already work)
0M. LeadDetailPanel Not Wired            1 import + useState in LeadsTable.tsx
0P. Prefill in Frontend Constants        1 constant + admin proposal builder integration

LOW (documentation):
0N. Missing Design Docs                  Create CSS_ARCHITECTURE.md + UX_GUIDELINES.md
0O. Security Hardening                   Demo scripts + bcrypt rounds + form labels
```

**Phase 0 must complete before Phase 1.** Proposals must be viewable/acceptable (0B), portal signing must emit events (0D), and installments must cascade to invoices (0G).

---

## Phase 1: Unified Client Experience — COMPLETE (core)

The single biggest differentiator in the space. HoneyBook's "Smart Files" combine proposal + contract + payment into one flow. Right now our pipeline requires 4 separate client actions across 4 separate screens. Phase 1 eliminates that friction.

**Status:** Core implementation complete (March 17, 2026). Phase 1.5 deferred items tracked below.

**Implemented:**

- 1-Pre: Idempotency guards (milestone check before generation)
- 1A: In-portal contract signing (verified working — ContractSignModal + POST /sign)
- 1B: Embedded Stripe Payments (migration 119, StripePaymentService, PaymentElement, processing fee)
- 1C: Unified Project Agreement Flow (migration 120, vertical card stack, GSAP transitions, auto-complete)
- 1D: Onboarding Checklist (migration 121, dashboard widget, seeded templates, workflow auto-complete)

**Deferred to Phase 1.5:**

- Auto-pay (cron + retry + saved payment methods management UI)
- Agreement admin drag-to-reorder builder (templates only for now)
- Onboarding admin template CRUD UI (seeded via migration)
- Upload mode for signature (draw + type cover 99% of cases)
- Agreement expiration cron

**Feature docs:** [Embedded Payments](features/EMBEDDED_PAYMENTS.md) | [Agreements](features/AGREEMENTS.md) | [Onboarding Checklist](features/ONBOARDING_CHECKLIST.md)

**Dependency chain:** 1-Pre must be done first (trivial). Then 1A and 1B are prerequisites for 1C. 1D can be built in parallel with 1C.

---

### 1-Pre. Idempotency Guards in Workflow Automations (Do First)

**Problem:** The existing `handleProposalAccepted` in `workflow-automations.ts` unconditionally generates contracts, milestones, and payment schedules. When the agreement flow (1C) pre-creates these entities, the cascade would duplicate them.

**This must be implemented BEFORE any Phase 1 feature, because 1A and 1B both emit events that hit this handler.**

#### Implementation

**File: `server/services/workflow-automations.ts`** — modify `handleProposalAccepted`:

```typescript
// BEFORE generating contract:
const existingContract = await db.get(
  'SELECT id FROM contracts WHERE project_id = ? AND deleted_at IS NULL LIMIT 1',
  [projectId]
);
if (!existingContract) {
  // Generate contract (existing logic)
} else {
  logger.info(`Skipping contract generation — contract ${existingContract.id} already exists for project ${projectId}`);
}

// BEFORE generating payment schedule:
const existingSchedule = await db.get(
  'SELECT id FROM payment_schedule_installments WHERE project_id = ? LIMIT 1',
  [projectId]
);
if (!existingSchedule) {
  // Generate payment schedule (existing logic)
} else {
  logger.info(`Skipping payment schedule — installments already exist for project ${projectId}`);
}

// BEFORE generating milestones:
const existingMilestones = await db.get(
  'SELECT id FROM milestones WHERE project_id = ? LIMIT 1',
  [projectId]
);
if (!existingMilestones) {
  // Generate milestones (existing logic)
} else {
  logger.info(`Skipping milestone generation — milestones already exist for project ${projectId}`);
}
```

**Also apply the same pattern to `handleProjectCreated`** for questionnaire auto-assignment:

```typescript
const existingAssignment = await db.get(
  'SELECT id FROM questionnaire_assignments WHERE project_id = ? LIMIT 1',
  [projectId]
);
if (!existingAssignment) {
  // Auto-assign questionnaires (existing logic)
}
```

#### Testing

- Unit test: call `handleProposalAccepted` twice with the same proposalId — second call should be a no-op
- Unit test: call with project that already has a contract — should skip contract generation
- Integration test: accept proposal → verify exactly 1 contract, 1 payment schedule, 1 set of milestones

**Effort:** ~30 minutes. Zero new files. Zero migrations.

---

### 1A. In-Portal Contract Signing (Prerequisite)

**Problem:** `sign-contract.html` is the only signing path. Clients in the portal cannot see or sign contracts — `/contracts` route redirects to `/documents`. This blocks the unified agreement flow.

**Competitors:** Every competitor has in-app signing. Dubsado, HoneyBook, and Bloom all have draw/type signature inside the portal.

#### Database Changes

**Migration: `118_contract_portal_signing.sql`**

```sql
-- Add portal signing fields to contracts table
ALTER TABLE contracts ADD COLUMN portal_signed_at TEXT;
ALTER TABLE contracts ADD COLUMN portal_signer_ip TEXT;
ALTER TABLE contracts ADD COLUMN portal_signer_user_agent TEXT;

-- Index for client contract lookups
CREATE INDEX IF NOT EXISTS idx_contracts_client_portal
  ON contracts(client_id, status, deleted_at);
```

No new tables needed — the existing `contracts` table and `signature_log` table handle everything. We add columns for portal-specific signing metadata to distinguish portal signs from email-link signs.

#### TypeScript Interfaces

**File: `server/services/contract-signing-types.ts`**

```typescript
export interface PortalSignRequest {
  signatureData: string;       // Base64 PNG from canvas
  signatureMethod: 'draw' | 'type' | 'upload';
  typedName?: string;          // If method === 'type'
  agreedToTerms: boolean;      // Must be true
}

export interface PortalSignResult {
  success: boolean;
  contract: {
    id: number;
    status: string;
    signedAt: string;
  };
  message: string;
}

export interface ClientContractView {
  id: number;
  projectId: number;
  projectName: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled';
  content: string;            // HTML content for preview
  sentAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  canSign: boolean;           // true if status === 'sent' or 'viewed'
  createdAt: string;
}
```

#### API Endpoints

**File: `server/routes/contracts/portal.ts`** (new sub-router)

```text
GET  /api/contracts/my                    — Client's contracts list
GET  /api/contracts/my/:id                — Single contract with full content
POST /api/contracts/my/:id/view           — Mark as viewed (updates viewed_at)
POST /api/contracts/my/:id/sign           — Portal signing endpoint
GET  /api/contracts/my/:id/pdf            — Download signed PDF
```

**Middleware chain:** `authenticateToken → requireClient → asyncHandler`

**`POST /api/contracts/my/:id/sign` — detailed flow:**

1. Validate `req.body` against `PortalSignRequest` schema
2. Verify `agreedToTerms === true` — reject if false
3. Fetch contract — verify `client_id === req.user.id`
4. Verify contract status is `sent` or `viewed` — reject if `draft`, `signed`, `expired`, `cancelled`
5. Check `expires_at` — if past, update status to `expired` and reject
6. Save `signatureData` to `contracts.signature_data` (JSON with method, image, timestamp)
7. Update contract: `status = 'signed'`, `signed_at = NOW()`, `portal_signed_at = NOW()`, `portal_signer_ip`, `portal_signer_user_agent`
8. Insert into `signature_log`: action = 'signed_portal', signer email, IP, user agent, timestamp
9. Emit `contract.signed` event via `workflowTriggerService.emit()` — this triggers existing `handleContractSigned` which sets project to `active`
10. Send notification email to admin: "Client signed contract for Project X"
11. Return `PortalSignResult`

**Error cases:**

- Contract not found or wrong client → `404 RESOURCE_NOT_FOUND`
- Contract not in signable state → `400 VALIDATION_ERROR` with message explaining current status
- Contract expired → `410 GONE` with "This contract has expired"
- Missing signature data → `400 VALIDATION_ERROR`
- `agreedToTerms !== true` → `400 VALIDATION_ERROR`

#### Service Layer

**File: `server/services/contract-signing-service.ts`**

```typescript
class ContractSigningService {
  // Client-facing queries
  async getClientContracts(clientId: number): Promise<ClientContractView[]>
  async getClientContract(contractId: number, clientId: number): Promise<ClientContractView | null>

  // Signing
  async signFromPortal(contractId: number, clientId: number, data: PortalSignRequest, meta: {
    ip: string;
    userAgent: string;
  }): Promise<PortalSignResult>

  // Status helpers
  async markViewed(contractId: number, clientId: number): Promise<void>
  async isExpired(contract: { expires_at: string | null }): boolean
}

export const contractSigningService = new ContractSigningService();
```

**Query pattern for `getClientContracts`:**

```sql
SELECT
  c.id, c.project_id, c.status, c.content, c.sent_at,
  c.signed_at, c.expires_at, c.created_at,
  p.project_name
FROM contracts c
LEFT JOIN projects p ON p.id = c.project_id
WHERE c.client_id = ?
  AND c.status != 'draft'
  AND c.deleted_at IS NULL
ORDER BY c.created_at DESC
```

Contracts in `draft` status are hidden from clients — only admin sees drafts.

#### React Components

**File: `src/react/features/portal/contracts/PortalContracts.tsx`**

Top-level portal contracts view. Replaces the redirect to `/documents`.

```typescript
interface PortalContractsProps {
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}
```

- Fetches `GET /api/contracts/my`
- Renders contract cards with status badges
- "Sign" button on contracts where `canSign === true`
- "View PDF" button on signed contracts
- Empty state: "No contracts yet"

**File: `src/react/features/portal/contracts/ContractViewer.tsx`**

Full contract content viewer with signing capability.

```typescript
interface ContractViewerProps {
  contractId: number;
  onSign: () => void;     // Callback after successful signing
  onClose: () => void;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

- Fetches `GET /api/contracts/my/:id`
- Renders contract HTML content in a scrollable preview area
- Auto-fires `POST /api/contracts/my/:id/view` on mount (marks as viewed)
- Shows signing form at bottom if `canSign === true`
- Shows signed status + signature image if already signed

**File: `src/react/features/portal/contracts/SignaturePad.tsx`**

Reusable signature capture component.

```typescript
interface SignaturePadProps {
  onCapture: (data: { signatureData: string; method: 'draw' | 'type' | 'upload' }) => void;
  disabled?: boolean;
}
```

**Three modes, toggled by tabs:**

1. **Draw mode:**
   - HTML5 `<canvas>` element (400x200 default, responsive)
   - Touch-compatible (`pointerdown`, `pointermove`, `pointerup` events)
   - Stroke color: `var(--app-color-text-primary)` (adapts to theme)
   - Line width: 2px
   - "Clear" button resets canvas
   - `canvas.toDataURL('image/png')` on capture

2. **Type mode:**
   - Text input for full name
   - Preview renders name in a signature-style font (cursive from system fonts, no external dependency)
   - Renders to hidden canvas → `toDataURL` for consistent output format

3. **Upload mode:**
   - File input accepting `.png`, `.jpg`, `.jpeg`
   - Max file size: 2MB
   - Preview before confirm
   - Converts to base64 PNG

**File: `src/react/features/portal/contracts/SigningForm.tsx`**

Wraps `SignaturePad` with the legal agreement checkbox and submit button.

```typescript
interface SigningFormProps {
  contractId: number;
  onSuccess: () => void;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

- "I agree to the terms and conditions" checkbox (must be checked)
- SignaturePad component
- "Sign Contract" button (disabled until checkbox checked + signature captured)
- Loading state during POST
- Success state: "Contract signed successfully" with checkmark

**File: `src/react/features/portal/contracts/index.ts`**

Barrel export for the portal contracts feature.

#### Route Registration

**File: `src/react/app/PortalRoutes.tsx`** — add lazy import:

```typescript
const PortalContracts = lazyNamed(() =>
  import('../features/portal/contracts').then(m => ({ PortalContracts: m.PortalContracts }))
);

// In routes, replace redirect with actual component:
<Route path="/contracts" element={
  <LazyTabRoute tabId="contracts">
    {role === 'admin' ? <ContractsTable {...commonProps} /> : <PortalContracts {...commonProps} />}
  </LazyTabRoute>
} />
```

**File: `server/config/unified-navigation.ts`** — update contracts nav item:

Currently contracts nav item may be admin-only or redirect clients. Update to include `'client'` in `roles` array.

**File: `server/routes/api.ts`** — mount new sub-router:

```typescript
import { portalContractsRouter } from './contracts/portal.js';
router.use('/contracts', portalContractsRouter);
```

#### Integration with Existing System

- `handleContractSigned` in `workflow-automations.ts` already handles the `contract.signed` event — no changes needed there
- The existing `sign-contract.html` email-link flow stays as-is — both paths emit the same event
- `signature_log` table already tracks signing actions — we add a new action type `signed_portal`
- Cache invalidation: `invalidateCache(['contracts'])` on the sign endpoint

#### Edge Cases

- **Client signs while admin is editing draft:** Contract must be `sent` or `viewed` to sign. Admin editing a draft won't conflict.
- **Contract expires between page load and sign submission:** The sign endpoint re-checks `expires_at` at execution time, not just at load.
- **Multiple signatures:** If contract is already `signed`, the endpoint returns `400` with "Contract already signed."
- **Large signature images:** The canvas is 400x200 so PNG data is small (~10-30KB). Upload mode enforces 2MB limit.
- **Admin countersigning:** Existing countersigner flow remains separate. Portal signing is client-side only.

#### Testing (1A)

- Unit test: `signFromPortal` with valid data → updates contract status, creates signature log
- Unit test: `signFromPortal` with wrong client → 404
- Unit test: `signFromPortal` on already-signed contract → 400
- Unit test: `signFromPortal` on expired contract → 410, status updated to expired
- Unit test: `getClientContracts` excludes draft status
- Unit test: `markViewed` updates viewed_at only if null
- Integration test: full sign flow → verify `contract.signed` event emitted
- Integration test: verify existing email-link signing still works after changes
- Component test: `SignaturePad` draw mode → produces valid base64 PNG
- Component test: `SigningForm` submit disabled until checkbox + signature
- Component test: `PortalContracts` renders correct status badges

---

### 1B. Embedded Stripe Payments (Prerequisite)

**Problem:** Stripe payment links open in a new tab. No saved payment methods. No auto-charge on payment schedule dates. Clients can't pay during proposal acceptance.

**Competitors:** HoneyBook embeds payment directly in their Smart Files. Dubsado has in-app payment with saved cards.

#### Database Changes

**Migration: `119_stripe_embedded_payments.sql`**

```sql
-- Store Stripe customer IDs for saved payment methods
ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_stripe ON clients(stripe_customer_id);

-- Saved payment methods
CREATE TABLE IF NOT EXISTS client_payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  stripe_payment_method_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'card',          -- card, us_bank_account
  brand TEXT,                                  -- visa, mastercard, amex, etc.
  last_four TEXT,                               -- last 4 digits
  exp_month INTEGER,                            -- card expiry month (1-12)
  exp_year INTEGER,                             -- card expiry year (2025, 2026, etc.)
  is_default INTEGER NOT NULL DEFAULT 0,        -- boolean: default payment method
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_client
  ON client_payment_methods(client_id);

-- Auto-pay configuration per payment schedule
ALTER TABLE payment_schedule_installments ADD COLUMN auto_pay INTEGER DEFAULT 0;

-- Track Stripe PaymentIntent per invoice/installment
CREATE TABLE IF NOT EXISTS stripe_payment_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_intent_id TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  invoice_id INTEGER,
  installment_id INTEGER,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'created',       -- created, processing, succeeded, failed, cancelled
  payment_method_id TEXT,                        -- stripe payment method used
  failure_reason TEXT,
  metadata TEXT,                                 -- JSON: additional context
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (installment_id) REFERENCES payment_schedule_installments(id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_intents_client
  ON stripe_payment_intents(client_id);
CREATE INDEX IF NOT EXISTS idx_stripe_intents_invoice
  ON stripe_payment_intents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_intents_installment
  ON stripe_payment_intents(installment_id);
CREATE INDEX IF NOT EXISTS idx_stripe_intents_status
  ON stripe_payment_intents(status);

-- Auto-pay retry tracking
CREATE TABLE IF NOT EXISTS auto_pay_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installment_id INTEGER NOT NULL,
  stripe_intent_id TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,    -- 1, 2, 3
  status TEXT NOT NULL DEFAULT 'pending',        -- pending, succeeded, failed
  failure_reason TEXT,
  next_retry_at TEXT,                             -- NULL if succeeded or max retries
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (installment_id) REFERENCES payment_schedule_installments(id)
);
```

#### TypeScript Interfaces

**File: `server/services/stripe-payment-types.ts`**

```typescript
export interface CreatePaymentIntentRequest {
  invoiceId?: number;
  installmentId?: number;
  savePaymentMethod?: boolean;   // Attach to customer for future use
}

export interface CreatePaymentIntentResult {
  clientSecret: string;          // For Stripe Elements on frontend
  paymentIntentId: string;
  amount: number;                // In cents
  currency: string;
}

export interface SavedPaymentMethod {
  id: number;
  stripePaymentMethodId: string;
  type: 'card' | 'us_bank_account';
  brand: string | null;
  lastFour: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface ChargeRequest {
  paymentMethodId: number;       // Our DB id, not Stripe id
  invoiceId?: number;
  installmentId?: number;
}

export interface ChargeResult {
  success: boolean;
  paymentIntentId: string;
  status: string;
  message: string;
}

export interface AutoPayConfig {
  installmentId: number;
  enabled: boolean;
}

// Retry constants
export const AUTO_PAY_MAX_RETRIES = 3;
export const AUTO_PAY_RETRY_DAYS = [3, 7, 14];  // Days after failure to retry
```

#### API Endpoints

**File: `server/routes/integrations/stripe-payments.ts`** (new sub-router)

```text
-- Client-facing (requireClient)
POST /api/payments/create-intent          — Create PaymentIntent for Stripe Elements
POST /api/payments/confirm                — Confirm payment succeeded (webhook backup)
GET  /api/payments/methods                — List client's saved payment methods
POST /api/payments/methods                — Save a new payment method
DELETE /api/payments/methods/:id          — Remove saved payment method
PUT  /api/payments/methods/:id/default    — Set as default payment method
PUT  /api/payments/auto-pay               — Toggle auto-pay for an installment

-- Webhook (no auth, raw body)
POST /api/payments/webhook                — Stripe webhook for payment events

-- Admin
GET  /api/admin/payments/intents          — All payment intents (filterable)
GET  /api/admin/payments/auto-pay/status  — Auto-pay enrollment summary
```

**`POST /api/payments/create-intent` — detailed flow:**

1. Validate request: must have `invoiceId` OR `installmentId` (not both, not neither)
2. Fetch the invoice or installment — verify `client_id === req.user.id`
3. Verify the item is unpaid (`status !== 'paid'`)
4. Calculate amount in cents: `Math.round(amount * 100)`
5. Get or create Stripe Customer for this client:
   - Check `clients.stripe_customer_id`
   - If null: `stripe.customers.create({ email, name, metadata: { clientId } })`
   - Save `stripe_customer_id` to clients table
6. Create PaymentIntent:

   ```typescript
   const intent = await stripe.paymentIntents.create({
     amount: amountCents,
     currency: 'usd',
     customer: stripeCustomerId,
     setup_future_usage: savePaymentMethod ? 'off_session' : undefined,
     metadata: {
       clientId: String(clientId),
       invoiceId: invoiceId ? String(invoiceId) : '',
       installmentId: installmentId ? String(installmentId) : ''
     }
   });
   ```

7. Insert into `stripe_payment_intents` table
8. Return `{ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount: amountCents, currency: 'usd' }`

**Webhook handler — events to handle:**

- `payment_intent.succeeded`:
  1. Find our `stripe_payment_intents` record by `stripe_intent_id`
  2. Update status to `succeeded`
  3. If `invoice_id`: update invoice status to `paid`, set `paid_date`, `paid_amount`
  4. If `installment_id`: call `paymentScheduleService.markPaid(installmentId, { paidDate, paymentMethod: 'stripe', paymentReference: intent.id })`
  5. If `setup_future_usage` was set: extract payment method and save to `client_payment_methods`
  6. Emit `invoice.paid` event via `workflowTriggerService`
  7. Send receipt email to client

- `payment_intent.payment_failed`:
  1. Update `stripe_payment_intents` status to `failed`, store `failure_reason`
  2. If this was an auto-pay attempt: update `auto_pay_attempts`, calculate `next_retry_at`
  3. Send failure notification to admin

- `payment_method.attached`:
  1. Save to `client_payment_methods` if not already present

#### Service Layer

**File: `server/services/stripe-payment-service.ts`**

```typescript
class StripePaymentService {
  // Customer management
  async getOrCreateCustomer(clientId: number): Promise<string>  // Returns stripe_customer_id

  // Payment intents
  async createPaymentIntent(clientId: number, req: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResult>
  async handlePaymentSuccess(stripeIntentId: string): Promise<void>
  async handlePaymentFailure(stripeIntentId: string, reason: string): Promise<void>

  // Payment methods
  async getPaymentMethods(clientId: number): Promise<SavedPaymentMethod[]>
  async savePaymentMethod(clientId: number, stripePaymentMethodId: string): Promise<SavedPaymentMethod>
  async removePaymentMethod(id: number, clientId: number): Promise<void>
  async setDefaultPaymentMethod(id: number, clientId: number): Promise<void>

  // Auto-pay
  async setAutoPay(installmentId: number, clientId: number, enabled: boolean): Promise<void>
  async processAutoPay(): Promise<{ charged: number; failed: number; skipped: number }>
  async chargeStoredMethod(paymentMethodDbId: number, amountCents: number, metadata: Record<string, string>): Promise<ChargeResult>
}

export const stripePaymentService = new StripePaymentService();
```

**Auto-pay cron job — `processAutoPay()` flow:**

Runs daily at 8:00 AM (configurable in business config).

```text
1. Query: SELECT i.* FROM payment_schedule_installments i
   WHERE i.auto_pay = 1
     AND i.status = 'pending'
     AND i.due_date <= date('now')
     AND i.client_id IN (
       SELECT client_id FROM client_payment_methods WHERE is_default = 1
     )

2. For each due installment:
   a. Check auto_pay_attempts — skip if max retries reached
   b. Get client's default payment method
   c. Get or verify stripe_customer_id
   d. Create PaymentIntent with off_session = true:
      stripe.paymentIntents.create({
        amount: Math.round(installment.amount * 100),
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method: stripePaymentMethodId,
        off_session: true,
        confirm: true,
        metadata: { installmentId, clientId }
      })
   e. Insert auto_pay_attempts record
   f. On success: webhook handles the rest (markPaid, receipt, etc.)
   g. On failure: log attempt, calculate next_retry_at based on AUTO_PAY_RETRY_DAYS
```

**Retry cron — runs daily at 9:00 AM:**

```text
1. Query auto_pay_attempts WHERE status = 'failed' AND next_retry_at <= date('now')
2. For each: re-attempt charge (same flow as above)
3. After 3rd failure: send email to admin + client, disable auto-pay for that installment
```

#### React Components

**File: `src/react/features/portal/payments/StripePaymentForm.tsx`**

Embedded Stripe Elements payment form.

```typescript
interface StripePaymentFormProps {
  invoiceId?: number;
  installmentId?: number;
  amount: number;                // Display amount in dollars
  description: string;           // "Invoice #2026-03-..." or "Deposit (50%)"
  onSuccess: () => void;
  onCancel: () => void;
  savePaymentMethod?: boolean;   // Show "save card" checkbox
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

**Implementation notes:**

- Uses `@stripe/react-stripe-js` and `@stripe/stripe-js` packages
- `loadStripe(VITE_STRIPE_PUBLISHABLE_KEY)` — key from env
- `<Elements>` provider wraps the form
- `<PaymentElement>` renders card/bank input (supports cards, ACH, Apple Pay, Google Pay automatically)
- On submit: `stripe.confirmPayment({ elements, confirmParams: { return_url } })` — or use redirect: 'if_required' for in-page confirmation
- "Save payment method for future use" checkbox when `savePaymentMethod` prop is true
- Loading spinner during processing
- Success animation on completion

**File: `src/react/features/portal/payments/PaymentMethodsList.tsx`**

Manage saved payment methods.

```typescript
interface PaymentMethodsListProps {
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

- Lists saved cards with brand icon + last four + expiry
- "Set as default" button (radio-style)
- "Remove" button with confirmation
- "Add payment method" button → opens `StripePaymentForm` in setup mode (no charge, just saves method)

**File: `src/react/features/portal/payments/AutoPayToggle.tsx`**

Toggle component for individual installments.

```typescript
interface AutoPayToggleProps {
  installmentId: number;
  enabled: boolean;
  hasDefaultPaymentMethod: boolean;  // Disable toggle if no saved method
  onChange: (enabled: boolean) => void;
}
```

- Switch/toggle UI
- If no default payment method: shows "Add a payment method first" with link
- Confirmation dialog when enabling: "Your default card ending in 4242 will be charged $X on [date]"

**New dependencies to add to `package.json`:**

```json
"@stripe/react-stripe-js": "^2.x",
"@stripe/stripe-js": "^2.x"
```

#### Portal Settings Integration

Add "Payment Methods" tab to existing `PortalSettings.tsx`:

```typescript
type SettingsTab = 'profile' | 'billing' | 'notifications' | 'payment-methods';
```

The new tab renders `PaymentMethodsList`.

#### Integration with Existing System

- Existing `server/routes/integrations/stripe.ts` stays for payment links — some clients may still use links
- The webhook handler in `stripe.ts` needs to be unified — either merge both webhook endpoints or have one shared handler
- `paymentScheduleService.markPaid()` is already the canonical "mark installment paid" function — auto-pay uses it
- `invoice.paid` event already triggers receipt generation — no new receipt logic needed

#### Edge Cases

- **Client has no saved payment method and tries auto-pay:** Toggle is disabled. UI shows "Add a payment method first."
- **Card declines during auto-pay:** Logged as failed attempt. Retry scheduled per `AUTO_PAY_RETRY_DAYS`. Client and admin emailed.
- **Installment amount changes after auto-pay enabled:** The charge uses the current `amount` column at charge time, not a cached value.
- **Client removes default card while auto-pay is active:** Auto-pay skips (no default method found). Admin notified.
- **Duplicate webhook events:** Idempotent — check `stripe_payment_intents.status` before processing. If already `succeeded`, skip.
- **3D Secure required for off-session charge:** PaymentIntent returns `requires_action`. Email client with a link to complete authentication in-portal.

#### Testing (1B)

- Unit test: `getOrCreateCustomer` creates Stripe customer if none exists
- Unit test: `getOrCreateCustomer` returns existing customer if already set
- Unit test: `createPaymentIntent` with invoiceId → correct amount, correct metadata
- Unit test: `createPaymentIntent` rejects if already paid
- Unit test: `handlePaymentSuccess` marks invoice paid and emits event
- Unit test: `handlePaymentSuccess` is idempotent (second call is no-op)
- Unit test: `processAutoPay` skips installments where max retries reached
- Unit test: `processAutoPay` skips paused/cancelled retainers
- Integration test: create intent → mock webhook success → verify invoice marked paid
- Integration test: auto-pay with failed charge → verify retry scheduled
- Component test: `StripePaymentForm` shows loading state during processing
- Component test: `AutoPayToggle` disabled when no default payment method

---

### 1C. Unified Project Agreement Flow (The Big Payoff)

**Problem:** Client receives proposal, accepts it, then separately signs contract, then separately pays deposit. Three round-trips where HoneyBook does one.

**Solution:** "Project Agreement" — a single interactive document clients walk through step-by-step in the portal. Admin assembles the agreement from existing entities (proposal, contract, payment schedule) and sends it as one package.

#### Database Changes

**Migration: `120_project_agreements.sql`**

```sql
-- The agreement itself
CREATE TABLE IF NOT EXISTS project_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Project Agreement',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft', 'sent', 'viewed', 'in_progress', 'completed', 'expired', 'cancelled')),

  -- Linked entities (all optional — admin picks which steps to include)
  proposal_id INTEGER,
  contract_id INTEGER,
  payment_schedule_id INTEGER,          -- Links to first installment for deposit
  questionnaire_id INTEGER,

  -- Configuration
  steps_config TEXT NOT NULL DEFAULT '[]',  -- JSON: ordered list of step types to include
  welcome_message TEXT,                      -- Optional admin message shown at top

  -- Tracking
  current_step INTEGER NOT NULL DEFAULT 0,  -- Index into steps_config
  sent_at TEXT,
  viewed_at TEXT,
  completed_at TEXT,
  expires_at TEXT,                           -- NULL = no expiry

  -- Reminders
  reminder_sent_3d INTEGER NOT NULL DEFAULT 0,   -- boolean
  reminder_sent_7d INTEGER NOT NULL DEFAULT 0,   -- boolean

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (proposal_id) REFERENCES proposal_requests(id),
  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id)
);

CREATE INDEX IF NOT EXISTS idx_agreements_project ON project_agreements(project_id);
CREATE INDEX IF NOT EXISTS idx_agreements_client ON project_agreements(client_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON project_agreements(status);

-- Individual steps within an agreement
CREATE TABLE IF NOT EXISTS agreement_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id INTEGER NOT NULL,
  step_type TEXT NOT NULL
    CHECK(step_type IN ('proposal_review', 'contract_sign', 'deposit_payment', 'questionnaire', 'custom_message')),
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'active', 'completed', 'skipped')),

  -- Polymorphic reference to the entity this step acts on
  entity_id INTEGER,                        -- proposal_id, contract_id, invoice_id, questionnaire_id

  -- For custom_message steps
  custom_title TEXT,
  custom_content TEXT,                       -- Rich text/HTML

  -- Tracking
  started_at TEXT,
  completed_at TEXT,

  -- Metadata (JSON): stores step-specific data like payment confirmation, signature reference
  metadata TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agreement_id) REFERENCES project_agreements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agreement_steps_agreement ON agreement_steps(agreement_id);
CREATE INDEX IF NOT EXISTS idx_agreement_steps_status ON agreement_steps(status);
```

#### TypeScript Interfaces

**File: `server/services/agreement-types.ts`**

```typescript
export type AgreementStatus = 'draft' | 'sent' | 'viewed' | 'in_progress' | 'completed' | 'expired' | 'cancelled';
export type StepType = 'proposal_review' | 'contract_sign' | 'deposit_payment' | 'questionnaire' | 'custom_message';
export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped';

export interface AgreementStep {
  id: number;
  agreementId: number;
  stepType: StepType;
  stepOrder: number;
  status: StepStatus;
  entityId: number | null;
  customTitle: string | null;
  customContent: string | null;
  startedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface Agreement {
  id: number;
  projectId: number;
  clientId: number;
  name: string;
  status: AgreementStatus;
  proposalId: number | null;
  contractId: number | null;
  paymentScheduleId: number | null;
  questionnaireId: number | null;
  welcomeMessage: string | null;
  currentStep: number;
  sentAt: string | null;
  viewedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  steps: AgreementStep[];
  createdAt: string;
}

// Admin creation request
export interface CreateAgreementRequest {
  projectId: number;
  name?: string;
  proposalId?: number;
  contractId?: number;
  depositInvoiceId?: number;      // The invoice for the deposit payment step
  questionnaireId?: number;
  welcomeMessage?: string;
  expiresAt?: string;
  steps: Array<{
    stepType: StepType;
    entityId?: number;
    customTitle?: string;
    customContent?: string;
  }>;
}

// Client view — enriched with entity data for each step
export interface AgreementClientView extends Agreement {
  projectName: string;
  steps: Array<AgreementStep & {
    // Enriched based on stepType:
    proposal?: { title: string; selectedTier: string; finalPrice: number; features: string[] };
    contract?: { content: string; canSign: boolean };
    invoice?: { amount: number; invoiceNumber: string; status: string };
    questionnaire?: { title: string; questionCount: number; completedCount: number };
  }>;
}

// Pre-built templates
export type AgreementTemplate = 'standard' | 'simple' | 'full';

export const AGREEMENT_TEMPLATES: Record<AgreementTemplate, StepType[]> = {
  standard: ['proposal_review', 'contract_sign', 'deposit_payment'],
  simple: ['proposal_review', 'deposit_payment'],
  full: ['custom_message', 'proposal_review', 'questionnaire', 'contract_sign', 'deposit_payment']
};
```

#### API Endpoints

**Admin endpoints — file: `server/routes/agreements/admin.ts`**

```text
GET    /api/admin/agreements                     — List all agreements (filterable by status, project)
POST   /api/admin/agreements                     — Create agreement
GET    /api/admin/agreements/:id                 — Get agreement with steps
PUT    /api/admin/agreements/:id                 — Update agreement (before sending)
DELETE /api/admin/agreements/:id                 — Delete draft agreement
POST   /api/admin/agreements/:id/send            — Send to client (email + portal notification)
POST   /api/admin/agreements/:id/cancel          — Cancel agreement
POST   /api/admin/agreements/from-template       — Create from template (auto-links entities)
```

**Client endpoints — file: `server/routes/agreements/portal.ts`**

```text
GET    /api/portal/agreements                    — Client's agreements
GET    /api/portal/agreements/:id                — Full agreement with enriched step data
POST   /api/portal/agreements/:id/view           — Mark as viewed
POST   /api/portal/agreements/:id/steps/:stepId/complete — Complete a step
```

**`POST /api/admin/agreements/from-template` — detailed flow:**

1. Input: `{ projectId, template: 'standard' | 'simple' | 'full' }`
2. Fetch project with client info
3. Look up existing entities for this project:
   - Latest non-rejected proposal → `proposalId`
   - Latest draft/sent contract → `contractId`
   - First pending installment → `depositInvoiceId` (need to create invoice if none exists)
   - Assigned questionnaires → `questionnaireId`
4. Create `project_agreements` record
5. For each step type in template, create `agreement_steps` record with entity linkage
6. Return created agreement

**`POST /api/portal/agreements/:id/steps/:stepId/complete` — detailed flow:**

1. Verify agreement belongs to client, status is `sent` or `viewed` or `in_progress`
2. Verify step is `active` (only one step is active at a time)
3. Based on `stepType`:
   - `proposal_review`: Calls existing `POST /api/proposals/:id/accept` logic internally (not via HTTP — direct service call). Marks step complete.
   - `contract_sign`: Requires `signatureData` in request body. Calls `contractSigningService.signFromPortal()` internally. Marks step complete.
   - `deposit_payment`: Requires successful Stripe payment (verified via PaymentIntent status). Step auto-completes via webhook handler when payment succeeds.
   - `questionnaire`: Verified by checking all required questions answered. Calls existing questionnaire submit logic.
   - `custom_message`: No action needed — client clicks "Continue" to mark as read/acknowledged.
4. Mark step `completed`, set `completed_at`
5. Activate next step (set status to `active`, set `started_at`)
6. If all steps completed:
   - Set agreement status to `completed`, set `completed_at`
   - Emit `agreement.completed` event
   - Trigger existing `proposal.accepted` cascade (if not already triggered by individual step)
   - Send admin notification: "Client completed all agreement steps for Project X"
7. Update `project_agreements.current_step`

#### Service Layer

**File: `server/services/agreement-service.ts`**

```typescript
class AgreementService {
  // Admin CRUD
  async create(data: CreateAgreementRequest): Promise<Agreement>
  async createFromTemplate(projectId: number, template: AgreementTemplate): Promise<Agreement>
  async update(id: number, data: Partial<CreateAgreementRequest>): Promise<Agreement>
  async delete(id: number): Promise<void>
  async send(id: number): Promise<void>      // Sets status to 'sent', sends email
  async cancel(id: number): Promise<void>

  // Admin queries
  async list(filters?: { status?: string; projectId?: number }): Promise<Agreement[]>
  async getById(id: number): Promise<Agreement | null>

  // Client queries
  async getClientAgreements(clientId: number): Promise<Agreement[]>
  async getClientAgreement(agreementId: number, clientId: number): Promise<AgreementClientView | null>

  // Step management
  async markViewed(agreementId: number, clientId: number): Promise<void>
  async completeStep(agreementId: number, stepId: number, clientId: number, data?: Record<string, unknown>): Promise<void>
  async skipStep(agreementId: number, stepId: number): Promise<void>  // Admin only

  // Enrichment (fetches entity data for each step)
  private async enrichStepsForClient(steps: AgreementStep[]): Promise<AgreementClientView['steps']>

  // Reminders
  async sendReminders(): Promise<{ sent3d: number; sent7d: number }>

  // Expiration
  async expireOverdue(): Promise<number>
}

export const agreementService = new AgreementService();
```

#### React Components

**File: `src/react/features/portal/agreements/AgreementWizard.tsx`**

The main multi-step interactive flow. This is the centerpiece component.

```typescript
interface AgreementWizardProps {
  agreementId: number;
  onComplete: () => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

**Component structure:**

```text
AgreementWizard
├── AgreementHeader            — Agreement name + progress bar
│   └── StepIndicator          — Circles/dots showing step progress (completed/active/pending)
├── WelcomeMessage             — Optional admin message (if configured)
├── StepRenderer               — Renders the active step based on stepType
│   ├── ProposalReviewStep     — Shows proposal details, tier, pricing, "Approve" button
│   ├── ContractSignStep       — Shows contract content + SigningForm from 1A
│   ├── DepositPaymentStep     — Shows amount + StripePaymentForm from 1B
│   ├── QuestionnaireStep      — Embeds existing questionnaire form
│   └── CustomMessageStep      — Shows admin message + "Continue" button
└── AgreementFooter            — "Back" and "Continue/Submit" buttons
```

**Step-by-step behavior:**

- Only the active step is interactive. Previous steps show a completed summary (checkmark + brief recap).
- Future steps show as locked (grayed out with step title visible).
- Client can navigate back to view completed steps but cannot un-complete them.
- Each step completion triggers the API call, waits for success, then animates to next step.
- For `deposit_payment`: the step shows as "processing" until webhook confirms payment (poll every 3 seconds for up to 30 seconds, then show "Payment is being processed, you'll receive confirmation shortly").

**File: `src/react/features/portal/agreements/steps/ProposalReviewStep.tsx`**

```typescript
interface ProposalReviewStepProps {
  proposal: {
    title: string;
    selectedTier: string;
    finalPrice: number;
    features: string[];
    description: string;
  };
  onApprove: () => Promise<void>;
}
```

- Displays proposal scope, selected tier with label, feature list, final price
- "Approve Proposal" button at bottom
- No ability to negotiate here — that's done before the agreement is sent

**File: `src/react/features/portal/agreements/steps/ContractSignStep.tsx`**

```typescript
interface ContractSignStepProps {
  contract: { content: string; canSign: boolean };
  contractId: number;
  onSign: (signatureData: string, method: 'draw' | 'type' | 'upload') => Promise<void>;
}
```

- Renders contract HTML in scrollable viewer
- Shows `SigningForm` from 1A at bottom
- Must scroll to bottom before signing form is enabled (ensures they read it)

**File: `src/react/features/portal/agreements/steps/DepositPaymentStep.tsx`**

```typescript
interface DepositPaymentStepProps {
  invoiceId: number;
  amount: number;
  description: string;
  onPaymentComplete: () => void;
  getAuthToken?: () => string | null;
}
```

- Shows deposit amount and description
- Renders `StripePaymentForm` from 1B
- Optional: show saved payment methods for one-click payment
- Step auto-completes when webhook fires (component polls agreement status)

**File: `src/react/features/portal/agreements/AgreementsList.tsx`**

Client's agreements list (accessible from portal nav or dashboard).

```typescript
interface AgreementsListProps {
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}
```

- Cards showing agreement name, project name, status, progress (3/5 steps)
- "Continue" button for in-progress agreements
- "View" for completed agreements
- Status badges: Sent (needs attention), In Progress, Completed

**File: `src/react/features/admin/agreements/AgreementBuilder.tsx`**

Admin interface for creating agreements.

```typescript
interface AgreementBuilderProps {
  projectId: number;
  onSave: (agreement: Agreement) => void;
  onCancel: () => void;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

- Template selector: "Standard", "Simple", "Full", "Custom"
- Step list with drag-to-reorder (custom only)
- For each step: dropdown to link entity (proposal, contract, invoice, questionnaire)
- Auto-detect: shows which entities exist for this project and pre-links them
- Welcome message textarea (optional)
- Expiry date picker (optional)
- Preview button: shows how client will see it
- "Save as Draft" and "Save & Send" buttons

#### Email Templates

**Agreement sent email:**

```text
Subject: Your Project Agreement is Ready — {{project_name}}

Body:
Hi {{client_name}},

Your project agreement for {{project_name}} is ready for review.

This agreement includes:
{{#each steps}}
  • {{step_label}}
{{/each}}

[Review Agreement →] (link to portal /agreements/:id)

This agreement {{#if expires_at}}expires on {{expires_at}}{{else}}does not expire{{/if}}.

If you have questions, reply to this email or message us in the portal.
```

**Agreement reminder (3 days):**

```text
Subject: Reminder: Your Project Agreement — {{project_name}}

Body:
Hi {{client_name}},

Just a friendly reminder that your project agreement for {{project_name}} is waiting for you.

Progress: {{completed_steps}}/{{total_steps}} steps completed.

[Continue Agreement →]
```

**Agreement completed (to admin):**

```text
Subject: Agreement Completed — {{project_name}}

Body:
{{client_name}} has completed all steps in the project agreement for {{project_name}}.

Steps completed:
{{#each steps}}
  ✓ {{step_label}} — completed {{completed_at}}
{{/each}}

The project has been activated automatically.
```

#### Cron Jobs

Add to existing scheduler (in `server/services/scheduler.ts` or equivalent):

```typescript
// Agreement reminders — runs daily at 10:00 AM
cron.schedule('0 10 * * *', async () => {
  const result = await agreementService.sendReminders();
  logger.info(`Agreement reminders sent: 3-day=${result.sent3d}, 7-day=${result.sent7d}`);
});

// Agreement expiration — runs daily at midnight
cron.schedule('0 0 * * *', async () => {
  const expired = await agreementService.expireOverdue();
  if (expired > 0) logger.info(`Expired ${expired} agreements`);
});
```

#### Navigation and Routing

**Client portal:** Add "Agreements" to navigation or make agreements accessible from the dashboard (agreement card with "Continue" CTA). Could also be shown on the project detail page.

**Admin:** Add "Agreements" tab in project detail view, or a section in the existing project overview.

#### Integration with Existing System

- `proposal.accepted` cascade in `workflow-automations.ts`: When a proposal is accepted through the agreement flow, the same cascade fires (auto-milestones, auto-contract, auto-payment-schedule). BUT the agreement flow may have already created the contract and payment schedule — so the cascade needs a guard: skip auto-generation if entities already exist for the project.
- Add guard to `handleProposalAccepted`:

  ```typescript
  // Check if contract already exists (created as part of agreement)
  const existingContract = await db.get(
    'SELECT id FROM contracts WHERE project_id = ? AND deleted_at IS NULL LIMIT 1',
    [projectId]
  );
  if (!existingContract) {
    // Generate contract (existing logic)
  }

  // Same for payment schedule
  const existingSchedule = await db.get(
    'SELECT id FROM payment_schedule_installments WHERE project_id = ? LIMIT 1',
    [projectId]
  );
  if (!existingSchedule) {
    // Generate payment schedule (existing logic)
  }
  ```

#### Edge Cases

- **Admin sends agreement, then edits the linked proposal:** Agreement shows the proposal data at view time (live query, not snapshot). If the price changes, the client sees the new price. Admin should finalize before sending.
- **Client completes proposal step but contract has expired:** Contract expiry is checked at sign time. If expired, the step shows an error and admin is notified to re-send the contract.
- **Payment fails in deposit step:** Step stays active. Client can retry. If they leave and come back, the step is still active with a "Retry Payment" option.
- **Admin cancels agreement mid-progress:** Steps already completed are NOT rolled back (proposal stays accepted, contract stays signed). Only pending steps are cancelled.
- **Multiple agreements for same project:** Allowed — admin might cancel one and send a revised one. Only one can be `sent` or `in_progress` at a time (validation on send).

#### Testing (1C)

- Unit test: `createFromTemplate('standard')` creates agreement with 3 steps (proposal, contract, deposit)
- Unit test: `createFromTemplate` auto-links existing project entities
- Unit test: `completeStep` for proposal_review → calls proposal accept logic
- Unit test: `completeStep` for contract_sign → calls signing service
- Unit test: `completeStep` on last step → marks agreement completed, emits event
- Unit test: `completeStep` rejects if step is not active
- Unit test: `completeStep` rejects if agreement belongs to different client
- Unit test: `send` rejects if another agreement for same project is already sent/in_progress
- Unit test: `sendReminders` sends 3-day reminder, does not re-send
- Unit test: `expireOverdue` marks expired, does not expire completed
- Integration test: create agreement → send → complete all steps → verify project activated
- Integration test: cancel mid-progress → completed steps stay, pending steps cancelled
- Component test: `AgreementWizard` renders correct active step
- Component test: `StepIndicator` shows completed/active/pending states
- Component test: `ContractSignStep` requires scroll before enabling signature
- Component test: `DepositPaymentStep` polls for payment confirmation
- Component test: resume behavior — leaving and returning to agreement

---

### 1D. Guided Client Onboarding Checklist

**Problem:** New clients don't know what to do after account creation. No guided "here's what happens next" flow.

**Competitors:** Dubsado has "Client Workflows" that show clients their progress. HoneyBook shows a project timeline. Bloom has guided onboarding.

**Note:** This is separate from the agreement flow. The onboarding checklist is the persistent "what's left to do" tracker that lives on the client dashboard. The agreement flow handles the proposal+contract+payment bundle. The checklist tracks everything else (upload brand assets, complete content questionnaire, schedule kickoff, etc.).

#### Database Changes

**Migration: `121_onboarding_checklists.sql`**

```sql
CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'completed', 'dismissed')),
  welcome_text TEXT,                          -- Admin-configurable welcome message
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  dismissed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_project ON onboarding_checklists(project_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_client ON onboarding_checklists(client_id, status);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL,
  step_type TEXT NOT NULL
    CHECK(step_type IN (
      'sign_contract', 'pay_deposit', 'complete_questionnaire',
      'upload_documents', 'upload_brand_assets', 'review_proposal',
      'complete_agreement', 'schedule_kickoff', 'custom'
    )),
  label TEXT NOT NULL,                         -- Display label (e.g., "Sign your contract")
  description TEXT,                            -- Brief help text
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'completed', 'skipped')),

  -- Auto-detection: which entity to watch for auto-completion
  entity_type TEXT,                            -- 'contract', 'invoice', 'questionnaire', 'document_request', 'agreement'
  entity_id INTEGER,                           -- FK to the specific entity
  auto_detect INTEGER NOT NULL DEFAULT 1,      -- boolean: auto-complete when entity status changes

  -- Navigation: where to send the client when they click this step
  navigate_tab TEXT,                           -- Portal tab ID (e.g., 'contracts', 'documents')
  navigate_entity_id TEXT,                     -- Entity ID for navigation

  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (checklist_id) REFERENCES onboarding_checklists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_checklist ON onboarding_steps(checklist_id);

-- Templates for common onboarding flows
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  project_type TEXT,                           -- NULL = applies to all types
  steps_config TEXT NOT NULL DEFAULT '[]',     -- JSON array of step definitions
  is_default INTEGER NOT NULL DEFAULT 0,       -- boolean: auto-apply to new projects
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### TypeScript Interfaces

**File: `server/services/onboarding-types.ts`**

```typescript
export type OnboardingStepType =
  | 'sign_contract' | 'pay_deposit' | 'complete_questionnaire'
  | 'upload_documents' | 'upload_brand_assets' | 'review_proposal'
  | 'complete_agreement' | 'schedule_kickoff' | 'custom';

export interface OnboardingStep {
  id: number;
  checklistId: number;
  stepType: OnboardingStepType;
  label: string;
  description: string | null;
  stepOrder: number;
  status: 'pending' | 'completed' | 'skipped';
  entityType: string | null;
  entityId: number | null;
  autoDetect: boolean;
  navigateTab: string | null;
  navigateEntityId: string | null;
  completedAt: string | null;
}

export interface OnboardingChecklist {
  id: number;
  projectId: number;
  clientId: number;
  status: 'active' | 'completed' | 'dismissed';
  welcomeText: string | null;
  steps: OnboardingStep[];
  completedCount: number;        // Derived
  totalCount: number;            // Derived
  createdAt: string;
}

export interface OnboardingTemplateStep {
  stepType: OnboardingStepType;
  label: string;
  description?: string;
  entityType?: string;
  autoDetect?: boolean;
  navigateTab?: string;
}

export interface CreateChecklistRequest {
  projectId: number;
  templateId?: number;          // Use template, or provide custom steps
  welcomeText?: string;
  steps?: OnboardingTemplateStep[];
}
```

#### API Endpoints

**File: `server/routes/onboarding/portal.ts`**

```text
GET  /api/portal/onboarding                     — Client's active checklists
GET  /api/portal/onboarding/:id                 — Single checklist with steps
POST /api/portal/onboarding/:id/dismiss         — Dismiss checklist
POST /api/portal/onboarding/steps/:id/complete  — Manually complete a step
```

**File: `server/routes/onboarding/admin.ts`**

```text
GET    /api/admin/onboarding                    — All checklists (filterable)
POST   /api/admin/onboarding                    — Create checklist for project
PUT    /api/admin/onboarding/:id                — Update checklist
DELETE /api/admin/onboarding/:id                — Delete checklist
POST   /api/admin/onboarding/:id/steps          — Add step
PUT    /api/admin/onboarding/steps/:id          — Edit step
DELETE /api/admin/onboarding/steps/:id          — Remove step
POST   /api/admin/onboarding/steps/:id/skip     — Skip step
GET    /api/admin/onboarding/templates          — List templates
POST   /api/admin/onboarding/templates          — Create template
PUT    /api/admin/onboarding/templates/:id      — Update template
DELETE /api/admin/onboarding/templates/:id      — Delete template
```

#### Service Layer

**File: `server/services/onboarding-service.ts`**

```typescript
class OnboardingService {
  // CRUD
  async createChecklist(data: CreateChecklistRequest): Promise<OnboardingChecklist>
  async createFromTemplate(projectId: number, templateId: number): Promise<OnboardingChecklist>
  async getClientChecklists(clientId: number): Promise<OnboardingChecklist[]>
  async getChecklist(id: number): Promise<OnboardingChecklist | null>

  // Step management
  async completeStep(stepId: number, clientId: number): Promise<void>
  async skipStep(stepId: number): Promise<void>
  async addStep(checklistId: number, step: OnboardingTemplateStep, entityId?: number): Promise<OnboardingStep>

  // Auto-detection: called by workflow event handlers
  async autoCompleteByEntity(entityType: string, entityId: number): Promise<void>

  // Nudge emails
  async sendNudges(): Promise<{ sent: number }>

  // Templates
  async listTemplates(): Promise<OnboardingTemplate[]>
  async createTemplate(data: { name: string; projectType?: string; steps: OnboardingTemplateStep[] }): Promise<OnboardingTemplate>
}

export const onboardingService = new OnboardingService();
```

**Auto-completion integration — add to `workflow-automations.ts`:**

```typescript
// After existing event handlers, add onboarding auto-complete:
workflowTriggerService.on('contract.signed', async (data) => {
  await onboardingService.autoCompleteByEntity('contract', data.entityId);
});

workflowTriggerService.on('invoice.paid', async (data) => {
  await onboardingService.autoCompleteByEntity('invoice', data.entityId);
});

workflowTriggerService.on('questionnaire.completed', async (data) => {
  await onboardingService.autoCompleteByEntity('questionnaire', data.entityId);
});

workflowTriggerService.on('document_request.approved', async (data) => {
  await onboardingService.autoCompleteByEntity('document_request', data.entityId);
});

workflowTriggerService.on('agreement.completed', async (data) => {
  await onboardingService.autoCompleteByEntity('agreement', data.entityId);
});
```

**`autoCompleteByEntity` implementation:**

```sql
UPDATE onboarding_steps
SET status = 'completed', completed_at = CURRENT_TIMESTAMP
WHERE entity_type = ? AND entity_id = ? AND auto_detect = 1 AND status = 'pending'
```

Then check if all steps in the checklist are completed/skipped → if yes, mark checklist as `completed`.

#### React Components

**File: `src/react/features/portal/onboarding/OnboardingCard.tsx`**

Dashboard widget showing the checklist.

```typescript
interface OnboardingCardProps {
  checklist: OnboardingChecklist;
  onNavigate?: (tab: string, entityId?: string) => void;
  onDismiss: () => void;
  getAuthToken?: () => string | null;
}
```

- Renders as a prominent card at the top of the client dashboard
- Welcome text (if configured)
- Progress bar: "3 of 5 steps complete"
- Step list:
  - Completed steps: checkmark icon + strikethrough label
  - Current/next step: highlighted with arrow, clickable (navigates to relevant portal page)
  - Future steps: dimmed but visible
- "Dismiss" link (small, bottom) — confirms before hiding
- GSAP entrance animation (fade + slide from top)

**File: `src/react/features/admin/onboarding/OnboardingManager.tsx`**

Admin interface for managing checklists (added as tab in project detail).

- View/edit checklist for a project
- Template selector for quick setup
- Drag-to-reorder steps
- Add/remove/skip steps
- Link entities to steps (dropdown of available contracts, questionnaires, etc. for this project)

#### Default Templates (Seed Data)

```typescript
const DEFAULT_TEMPLATES = [
  {
    name: 'Standard Website Project',
    projectType: 'website',
    steps: [
      { stepType: 'complete_agreement', label: 'Complete your project agreement', navigateTab: 'agreements' },
      { stepType: 'complete_questionnaire', label: 'Fill out the project questionnaire', navigateTab: 'questionnaires' },
      { stepType: 'upload_brand_assets', label: 'Upload your brand assets (logo, colors, fonts)', navigateTab: 'files' },
      { stepType: 'upload_documents', label: 'Provide your content and copy', navigateTab: 'content-requests' },
      { stepType: 'schedule_kickoff', label: 'Request a kickoff meeting', navigateTab: 'meeting-requests' }
    ]
  },
  {
    name: 'Simple Project',
    projectType: null,  // All types
    steps: [
      { stepType: 'review_proposal', label: 'Review your proposal', navigateTab: 'proposals' },
      { stepType: 'sign_contract', label: 'Sign your contract', navigateTab: 'contracts' },
      { stepType: 'pay_deposit', label: 'Pay your deposit', navigateTab: 'invoices' }
    ]
  }
];
```

#### Automation

- **Auto-create checklist:** When agreement is sent (or project created if no agreement), auto-create checklist from matching template (by `project_type`).
- **Nudge emails:** Cron runs daily at 10:30 AM. For checklists active > 3 days with pending steps, send nudge email listing remaining steps. Max one nudge per 4 days per checklist.
- **Admin notification:** When checklist completes (all steps done), notify admin.

#### Testing (1D)

- Unit test: `createChecklist` from template creates correct steps
- Unit test: `autoCompleteByEntity` marks matching step completed
- Unit test: `autoCompleteByEntity` marks checklist completed when all steps done
- Unit test: `autoCompleteByEntity` is no-op for non-matching entity
- Unit test: `sendNudges` respects 4-day cooldown between nudges
- Integration test: sign contract → onboarding step auto-completes
- Integration test: create checklist → complete all steps → admin notified
- Component test: `OnboardingCard` shows correct progress bar
- Component test: step click navigates to correct portal tab

---

## Phase 2: Lead Nurture and Follow-Up — COMPLETE

Right now leads enter the system and sit there until manually contacted. Every competitor has automated follow-up sequences.

**Status:** Complete (March 17, 2026)

**Implemented:**

- 2A: Email Drip Sequences (migration 122, sequenceService, scheduler cron every 30 min, workflow auto-enrollment, admin CRUD + table UI, 3 seeded sequences)
- 2B: Meeting Request System (migration 123, meetingRequestService, ICS generation, daily reminder cron, portal form + list, admin table with confirm/decline/reschedule)

**Feature docs:** [Email Sequences](features/EMAIL_SEQUENCES.md) | [Meeting Requests](features/MEETING_REQUESTS.md)

---

### 2A. Email Drip Sequences

**Problem:** No automated follow-up between initial contact and proposal. Leads go cold.

**Competitors:** Dubsado has "Workflows" with email sequences. HoneyBook has "Automations" with timed email sends. Moxie has "Follow-up sequences."

#### Database Changes

**Migration: `122_email_sequences.sql`**

```sql
-- Sequence definition
CREATE TABLE IF NOT EXISTS email_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,               -- lead.created, contact_form.submitted, proposal.sent, etc.
  trigger_conditions TEXT DEFAULT '{}',       -- JSON: filter conditions (e.g., {"project_type": "website"})
  is_active INTEGER NOT NULL DEFAULT 1,      -- boolean
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Steps within a sequence
CREATE TABLE IF NOT EXISTS sequence_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  delay_hours INTEGER NOT NULL DEFAULT 0,    -- Hours after PREVIOUS step (0 = immediate)
  email_template_id INTEGER,                  -- FK to email_templates (reuse existing system)
  subject_override TEXT,                       -- Optional: override template subject
  body_override TEXT,                          -- Optional: override template body
  stop_conditions TEXT DEFAULT '{}',          -- JSON: conditions that skip this step
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id) ON DELETE CASCADE,
  FOREIGN KEY (email_template_id) REFERENCES email_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence ON sequence_steps(sequence_id, step_order);

-- Active enrollments
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,                  -- 'lead', 'client', 'contact'
  entity_id INTEGER NOT NULL,
  entity_email TEXT NOT NULL,                 -- Cached for sending (don't re-query)
  entity_name TEXT,                            -- Cached for personalization
  current_step_order INTEGER NOT NULL DEFAULT 0,  -- 0 = not started, 1+ = completed through step N
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'completed', 'stopped', 'paused')),
  next_send_at TEXT,                           -- ISO datetime: when to send next step
  enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  stopped_at TEXT,
  stopped_reason TEXT,                         -- 'condition_met', 'manual', 'entity_deleted', 'bounced'
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_next_send ON sequence_enrollments(status, next_send_at);
CREATE INDEX IF NOT EXISTS idx_enrollments_entity ON sequence_enrollments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON sequence_enrollments(sequence_id);

-- Send logs per step per enrollment
CREATE TABLE IF NOT EXISTS sequence_send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_status TEXT NOT NULL DEFAULT 'sent'
    CHECK(email_status IN ('sent', 'failed', 'bounced', 'opened', 'clicked')),
  error_message TEXT,
  FOREIGN KEY (enrollment_id) REFERENCES sequence_enrollments(id),
  FOREIGN KEY (step_id) REFERENCES sequence_steps(id)
);

CREATE INDEX IF NOT EXISTS idx_send_logs_enrollment ON sequence_send_logs(enrollment_id);
```

#### TypeScript Interfaces

**File: `server/services/sequence-types.ts`**

```typescript
export interface EmailSequence {
  id: number;
  name: string;
  description: string | null;
  triggerEvent: string;
  triggerConditions: Record<string, unknown>;
  isActive: boolean;
  steps: SequenceStep[];
  enrollmentCount: number;        // Derived: active enrollments
  completionRate: number;          // Derived: completed / total enrollments
  createdAt: string;
}

export interface SequenceStep {
  id: number;
  sequenceId: number;
  stepOrder: number;
  delayHours: number;
  emailTemplateId: number | null;
  subjectOverride: string | null;
  bodyOverride: string | null;
  stopConditions: Record<string, unknown>;
}

export interface SequenceEnrollment {
  id: number;
  sequenceId: number;
  entityType: 'lead' | 'client' | 'contact';
  entityId: number;
  entityEmail: string;
  entityName: string | null;
  currentStepOrder: number;
  status: 'active' | 'completed' | 'stopped' | 'paused';
  nextSendAt: string | null;
  enrolledAt: string;
}

export interface SequenceAnalytics {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  stoppedEnrollments: number;
  stepMetrics: Array<{
    stepOrder: number;
    sent: number;
    failed: number;
    opened: number;
    clicked: number;
  }>;
}

export interface CreateSequenceRequest {
  name: string;
  description?: string;
  triggerEvent: string;
  triggerConditions?: Record<string, unknown>;
  steps: Array<{
    delayHours: number;
    emailTemplateId?: number;
    subjectOverride?: string;
    bodyOverride?: string;
    stopConditions?: Record<string, unknown>;
  }>;
}
```

#### API Endpoints

**File: `server/routes/sequences/admin.ts`**

```text
-- Sequence CRUD
GET    /api/admin/sequences                      — List all sequences with enrollment counts
POST   /api/admin/sequences                      — Create sequence
GET    /api/admin/sequences/:id                  — Get sequence with steps
PUT    /api/admin/sequences/:id                  — Update sequence
DELETE /api/admin/sequences/:id                  — Delete sequence (stops active enrollments first)

-- Step CRUD
POST   /api/admin/sequences/:id/steps            — Add step
PUT    /api/admin/sequences/:id/steps/:stepId    — Update step
DELETE /api/admin/sequences/:id/steps/:stepId    — Remove step
PUT    /api/admin/sequences/:id/steps/reorder    — Reorder steps

-- Enrollment management
GET    /api/admin/sequences/:id/enrollments      — List enrollments for a sequence
POST   /api/admin/sequences/:id/enroll           — Manually enroll entity
POST   /api/admin/enrollments/:id/stop           — Stop enrollment
POST   /api/admin/enrollments/:id/pause          — Pause enrollment
POST   /api/admin/enrollments/:id/resume         — Resume enrollment

-- Analytics
GET    /api/admin/sequences/:id/analytics        — Step-by-step metrics
```

#### Service Layer

**File: `server/services/sequence-service.ts`**

```typescript
class SequenceService {
  // CRUD
  async create(data: CreateSequenceRequest): Promise<EmailSequence>
  async update(id: number, data: Partial<CreateSequenceRequest>): Promise<EmailSequence>
  async delete(id: number): Promise<void>
  async list(): Promise<EmailSequence[]>
  async getById(id: number): Promise<EmailSequence | null>

  // Enrollment
  async enrollEntity(sequenceId: number, entityType: string, entityId: number): Promise<SequenceEnrollment>
  async stopEnrollment(enrollmentId: number, reason: string): Promise<void>
  async stopByEntity(entityType: string, entityId: number, reason?: string): Promise<number>  // Stops all for entity

  // Processing (called by cron)
  async processQueue(): Promise<{ sent: number; failed: number; stopped: number; completed: number }>

  // Auto-enrollment (called by workflow event handlers)
  async handleEvent(eventType: string, context: Record<string, unknown>): Promise<void>

  // Analytics
  async getAnalytics(sequenceId: number): Promise<SequenceAnalytics>
}

export const sequenceService = new SequenceService();
```

**`processQueue()` detailed flow — runs every 30 minutes via cron:**

```text
1. Query: SELECT e.*, s.* FROM sequence_enrollments e
   JOIN email_sequences s ON s.id = e.sequence_id
   WHERE e.status = 'active'
     AND e.next_send_at <= datetime('now')
     AND s.is_active = 1
   ORDER BY e.next_send_at ASC
   LIMIT 50  -- Process in batches

2. For each enrollment:
   a. Get next step: SELECT * FROM sequence_steps WHERE sequence_id = ? AND step_order = ?
   b. If no next step: mark enrollment completed, continue
   c. Evaluate stop_conditions against current entity state:
      - Fetch entity (lead/client/contact) from DB
      - Check conditions (e.g., if lead.status === 'converted', stop)
      - If stop condition met: stop enrollment with reason, continue
   d. Build email:
      - Use email_template_id to get template
      - Apply subject_override / body_override if set
      - Substitute variables: {{client_name}}, {{project_name}}, etc.
   e. Send email via existing email service
   f. Log to sequence_send_logs
   g. On success:
      - Update enrollment: current_step_order++
      - Calculate next_send_at from next step's delay_hours
      - If no more steps: mark enrollment completed
   h. On failure:
      - Log error to sequence_send_logs
      - Retry: leave next_send_at as-is (will retry next cron run)
      - After 3 failures on same step: stop enrollment with reason 'bounced'
```

**Event handler integration — add to `workflow-automations.ts`:**

```typescript
// After existing handlers, route events to sequence service:
const SEQUENCE_EVENTS = [
  'lead.created', 'lead.stage_changed', 'lead.converted',
  'contact_form.submitted', 'proposal.sent', 'proposal.accepted',
  'proposal.rejected', 'client.created'
];

for (const event of SEQUENCE_EVENTS) {
  workflowTriggerService.on(event, async (data) => {
    await sequenceService.handleEvent(event, data);
  });
}
```

**`handleEvent` flow:**

```text
1. Find active sequences WHERE trigger_event = eventType
2. For each sequence:
   a. Evaluate trigger_conditions against event context
   b. If match:
      - Determine entity: extract entityType + entityId from context
      - Check if entity already enrolled in this sequence → skip if yes
      - Check if entity enrolled in ANY active sequence → optionally skip (configurable per sequence)
      - Enroll: create enrollment record, set next_send_at based on first step's delay
3. Also: check for stop conditions on existing enrollments
   - If lead.status_changed to 'converted', stop all sequences for that lead
   - If proposal.accepted, stop 'Proposal Follow-Up' sequences
```

#### React Components

**File: `src/react/features/admin/sequences/SequencesTable.tsx`**

Admin table listing all sequences.

```typescript
interface SequencesTableProps {
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}
```

- Columns: Name, Trigger, Active Enrollments, Completion Rate, Status (active/inactive), Created
- Toggle active/inactive inline
- Row click → detail panel

**File: `src/react/features/admin/sequences/SequenceBuilder.tsx`**

Visual sequence editor.

```typescript
interface SequenceBuilderProps {
  sequenceId?: number;           // Edit mode if provided
  onSave: () => void;
  onCancel: () => void;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

**Layout:**

```text
SequenceBuilder
├── TriggerConfig              — Event dropdown + condition builder
│   ├── Event selector (dropdown of available events)
│   └── Conditions (field + operator + value rows, "Add condition" button)
├── StepsList                  — Ordered list of steps
│   ├── StepCard               — For each step:
│   │   ├── Delay config       — "Wait X hours/days after previous step"
│   │   ├── Email selector     — Dropdown of email templates, or custom subject+body
│   │   ├── Stop conditions    — "Skip if [field] [operator] [value]"
│   │   └── Preview button     — Shows rendered email with sample data
│   └── AddStepButton
├── PreviewTimeline            — Visual timeline showing when emails send
└── ActionButtons              — Save, Save & Activate, Cancel
```

**File: `src/react/features/admin/sequences/SequenceDetailPanel.tsx`**

Detail panel showing enrollments, analytics, logs.

#### Default Sequences (Seed Data)

```typescript
const DEFAULT_SEQUENCES = [
  {
    name: 'New Lead Welcome',
    triggerEvent: 'lead.created',
    triggerConditions: {},
    steps: [
      { delayHours: 0, subjectOverride: 'Thanks for reaching out!', bodyOverride: '...' },     // Immediate
      { delayHours: 48, subjectOverride: 'A little about what we do', bodyOverride: '...' },    // 2 days
      { delayHours: 120, subjectOverride: 'Ready to talk about your project?', bodyOverride: '...' }  // 5 days
    ]
  },
  {
    name: 'Proposal Follow-Up',
    triggerEvent: 'proposal.sent',
    triggerConditions: {},
    steps: [
      { delayHours: 72, subjectOverride: 'Any questions about the proposal?' },    // 3 days
      { delayHours: 168, subjectOverride: 'Just checking in' },                     // 7 days
      { delayHours: 336, subjectOverride: 'Last chance before this expires', stopConditions: { proposal_status: 'accepted' } }  // 14 days
    ]
  },
  {
    name: 'Post-Consultation',
    triggerEvent: 'lead.stage_changed',
    triggerConditions: { new_stage: 'qualified' },
    steps: [
      { delayHours: 24, subjectOverride: 'Great talking with you' },
      { delayHours: 96, subjectOverride: 'Your proposal is almost ready' }
    ]
  }
];
```

#### Cron Schedule

```typescript
// Process sequence queue — every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  const result = await sequenceService.processQueue();
  if (result.sent > 0 || result.failed > 0) {
    logger.info(`Sequences: sent=${result.sent}, failed=${result.failed}, stopped=${result.stopped}`);
  }
});
```

#### Testing (2A)

- Unit test: `handleEvent` enrolls entity when trigger matches
- Unit test: `handleEvent` skips enrollment when conditions don't match
- Unit test: `handleEvent` skips enrollment when entity already enrolled
- Unit test: `processQueue` sends email for due enrollment
- Unit test: `processQueue` evaluates stop conditions before sending
- Unit test: `processQueue` stops enrollment when stop condition met
- Unit test: `processQueue` marks enrollment completed after last step
- Unit test: `processQueue` retries on send failure, stops after 3 failures
- Integration test: create sequence → trigger event → verify enrollment + first email sent
- Integration test: lead.converted → all sequences for that lead stopped
- Component test: `SequenceBuilder` step reordering
- Component test: `SequenceBuilder` delay configuration
- Component test: `StepCard` email template vs custom toggle

---

### 2B. Meeting Request System

**Problem:** No structured way for clients to request meetings. Admin does NOT want a public calendar — clients propose times, admin confirms manually.

**Competitors:** HoneyBook/Dubsado have scheduling built in, but our approach is intentionally different. We do request-based scheduling, not self-serve booking. This is a deliberate design choice.

#### Database Changes

**Migration: `123_meeting_requests.sql`**

```sql
CREATE TABLE IF NOT EXISTS meeting_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_id INTEGER,                        -- Optional: may be general inquiry
  meeting_type TEXT NOT NULL DEFAULT 'consultation'
    CHECK(meeting_type IN ('discovery_call', 'consultation', 'project_kickoff', 'check_in', 'review', 'other')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK(status IN ('requested', 'confirmed', 'declined', 'rescheduled', 'completed', 'cancelled')),

  -- Client preferences (up to 3 date/time options)
  preferred_slot_1 TEXT,                     -- ISO datetime
  preferred_slot_2 TEXT,
  preferred_slot_3 TEXT,

  -- Admin decision
  confirmed_datetime TEXT,                    -- The chosen date/time
  duration_minutes INTEGER NOT NULL DEFAULT 60,

  -- Location
  location_type TEXT DEFAULT 'zoom'
    CHECK(location_type IN ('zoom', 'google_meet', 'phone', 'in_person', 'other')),
  location_details TEXT,                      -- URL, phone number, or address

  -- Notes
  client_notes TEXT,                          -- What the client wants to discuss
  admin_notes TEXT,                           -- Internal notes
  decline_reason TEXT,                        -- Why declined

  -- Calendar integration
  calendar_event_id TEXT,                     -- Google Calendar event ID (if synced)

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_requests_client ON meeting_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_confirmed ON meeting_requests(confirmed_datetime);
```

#### TypeScript Interfaces

**File: `server/services/meeting-request-types.ts`**

```typescript
export type MeetingType = 'discovery_call' | 'consultation' | 'project_kickoff' | 'check_in' | 'review' | 'other';
export type MeetingStatus = 'requested' | 'confirmed' | 'declined' | 'rescheduled' | 'completed' | 'cancelled';
export type LocationType = 'zoom' | 'google_meet' | 'phone' | 'in_person' | 'other';

export interface MeetingRequest {
  id: number;
  clientId: number;
  clientName: string;           // Joined from clients
  clientEmail: string;          // Joined from clients
  projectId: number | null;
  projectName: string | null;   // Joined from projects
  meetingType: MeetingType;
  status: MeetingStatus;
  preferredSlot1: string | null;
  preferredSlot2: string | null;
  preferredSlot3: string | null;
  confirmedDatetime: string | null;
  durationMinutes: number;
  locationType: LocationType;
  locationDetails: string | null;
  clientNotes: string | null;
  adminNotes: string | null;
  declineReason: string | null;
  calendarEventId: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface CreateMeetingRequestPayload {
  projectId?: number;
  meetingType: MeetingType;
  preferredSlot1: string;       // Required: at least one
  preferredSlot2?: string;
  preferredSlot3?: string;
  durationMinutes?: number;     // Default: 60
  notes?: string;
}

export interface ConfirmMeetingPayload {
  confirmedDatetime: string;    // Which slot (or a different time)
  durationMinutes?: number;
  locationType: LocationType;
  locationDetails?: string;
  adminNotes?: string;
  createCalendarEvent?: boolean; // Auto-create Google Calendar event
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  discovery_call: 'Discovery Call',
  consultation: 'Consultation',
  project_kickoff: 'Project Kickoff',
  check_in: 'Check-In',
  review: 'Review',
  other: 'Other'
};

export const DEFAULT_DURATIONS = [30, 45, 60, 90];  // Minutes
```

#### API Endpoints

**File: `server/routes/meeting-requests.ts`**

```text
-- Client (requireClient)
POST /api/portal/meeting-requests               — Submit meeting request
GET  /api/portal/meeting-requests               — Client's requests
PUT  /api/portal/meeting-requests/:id/cancel    — Cancel request

-- Admin (requireAdmin)
GET  /api/admin/meeting-requests                — All requests (filterable by status)
GET  /api/admin/meeting-requests/:id            — Single request
PUT  /api/admin/meeting-requests/:id/confirm    — Confirm with selected time + location
PUT  /api/admin/meeting-requests/:id/decline    — Decline with reason
PUT  /api/admin/meeting-requests/:id/reschedule — Counter-propose new times
POST /api/admin/meeting-requests/:id/complete   — Mark as completed
```

**`PUT /api/admin/meeting-requests/:id/confirm` flow:**

1. Validate `ConfirmMeetingPayload`
2. Update meeting request: status = 'confirmed', set `confirmed_datetime`, `location_type`, `location_details`, `confirmed_at`
3. If `createCalendarEvent === true` and Google Calendar is configured:
   - Use existing `calendar-service.ts` to create event
   - Store returned `calendarEventId`
4. Generate `.ics` file content for email attachment
5. Send confirmation email to client with `.ics` attachment
6. Send admin notification (self-reminder)
7. Return updated meeting request

#### Service Layer

**File: `server/services/meeting-request-service.ts`**

```typescript
class MeetingRequestService {
  async create(clientId: number, data: CreateMeetingRequestPayload): Promise<MeetingRequest>
  async list(filters?: { status?: string; clientId?: number }): Promise<MeetingRequest[]>
  async getById(id: number): Promise<MeetingRequest | null>
  async getByClient(clientId: number): Promise<MeetingRequest[]>
  async confirm(id: number, data: ConfirmMeetingPayload): Promise<MeetingRequest>
  async decline(id: number, reason: string): Promise<MeetingRequest>
  async reschedule(id: number, newSlots: string[]): Promise<MeetingRequest>
  async cancel(id: number, clientId: number): Promise<void>
  async complete(id: number): Promise<void>

  // Reminders
  async sendUpcomingReminders(): Promise<number>  // 24h before confirmed meetings

  // ICS generation
  generateIcs(meeting: MeetingRequest): string
}

export const meetingRequestService = new MeetingRequestService();
```

**ICS generation helper:**

```typescript
generateIcs(meeting: MeetingRequest): string {
  const start = new Date(meeting.confirmedDatetime);
  const end = new Date(start.getTime() + meeting.durationMinutes * 60000);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//No Bhad Codes//Meeting//EN',
    'BEGIN:VEVENT',
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${MEETING_TYPE_LABELS[meeting.meetingType]} — ${meeting.clientName}`,
    `DESCRIPTION:${meeting.clientNotes || ''}`,
    `LOCATION:${meeting.locationDetails || ''}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
```

#### React Components

**File: `src/react/features/portal/meetings/MeetingRequestForm.tsx`**

```typescript
interface MeetingRequestFormProps {
  projectId?: number;
  onSubmit: () => void;
  onCancel: () => void;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

- Meeting type dropdown
- Date/time pickers for up to 3 preferred slots (calendar input + time select)
- Duration dropdown (30, 45, 60, 90 minutes)
- Notes textarea ("What would you like to discuss?")
- Submit button

**File: `src/react/features/portal/meetings/MeetingRequestsList.tsx`**

- Cards showing meeting requests with status
- Confirmed meetings show date, time, location with "Add to Calendar" (`.ics` download) button
- Pending requests show "Awaiting confirmation"

**File: `src/react/features/admin/meetings/MeetingRequestsTable.tsx`**

Admin table with all requests. Quick-action buttons: Confirm, Decline.

**File: `src/react/features/admin/meetings/ConfirmMeetingModal.tsx`**

Modal for confirming a meeting — shows client's preferred slots with radio buttons, location config, calendar integration toggle.

#### Cron Schedule

```typescript
// Meeting reminders — daily at 9:00 AM
// Sends reminder for meetings confirmed for tomorrow
cron.schedule('0 9 * * *', async () => {
  const sent = await meetingRequestService.sendUpcomingReminders();
  if (sent > 0) logger.info(`Meeting reminders sent: ${sent}`);
});
```

#### Edge Cases

- **Client submits request with past dates:** Validate all preferred slots are in the future. Reject with 400.
- **Admin confirms with a time not in preferred slots:** Allowed — admin can pick any time, the preferred slots are suggestions.
- **Client cancels after admin confirms:** Status changes to 'cancelled'. If calendar event was created, attempt to delete via Google Calendar API.
- **Google Calendar not configured:** `createCalendarEvent` flag is ignored. Meeting is confirmed without calendar event. `.ics` attachment still works (not dependent on Google API).
- **Multiple pending requests from same client:** Allowed. Admin sees all and can confirm/decline individually.

#### Testing (2B)

- Unit test: `create` rejects past dates
- Unit test: `confirm` creates calendar event when configured
- Unit test: `confirm` generates valid `.ics` content
- Unit test: `sendUpcomingReminders` sends for meetings tomorrow, not today or next week
- Integration test: create request → confirm → verify email sent with `.ics`
- Component test: `MeetingRequestForm` validates at least one preferred slot
- Component test: `ConfirmMeetingModal` shows preferred slots as radio options

---

## Phase 3: Admin Self-Service Automations — COMPLETE

Split into two sub-phases: 3A builds the backend engine (can run automations via API/seed data), 3B builds the visual admin UI.

**Status:** Complete (March 17, 2026)

**Implemented:**

- 3A: Automation Engine (migration 124, 5 tables, 11 action types, condition evaluation, wait-step scheduling, variable substitution, dry-run, execution history)
- 3B: Automation Builder (AutomationsTable with create/toggle/delete, AutomationBuilder with grouped triggers + action config forms, AutomationDetailPanel with run history)

**Feature docs:** [Custom Automations](features/CUSTOM_AUTOMATIONS.md)

**Important:** This does NOT replace the existing `workflow-automations.ts` handlers. Custom automations run alongside them. Built-in automations (proposal accepted -> milestones, contract signed -> activate project) remain in code because they're core business logic. Custom automations handle the flexible stuff (send follow-up email 3 days after X, create task when Y happens).

**Competitors:** Dubsado's "Workflows" and HoneyBook's "Automations" are visual drag-and-drop builders. Moxie has "Automation Rules."

### 3A. Automation Engine (Backend)

#### Database Changes

**Migration: `124_custom_automations.sql`**

```sql
-- Automation definition
CREATE TABLE IF NOT EXISTS custom_automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,       -- boolean: off by default until explicitly activated

  -- Trigger
  trigger_event TEXT NOT NULL,                 -- Uses same event types as workflow_triggers
  trigger_conditions TEXT DEFAULT '{}',        -- JSON: field/operator/value conditions

  -- Execution config
  stop_on_error INTEGER NOT NULL DEFAULT 0,   -- boolean: stop remaining actions if one fails
  max_runs_per_entity INTEGER DEFAULT NULL,   -- NULL = unlimited, 1 = run once per entity

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_automations_event ON custom_automations(trigger_event, is_active);

-- Actions within an automation (executed in order)
CREATE TABLE IF NOT EXISTS automation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  action_order INTEGER NOT NULL,
  action_type TEXT NOT NULL
    CHECK(action_type IN (
      'send_email', 'create_task', 'update_status', 'send_notification',
      'wait', 'enroll_sequence', 'create_invoice', 'assign_questionnaire',
      'webhook', 'add_tag', 'add_note'
    )),
  action_config TEXT NOT NULL DEFAULT '{}',   -- JSON: type-specific configuration
  condition TEXT,                               -- JSON: optional "only if" condition for this action
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (automation_id) REFERENCES custom_automations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_automation_actions_automation ON automation_actions(automation_id, action_order);

-- Execution history
CREATE TABLE IF NOT EXISTS automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_entity_type TEXT,
  trigger_entity_id INTEGER,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK(status IN ('running', 'completed', 'failed', 'waiting')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  error_message TEXT,
  FOREIGN KEY (automation_id) REFERENCES custom_automations(id)
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);

-- Per-action execution log
CREATE TABLE IF NOT EXISTS automation_action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  action_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'executed', 'failed', 'skipped', 'waiting')),
  executed_at TEXT,
  result TEXT,                                -- JSON: action result data
  error_message TEXT,
  FOREIGN KEY (run_id) REFERENCES automation_runs(id),
  FOREIGN KEY (action_id) REFERENCES automation_actions(id)
);

-- Scheduled actions (for 'wait' action type)
CREATE TABLE IF NOT EXISTS automation_scheduled_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  action_id INTEGER NOT NULL,
  execute_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'executed', 'failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES automation_runs(id),
  FOREIGN KEY (action_id) REFERENCES automation_actions(id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_actions_execute ON automation_scheduled_actions(status, execute_at);
```

#### Action Config Schemas

**File: `server/services/automation-action-schemas.ts`**

```typescript
// Each action type has a specific config shape

export interface SendEmailConfig {
  templateId?: number;          // Use existing email template
  to: 'client' | 'admin' | string;  // 'client' resolves from entity, or literal email
  subject?: string;             // Override or custom
  body?: string;                // Override or custom
  variables?: Record<string, string>;  // Additional template variables
}

export interface CreateTaskConfig {
  title: string;                // Supports {{variables}}
  description?: string;
  projectSource: 'trigger_entity' | 'specific';  // Where to get project_id
  specificProjectId?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueOffsetDays?: number;      // Days from trigger event
}

export interface UpdateStatusConfig {
  entity: 'project' | 'lead' | 'invoice' | 'contract';
  entitySource: 'trigger_entity' | 'specific';
  specificEntityId?: number;
  newStatus: string;
}

export interface SendNotificationConfig {
  message: string;              // Supports {{variables}}
  to: 'client' | 'admin';
}

export interface WaitConfig {
  durationMinutes?: number;
  durationHours?: number;
  durationDays?: number;
}

export interface EnrollSequenceConfig {
  sequenceId: number;
}

export interface CreateInvoiceConfig {
  amountSource: 'payment_schedule' | 'fixed';
  fixedAmount?: number;
  description?: string;
}

export interface AssignQuestionnaireConfig {
  questionnaireId: number;
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'GET';
  headers?: Record<string, string>;
  payloadTemplate?: Record<string, unknown>;  // Supports {{variables}}
}

export interface AddTagConfig {
  tagName: string;
  entity: 'client' | 'project';
}

export interface AddNoteConfig {
  content: string;              // Supports {{variables}}
  entity: 'client' | 'project';
  isPinned?: boolean;
}

// Union type for all action configs
export type ActionConfig =
  | { type: 'send_email'; config: SendEmailConfig }
  | { type: 'create_task'; config: CreateTaskConfig }
  | { type: 'update_status'; config: UpdateStatusConfig }
  | { type: 'send_notification'; config: SendNotificationConfig }
  | { type: 'wait'; config: WaitConfig }
  | { type: 'enroll_sequence'; config: EnrollSequenceConfig }
  | { type: 'create_invoice'; config: CreateInvoiceConfig }
  | { type: 'assign_questionnaire'; config: AssignQuestionnaireConfig }
  | { type: 'webhook'; config: WebhookConfig }
  | { type: 'add_tag'; config: AddTagConfig }
  | { type: 'add_note'; config: AddNoteConfig };

// Available template variables (resolved at execution time from trigger context)
export const TEMPLATE_VARIABLES = [
  '{{client_name}}', '{{client_email}}', '{{project_name}}', '{{project_type}}',
  '{{amount}}', '{{due_date}}', '{{proposal_tier}}', '{{invoice_number}}',
  '{{contract_name}}', '{{lead_name}}', '{{lead_email}}', '{{trigger_date}}'
] as const;
```

#### Service Layer

**File: `server/services/automation-engine.ts`**

```typescript
class AutomationEngine {
  // Event handler — called by workflow system
  async handleEvent(eventType: string, context: Record<string, unknown>): Promise<void>

  // Execution
  private async executeAutomation(automation: CustomAutomation, context: Record<string, unknown>): Promise<void>
  private async executeAction(action: AutomationAction, context: Record<string, unknown>, runId: number): Promise<void>

  // Action executors (one per action type)
  private async executeSendEmail(config: SendEmailConfig, context: Record<string, unknown>): Promise<void>
  private async executeCreateTask(config: CreateTaskConfig, context: Record<string, unknown>): Promise<void>
  private async executeUpdateStatus(config: UpdateStatusConfig, context: Record<string, unknown>): Promise<void>
  private async executeSendNotification(config: SendNotificationConfig, context: Record<string, unknown>): Promise<void>
  private async executeWait(config: WaitConfig, runId: number, actionId: number): Promise<void>
  private async executeEnrollSequence(config: EnrollSequenceConfig, context: Record<string, unknown>): Promise<void>
  private async executeWebhook(config: WebhookConfig, context: Record<string, unknown>): Promise<void>
  private async executeAddTag(config: AddTagConfig, context: Record<string, unknown>): Promise<void>
  private async executeAddNote(config: AddNoteConfig, context: Record<string, unknown>): Promise<void>

  // Variable substitution
  private resolveVariables(template: string, context: Record<string, unknown>): string

  // Scheduled action processing (for 'wait' actions)
  async processScheduledActions(): Promise<{ executed: number; failed: number }>

  // CRUD
  async createAutomation(data: CreateAutomationRequest): Promise<CustomAutomation>
  async updateAutomation(id: number, data: Partial<CreateAutomationRequest>): Promise<CustomAutomation>
  async deleteAutomation(id: number): Promise<void>
  async listAutomations(): Promise<CustomAutomation[]>
  async getAutomation(id: number): Promise<CustomAutomation | null>
  async getRuns(automationId: number, limit?: number): Promise<AutomationRun[]>

  // Dry run (test without actually executing)
  async dryRun(automationId: number, sampleEntityId: number): Promise<DryRunResult>
}

export const automationEngine = new AutomationEngine();
```

**Integration with existing event system — add to `workflow-automations.ts`:**

```typescript
// At the end of the event registration block:
// Route ALL events to custom automation engine
for (const eventType of ALL_EVENT_TYPES) {
  workflowTriggerService.on(eventType, async (data) => {
    await automationEngine.handleEvent(eventType, data);
  });
}
```

**`handleEvent` execution flow:**

```text
1. Query active custom automations matching trigger_event
2. For each automation:
   a. Evaluate trigger_conditions against context
   b. Check max_runs_per_entity (if set, check automation_runs for this entity)
   c. If all checks pass:
      - Create automation_runs record (status: 'running')
      - Execute actions sequentially by action_order
      - For each action:
        i.   Evaluate action.condition (skip if not met)
        ii.  If action_type === 'wait': schedule future execution, set run to 'waiting', stop
        iii. Otherwise: execute action, log result
        iv.  If error and stop_on_error: mark run as 'failed', stop
      - After all actions: mark run as 'completed'
```

#### Cron Jobs

```typescript
// Process scheduled automation actions (from 'wait' steps) — every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const result = await automationEngine.processScheduledActions();
  if (result.executed > 0) logger.info(`Automation scheduled actions: ${result.executed} executed`);
});
```

#### API Endpoints

**File: `server/routes/automations/admin.ts`**

```text
-- Automation CRUD
GET    /api/admin/automations                     — List all automations with run stats
POST   /api/admin/automations                     — Create automation
GET    /api/admin/automations/:id                 — Get with actions
PUT    /api/admin/automations/:id                 — Update automation
DELETE /api/admin/automations/:id                 — Delete (stops active runs first)
PUT    /api/admin/automations/:id/activate        — Activate
PUT    /api/admin/automations/:id/deactivate      — Deactivate

-- Action CRUD
POST   /api/admin/automations/:id/actions         — Add action
PUT    /api/admin/automations/:id/actions/:actionId — Update action
DELETE /api/admin/automations/:id/actions/:actionId — Remove action
PUT    /api/admin/automations/:id/actions/reorder  — Reorder actions

-- Execution
GET    /api/admin/automations/:id/runs            — Execution history
GET    /api/admin/automations/runs/:runId/logs    — Per-action logs for a run
POST   /api/admin/automations/:id/dry-run         — Test against sample entity
POST   /api/admin/automations/:id/run-now         — Manually trigger against specific entity
```

#### Testing (3A)

- Unit test: `automationEngine.handleEvent()` with matching trigger → creates run, executes actions
- Unit test: `handleEvent()` with non-matching conditions → no run created
- Unit test: `wait` action → schedules future execution, pauses run
- Unit test: `stop_on_error = true` → stops after first failure
- Unit test: `max_runs_per_entity = 1` → second trigger for same entity is skipped
- Unit test: each action executor in isolation (send_email, create_task, etc.)
- Integration test: create automation via API → trigger event → verify actions executed

---

### 3B. Automation Builder (Admin UI)

**Depends on:** 3A (engine must exist)

This is the most complex React feature in the roadmap. The builder has dynamic forms, drag-and-drop, condition builders, and a timeline preview.

#### React Components

**File: `src/react/features/admin/automations/AutomationsTable.tsx`**

Standard admin table. Columns: Name, Trigger Event, Status (toggle), Run Count, Last Run, Success Rate.

```typescript
interface AutomationsTableProps {
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}
```

- Fetches `GET /api/admin/automations`
- Inline toggle for active/inactive
- Row click opens `AutomationDetailPanel`
- "Create Automation" button → opens `AutomationBuilder`
- Bulk actions: activate, deactivate, delete

**File: `src/react/features/admin/automations/AutomationBuilder.tsx`**

The visual builder.

```typescript
interface AutomationBuilderProps {
  automationId?: number;          // Edit mode if provided
  onSave: () => void;
  onCancel: () => void;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

**Component tree:**

```text
AutomationBuilder
├── AutomationHeader             — Name + description inputs
├── TriggerSection               — "When this happens..."
│   ├── EventSelector            — Dropdown of all event types (grouped by category)
│   │   Groups: Lead Events, Project Events, Invoice Events,
│   │           Contract Events, Proposal Events, Task Events
│   └── ConditionBuilder         — "Only if..." rows
│       └── ConditionRow         — Field dropdown + Operator dropdown + Value input
│           Operators: equals, not_equals, contains, greater_than, less_than, in
│           Values: text input, number input, or dropdown (for status fields)
├── ActionsSection               — "Do this..."
│   ├── ActionCard (per action)  — Draggable via drag handle, numbered
│   │   ├── ActionTypeSelector   — Dropdown: Send Email, Create Task, Wait, etc.
│   │   ├── ActionConfigForm     — Dynamic form based on selected type
│   │   │   ├── SendEmailForm    — Template picker OR custom subject+body, "to" selector
│   │   │   ├── CreateTaskForm   — Title (with variable picker), description, priority, due offset
│   │   │   ├── WaitForm         — Duration picker: number input + unit dropdown (minutes/hours/days)
│   │   │   ├── UpdateStatusForm — Entity type dropdown + new status dropdown (filtered by entity)
│   │   │   ├── SendNotificationForm — Message textarea + to selector
│   │   │   ├── EnrollSequenceForm   — Sequence dropdown (fetches from /api/admin/sequences)
│   │   │   ├── WebhookForm      — URL input, method dropdown, headers key-value pairs, payload editor
│   │   │   ├── AddTagForm       — Tag name input + entity type dropdown
│   │   │   └── AddNoteForm      — Content textarea + entity type + pinned checkbox
│   │   ├── ActionCondition      — Optional "only if" toggle → opens mini ConditionBuilder
│   │   └── RemoveButton         — Trash icon, confirm before delete
│   └── AddActionButton          — "+ Add Action" with type pre-selector dropdown
├── VariableHelper               — Floating panel showing available {{variables}} for current context
│   └── Clickable chips that insert variable at cursor position
├── PreviewSection               — "Here's what will happen..."
│   └── TimelinePreview          — Visual vertical timeline:
│       ├── "Immediately" → action icon + description
│       ├── "After 3 days" → wait indicator (dashed line) → action icon + description
│       └── "After 7 days" → action icon + description
├── TestSection                  — Dry run controls
│   ├── Entity picker            — Select a real entity to test against
│   └── DryRunResults            — Shows what would happen (no actual execution)
└── ActionButtons                — Save Draft | Save & Activate | Cancel
```

**File: `src/react/features/admin/automations/AutomationDetailPanel.tsx`**

Slide-in panel (uses `createDetailPanel` factory). Shows:

- Overview tab: trigger info, conditions, action summary, status toggle
- Runs tab: execution history table with status, timestamp, trigger entity
- Each run expandable: shows per-action log with status, timing, error messages

**File: `src/react/features/admin/automations/AutomationRunsLog.tsx`**

Full-page execution history for a specific automation.

```typescript
interface AutomationRunsLogProps {
  automationId: number;
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

- Table: Run ID, Trigger Event, Entity, Status, Started, Completed, Duration
- Expandable rows showing per-action log
- Filter by status (running, completed, failed, waiting)
- Pagination

**File: `src/react/features/admin/automations/components/ConditionBuilder.tsx`**

Reusable condition row builder (shared between trigger conditions and action conditions).

```typescript
interface ConditionBuilderProps {
  conditions: Array<{ field: string; operator: string; value: string }>;
  onChange: (conditions: Array<{ field: string; operator: string; value: string }>) => void;
  availableFields: Array<{ key: string; label: string; type: 'text' | 'number' | 'select'; options?: string[] }>;
}
```

- Add/remove condition rows
- AND logic between rows (all must match)
- Field dropdown populated from `availableFields` (changes based on trigger event)
- Operator dropdown filtered by field type
- Value input type changes based on field type (text, number, or select)

**File: `src/react/features/admin/automations/components/VariableHelper.tsx`**

Floating panel that shows available template variables.

```typescript
interface VariableHelperProps {
  triggerEvent: string;           // Determines which variables are available
  onInsert: (variable: string) => void;
}
```

- Groups variables by category (Client, Project, Invoice, etc.)
- Each variable is a clickable chip
- Shows description on hover
- Variables available depend on the trigger event (e.g., `invoice.paid` exposes `{{invoice_number}}`, `{{amount}}`, but `lead.created` does not)

#### Variable Availability by Trigger Event

```typescript
const VARIABLES_BY_EVENT_CATEGORY: Record<string, string[]> = {
  'lead.*': ['{{lead_name}}', '{{lead_email}}', '{{lead_source}}', '{{lead_stage}}'],
  'project.*': ['{{project_name}}', '{{project_type}}', '{{project_status}}', '{{client_name}}', '{{client_email}}'],
  'invoice.*': ['{{invoice_number}}', '{{amount}}', '{{due_date}}', '{{client_name}}', '{{client_email}}', '{{project_name}}'],
  'contract.*': ['{{contract_name}}', '{{client_name}}', '{{client_email}}', '{{project_name}}'],
  'proposal.*': ['{{proposal_tier}}', '{{proposal_price}}', '{{client_name}}', '{{client_email}}', '{{project_name}}', '{{project_type}}'],
  'task.*': ['{{task_title}}', '{{task_priority}}', '{{project_name}}', '{{client_name}}'],
  '*': ['{{trigger_date}}', '{{trigger_event}}']  // Always available
};
```

#### Testing (3B)

- Component test: `AutomationBuilder` renders all sections
- Component test: adding/removing/reordering actions
- Component test: `ConditionBuilder` add/remove rows, operator filtering
- Component test: `VariableHelper` shows correct variables for selected trigger event
- Component test: `TimelinePreview` correctly calculates cumulative delays
- E2E test: create automation via builder → verify saved correctly via API

#### Pre-Built Templates

```typescript
const AUTOMATION_TEMPLATES = [
  {
    name: 'New Project Setup',
    triggerEvent: 'project.created',
    actions: [
      { type: 'send_email', config: { to: 'client', templateId: null, subject: 'Welcome to your new project!' } },
      { type: 'create_task', config: { title: 'Schedule kickoff call with {{client_name}}', priority: 'high', dueOffsetDays: 2 } },
      { type: 'assign_questionnaire', config: { questionnaireId: null } }  // Admin fills in
    ]
  },
  {
    name: 'Invoice Follow-Up',
    triggerEvent: 'invoice.overdue',
    actions: [
      { type: 'send_email', config: { to: 'client', subject: 'Payment reminder: Invoice #{{invoice_number}}' } },
      { type: 'wait', config: { durationDays: 3 } },
      { type: 'send_notification', config: { to: 'admin', message: 'Invoice #{{invoice_number}} is 3+ days overdue' } }
    ]
  }
];
```

---

## Phase 4: Revenue Intelligence — COMPLETE

**Status:** Complete (March 17, 2026)

**Implemented:**

- 4A: Expense Tracking (migration 125, expenseService, 12 categories, profitability calculation, CSV export, admin table)
- 4B: Retainer Management (migration 126, retainerService, period lifecycle with rollover, auto-invoicing cron, usage alert cron, admin table + portal view)

**Feature docs:** [Expenses](features/EXPENSES.md) | [Retainers](features/RETAINERS.md)

### 4A. Expense Tracking and Profitability

**Problem:** Revenue is tracked via invoices but costs are invisible. No way to know if a project is profitable.

**Competitors:** Productive has full project profitability. Moxie has expense tracking. Plutio has financial reporting.

#### Database Changes

**Migration: `125_expenses_and_profitability.sql`**

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,                         -- NULL = general business expense
  category TEXT NOT NULL DEFAULT 'other'
    CHECK(category IN (
      'software', 'hosting', 'domain', 'stock_assets', 'subcontractor',
      'hardware', 'travel', 'marketing', 'office', 'professional_services',
      'subscription', 'other'
    )),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  vendor_name TEXT,
  expense_date TEXT NOT NULL,
  is_billable INTEGER NOT NULL DEFAULT 0,     -- Can be invoiced to client
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_interval TEXT
    CHECK(recurring_interval IN ('weekly', 'monthly', 'quarterly', 'annual')),
  receipt_file_id INTEGER,                     -- FK to files table
  tax_deductible INTEGER NOT NULL DEFAULT 1,
  tax_category TEXT,                           -- For accounting exports
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (receipt_file_id) REFERENCES files(id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deleted_at);
```

#### API Endpoints

```text
-- CRUD
GET    /api/admin/expenses                       — List (filterable by project, category, date range)
POST   /api/admin/expenses                       — Create expense
GET    /api/admin/expenses/:id                   — Get expense
PUT    /api/admin/expenses/:id                   — Update expense
DELETE /api/admin/expenses/:id                   — Soft delete

-- Project profitability
GET    /api/admin/projects/:id/profitability     — Revenue vs costs breakdown
GET    /api/admin/analytics/profitability        — All projects profitability summary
GET    /api/admin/analytics/expenses             — Expense breakdown (by category, by month, by project)
GET    /api/admin/analytics/expenses/export      — CSV export
```

**Profitability response shape:**

```typescript
interface ProjectProfitability {
  projectId: number;
  projectName: string;
  clientName: string;
  revenue: {
    invoicesPaid: number;        // Sum of paid invoice amounts
    installmentsPaid: number;    // Sum of paid payment schedule items
    totalRevenue: number;
  };
  costs: {
    expenses: number;            // Sum of project expenses
    timeCost: number;            // Sum of (billable time entries × hourly rate from business config)
    totalCosts: number;
  };
  profit: number;                // revenue - costs
  margin: number;                // (profit / revenue) × 100, or 0 if no revenue
  budget: number | null;         // Project budget
  budgetRemaining: number | null;
}
```

#### React Components

**File: `src/react/features/admin/expenses/ExpensesTable.tsx`**

Standard admin table. Columns: Date, Description, Category, Vendor, Amount, Project, Billable.

**File: `src/react/features/admin/expenses/ExpenseForm.tsx`**

Create/edit form. Project dropdown (optional), category dropdown, amount input, vendor, date picker, receipt upload, notes.

**Project detail — new "Financials" tab:**

Shows revenue bars, expense list, time cost, profit/margin calculation. Visual: green for profit, red for loss.

**Dashboard widget:**

Summary card showing: Total Revenue (MTD), Total Expenses (MTD), Net Profit (MTD), Avg Margin across active projects.

#### Service Layer

**File: `server/services/expense-service.ts`**

```typescript
class ExpenseService {
  // CRUD
  async create(data: CreateExpenseRequest): Promise<Expense>
  async update(id: number, data: Partial<CreateExpenseRequest>): Promise<Expense>
  async delete(id: number): Promise<void>       // Soft delete
  async list(filters?: { projectId?: number; category?: string; startDate?: string; endDate?: string }): Promise<Expense[]>
  async getById(id: number): Promise<Expense | null>

  // Profitability
  async getProjectProfitability(projectId: number): Promise<ProjectProfitability>
  async getAllProjectProfitability(): Promise<ProjectProfitability[]>

  // Analytics
  async getExpensesByCategory(dateRange?: { start: string; end: string }): Promise<Record<string, number>>
  async getMonthlyExpenses(months?: number): Promise<Array<{ month: string; total: number }>>
  async exportCsv(filters?: Record<string, string>): Promise<string>
}

export const expenseService = new ExpenseService();
```

**`getProjectProfitability` query:**

```sql
-- Revenue
SELECT COALESCE(SUM(total_amount), 0) as invoices_paid
FROM invoices
WHERE project_id = ? AND status = 'paid' AND deleted_at IS NULL;

SELECT COALESCE(SUM(paid_amount), 0) as installments_paid
FROM payment_schedule_installments
WHERE project_id = ? AND status = 'paid';

-- Costs
SELECT COALESCE(SUM(amount), 0) as expenses
FROM expenses
WHERE project_id = ? AND deleted_at IS NULL;

-- Time cost (using hourly rate from business config)
SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
FROM time_entries
WHERE project_id = ? AND billable = 1;
-- timeCost = (total_minutes / 60) * hourlyRate
```

#### Edge Cases

- **Expense with no project:** Allowed — `project_id` is nullable. General business expenses (hosting, software subscriptions) are not tied to a project. They appear in overall P&L but not in per-project profitability.
- **Receipt upload:** Uses existing file upload system. `receipt_file_id` links to `files` table. Admin can view receipt from expense detail.
- **Recurring expenses:** `is_recurring` is a flag for display/filtering only. No auto-creation — admin creates each occurrence manually. Recurring auto-creation could be added as a cron job later.
- **Zero revenue projects:** Margin = 0 (not NaN). Costs still tracked. Shows negative profit.

#### Testing (4A)

- Unit test: `getProjectProfitability` calculates correct revenue from invoices + installments
- Unit test: `getProjectProfitability` calculates time cost from billable entries × hourly rate
- Unit test: `getProjectProfitability` with zero revenue → margin = 0, not NaN
- Unit test: `getExpensesByCategory` groups correctly
- Integration test: create expense → get profitability → verify included
- Component test: `ExpenseForm` validates required fields
- Component test: profitability display shows green/red based on profit/loss

---

### 4B. Retainer and Recurring Project Management

**Problem:** No support for ongoing retainer clients. Only one-time project lifecycle.

**Competitors:** Moxie has retainer tracking. Productive has recurring budgets. HoneyBook has recurring invoices.

#### Database Changes

**Migration: `126_retainers.sql`**

```sql
CREATE TABLE IF NOT EXISTS retainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  retainer_type TEXT NOT NULL DEFAULT 'hourly'
    CHECK(retainer_type IN ('hourly', 'fixed_scope')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'paused', 'cancelled', 'expired')),
  monthly_hours REAL,                          -- For hourly retainers
  monthly_amount REAL NOT NULL,                -- Invoice amount per period
  rollover_enabled INTEGER NOT NULL DEFAULT 0,
  max_rollover_hours REAL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT,                                -- NULL = ongoing
  billing_day INTEGER NOT NULL DEFAULT 1,      -- Day of month (1-28)
  auto_invoice INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_retainers_client ON retainers(client_id);
CREATE INDEX IF NOT EXISTS idx_retainers_status ON retainers(status);

CREATE TABLE IF NOT EXISTS retainer_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retainer_id INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  allocated_hours REAL,
  used_hours REAL NOT NULL DEFAULT 0,
  rollover_hours REAL NOT NULL DEFAULT 0,
  total_available REAL,                        -- allocated + rollover
  invoice_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'closed', 'invoiced')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (retainer_id) REFERENCES retainers(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX IF NOT EXISTS idx_retainer_periods_retainer ON retainer_periods(retainer_id);
CREATE INDEX IF NOT EXISTS idx_retainer_periods_status ON retainer_periods(status);
```

#### TypeScript Interfaces

**File: `server/services/retainer-types.ts`**

```typescript
export type RetainerType = 'hourly' | 'fixed_scope';
export type RetainerStatus = 'active' | 'paused' | 'cancelled' | 'expired';
export type PeriodStatus = 'active' | 'closed' | 'invoiced';

export interface Retainer {
  id: number;
  clientId: number;
  clientName: string;             // Joined
  projectId: number;
  projectName: string;            // Joined
  retainerType: RetainerType;
  status: RetainerStatus;
  monthlyHours: number | null;
  monthlyAmount: number;
  rolloverEnabled: boolean;
  maxRolloverHours: number;
  startDate: string;
  endDate: string | null;
  billingDay: number;
  autoInvoice: boolean;
  notes: string | null;
  currentPeriod: RetainerPeriod | null;  // Enriched
  createdAt: string;
}

export interface RetainerPeriod {
  id: number;
  retainerId: number;
  periodStart: string;
  periodEnd: string;
  allocatedHours: number | null;
  usedHours: number;
  rolloverHours: number;
  totalAvailable: number | null;    // allocatedHours + rolloverHours
  invoiceId: number | null;
  status: PeriodStatus;
  utilizationPercent: number;       // Derived: (usedHours / totalAvailable) * 100
  createdAt: string;
}

export interface CreateRetainerRequest {
  clientId: number;
  projectId: number;
  retainerType: RetainerType;
  monthlyHours?: number;            // Required if retainerType === 'hourly'
  monthlyAmount: number;
  rolloverEnabled?: boolean;
  maxRolloverHours?: number;
  startDate: string;
  endDate?: string;
  billingDay?: number;              // Default: 1
  autoInvoice?: boolean;            // Default: true
  notes?: string;
}

export interface RetainerSummary {
  totalActive: number;
  totalMonthlyRevenue: number;      // Sum of monthlyAmount across active retainers
  avgUtilization: number;           // Average utilization % across active retainers
  retainersNearCap: number;         // Retainers at >= 80% utilization
}

// Constants
export const USAGE_ALERT_THRESHOLD = 0.8;  // 80%
export const ROLLOVER_CAP_DEFAULT = 10;    // Max rollover hours if not specified
```

#### API Endpoints

```text
-- Admin
GET    /api/admin/retainers                      — List all retainers with current period
POST   /api/admin/retainers                      — Create retainer (auto-creates first period)
GET    /api/admin/retainers/:id                  — Get with current period + recent time entries
PUT    /api/admin/retainers/:id                  — Update retainer
DELETE /api/admin/retainers/:id                  — Cancel retainer (sets status, does not delete)
GET    /api/admin/retainers/:id/periods          — Period history with utilization
POST   /api/admin/retainers/:id/close-period     — Close current period, create next
POST   /api/admin/retainers/:id/pause            — Pause retainer
POST   /api/admin/retainers/:id/resume           — Resume retainer
GET    /api/admin/retainers/summary              — Summary stats across all retainers

-- Client
GET    /api/portal/retainers                     — Client's active retainers
GET    /api/portal/retainers/:id                 — Retainer with current period + time log
```

#### Service Layer

**File: `server/services/retainer-service.ts`**

```typescript
class RetainerService {
  // CRUD
  async create(data: CreateRetainerRequest): Promise<Retainer>
  async update(id: number, data: Partial<CreateRetainerRequest>): Promise<Retainer>
  async cancel(id: number): Promise<void>
  async pause(id: number): Promise<void>
  async resume(id: number): Promise<void>

  // Queries
  async list(filters?: { status?: string; clientId?: number }): Promise<Retainer[]>
  async getById(id: number): Promise<Retainer | null>
  async getByClient(clientId: number): Promise<Retainer[]>
  async getSummary(): Promise<RetainerSummary>

  // Period management
  async getCurrentPeriod(retainerId: number): Promise<RetainerPeriod | null>
  async getPeriods(retainerId: number): Promise<RetainerPeriod[]>
  async closePeriod(retainerId: number): Promise<{ closedPeriod: RetainerPeriod; newPeriod: RetainerPeriod }>

  // Billing
  async processMonthlyBilling(): Promise<{ invoiced: number; skipped: number; errors: number }>

  // Alerts
  async sendUsageAlerts(): Promise<{ sent: number }>

  // Time tracking integration
  async getTimeEntriesForPeriod(retainerId: number, periodId: number): Promise<TimeEntry[]>
  async recalculateUsedHours(periodId: number): Promise<number>
}

export const retainerService = new RetainerService();
```

**`closePeriod` rollover calculation — detailed flow:**

```text
1. Fetch current active period for retainer
2. If retainer.rolloverEnabled:
   a. Calculate unused hours: unusedHours = totalAvailable - usedHours
   b. Clamp to max: rolloverForNext = Math.min(unusedHours, retainer.maxRolloverHours)
   c. If unusedHours <= 0: rolloverForNext = 0 (no negative rollover)
3. If !retainer.rolloverEnabled: rolloverForNext = 0
4. Mark current period as 'closed'
5. Create new period:
   - periodStart = day after current periodEnd
   - periodEnd = last day of next month (based on billing cycle)
   - allocatedHours = retainer.monthlyHours
   - rolloverHours = rolloverForNext
   - totalAvailable = allocatedHours + rolloverHours
   - status = 'active'
6. Return both periods
```

**`processMonthlyBilling` flow:**

```text
1. Query: SELECT r.* FROM retainers r
   WHERE r.status = 'active'
     AND r.auto_invoice = 1
     AND r.billing_day = cast(strftime('%d', 'now') as integer)

2. For each retainer:
   a. Check if invoice already exists for this period (idempotency)
   b. Create invoice via InvoiceService:
      - client_id from retainer
      - project_id from retainer
      - Line item: retainer.monthlyAmount with description "Monthly Retainer — [period start] to [period end]"
      - For hourly retainers, add line item detail: "X hours allocated (Y rollover)"
   c. Update retainer_periods: set invoice_id, status = 'invoiced'
   d. Close current period and create next (calls closePeriod)
   e. Send invoice email to client
   f. Emit 'invoice.created' event

3. Log results: { invoiced, skipped (already invoiced), errors }
```

#### React Components

**File: `src/react/features/admin/retainers/RetainersTable.tsx`**

```typescript
interface RetainersTableProps {
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}
```

- Columns: Client, Project, Type (hourly/fixed), Monthly Amount, Status, Utilization (progress bar), Billing Day
- Utilization bar color: green (< 60%), yellow (60-80%), red (> 80%)
- Row click → detail panel
- "Create Retainer" button

**File: `src/react/features/admin/retainers/RetainerDetailPanel.tsx`**

Slide-in panel using `createDetailPanel` factory.

- **Overview tab:** Retainer config, current period stats, utilization gauge
- **Periods tab:** Period history table (period dates, allocated, used, rollover, invoice link, status)
- **Time Log tab:** Time entries for current period with running total
- **Actions:** Pause/Resume, Close Period, Cancel

**File: `src/react/features/admin/retainers/RetainerForm.tsx`**

Create/edit form.

- Client dropdown (searchable)
- Project dropdown (filtered by selected client)
- Type toggle: Hourly / Fixed Scope
- Monthly amount input
- Monthly hours input (shown only if type === 'hourly')
- Rollover toggle + max rollover hours (shown only if type === 'hourly')
- Start date picker
- End date picker (optional — leave empty for ongoing)
- Billing day dropdown (1-28)
- Auto-invoice toggle
- Notes textarea

**File: `src/react/features/portal/retainers/PortalRetainers.tsx`**

Client view of their retainers.

```typescript
interface PortalRetainersProps {
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

- Card per retainer showing:
  - Retainer type and monthly amount
  - Current period: utilization progress bar with "X of Y hours used"
  - Rollover hours (if applicable): "Z hours carried over"
  - Days remaining in current period
  - Time entry log (read-only)
- Dashboard widget: compact retainer card with utilization bar

#### Edge Cases

- **Billing day > 28:** Not allowed (constraint on input). Avoids February issues.
- **Retainer paused mid-period:** Period stays active but auto-invoicing skips. Time can still be logged. On resume, period continues (no new period created).
- **Rollover exceeds max:** Clamped to `maxRolloverHours`. Excess hours are lost.
- **No time entries in a period:** Utilization = 0%. Still auto-invoiced (the retainer is for availability, not just usage).
- **Retainer cancelled with active period:** Period is closed immediately. Partial-month invoice can be generated (prorated: `monthlyAmount * (daysUsed / daysInPeriod)`), or admin can skip.
- **End date reached:** Cron detects `end_date <= today` and sets status to `expired`. Final period is closed and invoiced.

#### Cron Jobs

```text
Retainer auto-invoicing    — daily 7:00 AM — processMonthlyBilling()
Retainer usage alerts      — daily 8:00 AM — sendUsageAlerts() (emails admin for retainers >= 80%)
Retainer expiration check  — daily 12:00 AM — expireEndedRetainers()
```

#### Testing

- Unit test: `closePeriod` with rollover enabled — verify rollover calculation
- Unit test: `closePeriod` with rollover disabled — verify zero rollover
- Unit test: `closePeriod` with negative unused hours (over-budget) — verify rollover = 0
- Unit test: `processMonthlyBilling` idempotency — calling twice on same day creates only one invoice
- Unit test: `processMonthlyBilling` skips paused retainers
- Integration test: create retainer → log time → close period → verify new period has correct rollover
- Component test: utilization bar colors at different thresholds

---

## Phase 5: Post-Project and Client Satisfaction

### 5A. Feedback Surveys and Testimonial Collection

**Problem:** Project ends and there's no follow-up. No satisfaction measurement. No testimonial collection for portfolio.

#### Database Changes

**Migration: `127_feedback_and_testimonials.sql`**

```sql
CREATE TABLE IF NOT EXISTS feedback_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  client_id INTEGER NOT NULL,
  survey_type TEXT NOT NULL DEFAULT 'project_completion'
    CHECK(survey_type IN ('project_completion', 'milestone_check_in', 'nps_quarterly')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'sent', 'completed', 'expired')),
  token TEXT NOT NULL UNIQUE,                   -- For unauthenticated email-link access
  sent_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_surveys_client ON feedback_surveys(client_id);
CREATE INDEX IF NOT EXISTS idx_feedback_surveys_token ON feedback_surveys(token);

CREATE TABLE IF NOT EXISTS feedback_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL UNIQUE,
  overall_rating INTEGER CHECK(overall_rating BETWEEN 1 AND 5),
  nps_score INTEGER CHECK(nps_score BETWEEN 0 AND 10),
  communication_rating INTEGER CHECK(communication_rating BETWEEN 1 AND 5),
  quality_rating INTEGER CHECK(quality_rating BETWEEN 1 AND 5),
  timeliness_rating INTEGER CHECK(timeliness_rating BETWEEN 1 AND 5),
  highlights TEXT,
  improvements TEXT,
  testimonial_text TEXT,
  testimonial_approved INTEGER NOT NULL DEFAULT 0,  -- Client consents to public use
  allow_name_use INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (survey_id) REFERENCES feedback_surveys(id)
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_response_id INTEGER,
  client_id INTEGER NOT NULL,
  project_id INTEGER,
  text TEXT NOT NULL,
  client_name TEXT NOT NULL,
  company_name TEXT,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK(status IN ('pending_review', 'approved', 'published', 'rejected')),
  featured INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (feedback_response_id) REFERENCES feedback_responses(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(featured, status);
```

#### TypeScript Interfaces

**File: `server/services/feedback-types.ts`**

```typescript
export type SurveyType = 'project_completion' | 'milestone_check_in' | 'nps_quarterly';
export type SurveyStatus = 'pending' | 'sent' | 'completed' | 'expired';
export type TestimonialStatus = 'pending_review' | 'approved' | 'published' | 'rejected';

export interface FeedbackSurvey {
  id: number;
  projectId: number | null;
  projectName: string | null;     // Joined
  clientId: number;
  clientName: string;             // Joined
  surveyType: SurveyType;
  status: SurveyStatus;
  token: string;
  sentAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  reminderSent: boolean;
  response: FeedbackResponse | null;  // Enriched if completed
  createdAt: string;
}

export interface FeedbackResponse {
  id: number;
  surveyId: number;
  overallRating: number;          // 1-5
  npsScore: number;               // 0-10
  communicationRating: number;    // 1-5
  qualityRating: number;          // 1-5
  timelinessRating: number;       // 1-5
  highlights: string | null;
  improvements: string | null;
  testimonialText: string | null;
  testimonialApproved: boolean;
  allowNameUse: boolean;
  submittedAt: string;
}

export interface Testimonial {
  id: number;
  feedbackResponseId: number | null;
  clientId: number;
  clientName: string;
  companyName: string | null;
  projectId: number | null;
  projectName: string | null;     // Joined
  text: string;
  rating: number;                 // 1-5
  status: TestimonialStatus;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface FeedbackAnalytics {
  totalSurveys: number;
  completionRate: number;         // % of sent surveys that were completed
  nps: {
    score: number;                // -100 to +100 (promoters% - detractors%)
    promoters: number;            // NPS 9-10
    passives: number;             // NPS 7-8
    detractors: number;           // NPS 0-6
    totalResponses: number;
  };
  averageRatings: {
    overall: number;
    communication: number;
    quality: number;
    timeliness: number;
  };
  trends: Array<{                 // Monthly trend data
    month: string;                // 'YYYY-MM'
    avgOverall: number;
    npsScore: number;
    responseCount: number;
  }>;
  commonHighlights: string[];     // Extracted themes (simple keyword frequency)
  commonImprovements: string[];
}

export interface SendSurveyRequest {
  clientId: number;
  projectId?: number;
  surveyType: SurveyType;
  expiresInDays?: number;         // Default: 30
}

export interface SubmitSurveyRequest {
  overallRating: number;
  npsScore: number;
  communicationRating: number;
  qualityRating: number;
  timelinessRating: number;
  highlights?: string;
  improvements?: string;
  testimonialText?: string;
  testimonialApproved?: boolean;
  allowNameUse?: boolean;
}
```

#### API Endpoints

```text
-- Admin
POST   /api/admin/feedback/send                  — Send survey to client
GET    /api/admin/feedback/surveys                — All surveys (filterable by status, type)
GET    /api/admin/feedback/responses              — All responses with ratings
GET    /api/admin/feedback/analytics              — NPS score, avg ratings, trends
GET    /api/admin/testimonials                    — List testimonials
POST   /api/admin/testimonials                    — Create testimonial manually
PUT    /api/admin/testimonials/:id                — Update testimonial
DELETE /api/admin/testimonials/:id                — Delete testimonial
PUT    /api/admin/testimonials/:id/publish        — Publish testimonial
PUT    /api/admin/testimonials/:id/feature        — Toggle featured

-- Public (token-based, no auth)
GET    /api/feedback/:token                       — Survey form data (project name, client name, questions)
POST   /api/feedback/:token/submit                — Submit response

-- Client portal
GET    /api/portal/feedback                       — Client's pending/completed surveys

-- Public API (for embeds)
GET    /api/public/testimonials                   — Published testimonials (rate-limited, 60/min)
GET    /api/public/testimonials/featured          — Featured testimonials only
```

**`POST /api/admin/feedback/send` flow:**

1. Generate unique token: `crypto.randomUUID()`
2. Create `feedback_surveys` record with status = 'sent', set `sent_at`, calculate `expires_at`
3. Send email to client:
   - Subject: "We'd love your feedback on {{project_name}}"
   - Body includes link: `{{base_url}}/feedback/{{token}}`
   - Also accessible in-portal at `/feedback`
4. Return created survey

**`POST /api/feedback/:token/submit` flow:**

1. Find survey by token — verify status is 'sent' (not expired, not already completed)
2. Check `expires_at` — if past, return 410
3. Validate `SubmitSurveyRequest` — all ratings are in valid ranges
4. Insert `feedback_responses` record
5. Update survey: status = 'completed', set `completed_at`
6. If `testimonialText` is provided AND `testimonialApproved === true`:
   - Auto-create `testimonials` record with status = 'pending_review'
   - Set `client_name` from client record (or from survey if `allowNameUse === true`)
7. Send notification to admin: "New feedback received for {{project_name}} — Overall: X/5, NPS: Y"
8. Return success

**NPS calculation:**

```typescript
// NPS = % Promoters - % Detractors
// Promoters: NPS score 9-10
// Passives: NPS score 7-8
// Detractors: NPS score 0-6
function calculateNps(responses: FeedbackResponse[]): number {
  const total = responses.length;
  if (total === 0) return 0;
  const promoters = responses.filter(r => r.npsScore >= 9).length;
  const detractors = responses.filter(r => r.npsScore <= 6).length;
  return Math.round(((promoters - detractors) / total) * 100);
}
```

#### Service Layer

**File: `server/services/feedback-service.ts`**

```typescript
class FeedbackService {
  // Surveys
  async sendSurvey(data: SendSurveyRequest): Promise<FeedbackSurvey>
  async listSurveys(filters?: { status?: string; surveyType?: string }): Promise<FeedbackSurvey[]>
  async getSurveyByToken(token: string): Promise<FeedbackSurvey | null>
  async submitResponse(token: string, data: SubmitSurveyRequest): Promise<FeedbackResponse>
  async getClientSurveys(clientId: number): Promise<FeedbackSurvey[]>

  // Analytics
  async getAnalytics(dateRange?: { start: string; end: string }): Promise<FeedbackAnalytics>

  // Testimonials
  async listTestimonials(filters?: { status?: string; featured?: boolean }): Promise<Testimonial[]>
  async createTestimonial(data: Partial<Testimonial>): Promise<Testimonial>
  async updateTestimonial(id: number, data: Partial<Testimonial>): Promise<Testimonial>
  async publishTestimonial(id: number): Promise<Testimonial>
  async toggleFeatured(id: number): Promise<Testimonial>
  async getPublicTestimonials(): Promise<Testimonial[]>
  async getFeaturedTestimonials(): Promise<Testimonial[]>

  // Reminders and expiration
  async sendReminders(): Promise<{ sent: number }>
  async expireOverdue(): Promise<{ expired: number }>
}

export const feedbackService = new FeedbackService();
```

#### React Components

**File: `src/react/features/admin/feedback/FeedbackTable.tsx`**

Admin table showing all surveys.

- Columns: Client, Project, Type, Status, Overall Rating (stars), NPS, Sent, Completed
- Filter by status, survey type
- Row click → detail panel showing full response
- "Send Survey" button

**File: `src/react/features/admin/feedback/FeedbackAnalytics.tsx`**

Analytics dashboard for feedback data.

```typescript
interface FeedbackAnalyticsProps {
  getAuthToken?: () => string | null;
}
```

- NPS score gauge (-100 to +100) with promoter/passive/detractor breakdown
- Average ratings: 5 star displays for each category (overall, communication, quality, timeliness)
- Monthly trend chart (Chart.js line chart): NPS score + avg overall rating over time
- Response rate card: X% of surveys completed
- Common themes: word cloud or simple frequency list of highlights/improvements
- Total surveys sent vs completed

**File: `src/react/features/admin/feedback/TestimonialsTable.tsx`**

Manage testimonials.

- Columns: Client, Project, Rating (stars), Status, Featured (toggle), Published Date
- Status badge: pending_review (yellow), approved (blue), published (green), rejected (red)
- Quick actions: Publish, Feature/Unfeature, Reject
- Preview modal: shows testimonial text with client name as it would appear publicly

**File: `src/react/features/portal/feedback/SurveyForm.tsx`**

Client-facing survey form (accessible in-portal and via email link).

```typescript
interface SurveyFormProps {
  token?: string;                  // For email-link access (unauthenticated)
  surveyId?: number;               // For in-portal access (authenticated)
  getAuthToken?: () => string | null;
  showNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
```

- Project name and context shown at top
- Star rating inputs (1-5) for: Overall, Communication, Quality, Timeliness
- NPS slider (0-10) with labels: "Not likely" to "Very likely"
- Text areas: "What went well?", "What could be better?"
- Testimonial section:
  - "Would you like to share a testimonial?" (optional textarea)
  - "I consent to this being used publicly" checkbox
  - "You may use my name" checkbox
- Submit button
- Thank you screen on completion

**File: `public/feedback.html`** (or server-rendered page)

Standalone feedback page for unauthenticated email-link access. Minimal layout, loads `SurveyForm` component with token from URL.

#### Automation

- `project.completed` event → auto-create and send `project_completion` survey (via `workflow-automations.ts` handler)
- 5-day reminder cron: surveys where `status = 'sent'` and `sent_at < now() - 5 days` and `reminder_sent = 0`
- 30-day expiration cron: surveys where `status = 'sent'` and `expires_at <= now()`
- Auto-create testimonial on submit when client opts in (handled in submit flow above)

#### Edge Cases

- **Client submits survey twice:** `feedback_responses.survey_id` has UNIQUE constraint. Second submit returns 400.
- **Token used after expiry:** Returns 410 Gone with message "This survey has expired."
- **Survey sent for project with no client email:** Validate email exists before creating survey. Reject if no email.
- **Testimonial text but no consent:** Don't create testimonial record. Only create if `testimonialApproved === true`.
- **Admin manually creates testimonial (not from survey):** Supported — `feedbackResponseId` is nullable.
- **NPS with zero responses:** Return NPS = 0, not NaN.

#### Testing

- Unit test: NPS calculation with known inputs (all promoters = +100, all detractors = -100, mixed)
- Unit test: survey submit with testimonial consent → creates testimonial
- Unit test: survey submit without consent → no testimonial created
- Unit test: expired survey submission → 410
- Unit test: duplicate submission → 400
- Integration test: send survey → submit via token → verify response + testimonial created
- Component test: star rating inputs, NPS slider, form validation

---

### 5B. Embeddable Widgets --- COMPLETE

**Problem:** No way to embed contact forms, testimonials, or project status on external sites.

**Status:** COMPLETE (March 17, 2026) -- Migration 128

#### Database Changes

**Migration: `128_embed_configurations.sql`**

Two tables:

- `embed_configurations` — Widget configs with unique token, allowed_domains (comma-separated), JSON config, is_active flag
- `project_status_tokens` — Public tokens for project status badges, linked to project_id

#### Implementation

**Types:** `server/services/embed-types.ts` — WidgetType ('contact_form' | 'testimonials' | 'status_badge'), EmbedConfigRow, EmbedConfiguration, widget config interfaces (ContactFormWidgetConfig, TestimonialWidgetConfig, StatusBadgeWidgetConfig)

**Service:** `server/services/embed-service.ts` — CRUD for embed configurations, token generation/regeneration, project status resolution (completion % from milestones), embed code generation

**Admin routes:** `server/routes/embed/admin.ts` — 7 endpoints (requireAdmin):

```text
GET    /api/embed                          — List all widget configs
POST   /api/embed                          — Create widget config
GET    /api/embed/:id                      — Get single config with embed code
PUT    /api/embed/:id                      — Update config
DELETE /api/embed/:id                      — Deactivate widget
POST   /api/embed/:id/regenerate-token     — Regenerate token
GET    /api/embed/:id/embed-code           — Get embed code HTML
```

**Public routes:** `server/routes/embed/public.ts` — 4 endpoints (no auth, CSRF-exempt):

```text
GET /api/embed/contact-form.js             — Self-contained contact form widget JS
GET /api/embed/testimonials.js             — Testimonial carousel/grid/list widget JS
GET /api/embed/status-badge.js             — Status badge widget JS
GET /api/embed/status/:token               — Project status JSON (name, status, completion %, milestones)
```

Each widget endpoint returns a self-contained JavaScript snippet that:

1. Injects DOM elements with isolated styling
2. Communicates with the API via `fetch`
3. Supports configuration via `data-` attributes on the `<script>` tag

**CSRF:** All embed public endpoints are CSRF-exempt.

**Caching:** Public widget JS responses include 5-minute cache headers.

#### Widget Types

- **Contact Form** — Injects a styled form that POSTs to `/api/intake`. Configurable: brand color, max message length, success message, show/hide company and subject fields.
- **Testimonials** — Renders published testimonials in carousel, grid, or list layout. Configurable: max items, show rating, show project name, auto-rotate interval.
- **Status Badge** — Compact project status display with completion percentage from milestones. Configurable: show percentage, show milestones, light/dark theme.

#### React Components

**Admin:** `src/react/features/admin/embed/EmbedWidgetsManager.tsx` — Table of widget configs with create form, copy embed code to clipboard, regenerate token, deactivate toggle.

**Route:** `/embed-widgets` (admin only)

#### Frontend API Constants

Constants defined in `api-endpoints.ts`:

- `EMBED` — Base path '/api/embed'
- `buildEndpoint`: embedWidget(id), embedWidgetCode(id), embedWidgetRegenerate(id)

---

## Phase 6: AI-Powered Features — COMPLETE

### 6A. AI Proposal Drafting --- COMPLETE

**Problem:** Even with prefill, admin manually writes scope descriptions, feature explanations, and timeline narratives.

#### Implementation

**New dependency:** `@anthropic-ai/sdk` (Anthropic TypeScript SDK)

**File: `server/services/ai-service.ts`**

```typescript
class AiService {
  private client: Anthropic;  // Initialized from ANTHROPIC_API_KEY env var

  async draftProposalScope(context: {
    projectType: string;
    tier: string;
    features: string[];
    budget: number;
    questionnaireResponses: Record<string, string>;
    clientName: string;
  }): Promise<{ scope: string; featureDescriptions: Record<string, string>; timeline: string }>

  async draftEmail(context: {
    purpose: 'follow_up' | 'status_update' | 'request_info' | 'thank_you' | 'custom';
    threadHistory?: string[];
    projectContext?: { name: string; status: string; recentActivity: string[] };
    customPrompt?: string;
  }): Promise<{ subject: string; body: string }>
}

export const aiService = new AiService();
```

**API endpoints:**

```text
POST /api/admin/ai/draft-proposal               — Draft proposal scope from context
POST /api/admin/ai/draft-email                   — Draft email from context
```

**Important:** AI output is always a draft. Admin reviews and edits before using. The UI shows "AI Draft" label and edit controls.

#### Cost Controls and Rate Limiting

**File: `server/config/ai-config.ts`**

```typescript
export const AI_CONFIG = {
  maxTokensPerRequest: 2000,       // Output token limit per API call
  model: 'claude-sonnet-4-5-20250514',  // Use Sonnet for speed/cost; upgrade to Opus for quality
  monthlyBudgetCents: 5000,        // $50/month cap (configurable via env AI_MONTHLY_BUDGET_CENTS)
  dailyRequestLimit: 50,           // Max AI requests per day
  cacheEnabled: true,              // Cache identical requests
  cacheTtlSeconds: 86400,          // 24-hour cache TTL
};
```

**Database — add to migration `129_ai_usage_tracking.sql`:**

```sql
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_type TEXT NOT NULL,       -- 'draft_proposal', 'draft_email', 'search'
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_cents REAL NOT NULL,         -- Calculated from token counts
  cache_hit INTEGER NOT NULL DEFAULT 0,
  entity_type TEXT,                 -- 'proposal', 'email', 'search'
  entity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_log(created_at);
```

**Cost tracking in `ai-service.ts`:**

```typescript
class AiService {
  private async checkBudget(): Promise<void> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const usage = await db.get(
      'SELECT COALESCE(SUM(cost_cents), 0) as total FROM ai_usage_log WHERE created_at >= ?',
      [monthStart.toISOString()]
    );
    if (usage.total >= AI_CONFIG.monthlyBudgetCents) {
      throw new Error('Monthly AI budget exceeded');
    }
  }

  private async checkDailyLimit(): Promise<void> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const count = await db.get(
      'SELECT COUNT(*) as total FROM ai_usage_log WHERE created_at >= ? AND cache_hit = 0',
      [todayStart.toISOString()]
    );
    if (count.total >= AI_CONFIG.dailyRequestLimit) {
      throw new Error('Daily AI request limit reached');
    }
  }

  private async logUsage(data: {
    requestType: string; model: string;
    inputTokens: number; outputTokens: number;
    cacheHit: boolean; entityType?: string; entityId?: number;
  }): Promise<void> {
    // Cost calculation based on model pricing
    const costCents = calculateCost(data.model, data.inputTokens, data.outputTokens);
    await db.run(
      'INSERT INTO ai_usage_log (...) VALUES (...)',
      [data.requestType, data.model, data.inputTokens, data.outputTokens, costCents, data.cacheHit ? 1 : 0, data.entityType, data.entityId]
    );
  }
}
```

**Response caching:** Hash the input context → check cache table → return cached response if match within TTL. Saves API costs for repeated draft requests with same inputs.

**Admin visibility:**

```text
GET /api/admin/ai/usage                — Current month usage: total cost, request count, by type breakdown
GET /api/admin/ai/usage/history        — Monthly usage history
```

Dashboard widget: "AI Usage — $X.XX / $50.00 this month (Y requests)"

#### React Integration

**File: `src/react/features/admin/proposals/ProposalBuilder.tsx`** — add "Draft with AI" button:

```typescript
// In the scope/description section of the proposal builder:
<button
  className="btn-secondary"
  onClick={() => handleAiDraft('scope')}
  disabled={aiLoading || !projectId}
>
  {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
  Draft with AI
</button>

// Handler:
const handleAiDraft = async (section: 'scope' | 'features' | 'timeline') => {
  setAiLoading(true);
  try {
    const response = await fetch('/api/admin/ai/draft-proposal', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, section })
    });
    const data = await response.json();
    // Pre-fill the form field with AI draft, marked with "AI Draft" label
    setScopeText(data.scope);
    setIsAiDraft(true);  // Shows "AI Draft — review before sending" banner
  } catch (err) {
    showNotification('AI drafting failed: ' + err.message, 'error');
  } finally {
    setAiLoading(false);
  }
};
```

- "AI Draft" banner above the text field (dismissible after editing)
- "Regenerate" button to get a new draft
- Tone selector: Professional / Friendly / Technical (sent as parameter)

#### Testing

- Unit test: `checkBudget` blocks when limit exceeded
- Unit test: `checkDailyLimit` blocks when limit exceeded
- Unit test: response caching returns cached result for identical inputs
- Unit test: `logUsage` correctly calculates cost
- Integration test: draft-proposal endpoint returns valid proposal text
- Component test: "Draft with AI" button disabled when loading, shows error on failure

---

### 6B. AI Email Response Drafting --- COMPLETE

Same `ai-service.ts`, different method. Same cost controls apply.

#### API Endpoint

```text
POST /api/admin/ai/draft-email                   — Draft email from context
```

**Request:**

```typescript
interface DraftEmailRequest {
  purpose: 'follow_up' | 'status_update' | 'request_info' | 'thank_you' | 'custom';
  threadId?: number;              // For reply context — fetches recent messages
  projectId?: number;             // For project context
  customPrompt?: string;          // For 'custom' purpose
  tone?: 'professional' | 'friendly' | 'technical';
}
```

**Response:**

```typescript
interface DraftEmailResponse {
  subject: string;
  body: string;                   // Plain text, admin edits before sending
  tokensUsed: number;
  cached: boolean;
}
```

#### React Integration

**In messaging UI:** "Draft with AI" button next to reply textarea.

```text
MessageThread
└── ReplyBox
    ├── TextArea (reply content)
    ├── AiDraftButton              — "Draft Reply" with sparkle icon
    │   └── PurposeSelector        — Dropdown: Follow-up, Status Update, Request Info, Thank You, Custom
    └── SendButton
```

- Clicking "Draft Reply" → selects purpose → calls API → pre-fills textarea
- "AI Draft" label appears above textarea (same pattern as proposal builder)
- Admin edits freely before sending

#### Testing

- Unit test: draft-email with thread context includes recent messages in AI prompt
- Unit test: draft-email with project context includes project status
- Component test: purpose selector, textarea pre-fill, AI Draft label

---

### 6C. Semantic Search --- COMPLETE

**Problem:** Current search is basic text matching across limited fields. Finding "that invoice for the website project from January" requires knowing exact terms.

#### Implementation

**File: `server/services/search-service.ts`** (enhance existing)

For MVP: enhanced keyword search with entity-aware ranking. NOT true embeddings yet — that comes later when query volume justifies the infrastructure.

```text
GET /api/admin/search?q=...&mode=enhanced        — Enhanced search across all entities
```

**Search strategy:**

```typescript
interface SearchResult {
  entityType: 'client' | 'project' | 'invoice' | 'proposal' | 'contract' | 'message' | 'file' | 'lead' | 'task';
  entityId: number;
  title: string;                  // Primary display text
  subtitle: string;               // Secondary context (client name, project name)
  snippet: string;                // Matching text excerpt with highlights
  relevanceScore: number;         // 0-1 ranking
  navigateTab: string;            // Where to go in the portal
  navigateEntityId: string;
}

interface SearchResponse {
  results: SearchResult[];
  groupedResults: Record<string, SearchResult[]>;  // Grouped by entityType
  totalCount: number;
  queryTime: number;              // ms
}
```

**Ranking algorithm:**

```text
1. Exact match on identifier fields (invoice_number, project_code, email) → score 1.0
2. Exact match on name/title fields → score 0.9
3. Partial match on name/title (LIKE '%term%') → score 0.7
4. Match in description/content fields → score 0.5
5. Match in notes/comments → score 0.3
6. Boost for recent entities (created in last 30 days) → +0.1
7. Boost for active/in-progress status → +0.05
```

**Entities searched (priority order):**

```text
1. clients     — email, contact_name, company_name
2. projects    — project_name, project_code, project_type
3. invoices    — invoice_number, notes
4. proposals   — title, description
5. contracts   — content (truncated search)
6. messages    — message_text
7. files       — file_name, label
8. leads       — name, email, company
9. tasks       — title, description
```

**Performance:** Each entity type is queried in parallel with `Promise.allSettled()`. Results merged and sorted by `relevanceScore`. Total query time target: < 200ms.

#### React Components

**File: `src/react/components/SearchModal.tsx`**

Global search modal triggered by `Cmd+K` (Mac) / `Ctrl+K` (Windows).

```typescript
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
}
```

**Component tree:**

```text
SearchModal (portal-rendered overlay)
├── SearchInput                    — Auto-focused text input with magnifying glass icon
│   └── Keyboard hint              — "Cmd+K" badge
├── ResultsList                    — Grouped by entity type
│   ├── ResultGroup                — "Projects (3)", "Invoices (2)", etc.
│   │   └── ResultItem             — Icon + title + subtitle + snippet (highlighted)
│   └── EmptyState                 — "No results for '...'"
├── RecentSearches                 — Shown when input is empty (last 5 searches)
└── KeyboardNavigation             — Arrow keys to navigate, Enter to select, Escape to close
```

**Behavior:**

- Debounced search: 300ms after last keystroke
- Keyboard navigation: arrow up/down to move selection, Enter to navigate
- Results grouped by entity type with collapsible sections
- Each result shows type icon (Lucide), title, subtitle, and highlighted snippet
- Click or Enter navigates to the entity and closes modal
- Recent searches stored in localStorage (last 5 queries)

**Keyboard shortcut registration:**

```typescript
// In PortalLayout.tsx or PortalApp.tsx:
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

#### Testing

- Unit test: ranking algorithm with known inputs — exact match scores higher than partial
- Unit test: parallel entity search doesn't fail if one entity type errors (allSettled)
- Unit test: debounce — multiple rapid queries only fire one API call
- Component test: keyboard navigation (arrow keys, Enter, Escape)
- Component test: result grouping and highlighting
- Performance test: search across 1000+ entities completes in < 200ms

---

## Phase 7: Multi-Currency and Tax Compliance

**Scope:** Lower priority. Can be deferred until international clients are a reality.

### 7A. Multi-Currency Support

**Migration: `128_multi_currency.sql`**

```sql
ALTER TABLE invoices ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE proposal_requests ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE retainers ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';

-- Cached exchange rates (updated daily)
CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(base_currency, target_currency, fetched_at)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies
  ON exchange_rates(base_currency, target_currency, fetched_at DESC);
```

#### TypeScript Interfaces

**File: `server/services/currency-types.ts`**

```typescript
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD'] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];

export interface ExchangeRate {
  baseCurrency: Currency;
  targetCurrency: Currency;
  rate: number;
  fetchedAt: string;
}

export interface CurrencyAmount {
  amount: number;
  currency: Currency;
  amountUsd: number;              // Canonical USD amount for reporting
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$'
};

export const CURRENCY_LOCALES: Record<Currency, string> = {
  USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', CAD: 'en-CA', AUD: 'en-AU', NZD: 'en-NZ'
};
```

#### Service Layer

**File: `server/services/currency-service.ts`**

```typescript
class CurrencyService {
  // Exchange rates (free API: exchangerate.host or similar)
  async fetchRates(): Promise<void>           // Called by daily cron
  async getRate(from: Currency, to: Currency): Promise<number>
  async convertToUsd(amount: number, currency: Currency): Promise<number>

  // Formatting
  formatAmount(amount: number, currency: Currency): string
  // e.g., formatAmount(1234.56, 'EUR') → "€1.234,56"
}

export const currencyService = new CurrencyService();
```

#### Implementation Notes

- Default currency stored in `server/config/business.js` as `DEFAULT_CURRENCY`
- Client table gets `preferred_currency` column (defaults to business default)
- Invoice/proposal creation: currency defaults to client's preferred currency
- All reporting converts to USD (or business default) for consistency
- Frontend: `Intl.NumberFormat` for locale-aware currency display
- Exchange rate cron: daily at 6:00 AM, fetches rates for all supported currencies

### 7B. Tax Jurisdiction Handling

**Same migration (`128_multi_currency.sql`):**

```sql
CREATE TABLE IF NOT EXISTS tax_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  tax_region TEXT,                              -- 'US-CA', 'EU-DE', 'CA-ON', etc.
  tax_exempt INTEGER NOT NULL DEFAULT 0,
  tax_exempt_certificate_file_id INTEGER,
  default_tax_rate REAL DEFAULT 0,              -- 0-100 (percentage)
  tax_type TEXT DEFAULT 'sales_tax'
    CHECK(tax_type IN ('sales_tax', 'vat', 'gst', 'hst', 'none')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (tax_exempt_certificate_file_id) REFERENCES files(id)
);

CREATE INDEX IF NOT EXISTS idx_tax_profiles_client ON tax_profiles(client_id);

-- Common tax presets
CREATE TABLE IF NOT EXISTS tax_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                           -- 'California Sales Tax', 'EU Standard VAT', etc.
  region TEXT NOT NULL,
  tax_type TEXT NOT NULL,
  rate REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### Implementation Notes

- Tax profile per client: auto-applied when creating invoices
- Tax-exempt flag skips tax calculation
- Certificate upload: links to existing file system
- Pre-seed common tax presets: US state sales taxes (top 10 states), EU VAT (standard 20%), Canadian GST/HST
- Invoice tax display: line items can have per-item tax, or invoice-level tax (already supported in schema)
- Tax summary report: aggregate tax collected by region for filing

#### API Endpoints

```text
GET    /api/admin/tax/profiles                   — List all tax profiles
POST   /api/admin/tax/profiles                   — Create tax profile
PUT    /api/admin/tax/profiles/:id               — Update tax profile
DELETE /api/admin/tax/profiles/:id               — Delete tax profile
GET    /api/admin/tax/presets                     — List tax presets
GET    /api/admin/tax/summary                     — Tax collected summary by region
```

#### Testing

- Unit test: currency conversion with known rates
- Unit test: tax application to invoice line items
- Unit test: tax-exempt client → zero tax
- Unit test: currency formatting for each supported locale
- Integration test: create invoice with non-USD currency → verify USD conversion stored

---

## Cross-Cutting Concerns

### Scheduled Task Runner (Cron Consolidation)

By Phase 4 this platform will have 10+ cron jobs. Instead of 10 separate `cron.schedule()` calls scattered across service files, consolidate into a single task runner.

**File: `server/services/scheduled-task-runner.ts`**

```typescript
interface ScheduledTask {
  name: string;
  schedule: string;               // Cron expression
  handler: () => Promise<unknown>;
  enabled: boolean;               // Can be toggled without code change
  lastRun?: string;
  lastResult?: string;
  lastError?: string;
}

class ScheduledTaskRunner {
  private tasks: ScheduledTask[] = [];

  register(task: ScheduledTask): void {
    this.tasks.push(task);
  }

  start(): void {
    for (const task of this.tasks) {
      if (!task.enabled) continue;
      cron.schedule(task.schedule, async () => {
        const start = Date.now();
        try {
          const result = await task.handler();
          task.lastRun = new Date().toISOString();
          task.lastResult = JSON.stringify(result);
          task.lastError = undefined;
          logger.info(`[cron] ${task.name} completed in ${Date.now() - start}ms`, result);
        } catch (err) {
          task.lastError = err.message;
          logger.error(`[cron] ${task.name} failed`, err);
        }
      });
    }
  }

  getStatus(): Array<{ name: string; schedule: string; lastRun?: string; lastError?: string; enabled: boolean }> {
    return this.tasks.map(t => ({
      name: t.name, schedule: t.schedule,
      lastRun: t.lastRun, lastError: t.lastError, enabled: t.enabled
    }));
  }
}

export const taskRunner = new ScheduledTaskRunner();
```

**Registration (in server startup or `app.ts`):**

```typescript
import { taskRunner } from './services/scheduled-task-runner.js';

// Existing tasks
taskRunner.register({ name: 'overdue-invoices', schedule: '0 8 * * *', handler: () => invoiceService.checkOverdue(), enabled: true });
taskRunner.register({ name: 'overdue-installments', schedule: '0 8 * * *', handler: () => paymentScheduleService.checkAndUpdateOverdue(), enabled: true });
taskRunner.register({ name: 'email-retry-queue', schedule: '*/10 * * * *', handler: () => processEmailRetryQueue(), enabled: true });

// Phase 1
taskRunner.register({ name: 'agreement-reminders', schedule: '0 10 * * *', handler: () => agreementService.sendReminders(), enabled: true });
taskRunner.register({ name: 'agreement-expiration', schedule: '0 0 * * *', handler: () => agreementService.expireOverdue(), enabled: true });
taskRunner.register({ name: 'onboarding-nudges', schedule: '30 10 * * *', handler: () => onboardingService.sendNudges(), enabled: true });

// Phase 1B
taskRunner.register({ name: 'auto-pay-process', schedule: '0 8 * * *', handler: () => stripePaymentService.processAutoPay(), enabled: true });
taskRunner.register({ name: 'auto-pay-retry', schedule: '0 9 * * *', handler: () => stripePaymentService.retryFailedAutoPay(), enabled: true });

// Phase 2
taskRunner.register({ name: 'sequence-queue', schedule: '*/30 * * * *', handler: () => sequenceService.processQueue(), enabled: true });
taskRunner.register({ name: 'meeting-reminders', schedule: '0 9 * * *', handler: () => meetingRequestService.sendUpcomingReminders(), enabled: true });

// Phase 3
taskRunner.register({ name: 'automation-scheduled', schedule: '*/5 * * * *', handler: () => automationEngine.processScheduledActions(), enabled: true });

// Phase 4
taskRunner.register({ name: 'retainer-billing', schedule: '0 7 * * *', handler: () => retainerService.processMonthlyBilling(), enabled: true });
taskRunner.register({ name: 'retainer-usage-alerts', schedule: '0 8 * * *', handler: () => retainerService.sendUsageAlerts(), enabled: true });
taskRunner.register({ name: 'retainer-expiration', schedule: '0 0 * * *', handler: () => retainerService.expireEndedRetainers(), enabled: true });

// Phase 5
taskRunner.register({ name: 'feedback-reminders', schedule: '0 10 * * *', handler: () => feedbackService.sendReminders(), enabled: true });
taskRunner.register({ name: 'feedback-expiration', schedule: '0 0 * * *', handler: () => feedbackService.expireOverdue(), enabled: true });

// Phase 6
taskRunner.register({ name: 'ai-cache-cleanup', schedule: '30 3 * * *', handler: () => aiService.cleanupExpiredCache(), enabled: true });

// Phase 7
taskRunner.register({ name: 'exchange-rates', schedule: '0 6 * * *', handler: () => currencyService.fetchRates(), enabled: true });

taskRunner.start();
```

**Admin API:**

```text
GET /api/admin/system/cron-status                — List all tasks with last run time, status, errors
```

Dashboard widget: shows task health at a glance. Red indicator if any task has `lastError`.

---

### Testing Strategy Per Phase

Each phase should ship with tests covering the critical paths. Target: maintain or improve the ~15% coverage baseline with every feature shipped. Focus on service-layer unit tests and critical integration paths.

```text
Phase    | Service Tests  | Integration Tests | Component Tests | Priority
---------|----------------|-------------------|-----------------|----------
1-Pre    | 4 tests        | 1 test            | —               | CRITICAL
1A       | 6 tests        | 2 tests           | 3 tests         | HIGH
1B       | 8 tests        | 3 tests           | 2 tests         | HIGH
1C       | 10 tests       | 4 tests           | 5 tests         | HIGH
1D       | 5 tests        | 2 tests           | 2 tests         | MEDIUM
2A       | 8 tests        | 3 tests           | 3 tests         | HIGH
2B       | 4 tests        | 1 test            | 2 tests         | MEDIUM
3A       | 12 tests       | 4 tests           | —               | HIGH
3B       | —              | —                 | 8 tests         | MEDIUM
4A       | 4 tests        | 2 tests           | 2 tests         | MEDIUM
4B       | 8 tests        | 3 tests           | 3 tests         | HIGH
5A       | 8 tests        | 3 tests           | 4 tests         | MEDIUM
5B       | 3 tests        | 1 test            | —               | LOW
6A-B     | 5 tests        | 1 test            | 2 tests         | MEDIUM
6C       | 4 tests        | 1 test            | 3 tests         | MEDIUM
7        | 5 tests        | 2 tests           | 1 test          | LOW
---------|----------------|-------------------|-----------------|----------
TOTAL    | ~94 tests      | ~33 tests         | ~40 tests       | 167 total
```

**Testing priorities within each phase:**

1. Service-layer business logic (rollover calculations, payment flows, NPS math)
2. API endpoint auth/validation (correct middleware, error codes)
3. Event handler idempotency (calling twice doesn't duplicate)
4. Cron job correctness (scheduled task processes correct items)
5. React form validation and state management

---

## Implementation Priority and Dependencies

```text
Phase 0 (Foundation Fixes — MUST DO BEFORE ANYTHING ELSE)
│   Items removed after verification: 0A, 0H, 0I (proved false)
│
├── CRITICAL (blocks Phase 1):
│   ├── 0B. Client Proposal View + Accept     ← No detail view, no accept UI
│   │   New files: 3 React + 1 route
│   ├── 0C. Maintenance Tier Activation       ← Biggest functional gap
│   │   Migration: 118
│   ├── 0D. Portal Signing Event Bug          ← 1 line fix (missing emit)
│   └── 0G. Installment → Invoice Cascade     ← 1 service method + 1 cron
│
├── HIGH (broken integrations):
│   ├── 0E. Webhook Dispatch (Slack/Discord)  ← 1 new service + event hooks
│   ├── 0F. Email Templates in Automations    ← 1 seed migration + refactor
│   ├── 0K. Admin Invoice Endpoint            ← 1 route file
│   └── 0L. Create Backends (2 entities)      ← Design Reviews POST + Workflows POST
│
├── MEDIUM (UI completeness):
│   ├── 0J. Export/CSV Missing onClick        ← Wire ~15 tables
│   ├── 0M. LeadDetailPanel Wiring            ← 1 import
│   └── 0P. Prefill in Frontend Constants     ← 1 line + builder integration
│
└── LOW (docs + security):
    ├── 0N. Design Docs (CSS_ARCHITECTURE + UX_GUIDELINES)
    └── 0O. Security Hardening (demo scripts, bcrypt, a11y)

Phase 1-Pre (Trivial — Do Immediately After Phase 0)
└── Idempotency guards in workflow-automations.ts
    Migration: none
    New files: 0 (modify existing)
    Effort: ~30 minutes

Phase 1 (Highest Impact)
├── 1A. In-Portal Contract Signing        ← PREREQUISITE for 1C
│   Migration: 119 (renumbered)
│   New files: 5 server + 5 React
│
├── 1B. Embedded Stripe Payments          ← PREREQUISITE for 1C
│   Migration: 120
│   New files: 3 server + 4 React
│   New deps: @stripe/react-stripe-js, @stripe/stripe-js
│
├── 1C. Unified Project Agreement Flow    ← THE BIG PAYOFF (depends on 1A + 1B)
│   Migration: 121
│   New files: 4 server + 8 React
│
└── 1D. Guided Client Onboarding          ← Can parallel with 1C
    Migration: 122
    New files: 3 server + 3 React

Phase 2 (Lead Conversion)
├── 2A. Email Drip Sequences
│   Migration: 123
│   New files: 3 server + 4 React
│
└── 2B. Meeting Request System
    Migration: 124
    New files: 2 server + 5 React

Phase 3 (Admin Power)
├── 3A. Automation Engine (backend)       ← Can be used via API immediately
│   Migration: 125
│   New files: 3 server
│
└── 3B. Automation Builder (frontend)     ← Depends on 3A
    New files: 8 React components

Phase 4 (Revenue Intelligence)
├── 4A. Expense Tracking + Profitability
│   Migration: 126
│   New files: 2 server + 3 React
│
└── 4B. Retainer Management
    Migration: 127
    New files: 3 server + 4 React

Phase 5 (Post-Project)
├── 5A. Feedback + Testimonials
│   Migration: 128
│   New files: 3 server + 6 React
│
└── 5B. Embeddable Widgets
    New files: 2 server + 3 embed scripts

Phase 6 (AI) — COMPLETE
├── 6A. AI Proposal Drafting
│   Migration: 129 (ai_usage_tracking)
│   New files: 3 server + 1 React integration
│   New deps: @anthropic-ai/sdk
│
├── 6B. AI Email Drafting
│   New files: 0 (same service) + 1 React integration
│
└── 6C. Semantic Search
    New files: 1 server enhancement + 1 React modal

Phase 7 (International — Do Last)
├── 7A. Multi-Currency
│   Migration: 129
│   New files: 2 server + 1 React
│
└── 7B. Tax Jurisdictions
    Same migration + 1 server + 1 React
```

**Total new migrations:** 13 (118-130)
**Total new server files:** ~38
**Total new React components:** ~58
**Total new dependencies:** 3 (@stripe/react-stripe-js, @stripe/stripe-js, @anthropic-ai/sdk)
**Total new tests:** ~190

---

## Intentional Exclusions

| Feature | Why Excluded |
|---|---|
| Public booking/scheduling | Admin preference — clients request times, admin confirms manually (covered by 2B Meeting Request System) |
| Mobile app / PWA | Single-admin system — responsive web is sufficient for now |
| Team management / RBAC | Already tracked as future enhancement in CURRENT_WORK.md |
| SMS / text messaging | Adds complexity and cost, email is sufficient |
| White-labeling | Not needed for single-admin use |
| True AI embeddings search | MVP uses enhanced keyword search; embeddings can be added later |

---

## Change Log

### 2026-03-17 — Phase 6 AI-Powered Features Complete

**6A: AI Proposal Drafting + 6B: AI Email Drafting (Migration 129)**

- ai-config.ts: Model selection, monthly budget cap (configurable via env), daily rate limiting, pricing per model, temperature per request type, cache TTL
- ai-types.ts: DraftProposalContext/Result, DraftEmailContext/Result, AiUsageSummary types
- ai-service.ts: Core service with draftProposalScope, draftEmail, getUsageSummary, getUsageHistory, cleanupExpiredCache, isAvailable. SHA-256 response caching, budget enforcement, daily rate limiting
- 2 tables: ai_usage_log (request_type, model, tokens, cost_cents, cache_hit), ai_response_cache (context hash, TTL expiry)
- Admin routes (5 endpoints): POST /api/admin/ai/draft-proposal, POST /api/admin/ai/draft-email, GET /api/admin/ai/usage, GET /api/admin/ai/usage/history, GET /api/admin/ai/status
- Scheduler: 1 cron — AI cache cleanup (daily 3:30 AM)
- New npm dep: @anthropic-ai/sdk

**6C: Enhanced Search + Cmd+K Modal**

- search-service.ts: ENHANCED from 4 to 9 entity types (added proposals, contracts, leads, tasks, files). Relevance scoring algorithm, Promise.allSettled for parallel queries, results sorted by relevance
- SearchModal.tsx: Global Cmd+K search modal with debounced input, keyboard navigation (arrow keys, Enter, Escape), grouped results by entity type, recent searches in localStorage
- PortalLayout.tsx: Integrated SearchModal with useSearchModal hook
- Frontend API constants: AI_DRAFT_PROPOSAL, AI_DRAFT_EMAIL, AI_USAGE, AI_USAGE_HISTORY, AI_STATUS

**Files created:** ~7 (1 migration, 3 server config/services/types, 1 route, 1 React component)
**Files modified:** ~5 (app.ts, api-endpoints.ts, PortalLayout.tsx, search-service.ts, scheduler-service.ts)
**New npm deps:** 1 (@anthropic-ai/sdk)

### 2026-03-17 — Phase 5B Embeddable Widgets Complete

**5B: Embeddable Widgets (Migration 128)**

- embed-service.ts: CRUD for widget configurations, token generation/regeneration, project status resolution (completion % from milestones), embed code generation
- embed-types.ts: WidgetType, EmbedConfigRow, EmbedConfiguration, widget config interfaces (ContactForm, Testimonials, StatusBadge)
- 2 tables: embed_configurations (token, allowed_domains, JSON config, is_active), project_status_tokens (project_id, token, is_active)
- Admin routes (7 endpoints): GET /, POST /, GET /:id, PUT /:id, DELETE /:id, POST /:id/regenerate-token, GET /:id/embed-code
- Public routes (4 endpoints, no auth, CSRF-exempt): GET /contact-form.js, GET /testimonials.js, GET /status-badge.js, GET /status/:token
- React: EmbedWidgetsManager (admin widget config table with create, copy embed code, regenerate token, deactivate)
- Portal route: /embed-widgets (admin only)
- 3 widget types: Contact Form (posts to /api/intake), Testimonials (carousel/grid/list), Status Badge (completion %)

**Files created:** ~5 (1 migration, 2 services/types, 2 route files, 1 React component)
**Files modified:** ~4 (app.ts, api-endpoints.ts, PortalRoutes.tsx, csrf config)

### 2026-03-17 — Phase 5A Feedback Surveys and Testimonial Collection Complete

**5A: Feedback Surveys + Testimonials (Migration 127)**

- feedback-service.ts: 16 methods — survey CRUD, token-based public access, response submission with auto-testimonial creation, analytics (NPS calculation, average ratings, monthly trends), reminder + expiration crons
- feedback-types.ts: TypeScript interfaces and constants (SurveyType, SurveyStatus, TestimonialStatus, FeedbackAnalytics)
- 3 tables: feedback_surveys (token-based email access), feedback_responses (1:1 with star ratings + NPS), testimonials (approval workflow with publish/feature toggles)
- Admin routes (9 endpoints): POST /send survey, GET /surveys, GET /analytics, GET /testimonials, POST /testimonials, PUT /testimonials/:id, DELETE /testimonials/:id, PUT /testimonials/:id/publish, PUT /testimonials/:id/feature
- Portal routes (1 endpoint): GET /my (client's surveys)
- Public routes (4 endpoints, no auth): GET /survey/:token, POST /survey/:token/submit, GET /testimonials/public, GET /testimonials/featured
- CSRF skip for public survey submission and public testimonial reads
- React: FeedbackTable (admin survey list with send form), TestimonialsTable (admin testimonial management), FeedbackAnalytics (NPS gauge + ratings), PortalFeedback (client card view)
- Scheduler: 2 crons — feedback reminders (daily 10 AM), survey expiration (daily midnight)
- Portal routes: /feedback (admin/client), /feedback-analytics (admin), /testimonials (admin)

**Files created:** ~8 (1 migration, 2 services/types, 3 routes, 4 React components)
**Files modified:** ~5 (app.ts, api-endpoints.ts, PortalRoutes.tsx, scheduler-service.ts, csrf config)

### 2026-03-17 — Phase 4 Revenue Intelligence Complete

**4A: Expense Tracking (Migration 125)**

- expense-service.ts: CRUD, soft delete, profitability calculation (invoices + installments - expenses - time cost), analytics by category/month, CSV export
- 9 admin endpoints including profitability and analytics
- ExpensesTable React component with inline create form and filters
- 12 expense categories with labels

**4B: Retainer Management (Migration 126)**

- retainer-service.ts: CRUD, period lifecycle (create -> close -> rollover -> new), auto-invoicing, usage alerts
- Period rollover: unused hours clamped to maxRolloverHours
- Auto-invoicing cron: daily 7AM, creates invoice for retainers where billing_day = today
- Usage alerts cron: daily 8AM, emails admin for retainers >= 80% utilization
- Admin: RetainersTable with utilization bars (green/yellow/red)
- Portal: PortalRetainers card view with utilization + period info
- 10 admin + 2 portal endpoints

**Files created:** ~17 (2 migrations, 4 services/types, 5 routes, 4 React components, 2 feature docs)
**Files modified:** ~5 (app.ts, api-endpoints.ts, PortalRoutes.tsx, scheduler-service.ts)

### 2026-03-17 — Phase 3 Admin Self-Service Automations Complete

**3A: Automation Engine (Migration 124)**

- automation-engine.ts: Full execution engine with 11 action executors, condition evaluation, wait-step scheduling, variable substitution, dry-run mode
- 5 tables: custom_automations, automation_actions, automation_runs, automation_action_logs, automation_scheduled_actions
- Routes: 16 admin endpoints (CRUD + actions + runs + dry-run + run-now)
- Workflow integration: ALL event types routed to automation engine via handleCustomAutomationEvent
- Scheduler: */5 * * * * cron processes scheduled wait-step actions
- 2 seeded templates: New Project Setup, Invoice Follow-Up

**3B: Automation Builder (React)**

- AutomationsTable: Admin table with create form, toggle active, delete, search
- AutomationBuilder: Visual builder with grouped trigger events, condition rows, 11 action config forms
- AutomationDetailPanel: Overview, status toggle, recent runs table, edit/run-now/delete actions

**Files created:** ~10 (1 migration, 2 services/types, 2 routes, 5 React components)
**Files modified:** ~5 (app.ts, api-endpoints.ts, PortalRoutes.tsx, workflow-automations.ts, scheduler-service.ts)

### 2026-03-17 — Phase 2 Lead Nurture Complete

**2A: Email Drip Sequences (Migration 122)**

- sequence-service.ts: CRUD, step management, enrollment, processQueue (batch 50, bounce after 3 fails), handleEvent for auto-enrollment, analytics
- Routes: 15 admin endpoints (sequences + steps + enrollments)
- React: SequencesTable with create, toggle, detail
- 3 seeded sequences: New Lead Welcome, Proposal Follow-Up, Post-Consultation
- Scheduler cron: */30 * * * * (every 30 minutes)
- Workflow integration: 7 events auto-enroll (lead.created, lead.stage_changed, lead.converted, proposal.sent/accepted/rejected, client.created)

**2B: Meeting Request System (Migration 123)**

- meeting-request-service.ts: CRUD, confirm, decline, reschedule, ICS generation, sendUpcomingReminders
- Routes: 3 portal + 7 admin endpoints (including .ics download)
- React: MeetingRequestForm (portal), MeetingRequestsList (portal), MeetingRequestsTable (admin)
- Scheduler cron: 0 9 * * * (daily 9AM reminders for meetings in next 24h)
- ICS generation with valid VCALENDAR format

**Files created:** ~20 (2 migrations, 4 services/types, 5 routes, 8 React components, 2 feature docs)
**Files modified:** ~6 (app.ts, api-endpoints.ts, PortalRoutes.tsx, workflow-automations.ts, scheduler-service.ts)

### 2026-03-17 — Phase 1 Core Implementation Complete

All 4 Phase 1 items implemented (1A verified already working from Phase 0):

**1-Pre: Idempotency Guards**

- Added milestone existence check before generateTierMilestones() in workflow-automations.ts

**1B: Embedded Stripe Payments (Migration 119)**

- stripe-payment-service.ts: getOrCreateCustomer, createPaymentIntent (with processing fee), handlePaymentSuccess/Failure
- Routes: POST /payments/create-intent (requireClient), POST /payments/webhook (signature verification)
- React: StripeProvider, StripePaymentForm with fee breakdown and client responsibility notice
- Processing fee: 2.9% + $0.30 calculated server-side, displayed in form
- CSP updated for Stripe domains, raw body skip for webhook

**1C: Unified Project Agreement Flow (Migration 120)**

- agreement-service.ts: CRUD, template creation (auto-detects entities), step completion, auto-complete
- Routes: 5 admin + 4 portal endpoints
- React: AgreementFlow (vertical card stack, GSAP transitions), 5 step components, AgreementsList
- Workflow integration: contract.signed, invoice.paid, questionnaire.completed auto-complete steps

**1D: Onboarding Checklist (Migration 121)**

- onboarding-checklist-service.ts: template-based creation, auto-complete, dismiss
- Routes: 3 portal + 4 admin endpoints
- React: OnboardingCard dashboard widget with progress bar and step navigation
- 2 seeded templates (Standard Website, Simple Project)
- Workflow integration: same 3 events auto-complete onboarding steps

**Files created:** 35 (3 migrations, 6 services/types, 6 routes, 11 React components, 1 constants, 3 feature docs, 5 doc updates)
**Files modified:** 8 (app.ts, api-endpoints.ts, PortalRoutes.tsx, PortalDashboard.tsx, workflow-automations.ts, workflow-trigger-service.ts, constants.ts, package.json)
**New npm deps:** 2 (@stripe/react-stripe-js, @stripe/stripe-js)

### 2026-03-17 — Phase 0 Implementation Complete

All 12 verified Phase 0 items implemented (3 more proved false during implementation):

**Critical (4/4):**
- 0B: PortalProposalDetail.tsx + /proposals/:id route + accept flow with confirmation
- 0C: Migration 118 + handleMaintenanceActivation handler + recurring invoice creation + GET /projects/:id/maintenance
- 0D: Added workflowTriggerService.emit('contract.signed') to contracts/client.ts (1-line fix)
- 0G: Added generateDueInvoices() to payment-schedule-service + hooked into scheduler

**High (4/4):**
- 0E: dispatchWebhooks() function queries notification_integrations, sends via slack-service.ts, logs delivery
- 0F: loadEmailTemplate() + substituteVariables() — all 7 handlers pass templateSlug, falls back to hardcoded
- 0K: server/routes/admin/invoices.ts (GET list+stats, POST bulk-delete, POST bulk-status) + mounted in admin barrel
- 0L: POST /api/admin/design-reviews (+ create() on service) + POST /api/admin/workflows

**Medium (3/3):**
- 0J: Wired useExport to 9 tables, created 6 new export configs (Contracts, Questionnaires, Workflows, GlobalTasks, AdHocRequests, Deliverables)
- 0M: Proved false — LeadDetailPanel already imported and rendered in LeadsTable
- 0P: Added PROPOSALS_PREFILL + ADMIN.INVOICES to api-endpoints.ts

**Low (2/2):**
- 0N: Proved false — CSS_ARCHITECTURE.md (836 lines) and UX_GUIDELINES.md (69 lines) already exist
- 0O: Demo/test scripts now require env vars for passwords, bcrypt standardized to 12 rounds in intake.ts

**Files created:** 3 (migration, admin invoices route, PortalProposalDetail.tsx)
**Files modified:** ~25 (workflow-automations.ts, 9 table exports, routes, services, types, constants)

### 2026-03-16 — Verification Pass (Plan vs Actual Code)

Audited every Phase 0 claim against actual code with file paths and line numbers.

**Removed (proved false):**
- ~~0A: "4 orphaned services with no routes"~~ — All 4 have routes in projects/core.ts (lines 468-906) and proposals/core.ts (line 468). Services use dynamic import() and are fully wired.
- ~~0H: "7 broken delete buttons"~~ — All 7 work. Verified onClick handlers with API calls and confirm dialogs at: ProposalsTable:537, EmailTemplatesManager:339, DocumentRequestsTable:550, AdHocRequestsTable:591, DeliverablesTable:551, ArticlesTable:394, CategoriesTable:313.
- ~~0I: "Portal prop passing broken"~~ — LazyTabRoute injects props via React.cloneElement(). PaymentScheduleView uses context-based auth. console.log is in JSDoc comment only.

**Corrected:**
- 0D: Upgraded from "verify" to **confirmed bug** — portal signing at contracts/client.ts:191-273 saves signature but missing `workflowTriggerService.emit('contract.signed')`. Email-link signing at projects/contracts.ts:918 works fully. 1-line fix identified.
- 0L: Reduced from 4 broken to **2 broken** — Deliverables (admin/deliverables.ts:42-71) and Questionnaires (questionnaires/admin.ts:193-228) work. Only Design Reviews (no POST endpoint) and Workflows (no POST endpoint) are actually broken.
- 0J: Corrected from "all 22 broken" to **mixed** — InvoicesTable:357 has working `onClick={exportCsv}`. ContactsTable:389 missing onClick. ~15 tables need wiring.

**Confirmed (unchanged):**
- 0B: Client proposal route redirects to /documents (PortalRoutes.tsx:325-330). No ProposalDetail.tsx exists. No accept UI.
- 0C: maintenance_option read at workflow-automations.ts:105-107 then discarded. Not stored in projects table. No recurring invoices created.
- 0E: slack-service.ts has sendSlackNotification() and sendDiscordNotification() (lines 409-458) but workflow-automations.ts never calls them.
- 0F: All 7 notification handlers (lines 722-941) use hardcoded HTML. Zero queries to email_templates table.
- 0G: No generateDueInvoices() or createFromInstallment() exists anywhere. Payment schedule service only creates/marks installments.

Phase 0 reduced from 16 items to **12 verified items**.

### 2026-03-16 — Deep Audit Pass (5 parallel audits)

- **Client Portal audit:** 22/22 features verified working. PortalContracts has ContractSignModal (0D may already work). Minor gaps: project detail messages read-only, some prop passing issues.
- **Admin Features audit:** Found Export/CSV broken on ALL 22 tables (0J). 4 create modals have no backend endpoints (0L). LeadDetailPanel orphaned (0M). No admin invoice endpoint (0K). Analytics mostly table-based, limited chart visualization.
- **Security audit:** Overall 8.5/10. HIGH: demo scripts with hardcoded passwords, bcrypt rounds inconsistency. MEDIUM: CSRF token reuse, race conditions in file uploads. All parameterized SQL, proper auth middleware, strong rate limiting.
- **API audit:** 190+ endpoints mapped. Missing `/api/admin/invoices`. Prefill endpoint not in frontend constants. Minor REST inconsistencies (v1 vs api prefix).
- **Design/CSS/Docs audit:** 843 CSS variables healthy. 40 inline styles all acceptable. Missing CSS_ARCHITECTURE.md and UX_GUIDELINES.md (mandated by CLAUDE.md). ~10 form inputs without labels. 1 orphaned component (LeadDetailPanel).
- Added Phase 0 items: 0J (Export/CSV), 0K (Admin Invoices), 0L (Create Modal Backends), 0M (LeadDetailPanel), 0N (Design Docs), 0O (Security), 0P (Prefill Constants)
- Phase 0 now has 16 items categorized by priority: 5 Critical, 4 High, 5 Medium, 2 Low

### 2026-03-16 — Codebase Audit + Phase 0

- Added Phase 0: Foundation Fixes (9 items) based on full codebase audit
- 0A: 4 orphaned services (prefill, dynamic questionnaire, intake checklist, project completion) need API routes
- 0B: Client proposal view + acceptance UI — backend exists, zero frontend
- 0C: Maintenance tier activation — 4 tiers defined, priced, stored, displayed on PDF, **then completely ignored**. No recurring invoices, no contracts, no post-project automation. Added full implementation plan with migration, workflow handler, and client portal component
- 0D: Contract signing email-link flow needs verification
- 0E: Slack/Discord webhook configs stored but messages never dispatched
- 0F: workflow-automations.ts hardcodes all emails instead of using DB template system
- 0G: Payment schedule installments never auto-generate invoices
- 0H: 7 admin table delete buttons render with no onClick handlers
- 0I: Portal prop passing broken in RequestsHub, PaymentScheduleView
- Renumbered all migrations (118 = maintenance activation, 119-130 = new features)
- Updated totals: 13 migrations, ~38 server files, ~58 React components, ~190 tests

### 2026-03-16 — Refinement Pass

- Added Phase 1-Pre: idempotency guards for workflow automations (must-do-first)
- Split Phase 3 into 3A (engine, backend) and 3B (builder, frontend)
- Added cron consolidation: `ScheduledTaskRunner` pattern with admin status endpoint
- Added AI cost controls: monthly budget cap, daily request limit, response caching, usage tracking (migration 129)
- Fleshed out Phase 4B (retainers): full TypeScript interfaces, service methods, rollover calculation, React components, edge cases
- Fleshed out Phase 5A (feedback): full TypeScript interfaces, NPS calculation, survey flow, testimonial management, analytics dashboard
- Fleshed out Phase 6C (search): ranking algorithm, parallel entity search, Cmd+K modal with keyboard navigation
- Fleshed out Phase 7: currency service, exchange rates table, tax presets, full API endpoints
- Added testing strategy: ~167 tests across all phases with priority matrix
- Added testing section to every phase (1A through 7)
- Added edge cases to phases that were missing them (2B, 4A)
- Total migrations updated: 12 (118-129)

### 2026-03-16 — Initial Roadmap

- Created roadmap from state-of-the-art gap analysis
- 7 phases, 15 features defined with full implementation detail
- 11 migrations planned (118-128)
- Priority order based on client friction reduction + revenue impact
- Meeting request system designed instead of public booking (per admin preference)
