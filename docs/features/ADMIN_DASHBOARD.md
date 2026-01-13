# Admin Dashboard

**Last Updated:** January 13, 2026

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

The Admin Dashboard provides comprehensive administrative capabilities for managing leads, projects, clients, and analytics. Only users with admin privileges can access this dashboard.

**Key Features:**

- [x] Leads management with status tracking
- [x] Contact form submissions viewing
- [x] Projects management with full lifecycle support
- [x] Client invitation flow with magic link password setup
- [x] Full project detail view (mirrors client portal)
- [x] Client messaging system
- [x] Analytics and visitor tracking
- [x] System information

**Access:** `/admin/index.html`

---

## Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla TypeScript |
| Styling | CSS with CSS Variables |
| Charts | Chart.js |
| Build Tool | Vite |
| Authentication | HttpOnly cookies with bcrypt |

### Module Structure

```
admin/
└── index.html                    # Admin HTML entry point (~1300 lines)

src/features/admin/
├── admin-dashboard.ts            # Main dashboard controller (~1900 lines)
├── admin-project-details.ts      # Project detail view handler (~1300 lines)
├── admin-auth.ts                 # Admin authentication
└── admin-security.ts             # Rate limiting and security

src/features/admin/modules/       # Extracted modules
├── admin-analytics.ts            # Analytics and charts (~900 lines)
├── admin-clients.ts              # Client management (~850 lines)
├── admin-contacts.ts             # Contact form submissions (~250 lines)
├── admin-leads.ts                # Leads management (~450 lines)
├── admin-messaging.ts            # Messaging system (~400 lines)
├── admin-overview.ts             # Dashboard overview (~200 lines)
├── admin-performance.ts          # Performance monitoring (~400 lines)
├── admin-projects.ts             # Projects management (~1000 lines)
├── admin-system-status.ts        # System status display (~340 lines)
└── index.ts                      # Module exports

src/styles/pages/
└── admin.css                     # Admin-specific styles

server/routes/
├── admin.ts                      # Admin-specific API endpoints
├── auth.ts                       # Authentication including set-password
├── leads.ts                      # Leads management API
├── clients.ts                    # Clients management API
├── projects.ts                   # Projects management API
└── invoices.ts                   # Invoice management API

server/database/migrations/
├── 003_leads.sql                 # Leads table schema
├── 004_contacts.sql              # Contact submissions schema
├── 005_clients.sql               # Clients table schema
├── 010_client_invitation.sql     # Invitation token fields
├── 020_project_price.sql         # Project price column
└── 021_project_additional_fields.sql  # Additional project tracking fields
```

---

## Tab Navigation

The admin dashboard uses a sidebar navigation system with the following tabs:

| Tab | Button ID | Content ID | Description |
|-----|-----------|------------|-------------|
| Overview | `btn-overview` | `tab-overview` | Quick stats and recent leads |
| Leads | `btn-leads` | `tab-leads` | Lead and contact management |
| Projects | `btn-projects` | `tab-projects` | Active projects management |
| Messages | `btn-messages` | `tab-messages` | Client communication |
| Analytics | `btn-analytics` | `tab-analytics` | Visitor and page analytics |
| System | `btn-system` | `tab-system` | System information |
| Project Detail | - | `tab-project-detail` | Individual project view (hidden from sidebar) |

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

| Column | Description |
|--------|-------------|
| Date | Submission timestamp |
| Name | Contact name |
| Company | Company name |
| Email | Contact email |
| Project Type | Type of project requested |
| Budget | Budget range selected |
| Status | Current lead status |

### Lead Status Values

| Status | Description | Badge Color |
|--------|-------------|-------------|
| `pending` | New lead, not yet reviewed | Yellow |
| `active` | Lead converted to project | Blue |
| `in_progress` | Project work started | Blue |
| `completed` | Project delivered | Green |
| `cancelled` | Lead/project cancelled | Red |

### Contact Form Submissions

A separate table shows contact form submissions from the website:

| Column | Description |
|--------|-------------|
| Date | Submission timestamp |
| Name | Sender name |
| Email | Sender email |
| Subject | Message subject |
| Message | Message preview (truncated) |
| Status | Read/unread status |

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

| Column | Description |
|--------|-------------|
| Project Name | Name or description excerpt |
| Client | Contact name and company |
| Type | Project type |
| Budget | Budget range |
| Timeline | Expected timeline |
| Status | Project status dropdown |
| Actions | View button |

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

| Sub-Tab | Content |
|---------|---------|
| Overview | Progress, milestones, notes, activity |
| Files | Upload/manage project files |
| Messages | Communicate with client |
| Invoices | Create/manage invoices |
| Settings | Project settings and client account |

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

### Client Selector

The Messages tab includes a client selector dropdown:

```html
<select id="admin-client-select" class="form-select">
  <option value="">-- Select a client --</option>
  <!-- Options populated from API -->
</select>
```

### Loading Messages

```typescript
// src/features/admin/modules/admin-messaging.ts
private async loadClientThreads(): Promise<void> {
  const response = await fetch('/api/messages/threads', {
    credentials: 'include' // HttpOnly cookie authentication
  });

  if (response.ok) {
    const data = await response.json();
    // Populate client selector with threads
  }
}
```

### Sending Messages

Admin messages are sent with `sender_type: 'admin'`:

```typescript
// src/features/admin/modules/admin-messaging.ts
private async sendMessage(): Promise<void> {
  await fetch('/api/messages', {
    method: 'POST',
    credentials: 'include', // HttpOnly cookie authentication
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: this.selectedClientId,
      content: messageText,
      sender_type: 'admin'
    })
  });
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `admin/index.html` | Admin dashboard HTML |
| `src/features/admin/admin-dashboard.ts` | Main controller (~2000 lines) |
| `src/features/admin/admin-security.ts` | Rate limiting |
| `src/styles/pages/admin.css` | Admin styles |
| `client/set-password.html` | Password setup page |
| `server/routes/admin.ts` | Admin API endpoints |
| `server/routes/auth.ts` | Auth including set-password |
| `server/database/migrations/010_client_invitation.sql` | Invitation schema |

---

## Related Documentation

- [Client Portal](./CLIENT_PORTAL.md) - Client-facing portal
- [Messages](./MESSAGES.md) - Messaging system
- [Files](./FILES.md) - File management
- [API Documentation](../API_DOCUMENTATION.md) - Full API reference
