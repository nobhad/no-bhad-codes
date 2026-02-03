# CRM / CMS Deep Dive: Implemented vs State of the Art

**Date:** January 28, 2026  
**Purpose:** Compare the no-bhad-codes client management system to modern CRM/CMS and client-portal software, and identify gaps that would make it state of the art.

**Portal-only deep dive:** For a full audit of the **client portal** (every view, static vs API-driven, and portal-specific gaps), see [CLIENT_PORTAL_DEEP_DIVE.md](./CLIENT_PORTAL_DEEP_DIVE.md).

---

## 1. What You Have (Implemented)

### 1.1 CRM-Oriented Features

| Area | Implemented | Notes |
|------|-------------|-------|
| **Leads** | Yes | Table, filters, sort, status dropdown, activate → client, link to project |
| **Contacts** | Yes | Contact form submissions, status (new/read/responded), filter/sort |
| **Proposals** | Yes | Tiers, add-ons, maintenance, status workflow, PDF, convert to project |
| **Clients** | Yes | CRUD, invite flow, status, billing, projects, invoices rollup |
| **Projects** | Yes | Full CRUD, status, milestones, files, messages, invoices, contract PDF |
| **Messaging** | Yes | Threads (general + project), priority, attachments, email notifications |
| **Audit logs** | Yes | Create/update/delete/login, entity-centric, metadata |

### 1.2 Client Portal

| Area | Implemented | Notes |
|------|-------------|-------|
| **Auth** | Yes | JWT, magic link, set password, role-based (admin/client) |
| **Dashboard** | Yes | Project stats, recent activity |
| **Projects** | Yes | List, detail, milestones, files |
| **Files** | Yes | Upload, download, preview (PDF, images, text, JSON) |
| **Invoices** | Yes | List, status, download PDF |
| **Messages** | Yes | Threads, send, attachments, cache-bust on send |
| **Settings** | Yes | Profile, password, notifications, billing |
| **New project** | Yes | Request form, appears in admin |
| **Intake** | Yes | Terminal-style form, conditional flow, session persist |
| **Proposal builder** | Yes | Client-facing tier/add-on selection, submit |

### 1.3 Operations & Infrastructure

| Area | Implemented | Notes |
|------|-------------|-------|
| **Analytics** | Yes | Visitor tracking, page views, sessions, consent-first |
| **Performance** | Yes | Core Web Vitals, bundle analysis |
| **Invoicing** | Yes | Generate from intake, line items, status, PDF, mark paid (manual) |
| **Email** | Yes | SMTP, welcome, password reset, intake confirm, notifications |
| **Security** | Yes | Rate limiting, validation, sanitization, CSP, audit logs |
| **PWA** | Yes | Service worker, static cache, offline for main site |

### 1.4 Gaps You’ve Already Flagged (from `current_work.md`)

**Now implemented (Feb 2026):** Scheduler (reminders, scheduled/recurring invoices), workflow triggers, approval workflows, document requests, notification prefs UI, client timeline/activity, knowledge base, payment reminders, deposit/payment plans, recurring invoices, A/R aging, business metrics dashboard, client health score, pipeline/revenue reporting, Kanban pipeline view.

**Still gaps:**
- No Stripe/payment gateway; invoices paid manually
- No expense/time tracking
- Webhooks and external API documented as “future enhancement”

---

## 2. State-of-the-Art CRM / Client-Portal Expectations

### 2.1 AI & Automation (2025–2026)

- **Predictive lead scoring** – Score leads from behavior and attributes; prioritize outreach.
- **Automated data entry / enrichment** – Enrich leads (company, role, etc.); reduce manual input.
- **Workflow automation** – Triggers (e.g. `intake.completed`, `invoice.overdue`) → actions (create project, send reminder, update status).
- **Conversational AI** – In-app assistant for search, summaries, next steps (grounded in your data).
- **Forecasting** – Revenue and pipeline forecasts from historical data.

*Your gap:* No lead scoring, no workflow engine, no AI features. Automation is mostly fire-and-forget (e.g. intake → project + email).

### 2.2 Pipeline & Deal Management

- **Visual pipeline** – Kanban/board for leads or deals; drag-and-drop stage changes.
- **Pipeline analytics** – Value by stage, conversion rates, velocity.
- **Deal/lead stages** – Configurable stages; automatic movement via rules.

*Your gap:* No Kanban yet (planned). Leads/proposals have status but no pipeline view or stage-based analytics.

