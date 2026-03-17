# API Documentation Index

Full API reference is in [`/docs/API_DOCUMENTATION.md`](../API_DOCUMENTATION.md).

## Authentication

The API uses HttpOnly JWT cookies for authentication.

- Cookies are set automatically on login; all requests must include `credentials: 'include'`
- `getAuthToken()` always returns `null` — token access from JavaScript is intentionally blocked (HttpOnly)
- Bearer token header is supported as a fallback for API clients that cannot use cookies
- Admin tokens expire in 1 hour; client tokens expire in 7 days

See the [Authentication section](../API_DOCUMENTATION.md#authentication) in the full reference for cookie
properties and the JWT payload structure.

## Quick-Reference Index

### Authentication

- `POST /auth/login` — Authenticate and receive HttpOnly cookie
- `POST /auth/logout` — Clear auth cookie
- `GET /auth/me` — Get current user info

### Admin

- `GET /admin/stats` — Dashboard statistics
- `GET /admin/activity` — Recent activity feed
- `GET /admin/leads` — Lead management
- `GET /admin/clients` — Client list
- `GET /admin/projects` — Project list
- `GET /admin/invoices` — All invoices with stats (Phase 0K)
- `POST /admin/invoices/bulk-delete` — Bulk soft-delete invoices
- `POST /admin/invoices/bulk-status` — Bulk status change
- `POST /admin/design-reviews` — Create design review (Phase 0L)
- `POST /admin/workflows` — Create workflow trigger (Phase 0L)

### Client Self-Service (`/clients/me/...`)

- `GET /clients/me/dashboard` — Dashboard data (projects, stats, action items)
- `GET /clients/me/projects` — Client's projects
- `GET /clients/me/messages` — Message threads
- `GET /clients/me/files` — Uploaded files
- `GET /clients/me/invoices` — Invoice history
- `GET /proposals/my` — Client's proposals
- `GET /proposals/:id` — Proposal detail (client can view if they own it)
- `POST /proposals/:id/accept` — Accept proposal (triggers project creation cascade)
- `GET /contracts/my` — Client's contracts
- `POST /contracts/sign` — Sign contract in portal (emits contract.signed event)

### Client Management (Admin)

- `GET /clients` — All clients
- `POST /clients` — Create client
- `GET /clients/:id` — Client detail
- `PUT /clients/:id` — Update client
- `DELETE /clients/:id` — Delete client

### Project Management

- `GET /projects` — All projects
- `POST /projects` — Create project
- `GET /projects/:id` — Project detail
- `PUT /projects/:id` — Update project
- `GET /projects/:id/milestones` — Project milestones
- `GET /projects/:id/tasks` — Project tasks
- `GET /projects/:id/completion-status` — Check project completion readiness
- `POST /projects/:id/complete` — Mark project as completed
- `GET /projects/:id/intake-checklist` — Get intake information checklist
- `POST /projects/:id/request-info` — Request missing info from client
- `POST /projects/:id/generate-questionnaire` — Generate custom questionnaire from missing info
- `GET /projects/:id/maintenance` — Get maintenance plan status (Phase 0C)

### File Management

- `POST /uploads/single` — Upload a single file
- `POST /uploads/multiple` — Upload up to 5 files
- `POST /uploads/avatar` — Upload avatar (images only)
- `POST /uploads/project/:projectId` — Upload project files
- `GET /files` — List files
- `DELETE /files/:id` — Delete file

### Messaging

- `GET /messages/threads` — List message threads
- `POST /messages/threads` — Create thread
- `GET /messages/threads/:id` — Thread messages
- `POST /messages/threads/:id/messages` — Send message

### Invoices

- `GET /invoices` — All invoices
- `POST /invoices` — Create invoice
- `GET /invoices/:id` — Invoice detail
- `PUT /invoices/:id` — Update invoice
- `POST /invoices/:id/payments` — Record payment

### Proposals

- `GET /proposals` — All proposals
- `POST /proposals` — Create proposal
- `GET /proposals/:id` — Proposal detail
- `POST /proposals/:id/sign` — Sign proposal
- `GET /proposals/prefill/:projectId` — Get proposal prefill data from questionnaires
- `POST /proposals/:id/accept` — Client accepts a proposal
- `POST /proposals/from-template` — Create proposal from template + budget

### Analytics

- `GET /analytics/overview` — Business overview metrics
- `GET /analytics/revenue` — Revenue breakdown
- `GET /analytics/projects` — Project statistics

### Payment Schedules

- `GET /payment-schedules?projectId=X` — List installments by project
- `GET /payment-schedules/overdue` — Overdue installments
- `POST /payment-schedules` — Create schedule (batch of installments)
- `POST /payment-schedules/from-split` — Create from percentage split
- `POST /payment-schedules/:id/mark-paid` — Mark installment as paid
- `GET /payment-schedules/my` — Client's installments
- `GET /payment-schedules/my/summary` — Client payment summary

### Content Requests

- `GET /content-requests` — List checklists (admin)
- `GET /content-requests/overview` — Admin overview with completion stats
- `POST /content-requests` — Create checklist (with items or from template)
- `POST /content-requests/items/:id/accept` — Accept submitted item
- `POST /content-requests/items/:id/request-revision` — Request revision
- `GET /content-requests/my` — Client's checklists
- `POST /content-requests/items/:id/submit-text` — Submit text content
- `POST /content-requests/items/:id/submit-file` — Submit file
- `POST /content-requests/items/:id/submit-url` — Submit URL
- `POST /content-requests/items/:id/submit-data` — Submit structured data
- `GET/POST /content-requests/templates` — Template CRUD

### JSON Export / Import

- `GET /projects/:id/export-milestones` — Export milestones + tasks as JSON
- `POST /projects/:id/import-milestones` — Import milestones + tasks from JSON
- `GET /proposals/:id/export` — Export full proposal data as JSON
- `GET /contracts/:contractId/export` — Export contract + signatures as JSON

### Admin Config

- `GET /admin/config/tier-milestones` — Export tier milestone config
- `GET /admin/config/default-tasks` — Export default-tasks.json
- `POST /admin/config/default-tasks` — Update default-tasks.json
- `GET /admin/config/tier-tasks` — Export tier-tasks.json
- `POST /admin/config/tier-tasks` — Update tier-tasks.json

### Embedded Payments (Phase 1B)

- `POST /payments/create-intent` — Create PaymentIntent for invoice/installment (requireClient, returns clientSecret + fee breakdown)
- `POST /payments/webhook` — Stripe webhook for PaymentIntent events (no JWT, signature verification)

### Project Agreements (Phase 1C)

- `GET /agreements` — List agreements (admin, filter by ?projectId=)
- `POST /agreements` — Create agreement with custom steps (admin)
- `POST /agreements/from-template` — Create from template with auto-entity detection (admin)
- `POST /agreements/:id/send` — Send agreement to client (admin)
- `POST /agreements/:id/cancel` — Cancel agreement (admin)
- `GET /agreements/my` — Client's agreements (requireClient)
- `GET /agreements/:id` — Enriched agreement with step entity data
- `POST /agreements/:id/view` — Record client view (requireClient)
- `POST /agreements/steps/:stepId/complete` — Complete a step (requireClient)

### Onboarding Checklist (Phase 1D)

- `GET /onboarding-checklist/my` — Active checklist with steps and progress (requireClient)
- `POST /onboarding-checklist/dismiss` — Dismiss checklist (requireClient)
- `POST /onboarding-checklist/steps/:id/complete` — Complete a step (requireClient)
- `GET /onboarding-checklist/admin/all` — List all checklists (requireAdmin)
- `GET /onboarding-checklist/admin/templates` — List templates (requireAdmin)
- `POST /onboarding-checklist/admin/create` — Create for a project (requireAdmin)
- `GET /onboarding-checklist/admin/:id` — Checklist detail (requireAdmin)

### Email Sequences (Phase 2A)

- `GET /sequences` — List all sequences with enrollment stats (requireAdmin)
- `POST /sequences` — Create sequence with steps (requireAdmin)
- `GET /sequences/:id` — Get with full steps (requireAdmin)
- `PUT /sequences/:id` — Update sequence (requireAdmin)
- `DELETE /sequences/:id` — Delete sequence (requireAdmin)
- `POST /sequences/:id/steps` — Add step (requireAdmin)
- `PUT /sequences/:id/steps/:stepId` — Update step (requireAdmin)
- `DELETE /sequences/:id/steps/:stepId` — Delete step (requireAdmin)
- `PUT /sequences/:id/steps/reorder` — Reorder steps (requireAdmin)
- `GET /sequences/:id/enrollments` — List enrollments (requireAdmin)
- `POST /sequences/:id/enroll` — Manual enroll (requireAdmin)
- `POST /sequences/enrollments/:id/stop` — Stop enrollment (requireAdmin)
- `POST /sequences/enrollments/:id/pause` — Pause enrollment (requireAdmin)
- `POST /sequences/enrollments/:id/resume` — Resume enrollment (requireAdmin)
- `GET /sequences/:id/analytics` — Step metrics (requireAdmin)

### Meeting Requests (Phase 2B)

- `POST /meeting-requests` — Submit request (requireClient)
- `GET /meeting-requests/my` — Client's requests (requireClient)
- `POST /meeting-requests/:id/cancel` — Cancel request (requireClient)
- `GET /meeting-requests` — All requests (requireAdmin, filter by ?status=)
- `GET /meeting-requests/:id` — Single request (requireAdmin)
- `POST /meeting-requests/:id/confirm` — Confirm meeting (requireAdmin)
- `POST /meeting-requests/:id/decline` — Decline with reason (requireAdmin)
- `POST /meeting-requests/:id/reschedule` — Counter-propose times (requireAdmin)
- `POST /meeting-requests/:id/complete` — Mark completed (requireAdmin)
- `GET /meeting-requests/:id/ics` — Download .ics file (requireAdmin)

### Custom Automations (Phase 3)

- `GET /automations` — List automations with run stats (requireAdmin)
- `POST /automations` — Create automation with actions (requireAdmin)
- `GET /automations/:id` — Get with full actions (requireAdmin)
- `PUT /automations/:id` — Update automation (requireAdmin)
- `DELETE /automations/:id` — Delete automation (requireAdmin)
- `PUT /automations/:id/activate` — Activate (requireAdmin)
- `PUT /automations/:id/deactivate` — Deactivate (requireAdmin)
- `POST /automations/:id/actions` — Add action (requireAdmin)
- `PUT /automations/:id/actions/:actionId` — Update action (requireAdmin)
- `DELETE /automations/:id/actions/:actionId` — Delete action (requireAdmin)
- `PUT /automations/:id/actions/reorder` — Reorder actions (requireAdmin)
- `GET /automations/:id/runs` — Execution history (requireAdmin)
- `GET /automations/runs/:runId/logs` — Per-action logs (requireAdmin)
- `POST /automations/:id/dry-run` — Test without executing (requireAdmin)
- `POST /automations/:id/run-now` — Manual trigger (requireAdmin)

### Expenses (Phase 4A)

- `GET /expenses` — List expenses (requireAdmin, filter by project/category/date)
- `POST /expenses` — Create expense (requireAdmin)
- `GET /expenses/:id` — Single expense (requireAdmin)
- `PUT /expenses/:id` — Update expense (requireAdmin)
- `DELETE /expenses/:id` — Soft delete (requireAdmin)
- `GET /expenses/profitability/:projectId` — Project profitability (requireAdmin)
- `GET /expenses/profitability` — All projects profitability (requireAdmin)
- `GET /expenses/analytics` — Expense breakdown (requireAdmin)
- `GET /expenses/analytics/export` — CSV download (requireAdmin)

### Retainers (Phase 4B)

- `GET /retainers` — List all retainers (requireAdmin)
- `POST /retainers` — Create retainer (requireAdmin)
- `GET /retainers/summary` — Aggregate stats (requireAdmin)
- `GET /retainers/:id` — Single with current period (requireAdmin)
- `PUT /retainers/:id` — Update (requireAdmin)
- `DELETE /retainers/:id` — Cancel (requireAdmin)
- `GET /retainers/:id/periods` — Period history (requireAdmin)
- `POST /retainers/:id/close-period` — Close + create next (requireAdmin)
- `POST /retainers/:id/pause` — Pause (requireAdmin)
- `POST /retainers/:id/resume` — Resume (requireAdmin)
- `GET /retainers/my` — Client's retainers (requireClient)
- `GET /retainers/my/:id` — Single retainer (requireClient)

### Other Feature Areas

- Questionnaires: `GET/POST /questionnaires`
- Document Requests: `GET/POST /document-requests`
- Ad Hoc Requests: `GET/POST /adhoc-requests`
- Knowledge Base: `GET/POST /knowledge-base`
- Contracts: `GET/POST /contracts`
- Receipts: `GET /receipts`
- Workflows: `GET/POST /workflows`

See [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md) for full request/response schemas.
