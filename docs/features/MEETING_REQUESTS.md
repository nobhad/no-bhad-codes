# Meeting Requests

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Request-based meeting scheduling where clients propose up to 3 preferred time slots and the admin confirms manually. Intentionally NOT self-serve booking — admin always has final say on timing.

## Architecture

### Data Flow

1. Client submits request via portal (type, preferred slots, duration, notes)
2. Admin sees pending requests in admin table
3. Admin confirms (picks a time + location) or declines (with reason)
4. On confirm: client gets styled email + meeting details in portal
5. Daily 9AM cron sends reminders for meetings happening in the next 24 hours
6. Admin can download .ics calendar file for any confirmed meeting

### Database Tables

- `meeting_requests` — Full meeting lifecycle (client, project, type, status, slots, confirmed datetime, location, notes, calendar event ID)

### Meeting Types

- Discovery Call, Consultation, Project Kickoff, Check-In, Review, Other

### Statuses

- requested, confirmed, declined, rescheduled, completed, cancelled

### API Endpoints

**Client (Portal):**

- `POST /api/meeting-requests` — Submit request
- `GET /api/meeting-requests/my` — Client's requests
- `POST /api/meeting-requests/:id/cancel` — Cancel own request

**Admin:**

- `GET /api/meeting-requests` — All requests (filter by ?status=)
- `GET /api/meeting-requests/:id` — Single request
- `POST /api/meeting-requests/:id/confirm` — Confirm with time + location
- `POST /api/meeting-requests/:id/decline` — Decline with reason
- `POST /api/meeting-requests/:id/reschedule` — Counter-propose times
- `POST /api/meeting-requests/:id/complete` — Mark completed
- `GET /api/meeting-requests/:id/ics` — Download .ics calendar file

### ICS Generation

Generates valid iCalendar files with VEVENT including DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION. Dates formatted as `YYYYMMDDTHHmmssZ` (UTC).

### Scheduler

- Cron: `0 9 * * *` (daily at 9:00 AM)
- Sends reminders for confirmed meetings in the next 24 hours
- Emails both client and admin

## Key Files

- `server/services/meeting-request-service.ts` — CRUD, confirm, ICS generation, reminders
- `server/services/meeting-request-types.ts` — TypeScript interfaces + constants
- `server/routes/meeting-requests/portal.ts` — Client routes
- `server/routes/meeting-requests/admin.ts` — Admin routes
- `server/database/migrations/123_meeting_requests.sql` — Schema
- `src/react/features/portal/meetings/MeetingRequestForm.tsx` — Client form
- `src/react/features/portal/meetings/MeetingRequestsList.tsx` — Client list
- `src/react/features/admin/meetings/MeetingRequestsTable.tsx` — Admin table

## Change Log

### 2026-03-17 — Initial Implementation

- Meeting request system with client submission + admin confirmation
- 6 meeting types, 6 statuses, 5 location types
- ICS calendar file generation
- Styled confirmation emails
- Daily meeting reminder cron
- Portal + admin React components