### 2.3 Client Portal Best Practices

- **Approval workflows** – Sequential or parallel approvals, due dates, audit trail.
- **E-signatures** – Contract/proposal signing in-portal (e.g. DocuSign/Adobe Sign–style).
- **Document requests** – Request specific docs, track received/missing, reminders.
- **Real-time updates** – Live activity (new messages, status changes) without refresh.
- **24/7 self-service** – Knowledge base, FAQs, how-to guides.
- **Role-based access** – Per-project or per-section visibility.
- **Branded experience** – Your domain, layout, and tone throughout.

*Your status:* Approval workflows, document requests, and knowledge base are implemented (Feb 2026). E-sign (contract signatures) and real-time updates (WebSockets/SSE) are not. RBAC is role-level (admin/client), not resource-level. Branding is in place.

### 2.4 Financial & Payments

- **Online payments** – Stripe/payment gateway; pay invoices in-portal.
- **Payment reminders** – Automated emails (e.g. before due, overdue).
- **Deposits & payment plans** – Schedule deposit + installments; link to milestones.
- **Recurring invoices** – Retainers, subscriptions.
- **Revenue reporting** – Paid vs outstanding, by period, by client.

*Your gap:* No gateway integration; “mark as paid” only. No reminders, no deposit/payment-plan automation, no recurring invoices. Basic invoice rollups exist.

### 2.5 Integrations & Extensibility

- **Webhooks** – Outbound events (e.g. `project.status_changed`, `invoice.paid`) for Zapier, internal tools.
- **Public API** – REST (or similar) for CRUD on clients, projects, invoices, etc.
- **Integrations** – Email (Gmail/Outlook), calendar, accounting (QuickBooks/Xero), marketing (Mailchimp).

*Your gap:* Webhooks and SDK are “future”; no outbound webhooks or public API in production. No native integrations.

### 2.6 Reporting & Analytics

- **Business metrics** – Revenue, pipeline, utilization, win rate.
- **Client health** – Payment behavior, response time, engagement.
- **Custom reports** – Filters, date ranges, export (CSV/Excel).
- **Dashboards** – Configurable widgets; often AI-assisted insights.

*Your gap:* Analytics are visitor/product-focused. No business/client CRM dashboards, no custom reports, no client health metrics.

### 2.7 Real-Time & UX

- **Real-time messaging** – WebSockets or SSE; messages appear without refresh.
- **Live notifications** – In-app toasts/badges for new messages, approvals, etc.
- **Mobile-friendly** – Responsive; some products offer native apps.

*Your gap:* Messaging uses fetch (and cache-bust on send); no WebSockets/SSE. No live notifications. Responsive UI exists; no native app.

---

## 3. Gap Summary: What’s Missing for “State of the Art”

### 3.1 High Impact (Most Differentiating)

| Gap | Category | Why it matters |
|-----|----------|----------------|
| **Workflow automation + scheduled jobs** | Automation | Foundation for reminders, pipeline moves, follow-ups; expected in modern CRMs. |
| **Online payments (Stripe, etc.)** | Financial | Clients expect to pay in-portal; manual-only feels outdated. |
| **E-signatures** | Client portal | Contracts/proposals signed in-portal; faster closure, less back-and-forth. |
| **Document requests + tracking** | Client portal | Clear “what we need from you” and “received” state; fewer chaser emails. |
| **Real-time messaging / notifications** | UX | Live chat and alerts are table stakes for modern portals. |
| **Kanban pipeline view** | CRM | Visual pipeline for leads/projects; you’ve already planned this. |
| **Business metrics dashboard** | Reporting | Revenue, pipeline, client health in one place; drives decisions. |

### 3.2 Medium Impact (Strong Enhancements)

| Gap | Category | Why it matters |
|-----|----------|----------------|
| **Payment reminders** | Financial | Reduces overdue invoices; uses your existing email + (future) scheduler. |
| **Activity feed + client timeline** | Client portal | Single timeline of messages, files, invoices, milestones; transparency. |
| **Approval workflows for deliverables** | Client portal | Clear approve/revision flow; aligns with client-portal best practices. |
| **Knowledge base / self-service** | Client portal | Cuts “how do I…?” support; quick win. |
| **Webhooks + public API** | Integrations | Enables Zapier, internal tools, accounting sync; extensibility. |
| **Lead scoring** | CRM | Prioritize leads; optional AI layer later. |

### 3.3 Lower Priority (Nice to Have)

