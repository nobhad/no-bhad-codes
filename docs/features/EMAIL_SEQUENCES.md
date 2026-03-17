# Email Drip Sequences

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Automated email sequences that trigger on system events (lead created, proposal sent, etc.) and send timed follow-up emails. Prevents leads from going cold with zero manual effort.

## Architecture

### Data Flow

1. Workflow event fires (e.g., `lead.created`)
2. `handleSequenceEvent` in workflow-automations resolves entity info (email, name, type)
3. `sequenceService.handleEvent()` finds active sequences matching the trigger event
4. Evaluates trigger conditions against event context
5. Enrolls entity if not already enrolled
6. Sets `next_send_at` based on first step's `delay_hours`
7. Scheduler cron (every 30 min) calls `processQueue()`:
   - Finds enrollments where `next_send_at <= now`
   - Evaluates stop conditions per step
   - Sends email via `emailService` (using template or overrides)
   - Logs to `sequence_send_logs`
   - Advances to next step or marks completed
   - After 3 failures on same step: stops enrollment as 'bounced'

### Database Tables

- `email_sequences` — Sequence definitions (name, trigger_event, trigger_conditions, is_active)
- `sequence_steps` — Ordered steps (delay_hours, email_template_id, subject/body overrides, stop_conditions)
- `sequence_enrollments` — Active enrollments (entity, current step, next_send_at, status)
- `sequence_send_logs` — Per-step send history (status: sent/failed/bounced/opened/clicked)

### Seeded Sequences

1. **New Lead Welcome** (lead.created) — 3 emails at 0h, 48h, 120h
2. **Proposal Follow-Up** (proposal.sent) — 3 emails at 72h, 168h, 336h
3. **Post-Consultation** (lead.stage_changed, condition: qualified) — 2 emails at 24h, 96h

### API Endpoints (Admin)

- `GET /api/sequences` — List all with enrollment stats
- `POST /api/sequences` — Create sequence with steps
- `GET /api/sequences/:id` — Get with full steps
- `PUT /api/sequences/:id` — Update sequence
- `DELETE /api/sequences/:id` — Delete (stops enrollments)
- `POST /api/sequences/:id/steps` — Add step
- `PUT /api/sequences/:id/steps/:stepId` — Update step
- `DELETE /api/sequences/:id/steps/:stepId` — Delete step
- `PUT /api/sequences/:id/steps/reorder` — Reorder
- `GET /api/sequences/:id/enrollments` — List enrollments
- `POST /api/sequences/:id/enroll` — Manual enroll
- `POST /api/sequences/enrollments/:id/stop|pause|resume` — Manage enrollment
- `GET /api/sequences/:id/analytics` — Step-by-step metrics

### Scheduler

- Cron: `*/30 * * * *` (every 30 minutes)
- Batch size: 50 enrollments per run
- Bounce detection: 3 failures on same step

## Key Files

- `server/services/sequence-service.ts` — Full service (CRUD, enrollment, processing, analytics)
- `server/services/sequence-types.ts` — TypeScript interfaces
- `server/routes/sequences/admin.ts` — Admin API routes
- `server/database/migrations/122_email_sequences.sql` — Schema + seed data
- `src/react/features/admin/sequences/SequencesTable.tsx` — Admin table UI

## Change Log

### 2026-03-17 — Initial Implementation

- Email sequence engine with auto-enrollment from workflow events
- Scheduler-based queue processing with retry + bounce detection
- Admin CRUD for sequences, steps, enrollments
- 3 seeded default sequences
- Admin React table with create, toggle, detail views
