# Project Agreements

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

The unified project agreement flow combines proposal review, contract signing, deposit payment, and questionnaire completion into a single step-by-step experience. Clients complete everything in one session instead of 3-4 separate round-trips.

## Architecture

### Components

- `AgreementFlow.tsx` — Vertical card stack layout (NOT horizontal wizard). Active step expanded, completed steps show summary, future steps locked. GSAP transitions.
- `AgreementHeader.tsx` — Title + progress dots
- `AgreementsList.tsx` — Client list view with progress bars
- Step components in `steps/`:
  - `CustomMessageStep.tsx` — Welcome/info text + "Continue"
  - `ProposalReviewStep.tsx` — Proposal summary + "Approve" (calls proposal accept API)
  - `ContractSignStep.tsx` — Reuses `ContractSignModal` pattern
  - `DepositPaymentStep.tsx` — Embeds `StripePaymentForm`
  - `QuestionnaireStep.tsx` — Links to questionnaire with "Go" button

### Data Flow

1. Admin creates agreement from template (`POST /api/agreements/from-template`)
2. Service auto-detects proposal, contract, invoice, questionnaire for the project
3. Admin sends agreement (`POST /api/agreements/:id/send`) — marks first step active
4. Client opens agreement — records view, sees vertical card stack
5. Client completes each step in order (some auto-complete via webhooks)
6. When all steps done, agreement status set to `completed`, workflow event emitted

### Step Auto-Completion

Steps auto-complete when matching workflow events fire:

- `contract.signed` → completes `contract_sign` steps
- `invoice.paid` → completes `deposit_payment` steps
- `questionnaire.completed` → completes `questionnaire` steps

This is handled by `handleAutoCompleteAgreementStep` in `workflow-automations.ts`.

### Database Tables

- `project_agreements` — Agreement metadata (project, client, status, steps config)
- `agreement_steps` — Individual steps (type, order, status, entity reference)

### API Endpoints

**Admin:**

- `GET /api/agreements` — List agreements (filter by ?projectId=)
- `POST /api/agreements` — Create with custom steps
- `POST /api/agreements/from-template` — Auto-detect entities from project
- `POST /api/agreements/:id/send` — Send to client
- `POST /api/agreements/:id/cancel` — Cancel

**Client (Portal):**

- `GET /api/agreements/my` — Client's agreements
- `GET /api/agreements/:id` — Enriched agreement with step entity data
- `POST /api/agreements/:id/view` — Record view
- `POST /api/agreements/steps/:stepId/complete` — Complete a step

### Portal Routes

- `/agreements` — Client agreement list
- `/agreements/:id` — Agreement flow (step-by-step)

## Key Files

- `server/services/agreement-service.ts` — CRUD, template creation, step completion, auto-complete
- `server/services/agreement-types.ts` — TypeScript interfaces
- `server/routes/agreements/admin.ts` — Admin routes
- `server/routes/agreements/portal.ts` — Client routes
- `src/react/features/portal/agreements/AgreementFlow.tsx` — Main React component
- `server/database/migrations/120_project_agreements.sql` — Schema

## Change Log

### 2026-03-17 — Initial Implementation

- Created unified agreement flow (proposal + contract + payment + questionnaire)
- Vertical card stack layout with GSAP animations
- Template-based creation with auto-entity detection
- Auto-complete integration with workflow events
- Enriched API returns entity data for each step