| Gap | Category | Why it matters |
|-----|----------|----------------|
| **AI features** | AI | Summaries, next steps, forecasting; differentiate once core is solid. |
| **Recurring invoices** | Financial | Retainers, maintenance; relevant if you offer those. |
| **Time & expense tracking** | Financial | Profitability and project margins; useful for agencies. |
| **Visual workflow builder** | Automation | Low-code rules; depends on workflow engine existing first. |
| **Custom fields** | Data model | Flexible CRM attributes; more important at scale. |

---

## 4. Recommended Priorities (Aligned with Your Roadmap)

Your **CMS Enhancement Plan** (Tier 1–6) in `current_work.md` already targets many of these. Below is a tightened “state of the art” ordering that fits that plan.

### 4.1 Foundation (Do First)

1. **Scheduled job system** (your 1.1) – Prerequisite for reminders, workflow triggers, and any time-based automation.
2. **Reminder engine** (your 1.2) – Invoice overdue, milestone approaching, silent clients; uses 1.1.
3. **Workflow triggers** (your 1.4) – Formalize events (`intake.completed`, `proposal.accepted`, etc.) and actions; backbone for “state of the art” automation.

### 4.2 High-Visibility Client Portal

4. **Activity feed** (your 2.1) – Single timeline from messages, files, invoices, milestones.
5. **Notification preferences UI** (your 2.3) – Use existing `notification_preferences`; respect them in email.
6. **Knowledge base** (your 2.5) – Self-service FAQs; low effort, high value.
7. **Document requests** (your 3.1) – Request specific docs, track status, optionally remind via 1.2.

### 4.3 Financial & Payments

8. **Payment reminders** (your 5.1) – Use reminder engine + email; include link to portal invoices.
9. **Online payments** – Integrate Stripe (or similar) for “Pay now” on invoices; largest perceptual leap.
10. **Deposit / payment plans** (your 5.2) – Match how you actually charge; improves cash flow and clarity.

### 4.4 CRM & Reporting

11. **Kanban (and optionally Timeline)** (your plan) – Visual project/lead pipeline.
12. **Business metrics dashboard** (your 6.1) – Revenue, pipeline, active projects, client counts.
13. **Pipeline value + conversion** – Extend 6.1 with proposal/deal value and simple conversion metrics.

### 4.5 Approval & Documents

14. **Deliverable tracking + approval** (your 4.1, 4.3) – Draft → review → approve / request revision.
15. **E-signatures** – Contract (and optionally proposal) signing in-portal; integrate provider (e.g. DocuSign, Adobe Sign) or use a lighter widget.

### 4.6 Real-Time & Integrations

16. **Real-time messaging** – WebSockets or SSE for new messages (and optionally notifications).
17. **Webhooks** – Outbound events for `project`, `invoice`, `client`, etc.
18. **Public API** – Documented REST API for clients, projects, invoices; enables integrations and automation.

---

## 5. Conclusion

You already have a solid base: leads, contacts, proposals, clients, projects, messaging, audit logs, client portal, invoicing, and solid security. The biggest gaps versus state-of-the-art CRM/client-portal software are:

1. **Automation** – No scheduler, reminder engine, or workflow triggers.
2. **Payments** – No payment gateway; manual “mark as paid” only.
3. **Client portal UX** – No real-time updates, no e-sign, no document requests, no knowledge base.
4. **Pipeline & reporting** – No Kanban, no business/client-health metrics.
5. **Integrations** – No webhooks or public API yet.

Tackling **scheduler → reminders → workflow triggers** first, then **payment reminders + Stripe**, then **activity feed + document requests + knowledge base**, and **Kanban + business dashboard** will bring you closest to “state of the art” for a custom CRM/CMS of this kind. The rest (e-sign, real-time, webhooks, API, AI) can follow in that order based on your capacity and product goals.

---

## References

- `docs/current_work.md` – CMS Enhancement Plan (Tiers 1–6), Kanban deep dive.
- `README.md` – Feature overview, API surface, DB schema.
- `docs/VISITOR-TRACKING.md` – Analytics and consent.
- `docs/API_DOCUMENTATION.md` – Webhooks (future), SDK examples.
- `docs/features/*` – Client portal, messages, invoices, etc.
- External: Salesforce CRM features, client portal best practices (e.g. Moxo, Monday), AI CRM (SAP, Zapier), e-sign workflows (Adobe, DocuSign), lead scoring and workflow automation (Nutshell, Cubeo, Oracle Eloqua).
