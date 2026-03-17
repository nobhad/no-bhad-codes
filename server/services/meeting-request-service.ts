/**
 * ===============================================
 * MEETING REQUEST SERVICE
 * ===============================================
 * @file server/services/meeting-request-service.ts
 *
 * Service for managing client meeting requests,
 * including creation, confirmation, scheduling,
 * calendar file generation, and reminder emails.
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import { emailService } from './email-service.js';
import { BUSINESS_INFO } from '../config/business.js';
import { EMAIL_COLORS, EMAIL_TYPOGRAPHY } from '../config/email-styles.js';
import {
  type MeetingRequestWithNames,
  type CreateMeetingRequestParams,
  type ConfirmMeetingParams,
  type MeetingStatus,
  MEETING_TYPE_LABELS,
  DEFAULT_DURATION_MINUTES,
  VALID_MEETING_TYPES,
  LOCATION_TYPE_LABELS
} from './meeting-request-types.js';

// ============================================
// CONSTANTS
// ============================================

const SERVICE_TAG = '[MeetingRequest]';
const REMINDER_WINDOW_HOURS = 24;
const MILLISECONDS_PER_HOUR = 3_600_000;
const REMINDER_SENT_MARKER = '[REMINDER_SENT]';
const CALENDAR_PRODID = '-//No Bhad Codes//Meeting//EN';
const _ICS_DATE_FORMAT_LENGTH = 16; // YYYYMMDDTHHmmssZ

// ============================================
// SQL QUERIES
// ============================================

const LIST_QUERY = `
  SELECT
    mr.*,
    c.contact_name AS clientName,
    c.email AS clientEmail,
    p.name AS projectName
  FROM meeting_requests mr
  JOIN clients c ON c.id = mr.client_id
  LEFT JOIN projects p ON p.id = mr.project_id
`;

const ORDER_BY_CREATED = '\nORDER BY mr.created_at DESC';

// ============================================
// HELPERS
// ============================================

/**
 * Validate that a datetime string represents a future date.
 */
function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.getTime() > Date.now();
}

/**
 * Format a JS Date or ISO string to ICS datetime format (YYYYMMDDTHHmmssZ).
 */
function formatIcsDatetime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Calculate end datetime from start + duration in minutes.
 */
function calculateEndDatetime(startIso: string, durationMinutes: number): string {
  const startMs = new Date(startIso).getTime();
  const endMs = startMs + durationMinutes * 60_000;
  return new Date(endMs).toISOString();
}

/**
 * Build a meeting confirmation email body (HTML).
 */
function buildConfirmationEmailHtml(meeting: MeetingRequestWithNames): string {
  const meetingTypeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type;
  const locationLabel = LOCATION_TYPE_LABELS[meeting.location_type] || meeting.location_type;
  const confirmedDate = meeting.confirmed_datetime
    ? new Date(meeting.confirmed_datetime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })
    : 'TBD';

  return `
    <div style="font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; color: ${EMAIL_COLORS.bodyText}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight};">
      <h2 style="color: ${EMAIL_COLORS.bodyTextDark}; font-size: ${EMAIL_TYPOGRAPHY.headingFontSize};">Meeting Confirmed</h2>
      <p>Your <strong>${meetingTypeLabel}</strong> has been confirmed.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border}; font-weight: bold;">Date & Time</td>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border};">${confirmedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border}; font-weight: bold;">Duration</td>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border};">${meeting.duration_minutes} minutes</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border}; font-weight: bold;">Location</td>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border};">${locationLabel}${meeting.location_details ? ` - ${meeting.location_details}` : ''}</td>
        </tr>
      </table>
      ${meeting.admin_notes ? `<p style="color: ${EMAIL_COLORS.bodyTextLight};"><strong>Notes:</strong> ${meeting.admin_notes}</p>` : ''}
      <p style="color: ${EMAIL_COLORS.bodyTextMuted}; font-size: ${EMAIL_TYPOGRAPHY.smallFontSize};">${BUSINESS_INFO.name} - ${BUSINESS_INFO.email}</p>
    </div>
  `;
}

/**
 * Build a meeting reminder email body (HTML).
 */
