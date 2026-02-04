# Client Management System

**Status:** Complete
**Last Updated:** February 1, 2026

## Overview

The Client Management System provides CRM-grade functionality for managing client relationships, contacts, activities, custom fields, tags, and health scoring. This system is comparable to features found in HubSpot, Salesforce, and other enterprise CRM platforms.

## Client Detail View Organization

The client detail view is organized by tabs so the **Overview** stays a summary and deeper content lives in dedicated tabs.

**Overview tab (summary only):**

- **Quick Stats** – At-a-glance metrics (projects, activity).
- **Client Health** – Relationship/account health score.
- **CRM Details** – Who they are, company, contact, last/next follow-up.
- **Billing Details** – Billing name, email, address (edit in place).
- **Tags** – Categorization.
- **Custom Fields** – Optional/extended data.

The **overview card** at the top (above the tabs) shows: client name, email, company, phone, status, type, account created, last login, **total projects**, and **outstanding invoices count**. That count is the number of unpaid invoices and links conceptually to the Invoices tab.

**Other tabs:**

- **Contacts** – Multi-contact management.
- **Activity** – Activity timeline.
- **Projects** – List of client projects (links to project detail).
- **Invoices** – Full invoice summary (totals: invoiced, paid, outstanding) and invoice list. Moved out of Overview so Overview stays scannable.
- **Notes** – Client notes.

**Account Actions** (Reset Password, Resend Invitation, Delete Client) sit below the tabs so they are always visible.

## Features

### 1. Multi-Contact Management

Each client organization can have multiple contacts with different roles:

- **Primary Contact** - Main point of contact
- **Billing Contact** - Handles invoices and payments
- **Technical Contact** - Technical liaison
- **Decision Maker** - Approves proposals and contracts
- **General** - Other contacts

Each contact has:

- Name (first, last)
- Email
- Phone
- Job title
- Department
- Notes

### 2. Activity Timeline

Automatic and manual activity tracking for each client:

**Automatic Activities:**

- Contact added/removed
- Tag added/removed
- Invoice sent
- Payment received
- Project created/completed
- Proposal sent/accepted
- Status change

**Manual Activities:**

- Notes
- Calls
- Emails
- Meetings

### 3. Custom Fields

Define custom fields to capture additional client data:

**Field Types:**

- Text
- Number
- Date
- Select (dropdown)
- Multi-select
- Boolean (checkbox)
- URL
- Email
- Phone

### 4. Tags & Segmentation

Categorize and segment clients with tags:

**Default Tags:**

- VIP - High-value or priority clients
- Referral - Client was referred by another client
- New - Recently acquired client
- Returning - Client with previous completed projects
- Enterprise - Large enterprise client
- Startup - Startup or early-stage company
- Agency - Agency or partner
- Non-Profit - Non-profit organization

### 5. Health Scoring

Automatic client health calculation based on:

- **Payment History (0-25 points)** - On-time payments, average days overdue
- **Engagement (0-25 points)** - Message count, recency of messages
- **Project Success (0-25 points)** - Completion rate, projects on hold
- **Communication (0-25 points)** - Activity count, recency of activities

**Health Statuses:**

- **Healthy (70-100)** - Client is in good standing
- **At Risk (40-69)** - Client needs attention
- **Critical (0-39)** - Immediate action required

### 6. CRM Fields

Additional CRM-specific fields for clients:

- Acquisition Source - Where the client came from
- Industry - Client's industry
- Company Size - solo, small (2-10), medium (11-50), enterprise (50+)
- Website - Client's website URL
- Last Contact Date - Last interaction date
- Next Follow-up Date - Scheduled follow-up
- Preferred Contact Method - email, phone, text, slack
- Notes - General notes about client

### 7. Client Statistics

Comprehensive stats for each client:

- Total/Active/Completed projects
- Total invoiced/paid/outstanding amounts
- Average payment days
- Lifetime value
- Message count
- Last activity date

## Database Schema

### New Tables

```sql
-- Contacts within client accounts
CREATE TABLE client_contacts (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  department TEXT,
  role TEXT DEFAULT 'general',
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

-- Activity timeline
CREATE TABLE client_activities (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSON,
  created_by TEXT,
  created_at DATETIME
);

-- Custom field definitions
CREATE TABLE client_custom_fields (
  id INTEGER PRIMARY KEY,
  field_name TEXT NOT NULL UNIQUE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSON,
  is_required BOOLEAN DEFAULT FALSE,
  placeholder TEXT,
  default_value TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME
);

-- Custom field values
CREATE TABLE client_custom_field_values (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  field_value TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE(client_id, field_id)
);

-- Tags
CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6b7280',
  description TEXT,
  tag_type TEXT DEFAULT 'client',
  created_at DATETIME
);

-- Client-tag junction
CREATE TABLE client_tags (
  client_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME,
  PRIMARY KEY (client_id, tag_id)
);
```

### Clients Table Additions

```sql
ALTER TABLE clients ADD COLUMN health_score INTEGER DEFAULT 100;
ALTER TABLE clients ADD COLUMN health_status TEXT DEFAULT 'healthy';
ALTER TABLE clients ADD COLUMN lifetime_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN acquisition_source TEXT;
ALTER TABLE clients ADD COLUMN industry TEXT;
ALTER TABLE clients ADD COLUMN company_size TEXT;
ALTER TABLE clients ADD COLUMN website TEXT;
ALTER TABLE clients ADD COLUMN last_contact_date DATE;
ALTER TABLE clients ADD COLUMN next_follow_up_date DATE;
ALTER TABLE clients ADD COLUMN notes TEXT;
ALTER TABLE clients ADD COLUMN preferred_contact_method TEXT;
```

