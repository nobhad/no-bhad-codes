/**
 * ===============================================
 * CALENDAR INTEGRATION SERVICE
 * ===============================================
 * @file server/services/integrations/calendar-service.ts
 *
 * Provides Google Calendar integration for milestones
 * and task due dates. Also supports iCal export format.
 *
 * SETUP REQUIRED FOR GOOGLE CALENDAR:
 * 1. Create Google Cloud project
 * 2. Enable Calendar API
 * 3. Create OAuth2 credentials
 * 4. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */

import { getDatabase } from '../../database/init';

// Google Calendar configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Calendar event types
export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    date?: string; // YYYY-MM-DD for all-day events
    dateTime?: string; // ISO 8601 for timed events
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

// Google Calendar token
export interface GoogleCalendarToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type: string;
}

// Calendar sync configuration
export interface CalendarSyncConfig {
  id?: number;
  userId: number;
  calendarId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  syncMilestones: boolean;
  syncTasks: boolean;
  syncInvoiceDueDates: boolean;
  lastSyncAt?: string;
  isActive: boolean;
}

// iCal format constants
const ICAL_PRODID = '-//No Bhad Codes//Calendar Export//EN';
const ICAL_VERSION = '2.0';

/**
 * Check if Google Calendar is configured
 */
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

/**
 * Get Google OAuth URL for calendar access
 */
export function getGoogleAuthUrl(state?: string): string {
  if (!isGoogleCalendarConfigured()) {
    throw new Error('Google Calendar is not configured');
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent'
  });

  if (state) {
    params.append('state', state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleCalendarToken> {
  if (!isGoogleCalendarConfigured()) {
    throw new Error('Google Calendar is not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI
    }).toString()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Google OAuth error: ${error.error_description || error.error}`);
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    token_type: data.token_type
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleCalendarToken> {
  if (!isGoogleCalendarConfigured()) {
    throw new Error('Google Calendar is not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token refresh error: ${error.error_description || error.error}`);
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // Refresh token doesn't change
    expires_at: Date.now() + (data.expires_in * 1000),
    token_type: data.token_type
  };
}

/**
 * Create calendar event in Google Calendar
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent
): Promise<CalendarEvent> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Google Calendar API error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Update calendar event in Google Calendar
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<CalendarEvent>
): Promise<CalendarEvent> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Google Calendar API error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Delete calendar event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(`Google Calendar API error: ${error.error?.message || response.statusText}`);
  }
}

/**
 * Convert milestone to calendar event
 */
export function milestoneToCalendarEvent(milestone: Record<string, unknown>, projectName: string): CalendarEvent {
  const dueDate = milestone.due_date as string;

  return {
    summary: `[Milestone] ${milestone.title}`,
    description: `Project: ${projectName}\n\n${milestone.description || ''}\n\nStatus: ${milestone.status}`,
    start: {
      date: dueDate.split('T')[0] // All-day event
    },
    end: {
      date: dueDate.split('T')[0]
    },
    colorId: getColorIdForStatus(milestone.status as string),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 }, // 1 day before
        { method: 'popup', minutes: 60 } // 1 hour before
      ]
    },
    extendedProperties: {
      private: {
        source: 'no-bhad-codes',
        type: 'milestone',
        milestoneId: String(milestone.id),
        projectId: String(milestone.project_id)
      }
    }
  };
}

/**
 * Convert task to calendar event
 */
export function taskToCalendarEvent(task: Record<string, unknown>, projectName: string): CalendarEvent {
  const dueDate = task.due_date as string;

  return {
    summary: `[Task] ${task.title}`,
    description: `Project: ${projectName}\nPriority: ${task.priority || 'normal'}\n\n${task.description || ''}\n\nStatus: ${task.status}`,
    start: {
      date: dueDate.split('T')[0]
    },
    end: {
      date: dueDate.split('T')[0]
    },
    attendees: task.assigned_to ? [{
      email: task.assigned_to as string,
      responseStatus: 'needsAction'
    }] : undefined,
    colorId: getColorIdForPriority(task.priority as string),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 }
      ]
    },
    extendedProperties: {
      private: {
        source: 'no-bhad-codes',
        type: 'task',
        taskId: String(task.id),
        projectId: String(task.project_id)
      }
    }
  };
}