function buildReminderEmailHtml(meeting: MeetingRequestWithNames): string {
  const meetingTypeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type;
  const locationLabel = LOCATION_TYPE_LABELS[meeting.location_type] || meeting.location_type;
  const confirmedDate = meeting.confirmed_datetime
    ? new Date(meeting.confirmed_datetime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })
    : 'TBD';

  return `
    <div style="font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; color: ${EMAIL_COLORS.bodyText}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight};">
      <h2 style="color: ${EMAIL_COLORS.bodyTextDark}; font-size: ${EMAIL_TYPOGRAPHY.headingFontSize};">Meeting Reminder</h2>
      <p>This is a reminder that your <strong>${meetingTypeLabel}</strong> is coming up soon.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border}; font-weight: bold;">Date & Time</td>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border};">${confirmedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border}; font-weight: bold;">Duration</td>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border};">${meeting.duration_minutes} minutes</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border}; font-weight: bold;">Location</td>
          <td style="padding: 8px; border: 1px solid ${EMAIL_COLORS.border};">${locationLabel}${meeting.location_details ? ` - ${meeting.location_details}` : ''}</td>
        </tr>
      </table>
      <p style="color: ${EMAIL_COLORS.bodyTextMuted}; font-size: ${EMAIL_TYPOGRAPHY.smallFontSize};">${BUSINESS_INFO.name} - ${BUSINESS_INFO.email}</p>
    </div>
  `;
}

// ============================================
// SERVICE
// ============================================

