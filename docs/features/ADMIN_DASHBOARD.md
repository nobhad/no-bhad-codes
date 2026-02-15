# Admin Dashboard

**Last Updated:** February 15, 2026 (Portal Rebuild complete - all 19 modules render dynamically)

> **Part of "The Backend"** - The portal system consisting of both the Admin Dashboard and Client Portal.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tab Navigation](#tab-navigation)
4. [Leads Management](#leads-management)
5. [Projects Management](#projects-management)
6. [Project Detail View](#project-detail-view)
7. [Client Invitation Flow](#client-invitation-flow)
8. [Messaging](#messaging)
9. [File Locations](#file-locations)
10. [Related Documentation](#related-documentation)

---

## Overview

The Admin Dashboard is the administrative side of "The Backend" portal system. It provides comprehensive capabilities for managing leads, projects, clients, and analytics. Only users with admin privileges can access this dashboard.

**Key Features:**

- [x] Leads management with status tracking
- [x] Contact form submissions viewing
- [x] Projects management with full lifecycle support
- [x] Client invitation flow with magic link password setup
- [x] Full project detail view (mirrors client portal)
- [x] Client messaging system
- [x] Global tasks Kanban (tasks across all projects)
- [x] Analytics and visitor tracking
- [x] System information

**Access:** `/admin/index.html`

---

## Architecture

### Technology Stack

|Component|Technology|
|-----------|------------|
|Frontend|Vanilla TypeScript|
|Styling|CSS with CSS Variables|
|Charts|Chart.js|
|Build Tool|Vite|
|Authentication|HttpOnly cookies with bcrypt|

### Module Structure

```text
admin/
└── index.html                    # Admin HTML entry point

src/features/admin/
├── admin-dashboard.ts            # Main dashboard coordinator (~2562 lines)
├── admin-project-details.ts      # Project detail view handler (~1300 lines)
├── admin-auth.ts                 # Admin authentication
└── admin-security.ts             # Rate limiting and security

src/features/admin/services/      # Extracted services (January 2026 refactor)
├── admin-data.service.ts         # Data fetching and caching with TTL
├── admin-chart.service.ts        # Chart.js integration and rendering
└── admin-export.service.ts       # CSV/data export functionality

src/features/admin/renderers/     # Extracted UI renderers (January 2026 refactor)
├── admin-contacts.renderer.ts    # Contact table and modal rendering
├── admin-messaging.renderer.ts   # Messaging UI and thread rendering
└── admin-performance.renderer.ts # Performance monitoring UI

src/features/admin/modules/       # Extracted modules (27 modules)
├── admin-ad-hoc-analytics.ts     # Ad hoc request analytics
├── admin-ad-hoc-requests.ts      # Ad hoc requests management
├── admin-analytics.ts            # Analytics and charts
├── admin-client-details.ts       # Client detail view
├── admin-clients.ts              # Client management
├── admin-contacts.ts             # Contact form submissions
├── admin-contracts.ts            # Contracts management
├── admin-deleted-items.ts        # Soft-deleted items management
├── admin-deliverables.ts         # Deliverables workflow
├── admin-design-review.ts        # Design review system
├── admin-document-requests.ts    # Document requests
├── admin-email-templates.ts      # Email template management
├── admin-files.ts                # File management
├── admin-global-tasks.ts         # Global tasks Kanban (all projects)
├── admin-invoices.ts             # Invoice management
├── admin-knowledge-base.ts       # Knowledge base (KB)
├── admin-leads.ts                # Leads management
├── admin-messaging.ts            # Messaging system
├── admin-overview.ts             # Dashboard overview
├── admin-performance.ts          # Performance monitoring
├── admin-projects.ts             # Projects management
├── admin-proposals.ts            # Proposals
├── admin-questionnaires.ts       # Questionnaires management
├── admin-system-status.ts        # System status display
├── admin-tasks.ts                # Tasks
├── admin-time-tracking.ts        # Time tracking
├── admin-workflows.ts            # Workflows and approvals
└── index.ts                      # Module exports

src/styles/pages/
└── admin.css                     # Admin-specific styles

server/routes/
├── admin/                        # Admin API (split into modules)
│   ├── index.ts                  # Router mounting
│   ├── dashboard.ts              # Stats and overview
│   ├── leads.ts                  # Lead management
│   ├── projects.ts               # Admin project creation
│   ├── kpi.ts                    # KPI endpoints
│   ├── workflows.ts              # Workflow admin
│   ├── settings.ts               # Admin settings
│   ├── notifications.ts          # Notification management
│   ├── tags.ts                   # Tag management
│   ├── cache.ts                  # Cache management
│   ├── activity.ts               # Recent activity
│   └── misc.ts                   # Miscellaneous endpoints
├── projects/                     # Projects API (split into modules)
│   ├── index.ts                  # Router mounting
│   ├── core.ts                   # CRUD operations
│   ├── milestones.ts             # Milestone management
│   ├── tasks.ts                  # Task endpoints
│   └── ...                       # Other project subroutes
├── invoices/                     # Invoice API (split into modules)
│   ├── index.ts                  # Router mounting
│   ├── core.ts                   # CRUD operations
│   ├── pdf.ts                    # PDF generation
│   └── ...                       # Other invoice subroutes
├── auth.ts                       # Authentication (login, set-password, magic-link)
├── clients.ts                    # Clients management API
├── messages.ts                   # Messaging API
├── uploads.ts                    # File upload API
├── analytics.ts                  # Visitor analytics
├── proposals.ts                  # Proposal builder API
└── ... (intake, approvals, triggers, document-requests, knowledge-base)

server/database/migrations/       # 001_initial_schema through 045_knowledge_base.sql
├── 001_initial_schema.sql
├── 002_client_intakes.sql
├── 009_contact_submissions.sql
├── 010_client_invitation.sql
├── 016_uploaded_files.sql
├── 020_project_price.sql
├── 021_project_additional_fields.sql
└── ... (see directory for full list)
```

---

## Tab Navigation

The admin dashboard uses a sidebar navigation system with the following tabs:

|Tab|Button ID|Content ID|Description|
|-----|-----------|------------|-------------|
|Overview|`btn-overview`|`tab-overview`|Quick stats, upcoming tasks, and recent leads|
|Work|`btn-work`|`tab-work`|Work management (projects, tasks, deliverables)|
|CRM|`btn-crm`|`tab-crm`|Customer relationship management|
|Documents|`btn-documents`|`tab-documents`|Document requests and management|
|Workflows|`btn-workflows`|`tab-workflows`|Approvals, triggers, and automation|
|Analytics|`btn-analytics`|`tab-analytics`|Visitor and page analytics|
|Support|`btn-support`|`tab-support`|Support and help desk|
|System|`btn-system`|`tab-system`|System information and settings|
|Tasks|`btn-tasks`|`tab-tasks`|Global tasks Kanban across all projects|
|Leads|`btn-leads`|`tab-leads`|Lead and contact management|
|Projects|`btn-projects`|`tab-projects`|Active projects management|
|Clients|`btn-clients`|`tab-clients`|Client management|
|Invoices|`btn-invoices`|`tab-invoices`|Invoice management|
|Messages|`btn-messages`|`tab-messages`|Client communication|
|Access|`btn-access`|`tab-access`|Access control and permissions|
|Comments|`btn-comments`|`tab-comments`|Comments and feedback|
|Info|`btn-info`|`tab-info`|Information and metadata|
|Versions|`btn-versions`|`tab-versions`|Version history and rollbacks|
|Project Detail|-|`tab-project-detail`|Individual project view (hidden from sidebar)|
|Client Detail|-|`tab-client-detail`|Individual client view (hidden from sidebar)|

### Tab Switching

```typescript
private switchTab(tabName: string): void {
  // Update active tab button
  document.querySelectorAll('.sidebar-buttons .btn[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tabName);
  });

  // Update active tab content
  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.remove('active');
  });
  const tabContent = document.getElementById(`tab-${tabName}`);
  tabContent?.classList.add('active');

  this.currentTab = tabName;
  this.loadTabData(tabName);
}
```

---

## Leads Management

### Leads Table

The Leads tab displays all intake form submissions with the following columns:

|Column|Description|
|--------|-------------|
|Date|Submission timestamp|
|Name|Contact name|
|Company|Company name|
|Email|Contact email|
|Project Type|Type of project requested|
|Budget|Budget range selected|
|Status|Current lead status|

### Lead Status Values

|Status|Description|Badge Color|
|--------|-------------|-------------|
|`pending`|New lead, not yet reviewed|Yellow|
|`active`|Lead converted to project|Blue|
|`in_progress`|Project work started|Blue|
|`completed`|Project delivered|Green|
|`cancelled`|Lead/project cancelled|Red|

### Contact Form Submissions

A separate table shows contact form submissions from the website:

|Column|Description|
|--------|-------------|
|Date|Submission timestamp|
|Name|Sender name|
|Email|Sender email|
|Subject|Message subject|
|Message|Message preview (truncated)|
|Status|Read/unread status|

### Clicking Lead Rows

Clicking a lead row opens a detail modal showing:

- Full lead information
- Project description
- Features requested
- Contact details
- **Invite to Client Portal** button (for pending leads)

---

## Projects Management

### Projects Table

The Projects tab shows all leads that have been converted to active projects:

|Column|Description|
|--------|-------------|
|Project Name|Name or description excerpt|
|Client|Contact name and company|
|Type|Project type|
|Budget|Budget range|
|Timeline|Expected timeline|
|Status|Project status dropdown|
|Actions|View button|

### Project Status Dropdown

Inline status changes via dropdown:

```typescript
private async updateProjectStatus(id: number, status: string): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });

  if (response.ok) {
    this.loadLeads();
    this.loadProjects();
  }
}
```

---

## Project Detail View

**NEW in v10.0:** Clicking a project row navigates to a full project detail view instead of a modal. This mirrors what clients see in their portal, allowing admins to manage all aspects of a project.

### Project Detail Sub-Tabs

|Sub-Tab|Content|
|---------|---------|
|Overview|Progress, milestones, notes, activity|
|Files|Upload/manage project files|
|Messages|Communicate with client|
|Invoices|Create/manage invoices|
|Settings|Project settings and client account|

### Overview Sub-Tab

- **Project Progress**: Visual progress bar with percentage
- **Milestones**: Track project milestones with completion status
- **Project Notes**: Description and feature requests
- **Recent Activity**: Timeline of project events

### Files Sub-Tab

- Upload files for client access
- View all project files
- Download/preview files

### Messages Sub-Tab

- View conversation history with client
- Send messages to client
- Messages appear in client portal

### Invoices Sub-Tab

- View outstanding and paid amounts
- Create new invoices
- View invoice history

### Project Edit Modal

The edit button opens a modal with all project fields:

**Basic Info:**

- Project name
- Project type
- Status dropdown
- Budget and Price

**Dates:**

- Start date
- Target end date (estimated_end_date)
- Timeline

**URLs:**

- Preview URL
- Repository URL
- Staging URL
- Production URL

**Financial/Contract:**

- Deposit amount
- Contract signed date

**Internal:**

- Admin notes (not visible to clients)

### Settings Sub-Tab

**Client Account:**

- Client email
- Account status (Active/Not Invited)
- Last login timestamp
- Resend Invitation button
- Reset Password button

### Back Navigation

The "Back to Projects" button returns to the projects list:

```typescript
const backBtn = document.getElementById('btn-back-to-projects');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    this.currentProjectId = null;
    this.switchTab('projects');
  });
}
```

---

## Client Invitation Flow

The admin can invite leads to create client portal accounts using a magic link system.

### Database Schema

Migration `010_client_invitation.sql` adds:

```sql
ALTER TABLE clients ADD COLUMN invitation_token TEXT;
ALTER TABLE clients ADD COLUMN invitation_expires_at DATETIME;
ALTER TABLE clients ADD COLUMN invitation_sent_at DATETIME;
ALTER TABLE clients ADD COLUMN last_login_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_clients_invitation_token ON clients(invitation_token);
```

### Invitation Process

1. **Admin clicks "Invite to Client Portal"** on a lead
2. **System generates secure token** (64 character hex)
3. **Client account created** with hashed token
4. **Email sent** with magic link to `/client/set-password.html?token=...`
5. **Lead status updated** to `active`

### API Endpoint: Invite Lead

```typescript
// POST /api/admin/leads/:id/invite
router.post('/leads/:id/invite', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  // Get lead data
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);

  // Generate secure invitation token
  const invitationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(invitationToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create or update client account
  db.prepare(`
    INSERT INTO clients (email, contact_name, company_name, phone, invitation_token, invitation_expires_at, invitation_sent_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(email) DO UPDATE SET
      invitation_token = excluded.invitation_token,
      invitation_expires_at = excluded.invitation_expires_at,
      invitation_sent_at = excluded.invitation_sent_at
  `).run(lead.email, lead.contact_name, lead.company_name, lead.phone, tokenHash, expiresAt.toISOString());

  // Update lead status to active
  db.prepare('UPDATE leads SET status = ? WHERE id = ?').run('active', id);

  // Send invitation email with magic link
  const inviteLink = `${process.env.WEBSITE_URL}/client/set-password.html?token=${invitationToken}`;
  // ... send email
});
```

### Set Password Page

`client/set-password.html` handles password setup:

1. **Token Verification** - Validates token on page load
2. **Password Form** - User enters new password
3. **Password Set** - Activates account with hashed password
4. **Redirect** - User redirected to client portal login

### API Endpoints: Password Setup

**Verify Invitation Token:**

```typescript
// POST /api/auth/verify-invitation
{
  "token": "abc123..."
}
// Returns: { success: true, email: "client@example.com", name: "John" }
```

**Set Password:**

```typescript
// POST /api/auth/set-password
{
  "token": "abc123...",
  "password": "newSecurePassword"
}
// Returns: { success: true, message: "Password set successfully" }
```

---

## Messaging

### Custom Client Dropdown

The Messages tab uses a custom dropdown component for better styling:

```html
<div class="custom-dropdown" id="admin-client-dropdown">
  <button class="custom-dropdown-trigger" id="admin-client-trigger">
    <span class="custom-dropdown-text">Select a client...</span>
    <span class="custom-dropdown-caret">▼</span>
  </button>
  <ul class="custom-dropdown-menu" id="admin-client-menu">
    <!-- Client items with unread counts populated dynamically -->
  </ul>
</div>
```

### Unread Message Counts

The dropdown displays unread message counts from clients:

- Only shows count badge when unread > 0
- Clients with unread messages sorted first
- Badge displays number of unread messages

### Loading Messages

```typescript
// src/features/admin/modules/admin-messaging.ts
export async function loadClientThreads(ctx: AdminDashboardContext): Promise<void> {
  // Fetch both clients and threads in parallel
  const [clientsResponse, threadsResponse] = await Promise.all([
    fetch('/api/clients', { credentials: 'include' }),
    fetch('/api/messages/threads', { credentials: 'include' })
  ]);

  // Merge clients with their thread data
  // Sort: clients with unread messages first
}
```

### Cache Busting

Messages are fetched with cache-busting after sending to ensure fresh data:

```typescript
// After sending, bust cache to get latest messages
const url = bustCache
  ? `/api/messages/threads/${threadId}/messages?_=${Date.now()}`
  : `/api/messages/threads/${threadId}/messages`;
```

### Admin Avatar

Admin messages display an SVG avatar with inverted colors:

```html
<img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />
```

```css
.messages-thread .message-avatar .avatar-img {
  filter: invert(1);  /* Dark body with light eye */
}
```

**Note:** Use self-contained SVGs for `<img>` tags. SVGs with external `<image>` references will not load.

### Keyboard Navigation

|Shortcut|Action|
|----------|--------|
|Tab|Move focus from textarea to send button|
|Enter|Send message|
|Shift+Enter|New line in message|

### Module Architecture

The messaging module (`admin-messaging.ts`) manages its own state:

```typescript
let selectedClientId: number | null = null;
let selectedThreadId: number | null = null;
let selectedClientName: string = 'Client';

export function getSelectedThreadId(): number | null {
  return selectedThreadId;
}
```

The main dashboard delegates to this module's `setupMessagingListeners()` for proper state tracking.

---

## File Locations

|File|Purpose|
|------|---------|
|`admin/index.html`|Admin dashboard HTML|
|`src/features/admin/admin-dashboard.ts`|Main coordinator|
|`src/features/admin/admin-security.ts`|Rate limiting|
|`src/features/admin/services/admin-data.service.ts`|Data fetching and caching|
|`src/features/admin/services/admin-chart.service.ts`|Chart.js integration|
|`src/features/admin/services/admin-export.service.ts`|Data export functionality|
|`src/features/admin/renderers/admin-contacts.renderer.ts`|Contact table rendering|
|`src/features/admin/renderers/admin-messaging.renderer.ts`|Messaging UI rendering|
|`src/styles/pages/admin.css`|Admin styles|
|`client/set-password.html`|Password setup page|
|`server/routes/admin/`|Admin API endpoints (split into modules)|
|`server/routes/auth.ts`|Auth including set-password|
|`server/database/migrations/010_client_invitation.sql`|Invitation schema|

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Client-facing portal
- [Messages](./MESSAGES.md) - Messaging system
- [Files](./FILES.md) - File management
- [API Documentation](../API_DOCUMENTATION.md) - Full API reference