/**
 * Convert invoice due date to calendar event
 */
export function invoiceToCalendarEvent(invoice: Record<string, unknown>): CalendarEvent {
  const dueDate = invoice.due_date as string;
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(invoice.total_amount));

  return {
    summary: `[Invoice Due] ${invoice.invoice_number} - ${amount}`,
    description: `Client: ${invoice.client_name}\nAmount: ${amount}\n\nInvoice #${invoice.invoice_number}`,
    start: {
      date: dueDate.split('T')[0]
    },
    end: {
      date: dueDate.split('T')[0]
    },
    colorId: '11', // Red for payment due
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 4320 }, // 3 days before
        { method: 'email', minutes: 1440 }, // 1 day before
        { method: 'popup', minutes: 60 }
      ]
    },
    extendedProperties: {
      private: {
        source: 'no-bhad-codes',
        type: 'invoice',
        invoiceId: String(invoice.id)
      }
    }
  };
}

/**
 * Get color ID based on status
 */
function getColorIdForStatus(status: string): string {
  const colors: Record<string, string> = {
    'pending': '5', // Yellow
    'in_progress': '9', // Blue
    'completed': '10', // Green
    'blocked': '11' // Red
  };
  return colors[status] || '8'; // Gray default
}

/**
 * Get color ID based on priority
 */
function getColorIdForPriority(priority: string): string {
  const colors: Record<string, string> = {
    'low': '8', // Gray
    'medium': '5', // Yellow
    'high': '6', // Orange
    'urgent': '11' // Red
  };
  return colors[priority] || '8';
}

/**
 * Generate iCal format for export (no Google API required)
 */
export function generateICalExport(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    `PRODID:${ICAL_PRODID}`,
    `VERSION:${ICAL_VERSION}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  for (const event of events) {
    const uid = `${event.extendedProperties?.private?.type || 'event'}-${event.extendedProperties?.private?.milestoneId || event.extendedProperties?.private?.taskId || event.extendedProperties?.private?.invoiceId || Date.now()}@no-bhad-codes`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
    lines.push(`SUMMARY:${escapeICalText(event.summary)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
    }

    if (event.start.date) {
      lines.push(`DTSTART;VALUE=DATE:${event.start.date.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${event.end?.date?.replace(/-/g, '') || event.start.date.replace(/-/g, '')}`);
    } else if (event.start.dateTime) {
      lines.push(`DTSTART:${formatICalDate(new Date(event.start.dateTime))}`);
      lines.push(`DTEND:${formatICalDate(new Date(event.end?.dateTime || event.start.dateTime))}`);
    }

    if (event.attendees) {
      for (const attendee of event.attendees) {
        lines.push(`ATTENDEE;CN=${attendee.displayName || attendee.email}:mailto:${attendee.email}`);
      }
    }

    // Add alarm/reminder
    if (event.reminders?.overrides) {
      for (const reminder of event.reminders.overrides) {
        lines.push('BEGIN:VALARM');
        lines.push(`TRIGGER:-PT${reminder.minutes}M`);
        lines.push(`ACTION:${reminder.method === 'email' ? 'EMAIL' : 'DISPLAY'}`);
        lines.push(`DESCRIPTION:${escapeICalText(event.summary)}`);
        lines.push('END:VALARM');
      }
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Export project milestones and tasks to iCal
 */
export async function exportProjectToICal(projectId: number): Promise<string> {
  const db = getDatabase();

  // Get project details
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]) as { name: string } | undefined;
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const events: CalendarEvent[] = [];

  // Get milestones
  const milestones = await db.all(
    'SELECT * FROM milestones WHERE project_id = ? AND due_date IS NOT NULL ORDER BY due_date',
    [projectId]
  ) as Record<string, unknown>[];

  for (const milestone of milestones) {
    events.push(milestoneToCalendarEvent(milestone, project.name));
  }

  // Get tasks
  const tasks = await db.all(
    'SELECT * FROM project_tasks WHERE project_id = ? AND due_date IS NOT NULL ORDER BY due_date',
    [projectId]
  ) as Record<string, unknown>[];

  for (const task of tasks) {
    events.push(taskToCalendarEvent(task, project.name));
  }

  return generateICalExport(events);
}

/**
 * Export all upcoming items to iCal
 */