export const meetingRequestService = {
  /**
   * Create a new meeting request from a client.
   * Validates that at least one preferred slot is in the future.
   */
  async create(clientId: number, params: CreateMeetingRequestParams): Promise<number> {
    const db = getDatabase();

    // Validate meeting type
    if (!VALID_MEETING_TYPES.includes(params.meetingType)) {
      throw new Error(`Invalid meeting type: ${params.meetingType}`);
    }

    // Validate that the primary preferred slot is a future date
    if (!isFutureDate(params.preferredSlot1)) {
      throw new Error('Preferred slot 1 must be a valid future date');
    }

    // Validate optional slots if provided
    if (params.preferredSlot2 && !isFutureDate(params.preferredSlot2)) {
      throw new Error('Preferred slot 2 must be a valid future date');
    }
    if (params.preferredSlot3 && !isFutureDate(params.preferredSlot3)) {
      throw new Error('Preferred slot 3 must be a valid future date');
    }

    const durationMinutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;

    const result = await db.run(
      `INSERT INTO meeting_requests
        (client_id, project_id, meeting_type, preferred_slot_1, preferred_slot_2,
         preferred_slot_3, duration_minutes, client_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        params.projectId ?? null,
        params.meetingType,
        params.preferredSlot1,
        params.preferredSlot2 ?? null,
        params.preferredSlot3 ?? null,
        durationMinutes,
        params.notes ?? null
      ]
    );

    const meetingRequestId = result.lastID!;
    logger.info(`${SERVICE_TAG} Created meeting request #${meetingRequestId} for client #${clientId}`);

    return meetingRequestId;
  },

  /**
   * List meeting requests with optional filters.
   * Joins clients and projects for display names.
   */
  async list(filters?: { status?: MeetingStatus; clientId?: number }): Promise<MeetingRequestWithNames[]> {
    const db = getDatabase();
    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    if (filters?.status) {
      conditions.push('mr.status = ?');
      queryParams.push(filters.status);
    }

    if (filters?.clientId) {
      conditions.push('mr.client_id = ?');
      queryParams.push(filters.clientId);
    }

    const whereClause = conditions.length > 0
      ? `\nWHERE ${conditions.join(' AND ')}`
      : '';

    const sql = LIST_QUERY + whereClause + ORDER_BY_CREATED;
    const rows = await db.all(sql, queryParams);

    return rows as MeetingRequestWithNames[];
  },

  /**
   * Get a single meeting request by ID with joined names.
   */
  async getById(id: number): Promise<MeetingRequestWithNames | null> {
    const db = getDatabase();
    const sql = `${LIST_QUERY  }\nWHERE mr.id = ?`;
    const row = await db.get(sql, [id]);
    return (row as MeetingRequestWithNames) ?? null;
  },

  /**
   * Get all meeting requests for a specific client.
   */
  async getByClient(clientId: number): Promise<MeetingRequestWithNames[]> {
    return meetingRequestService.list({ clientId });
  },

  /**
   * Confirm a meeting request: set confirmed datetime, location, and status.
   * Sends a confirmation email to the client.
   */
  async confirm(id: number, params: ConfirmMeetingParams): Promise<void> {
    const db = getDatabase();

    const meeting = await meetingRequestService.getById(id);
    if (!meeting) {
      throw new Error(`Meeting request #${id} not found`);
    }

    const durationMinutes = params.durationMinutes ?? meeting.duration_minutes;
    let adminNotes = params.adminNotes ?? meeting.admin_notes ?? '';

    if (params.createCalendarEvent) {
      const calendarNote = '[Calendar event requested at confirmation]';
      adminNotes = adminNotes ? `${adminNotes}\n${calendarNote}` : calendarNote;
    }

    await db.run(
      `UPDATE meeting_requests
       SET status = 'confirmed',
           confirmed_datetime = ?,
           duration_minutes = ?,
           location_type = ?,
           location_details = ?,
           admin_notes = ?,
           confirmed_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        params.confirmedDatetime,
        durationMinutes,
        params.locationType,
        params.locationDetails ?? null,
        adminNotes || null,
        id
      ]
    );

    logger.info(`${SERVICE_TAG} Confirmed meeting request #${id}`);

    // Send confirmation email to client
    try {
      const updatedMeeting = await meetingRequestService.getById(id);
      if (updatedMeeting) {
        const meetingTypeLabel = MEETING_TYPE_LABELS[updatedMeeting.meeting_type] || updatedMeeting.meeting_type;
        await emailService.sendEmail({
          to: updatedMeeting.clientEmail,
          subject: `Meeting Confirmed: ${meetingTypeLabel} - ${BUSINESS_INFO.name}`,
          text: `Your ${meetingTypeLabel} has been confirmed for ${params.confirmedDatetime}. Duration: ${durationMinutes} minutes.`,
          html: buildConfirmationEmailHtml(updatedMeeting)
        });
        logger.info(`${SERVICE_TAG} Sent confirmation email for meeting #${id}`);
      }
    } catch (emailError) {
      logger.error(`${SERVICE_TAG} Failed to send confirmation email for meeting #${id}`, {
        error: emailError instanceof Error ? emailError : undefined
      });
    }
  },

  /**
   * Decline a meeting request with a reason.
   */
  async decline(id: number, reason: string): Promise<void> {
    const db = getDatabase();

    const meeting = await meetingRequestService.getById(id);
    if (!meeting) {
      throw new Error(`Meeting request #${id} not found`);
    }

    await db.run(
      `UPDATE meeting_requests
       SET status = 'declined',
           decline_reason = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [reason, id]
    );

    logger.info(`${SERVICE_TAG} Declined meeting request #${id}`);
  },

  /**
   * Reschedule a meeting request with new preferred time slots.
   */
  async reschedule(id: number, newSlots: string[]): Promise<void> {
    const db = getDatabase();

    const meeting = await meetingRequestService.getById(id);
    if (!meeting) {
      throw new Error(`Meeting request #${id} not found`);
    }

    if (!newSlots.length) {
      throw new Error('At least one preferred slot is required for rescheduling');
    }

    const slot1 = newSlots[0] ?? null;
    const slot2 = newSlots[1] ?? null;
    const slot3 = newSlots[2] ?? null;

    await db.run(
      `UPDATE meeting_requests
       SET status = 'rescheduled',
           preferred_slot_1 = ?,
           preferred_slot_2 = ?,
           preferred_slot_3 = ?,
           confirmed_datetime = NULL,
           confirmed_at = NULL,
           updated_at = datetime('now')
       WHERE id = ?`,
      [slot1, slot2, slot3, id]
    );

    logger.info(`${SERVICE_TAG} Rescheduled meeting request #${id}`);
  },

  /**
   * Cancel a meeting request. Only allowed if it belongs to the given client.
   */
  async cancel(id: number, clientId: number): Promise<void> {
    const db = getDatabase();

    const meeting = await meetingRequestService.getById(id);
    if (!meeting) {
      throw new Error(`Meeting request #${id} not found`);
    }

    if (meeting.client_id !== clientId) {
      throw new Error('You can only cancel your own meeting requests');
    }

    await db.run(
      `UPDATE meeting_requests
       SET status = 'cancelled',
           updated_at = datetime('now')
       WHERE id = ?`,
      [id]
    );

    logger.info(`${SERVICE_TAG} Client #${clientId} cancelled meeting request #${id}`);
  },

  /**
   * Mark a meeting request as completed.
   */
  async complete(id: number): Promise<void> {
    const db = getDatabase();

    const meeting = await meetingRequestService.getById(id);
    if (!meeting) {
      throw new Error(`Meeting request #${id} not found`);
    }

    await db.run(
      `UPDATE meeting_requests
       SET status = 'completed',
           completed_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
      [id]
    );

    logger.info(`${SERVICE_TAG} Completed meeting request #${id}`);
  },

  /**
   * Generate a valid .ics calendar file content for a confirmed meeting.
   */
  generateIcs(meeting: MeetingRequestWithNames): string {
    if (!meeting.confirmed_datetime) {
      throw new Error('Cannot generate ICS for unconfirmed meeting');
    }

    const startFormatted = formatIcsDatetime(meeting.confirmed_datetime);
    const endIso = calculateEndDatetime(meeting.confirmed_datetime, meeting.duration_minutes);
    const endFormatted = formatIcsDatetime(endIso);
    const meetingTypeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type;
    const summary = `${meetingTypeLabel} - ${meeting.clientName}`;
    const description = meeting.client_notes ?? '';
    const location = meeting.location_details ?? '';

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:${CALENDAR_PRODID}`,
      'BEGIN:VEVENT',
      `DTSTART:${startFormatted}`,
      `DTEND:${endFormatted}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    return lines.join('\r\n');
  },

  /**
   * Find confirmed meetings within the next 24 hours that have not
   * had a reminder sent, send reminder emails, and mark them.
   * Returns the number of reminders sent.
   */
  async sendUpcomingReminders(): Promise<number> {
    const db = getDatabase();
    const now = new Date();
    const reminderCutoff = new Date(now.getTime() + REMINDER_WINDOW_HOURS * MILLISECONDS_PER_HOUR);

    const upcomingMeetings = await db.all(
      `${LIST_QUERY}
       WHERE mr.status = 'confirmed'
         AND mr.confirmed_datetime IS NOT NULL
         AND mr.confirmed_datetime >= ?
         AND mr.confirmed_datetime <= ?
         AND (mr.admin_notes IS NULL OR mr.admin_notes NOT LIKE ?)
       ORDER BY mr.confirmed_datetime ASC`,
      [now.toISOString(), reminderCutoff.toISOString(), `%${REMINDER_SENT_MARKER}%`]
    ) as MeetingRequestWithNames[];

    let remindersSent = 0;

    for (const meeting of upcomingMeetings) {
      try {
        const meetingTypeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type;
        const reminderSubject = `Reminder: ${meetingTypeLabel} Tomorrow - ${BUSINESS_INFO.name}`;
        const reminderHtml = buildReminderEmailHtml(meeting);
        const reminderText = `Reminder: Your ${meetingTypeLabel} is scheduled for ${meeting.confirmed_datetime}. Duration: ${meeting.duration_minutes} minutes.`;

        // Send reminder to client
        await emailService.sendEmail({
          to: meeting.clientEmail,
          subject: reminderSubject,
          text: reminderText,
          html: reminderHtml
        });

        // Send reminder to admin
        await emailService.sendEmail({
          to: BUSINESS_INFO.email,
          subject: `${reminderSubject} (${meeting.clientName})`,
          text: `${reminderText} Client: ${meeting.clientName} (${meeting.clientEmail})`,
          html: reminderHtml
        });

        // Mark reminder as sent via admin_notes
        const existingNotes = meeting.admin_notes ?? '';
        const updatedNotes = existingNotes
          ? `${existingNotes}\n${REMINDER_SENT_MARKER} ${now.toISOString()}`
          : `${REMINDER_SENT_MARKER} ${now.toISOString()}`;

        await db.run(
          `UPDATE meeting_requests
           SET admin_notes = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [updatedNotes, meeting.id]
        );

        remindersSent++;
        logger.info(`${SERVICE_TAG} Sent reminder for meeting #${meeting.id} to ${meeting.clientEmail}`);
      } catch (reminderError) {
        logger.error(`${SERVICE_TAG} Failed to send reminder for meeting #${meeting.id}`, {
          error: reminderError instanceof Error ? reminderError : undefined
        });
      }
    }

    logger.info(`${SERVICE_TAG} Sent ${remindersSent} meeting reminders`);
    return remindersSent;
  }
};