## API Endpoints

### Contact Management

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/clients/:id/contacts`|Get all contacts for a client|
|POST|`/api/clients/:id/contacts`|Create a new contact|
|PUT|`/api/clients/contacts/:contactId`|Update a contact|
|DELETE|`/api/clients/contacts/:contactId`|Delete a contact|
|POST|`/api/clients/:id/contacts/:contactId/set-primary`|Set primary contact|

### Activity Timeline

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/clients/:id/activities`|Get activity timeline|
|POST|`/api/clients/:id/activities`|Log an activity|
|GET|`/api/clients/activities/recent`|Get recent activities (all clients)|

### Custom Fields

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/clients/custom-fields`|Get all field definitions|
|POST|`/api/clients/custom-fields`|Create a field definition|
|PUT|`/api/clients/custom-fields/:fieldId`|Update a field definition|
|DELETE|`/api/clients/custom-fields/:fieldId`|Deactivate a field|
|GET|`/api/clients/:id/custom-fields`|Get field values for client|
|PUT|`/api/clients/:id/custom-fields`|Set field values for client|

### Tags

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/clients/tags`|Get all tags|
|POST|`/api/clients/tags`|Create a tag|
|PUT|`/api/clients/tags/:tagId`|Update a tag|
|DELETE|`/api/clients/tags/:tagId`|Delete a tag|
|GET|`/api/clients/:id/tags`|Get tags for a client|
|POST|`/api/clients/:id/tags/:tagId`|Add tag to client|
|DELETE|`/api/clients/:id/tags/:tagId`|Remove tag from client|
|GET|`/api/clients/by-tag/:tagId`|Get clients by tag|

### Health Scoring

|Method|Endpoint|Description|
|--------|----------|-------------|
|GET|`/api/clients/:id/health`|Get health score|
|POST|`/api/clients/:id/health/recalculate`|Recalculate health score|
|GET|`/api/clients/at-risk`|Get at-risk clients|
|GET|`/api/clients/:id/stats`|Get comprehensive stats|

### CRM Fields

|Method|Endpoint|Description|
|--------|----------|-------------|
|PUT|`/api/clients/:id/crm`|Update CRM fields|
|GET|`/api/clients/follow-up`|Get clients due for follow-up|

## Service Methods

The `client-service.ts` provides the following methods:

### Contact Methods

- `createContact(clientId, data)` - Create a contact
- `getContacts(clientId)` - Get all contacts
- `getContact(contactId)` - Get single contact
- `updateContact(contactId, data)` - Update a contact
- `deleteContact(contactId)` - Delete a contact
- `setPrimaryContact(clientId, contactId)` - Set primary contact

### Activity Methods

- `logActivity(clientId, activity)` - Log an activity
- `getActivityTimeline(clientId, filters)` - Get activity timeline
- `getRecentActivities(limit)` - Get recent activities

### Custom Field Methods

- `createCustomField(data)` - Create field definition
- `getCustomFields(includeInactive)` - Get all fields
- `updateCustomField(fieldId, data)` - Update field
- `deleteCustomField(fieldId)` - Deactivate field
- `setCustomFieldValue(clientId, fieldId, value)` - Set single value
- `getClientCustomFields(clientId)` - Get all values for client
- `setClientCustomFields(clientId, values)` - Set multiple values

### Tag Methods

- `createTag(data)` - Create a tag
- `getTags(tagType)` - Get all tags
- `updateTag(tagId, data)` - Update a tag
- `deleteTag(tagId)` - Delete a tag
- `addTagToClient(clientId, tagId)` - Add tag to client
- `removeTagFromClient(clientId, tagId)` - Remove tag from client
- `getClientTags(clientId)` - Get tags for client
- `getClientsByTag(tagId)` - Get clients by tag

### Health Scoring Methods

- `calculateHealthScore(clientId)` - Calculate health score
- `updateHealthStatus(clientId)` - Update health status
- `getAtRiskClients()` - Get at-risk clients
- `getClientLifetimeValue(clientId)` - Get lifetime value
- `getClientStats(clientId)` - Get comprehensive stats

### CRM Methods

- `updateCRMFields(clientId, data)` - Update CRM fields
- `getClientsForFollowUp()` - Get clients due for follow-up

## Files

### Created

- `server/database/migrations/030_client_enhancements.sql` - Database migration
- `server/services/client-service.ts` - Client service
- `docs/features/CLIENTS.md` - This documentation

### Modified

- `server/routes/clients.ts` - Added 25+ new endpoints
- `src/types/api.ts` - Added TypeScript interfaces

## Usage Examples

### Creating a Contact

```typescript
const response = await fetch('/api/clients/123/contacts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    title: 'CEO',
    role: 'decision_maker',
    isPrimary: true
  })
});
```

### Logging an Activity

```typescript
const response = await fetch('/api/clients/123/activities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    activityType: 'meeting',
    title: 'Project kickoff meeting',
    description: 'Discussed requirements and timeline'
  })
});
```

### Adding a Tag

```typescript
await fetch('/api/clients/123/tags/5', { method: 'POST' });
```

### Getting Health Score

```typescript
const response = await fetch('/api/clients/123/health');
const { health } = await response.json();
// { score: 85, status: 'healthy', factors: {...} }
```

## Change Log

### February 1, 2026 - Initial Implementation

- Created database migration for all CRM tables
- Implemented client-service.ts with all methods
- Added 25+ API endpoints to clients.ts
- Added TypeScript interfaces for all types
- Created feature documentation
