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

### Other Feature Areas

- Questionnaires: `GET/POST /questionnaires`
- Document Requests: `GET/POST /document-requests`
- Ad Hoc Requests: `GET/POST /adhoc-requests`
- Knowledge Base: `GET/POST /knowledge-base`
- Contracts: `GET/POST /contracts`
- Receipts: `GET /receipts`
- Workflows: `GET/POST /workflows`

See [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md) for full request/response schemas.