export async function exportUpcomingToICal(daysAhead: number = 30): Promise<string> {
  const db = getDatabase();
  const events: CalendarEvent[] = [];

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  // Get upcoming milestones
  const milestones = await db.all(
    `SELECT m.*, p.name as project_name FROM milestones m
     JOIN projects p ON m.project_id = p.id
     WHERE m.due_date IS NOT NULL AND m.due_date <= ? AND m.status != 'completed'
     ORDER BY m.due_date`,
    [futureDateStr]
  ) as Array<Record<string, unknown> & { project_name: string }>;

  for (const milestone of milestones) {
    events.push(milestoneToCalendarEvent(milestone, milestone.project_name));
  }

  // Get upcoming tasks
  const tasks = await db.all(
    `SELECT t.*, p.name as project_name FROM project_tasks t
     JOIN projects p ON t.project_id = p.id
     WHERE t.due_date IS NOT NULL AND t.due_date <= ? AND t.status != 'completed'
     ORDER BY t.due_date`,
    [futureDateStr]
  ) as Array<Record<string, unknown> & { project_name: string }>;

  for (const task of tasks) {
    events.push(taskToCalendarEvent(task, task.project_name));
  }

  // Get upcoming invoice due dates
  const invoices = await db.all(
    `SELECT i.*, c.name as client_name FROM invoices i
     JOIN clients c ON i.client_id = c.id
     WHERE i.due_date IS NOT NULL AND i.due_date <= ? AND i.status IN ('sent', 'pending', 'overdue')
     ORDER BY i.due_date`,
    [futureDateStr]
  ) as Record<string, unknown>[];

  for (const invoice of invoices) {
    events.push(invoiceToCalendarEvent(invoice));
  }

  return generateICalExport(events);
}

/**
 * Format date for iCal
 */
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Escape text for iCal
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Save calendar sync configuration
 */
export async function saveCalendarSyncConfig(config: CalendarSyncConfig): Promise<CalendarSyncConfig> {
  const db = getDatabase();

  if (config.id) {
    await db.run(
      `UPDATE calendar_sync_configs
       SET calendar_id = ?, access_token = ?, refresh_token = ?, expires_at = ?,
           sync_milestones = ?, sync_tasks = ?, sync_invoice_due_dates = ?, is_active = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [config.calendarId, config.accessToken, config.refreshToken, config.expiresAt,
       config.syncMilestones ? 1 : 0, config.syncTasks ? 1 : 0, config.syncInvoiceDueDates ? 1 : 0,
       config.isActive ? 1 : 0, config.id]
    );
    return config;
  } else {
    const result = await db.run(
      `INSERT INTO calendar_sync_configs
       (user_id, calendar_id, access_token, refresh_token, expires_at, sync_milestones, sync_tasks, sync_invoice_due_dates, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [config.userId, config.calendarId, config.accessToken, config.refreshToken, config.expiresAt,
       config.syncMilestones ? 1 : 0, config.syncTasks ? 1 : 0, config.syncInvoiceDueDates ? 1 : 0,
       config.isActive ? 1 : 0]
    );
    return { ...config, id: result.lastID };
  }
}

/**
 * Get calendar sync configuration for user
 */
export async function getCalendarSyncConfig(userId: number): Promise<CalendarSyncConfig | null> {
  const db = getDatabase();
  const row = await db.get('SELECT * FROM calendar_sync_configs WHERE user_id = ?', [userId]) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id as number,
    userId: row.user_id as number,
    calendarId: row.calendar_id as string,
    accessToken: row.access_token as string,
    refreshToken: row.refresh_token as string | undefined,
    expiresAt: row.expires_at as number,
    syncMilestones: Boolean(row.sync_milestones),
    syncTasks: Boolean(row.sync_tasks),
    syncInvoiceDueDates: Boolean(row.sync_invoice_due_dates),
    lastSyncAt: row.last_sync_at as string | undefined,
    isActive: Boolean(row.is_active)
  };
}

export default {
  isGoogleCalendarConfigured,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  milestoneToCalendarEvent,
  taskToCalendarEvent,
  invoiceToCalendarEvent,
  generateICalExport,
  exportProjectToICal,
  exportUpcomingToICal,
  saveCalendarSyncConfig,
  getCalendarSyncConfig
};
