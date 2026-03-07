# THE BACKEND - Portal System Documentation

**Last Updated:** February 27, 2026

Complete documentation for the No Bhad Codes Portal System, consisting of the **Client Portal** and **Admin Dashboard**.

## Table of Contents

1. [Overview](#overview)
2. [Client Portal](#client-portal)
3. [Admin Dashboard](#admin-dashboard)
4. [Shared Features](#shared-features)
5. [Feature Reference](#feature-reference)

---

## Overview

"THE BACKEND" is a **solo freelance operation** — one admin (the business owner) manages all clients, projects, and operations. There is no team management or multi-user admin.

It provides two interfaces:

| Portal | URL | Purpose |
|--------|-----|---------|
| **Client Portal** | `/client/portal` | Client-facing dashboard for project tracking, communication, files, invoices |
| **Admin Dashboard** | `/admin/` | Administrative interface for client management, analytics, operations |

### Technology Stack

**Frontend:**

- TypeScript, Vite build system
- GSAP animations, Lucide icons
- CSS design tokens, modular CSS

**Backend:**

- Express.js server framework
- SQLite3 database (`data/client_portal.db`)
- JWT with HttpOnly cookies for authentication

**Services:**

- Nodemailer for email delivery
- Stripe for payment processing
- Sentry for error tracking
- Redis for caching (optional)

---

## Client Portal

The client-facing interface for project tracking and communication.

### Features

| Feature | Documentation | Description |
|---------|---------------|-------------|
| Dashboard | [CLIENT_PORTAL.md](./features/CLIENT_PORTAL.md) | Project cards, quick stats, activity log |
| Messaging | [MESSAGING.md](./features/MESSAGING.md) | Real-time messaging, threads, emoji picker |
| Files | [FILES.md](./features/FILES.md) | File upload, drag & drop, downloads |
| Invoices | [INVOICES.md](./features/INVOICES.md) | Invoice history, payments, PDF download |
| Settings | [SETTINGS.md](./features/SETTINGS.md) | Account, notifications, billing |
| New Project | [NEW_PROJECT.md](./features/NEW_PROJECT.md) | Project request form |

### Access

- URL: `/client/portal`
- Login: Email + password
- Session: 7-day JWT token

---

## Admin Dashboard

The administrative interface for business operations.

### Features

| Feature | Documentation | Description |
|---------|---------------|-------------|
| Overview | [ADMIN_DASHBOARD.md](./features/ADMIN_DASHBOARD.md) | Dashboard home, quick stats |
| Clients | [CLIENTS.md](./features/CLIENTS.md) | CRM, contacts, tags, health scoring |
| Projects | [PROJECTS.md](./features/PROJECTS.md) | Project management, tasks, milestones |
| Leads | [LEADS.md](./features/LEADS.md) | Lead pipeline, scoring, conversion |
| Invoices | [INVOICES.md](./features/INVOICES.md) | Invoice management, payments, recurring |
| Proposals | [PROPOSALS.md](./features/PROPOSALS.md) | Proposal builder, templates |
| Contracts | [CONTRACTS.md](./features/CONTRACTS.md) | Contract management, e-signatures |
| Messaging | [MESSAGING.md](./features/MESSAGING.md) | Client communication |
| Analytics | [ANALYTICS.md](./features/ANALYTICS.md) | KPIs, dashboards, reporting |
| Files | [FILES.md](./features/FILES.md) | File management |
| Time Tracking | [TIME_TRACKING.md](./features/TIME_TRACKING.md) | Time entries, billing |
| Settings | [SETTINGS.md](./features/SETTINGS.md) | Configuration, Workflows, Email Templates, Audit Log, System Health |

### Access

- URL: `/admin/`
- Login: Admin email + password
- Session: 1-hour JWT token (stricter security)

---

## Shared Features

Features available across both portals.

| Feature | Documentation | Description |
|---------|---------------|-------------|
| Deliverables | [DELIVERABLES.md](./features/DELIVERABLES.md) | Deliverable tracking, approvals |
| Document Requests | [DOCUMENT_REQUESTS.md](./features/DOCUMENT_REQUESTS.md) | Document collection workflows |
| Questionnaires | [QUESTIONNAIRES.md](./features/QUESTIONNAIRES.md) | Client questionnaires |
| Knowledge Base | [KNOWLEDGE_BASE.md](./features/KNOWLEDGE_BASE.md) | Help articles |
| Workflows | [WORKFLOWS.md](./features/WORKFLOWS.md) | Automation workflows |
| Integrations | [INTEGRATIONS.md](./features/INTEGRATIONS.md) | Third-party integrations |

---

## Backend Routes

API routes are mounted under `/api/` prefix. See [API Documentation](./API_DOCUMENTATION.md) for endpoint details.

### Core Routes

| Route | File | Purpose |
|-------|------|---------|
| `/api/auth` | `auth.ts` | Authentication, login, logout, password reset |
| `/api/clients` | `clients.ts` | Client CRUD, contacts, tags |
| `/api/projects` | `projects/` | Project management (18 sub-route files) |
| `/api/invoices` | `invoices/` | Invoice system (13 sub-route files) |
| `/api/admin` | `admin/` | Admin dashboard (12 sub-route files) |
| `/api/messages` | `messages.ts` | Messaging system |

### Feature Routes

| Route | File | Purpose |
|-------|------|---------|
| `/api/proposals` | `proposals.ts` | Proposal builder and management |
| `/api/contracts` | `contracts.ts` | Contract management, e-signatures |
| `/api/analytics` | `analytics.ts` | Analytics and KPIs |
| `/api/questionnaires` | `questionnaires.ts` | Questionnaire system |
| `/api/document-requests` | `document-requests.ts` | Document collection |
| `/api/ad-hoc-requests` | `ad-hoc-requests.ts` | Ad hoc service requests |
| `/api/deliverables` | `deliverables.ts` | Deliverable management |
| `/api/knowledge-base` | `knowledge-base.ts` | Help articles |

### System Routes

| Route | File | Purpose |
|-------|------|---------|
| `/api/uploads` | `uploads.ts` | File uploads |
| `/api/webhooks` | `webhooks.ts` | Webhook management |
| `/api/integrations` | `integrations.ts` | Third-party integrations |
| `/api/data-quality` | `data-quality.ts` | Data validation and cleanup |
| `/api/settings` | `settings.ts` | System settings |
| `/api/intake` | `intake.ts` | New project intake |
| `/api/approvals` | `approvals.ts` | Approval workflows |
| `/api/triggers` | `triggers.ts` | Workflow automation triggers |
| `/api/email-templates` | `email-templates.ts` | Email template management |
| `/api/receipts` | `receipts.ts` | Receipt management |
| `/api/health` | `health.ts` | Health check endpoint |

---

## Feature Reference

### Quick Links by Category

#### Client Management

- [Clients](./features/CLIENTS.md) - CRM, contacts, tags, health scoring
- [Client Information](./features/CLIENT_INFORMATION.md) - Profile data
- [Contacts](./features/CONTACTS.md) - Contact management
- [Leads](./features/LEADS.md) - Lead pipeline

#### Project Management

- [Projects](./features/PROJECTS.md) - Tasks, milestones, templates
- [Milestones](./features/MILESTONES.md) - Milestone tracking
- [Tasks](./features/TASKS.md) - Task management
- [Deliverables](./features/DELIVERABLES.md) - Deliverable tracking
- [Time Tracking](./features/TIME_TRACKING.md) - Time entries

#### Financial

- [Invoices](./features/INVOICES.md) - Invoicing, payments
- [Proposals](./features/PROPOSALS.md) - Proposal system
- [Contracts](./features/CONTRACTS.md) - Contracts, signatures
- [PDF Generation](./features/PDF_GENERATION.md) - PDF exports

#### Communication

- [Messaging](./features/MESSAGING.md) - Real-time messaging
- [Document Requests](./features/DOCUMENT_REQUESTS.md) - Document collection
- [Questionnaires](./features/QUESTIONNAIRES.md) - Client questionnaires

#### Administration

- [Analytics](./features/ANALYTICS.md) - Business intelligence
- [Settings](./features/SETTINGS.md) - Configuration
- [Data Quality](./features/DATA_QUALITY.md) - Data validation
- [Workflows](./features/WORKFLOWS.md) - Automation

#### Utilities

- [Files](./features/FILES.md) - File management
- [Knowledge Base](./features/KNOWLEDGE_BASE.md) - Help articles
- [Ad Hoc Requests](./features/AD_HOC_REQUESTS.md) - On-demand services
- [Integrations](./features/INTEGRATIONS.md) - Third-party connections

### API Reference

See [API Documentation](./API_DOCUMENTATION.md) for complete endpoint reference.

### Architecture

See [Architecture](./ARCHITECTURE.md) for system design and module patterns.
