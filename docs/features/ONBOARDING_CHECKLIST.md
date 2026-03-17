# Onboarding Checklist

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Post-agreement onboarding checklist displayed as a dashboard widget. Guides clients through getting-started steps (sign contract, pay deposit, upload assets, etc.) with auto-completion when workflow events fire.

## Architecture

### Components

- `OnboardingCard.tsx` — Dashboard widget with progress bar, step list, Lucide icons, dismiss, navigate buttons

### Data Flow

1. Admin creates checklist for a project (`POST /api/onboarding-checklist/admin/create`)
2. Service picks template matching project type (or default), resolves entity IDs
3. Client sees `OnboardingCard` at top of dashboard (renders when active checklist exists)
4. Steps auto-complete when matching events fire (contract signed, invoice paid, questionnaire completed)
5. Manual steps (e.g., "Upload Assets") have a "Done" button
6. Navigation steps have a "Go" button that routes to the relevant portal tab
7. When all steps complete, checklist status set to `completed`
8. Client can dismiss the checklist with the X button

### Step Auto-Completion

Workflow events auto-complete matching steps:

- `contract.signed` → completes steps with `entity_type = 'contract'`
- `invoice.paid` → completes steps with `entity_type = 'invoice'`
- `questionnaire.completed` → completes steps with `entity_type = 'questionnaire'`

This is handled by `handleAutoCompleteOnboardingStep` in `workflow-automations.ts`.

### Database Tables

- `onboarding_checklists` — Checklist per project (status: active/completed/dismissed)
- `onboarding_steps` — Steps with entity references, auto-detect flag, navigation config
- `onboarding_templates` — Seeded templates (Standard Website, Simple Project)

### Seeded Templates

**Standard Website** (default):

1. Review Your Proposal (auto-detect: proposal)
2. Sign Your Contract (auto-detect: contract)
3. Pay Deposit (auto-detect: invoice)
4. Complete Project Questionnaire (auto-detect: questionnaire)
5. Upload Brand Assets (manual, navigates to files tab)

**Simple Project:**

1. Sign Your Contract (auto-detect: contract)
2. Pay Deposit (auto-detect: invoice)
3. Complete Questionnaire (auto-detect: questionnaire)

### API Endpoints

**Client (Portal):**

- `GET /api/onboarding-checklist/my` — Active checklist with steps and progress
- `POST /api/onboarding-checklist/dismiss` — Hide checklist
- `POST /api/onboarding-checklist/steps/:id/complete` — Manual step completion

**Admin:**

- `GET /api/onboarding-checklist/admin/all` — List all checklists
- `GET /api/onboarding-checklist/admin/templates` — List templates
- `POST /api/onboarding-checklist/admin/create` — Create for a project
- `GET /api/onboarding-checklist/admin/:id` — Checklist detail

### Dashboard Integration

`OnboardingCard` is rendered in `PortalDashboard.tsx` between the project progress panel and the stats grid. It only renders when an active checklist exists for the client.

## Key Files

- `server/services/onboarding-checklist-service.ts` — CRUD, auto-complete, template resolution
- `server/services/onboarding-checklist-types.ts` — TypeScript interfaces
- `server/routes/onboarding-checklist/portal.ts` — Client routes
- `server/routes/onboarding-checklist/admin.ts` — Admin routes
- `src/react/features/portal/onboarding-checklist/OnboardingCard.tsx` — Dashboard widget
- `server/database/migrations/121_onboarding_checklists.sql` — Schema + seed data

## Change Log

### 2026-03-17 — Initial Implementation

- Created onboarding checklist system with template-based creation
- Dashboard widget with progress bar and step navigation
- Auto-complete integration with workflow events
- Two seeded templates (Standard Website, Simple Project)
- Admin CRUD endpoints
