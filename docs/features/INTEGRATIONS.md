# External Integrations

**Status:** Complete
**Last Updated:** February 10, 2026

## Overview

The External Integrations system provides connectivity with third-party services for payments, notifications, calendar sync, and automation workflows.

**Supported Integrations:**

1. **Stripe** - Invoice payment links and payment processing
2. **Google Calendar** - Milestone and task date synchronization
3. **Slack** - Team notifications via webhooks
4. **Discord** - Team notifications via webhooks
5. **Zapier** - Automation workflows with compatible webhook format

**Access:** Admin Dashboard > Settings > Integrations

---

## Stripe Payment Integration

### Features

- Generate payment links for invoices
- Automatic invoice status updates on payment
- Webhook handling for payment events
- Refund tracking
- Test and live mode support

### Configuration

Set environment variables:

```bash
STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://yourdomain.com
```

### Payment Flow

```text
1. Admin clicks "Create Payment Link" on invoice
   ↓
2. System creates Stripe Checkout Session
   ↓
3. Client receives invoice email with payment link
   ↓
4. Client clicks link → Stripe Checkout
   ↓
5. Client completes payment
   ↓
6. Stripe sends webhook to /api/integrations/stripe/webhook
   ↓
7. System updates invoice status to "paid"
   ↓
8. Payment recorded in database
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/stripe/status` | Get Stripe configuration status |
| POST | `/api/integrations/stripe/payment-link` | Create payment link for invoice |
| GET | `/api/integrations/stripe/payment-link/:invoiceId` | Get existing payment link |
| DELETE | `/api/integrations/stripe/payment-link/:invoiceId` | Cancel/expire payment link |
| POST | `/api/integrations/stripe/webhook` | Handle Stripe webhook events |

### Webhook Events Handled

- `checkout.session.completed` - Mark invoice as paid
- `checkout.session.expired` - Update payment link status
- `payment_intent.payment_failed` - Log failed payment attempt
- `charge.refunded` - Update invoice refund status

---

## Google Calendar Integration

### Features

- OAuth2 authentication with Google
- Sync milestones to Google Calendar
- Sync task due dates to Google Calendar
- Sync invoice due dates (optional)
- iCal export (no Google account required)

### Configuration

Set environment variables:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/integrations/calendar/callback
```

### OAuth Flow

```text
1. Admin clicks "Connect Google Calendar"
   ↓
2. Redirect to Google OAuth consent screen
   ↓
3. User authorizes calendar access
   ↓
4. Google redirects back with authorization code
   ↓
5. System exchanges code for access/refresh tokens
   ↓
6. Tokens stored securely in database
   ↓
7. Calendar sync enabled
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/calendar/status` | Get calendar connection status |
| GET | `/api/integrations/calendar/auth-url` | Get Google OAuth URL |
| POST | `/api/integrations/calendar/callback` | Handle OAuth callback |
| PUT | `/api/integrations/calendar/settings` | Update sync settings |
| GET | `/api/integrations/calendar/export/project/:id` | Export project to iCal |
| GET | `/api/integrations/calendar/export/upcoming` | Export upcoming items to iCal |

### iCal Export (No Google Required)

Download `.ics` files for import into any calendar app:

- Export single project milestones/tasks
- Export all upcoming items (configurable days ahead)
- Compatible with Apple Calendar, Outlook, etc.

---

## Slack/Discord Notifications

### Features

- Incoming webhook integration
- Rich message formatting with blocks
- Event-based notifications
- Multiple webhook configurations
- Test notification functionality

### Configuration

1. Create incoming webhook in Slack/Discord
2. Add configuration in Admin > Integrations > Notifications
3. Select events to trigger notifications
4. Test and activate

### Supported Events

**Invoice Events:**

- `invoice.created` - New invoice created
- `invoice.sent` - Invoice sent to client
- `invoice.paid` - Invoice paid
- `invoice.overdue` - Invoice past due

**Project Events:**

- `project.created` - New project created
- `project.started` - Project started
- `project.completed` - Project completed

**Contract Events:**

- `contract.signed` - Contract signed by client

**Other Events:**

- `proposal.accepted` / `proposal.rejected`
- `task.completed` / `task.overdue`
- `milestone.completed`
- `client.created`
- `lead.created`

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/notifications` | List notification configs |
| POST | `/api/integrations/notifications` | Create/update notification |
| DELETE | `/api/integrations/notifications/:id` | Delete notification config |
| POST | `/api/integrations/notifications/:id/test` | Test notification |
| POST | `/api/integrations/notifications/preview` | Preview message format |

### Message Formatting

**Slack Messages:**

- Header block with event type and emoji
- Content section with event summary
- Fields for key data (client, amount, status)
- Action button linking to details
- Footer with timestamp

**Discord Messages:**

- Embedded message with color coding
- Title and description
- Inline fields for data
- Footer with source

---

## Zapier Integration

### Features

- Zapier-compatible webhook payload format
- Sample payloads for trigger testing
- All system events available as triggers
- Flat payload structure for easy field mapping
- HMAC signature verification

### Payload Format

```json
{
  "id": "invoice.created_123_abc123",
  "event_type": "invoice.created",
  "timestamp": "2026-02-10T15:30:00.000Z",
  "data": {
    "invoice_id": 123,
    "invoice_number": "INV-2026-001",
    "invoice_client_name": "Acme Corp",
    "invoice_amount": 5000.00,
    "invoice_status": "draft"
  },
  "meta": {
    "version": "1.0",
    "source": "no-bhad-codes"
  }
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/zapier/events` | List available event types |
| GET | `/api/integrations/zapier/samples` | Get sample payloads |
| POST | `/api/integrations/zapier/webhook` | Create Zapier webhook |
| POST | `/api/integrations/zapier/format` | Format data as Zapier payload |

### Available Events

All workflow trigger events are available:

- Invoice: created, sent, paid, overdue
- Project: created, started, completed, status_changed
- Contract: created, sent, signed
- Proposal: created, sent, accepted, rejected
- Task: created, completed, overdue
- Milestone: completed
- Client: created
- Lead: created, converted

---

## Database Schema

### notification_integrations

```sql
CREATE TABLE notification_integrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'slack' or 'discord'
  webhook_url TEXT NOT NULL,
  channel TEXT,
  events TEXT NOT NULL, -- Comma-separated
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME
);
```

### invoice_payment_links

```sql
CREATE TABLE invoice_payment_links (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL,
  stripe_session_id TEXT NOT NULL,
  payment_url TEXT NOT NULL,
  amount INTEGER NOT NULL, -- In cents
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'active',
  completed_at DATETIME,
  created_at DATETIME
);
```

### calendar_sync_configs

```sql
CREATE TABLE calendar_sync_configs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  calendar_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  sync_milestones BOOLEAN DEFAULT TRUE,
  sync_tasks BOOLEAN DEFAULT TRUE,
  sync_invoice_due_dates BOOLEAN DEFAULT FALSE,
  last_sync_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME
);
```

### integration_status

```sql
CREATE TABLE integration_status (
  id INTEGER PRIMARY KEY,
  integration_type TEXT NOT NULL,
  is_configured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  configuration TEXT, -- JSON
  last_activity_at DATETIME,
  error_message TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

---

## File Locations

| File | Purpose |
|------|---------|
| `server/routes/integrations.ts` | API routes |
| `server/services/integrations/index.ts` | Service exports |
| `server/services/integrations/stripe-service.ts` | Stripe payment handling |
| `server/services/integrations/calendar-service.ts` | Google Calendar + iCal |
| `server/services/integrations/slack-service.ts` | Slack/Discord notifications |
| `server/services/integrations/zapier-service.ts` | Zapier webhook format |
| `server/database/migrations/065_integrations.sql` | Database schema |

---

## Setup Checklist

### Stripe

- [ ] Create Stripe account (stripe.com)
- [ ] Get API keys from Dashboard > Developers > API keys
- [ ] Set `STRIPE_SECRET_KEY` environment variable
- [ ] Create webhook endpoint in Stripe Dashboard
- [ ] Set `STRIPE_WEBHOOK_SECRET` environment variable
- [ ] Test with Stripe CLI or test mode

### Google Calendar

- [ ] Create Google Cloud project (console.cloud.google.com)
- [ ] Enable Google Calendar API
- [ ] Configure OAuth consent screen
- [ ] Create OAuth 2.0 credentials
- [ ] Set `GOOGLE_CLIENT_ID` environment variable
- [ ] Set `GOOGLE_CLIENT_SECRET` environment variable
- [ ] Set `GOOGLE_REDIRECT_URI` environment variable
- [ ] Test OAuth flow

### Slack

- [ ] Go to api.slack.com/apps
- [ ] Create new app or select existing
- [ ] Enable Incoming Webhooks
- [ ] Create webhook for desired channel
- [ ] Copy webhook URL to notification config

### Discord

- [ ] Open Server Settings > Integrations
- [ ] Create Webhook
- [ ] Copy webhook URL to notification config

### Zapier

- [ ] Create Zap with "Webhooks by Zapier" trigger
- [ ] Select "Catch Hook"
- [ ] Copy webhook URL
- [ ] Create webhook via API or admin UI
- [ ] Test with sample data

---

## Test Coverage

**Test File:** `tests/unit/server/webhooks.test.ts`
**Total Tests:** 24

### Coverage Areas

| Area | Tests | Description |
|------|-------|-------------|
| Webhook CRUD | 6 | Create, retrieve, list, update, delete webhooks |
| Payload Building | 4 | Variable substitution, payload templating |
| HMAC Signatures | 3 | SHA256 signing, verification |
| Delivery Tracking | 5 | Logs, statistics, paginated history |
| Retry Logic | 4 | Exponential backoff, max attempts, manual retry |
| Secret Management | 2 | Key generation, rotation |

### Test Categories

**CRUD Tests:**

- Create webhook with URL and events
- Get webhook by ID
- List all webhooks with pagination
- Update webhook configuration
- Delete webhook
- Validate webhook URL format

**Payload Tests:**

- Build payload with entity data
- Substitute {{variable}} placeholders
- Handle nested object paths
- Zapier-compatible format output

**Security Tests:**

- Generate HMAC-SHA256 signature
- Verify signature on delivery
- Rotate secret key

**Delivery Tests:**

- Log successful delivery
- Log failed delivery with error
- Get delivery statistics
- Filter delivery history by date
- Track success rate

**Retry Tests:**

- Calculate exponential backoff
- Respect max attempt limit
- Manual retry trigger
- Mark delivery as failed after max attempts

---

## Related Documentation

- [Webhooks](./WEBHOOKS.md) - Core webhook system
- [Workflows](./WORKFLOWS.md) - Event triggers
- [Invoices](./INVOICES.md) - Invoice system
- [Milestones](./MILESTONES.md) - Project milestones
- [Tasks](./TASKS.md) - Task management

---

## Change Log

### February 10, 2026 - Initial Implementation

- Created Stripe payment link service
- Created Google Calendar integration with OAuth
- Created Slack/Discord notification service
- Created Zapier-compatible webhook format
- Created database migration for integration tables
- Created API routes for all integrations
- Created comprehensive feature documentation
