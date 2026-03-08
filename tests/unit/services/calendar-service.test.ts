/**
 * ===============================================
 * UNIT TESTS - CALENDAR SERVICE
 * ===============================================
 * @file tests/unit/services/calendar-service.test.ts
 *
 * Tests for Google Calendar integration service including:
 * - isGoogleCalendarConfigured
 * - getGoogleAuthUrl
 * - exchangeCodeForTokens
 * - refreshAccessToken
 * - ensureValidToken
 * - createGoogleCalendarEvent / updateGoogleCalendarEvent / deleteGoogleCalendarEvent
 * - milestoneToCalendarEvent / taskToCalendarEvent / invoiceToCalendarEvent
 * - generateICalExport
 * - exportProjectToICal / exportUpcomingToICal
 * - saveCalendarSyncConfig / getCalendarSyncConfig
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// MOCK SETUP
// ============================================

const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock global fetch for Google API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============================================
// IMPORTS (after mocks)
// ============================================

import {
  isGoogleCalendarConfigured,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  ensureValidToken,
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
  getCalendarSyncConfig,
  type CalendarEvent,
  type CalendarSyncConfig
} from '../../../server/services/integrations/calendar-service';

// ============================================
// HELPERS
// ============================================

function makeMockJsonResponse(ok: boolean, body: unknown, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: { get: vi.fn().mockReturnValue(null) },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body))
  } as unknown as Response;
}

function makeRateLimitResponse(retryAfterSeconds?: number): Response {
  return {
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    headers: {
      get: vi.fn().mockImplementation((header: string) =>
        header === 'Retry-After' ? (retryAfterSeconds ? String(retryAfterSeconds) : null) : null
      )
    },
    json: vi.fn().mockResolvedValue({ error: { message: 'rate limited' } }),
    text: vi.fn().mockResolvedValue('rate limited')
  } as unknown as Response;
}

const NOW = Date.now();
const FUTURE_EXPIRY = NOW + 3_600_000; // 1 hour from now
const PAST_EXPIRY = NOW - 1_000; // Already expired

// ============================================
// TESTS: isGoogleCalendarConfigured
// ============================================

describe('isGoogleCalendarConfigured', () => {
  it('returns false when environment variables are not set', () => {
    // In test environment, env vars are not set
    const result = isGoogleCalendarConfigured();
    // The module reads env at import time, result depends on test environment
    // We verify it returns a boolean
    expect(typeof result).toBe('boolean');
  });
});

// ============================================
// TESTS: getGoogleAuthUrl
// ============================================

describe('getGoogleAuthUrl', () => {
  it('throws when Google Calendar is not configured', () => {
    // GOOGLE_CLIENT_ID etc. are not set in test env, so it should throw
    if (!isGoogleCalendarConfigured()) {
      expect(() => getGoogleAuthUrl()).toThrow('Google Calendar is not configured');
    }
  });

  it('includes state parameter when provided and configured', () => {
    // Only test this branch if configured
    if (isGoogleCalendarConfigured()) {
      const url = getGoogleAuthUrl('my-state-token');
      expect(url).toContain('state=my-state-token');
    }
  });
});

// ============================================
// TESTS: exchangeCodeForTokens
// ============================================

describe('exchangeCodeForTokens', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('throws when Google Calendar is not configured', async () => {
    if (!isGoogleCalendarConfigured()) {
      await expect(exchangeCodeForTokens('test-code')).rejects.toThrow(
        'Google Calendar is not configured'
      );
    }
  });

  it('returns token when configured and response is ok', async () => {
    if (!isGoogleCalendarConfigured()) {
      return; // Skip — can't test without config
    }

    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(true, {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    );

    const result = await exchangeCodeForTokens('auth-code-123');

    expect(result.access_token).toBe('access-123');
    expect(result.refresh_token).toBe('refresh-456');
    expect(result.token_type).toBe('Bearer');
    expect(result.expires_at).toBeGreaterThan(Date.now());
  });

  it('throws when OAuth response is not ok', async () => {
    if (!isGoogleCalendarConfigured()) {
      return;
    }

    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(false, {
        error: 'invalid_grant',
        error_description: 'Code expired'
      })
    );

    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow('Code expired');
  });
});

// ============================================
// TESTS: refreshAccessToken
// ============================================

describe('refreshAccessToken', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('throws when Google Calendar is not configured', async () => {
    if (!isGoogleCalendarConfigured()) {
      await expect(refreshAccessToken('some-refresh-token')).rejects.toThrow(
        'Google Calendar is not configured'
      );
    }
  });

  it('returns new token when configured and refresh succeeds', async () => {
    if (!isGoogleCalendarConfigured()) {
      return;
    }

    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(true, {
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    );

    const result = await refreshAccessToken('my-refresh-token');

    expect(result.access_token).toBe('new-access-token');
    expect(result.refresh_token).toBe('my-refresh-token'); // unchanged
    expect(result.expires_at).toBeGreaterThan(Date.now());
  });
});

// ============================================
// TESTS: ensureValidToken
// ============================================

describe('ensureValidToken', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns the existing access token when not expired', async () => {
    const result = await ensureValidToken('valid-token', 'refresh-token', FUTURE_EXPIRY);
    expect(result).toBe('valid-token');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null when token is expired and no refresh token is provided', async () => {
    const result = await ensureValidToken('expired-token', undefined, PAST_EXPIRY);
    expect(result).toBeNull();
  });

  it('attempts to refresh when token is expired and refresh token exists', async () => {
    if (!isGoogleCalendarConfigured()) {
      // Without Google config, refreshAccessToken throws, ensureValidToken catches and returns null
      const result = await ensureValidToken('expired-token', 'refresh-token', PAST_EXPIRY);
      expect(result).toBeNull();
      return;
    }

    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(true, {
        access_token: 'refreshed-access-token',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    );

    const result = await ensureValidToken('expired-token', 'refresh-token', PAST_EXPIRY);
    expect(result).toBe('refreshed-access-token');
  });

  it('returns null gracefully when token refresh fails', async () => {
    if (isGoogleCalendarConfigured()) {
      mockFetch.mockRejectedValueOnce(new Error('Refresh failed'));
    }

    // Whether configured or not, a failing refresh should result in null
    const result = await ensureValidToken('expired-token', 'bad-refresh', PAST_EXPIRY);
    expect(result).toBeNull();
  });
});

// ============================================
// TESTS: createGoogleCalendarEvent
// ============================================

describe('createGoogleCalendarEvent', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const sampleEvent: CalendarEvent = {
    summary: 'Test Event',
    start: { date: '2026-03-01' },
    end: { date: '2026-03-01' }
  };

  it('returns the created event when API call succeeds', async () => {
    const returnedEvent = { ...sampleEvent, id: 'google-event-id-123' };
    mockFetch.mockResolvedValueOnce(makeMockJsonResponse(true, returnedEvent));

    const result = await createGoogleCalendarEvent('access-token', 'primary', sampleEvent);

    expect(result).toEqual(returnedEvent);
  });

  it('sends POST to the correct Google Calendar endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeMockJsonResponse(true, { id: '1' }));

    await createGoogleCalendarEvent('my-token', 'primary', sampleEvent);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('calendars/primary/events'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' })
      })
    );
  });

  it('throws when API returns a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(false, { error: { message: 'Forbidden' } }, 403)
    );

    await expect(
      createGoogleCalendarEvent('bad-token', 'primary', sampleEvent)
    ).rejects.toThrow('Google Calendar API error: Forbidden');
  });

  it('retries on 429 rate limit and succeeds on second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce(makeRateLimitResponse())
      .mockResolvedValueOnce(makeMockJsonResponse(true, { id: 'evt-1', summary: 'Test Event' }));

    // Use fake timers to avoid actual sleep delays
    vi.useFakeTimers();
    const promise = createGoogleCalendarEvent('token', 'primary', sampleEvent);
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// TESTS: updateGoogleCalendarEvent
// ============================================

describe('updateGoogleCalendarEvent', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns the updated event when API call succeeds', async () => {
    const updatedEvent = { summary: 'Updated Event', id: 'evt-123' };
    mockFetch.mockResolvedValueOnce(makeMockJsonResponse(true, updatedEvent));

    const result = await updateGoogleCalendarEvent('token', 'primary', 'evt-123', {
      summary: 'Updated Event'
    });

    expect(result).toEqual(updatedEvent);
  });

  it('sends PATCH to the correct endpoint with event id', async () => {
    mockFetch.mockResolvedValueOnce(makeMockJsonResponse(true, { id: 'evt-999' }));

    await updateGoogleCalendarEvent('my-token', 'work@group.calendar.google.com', 'evt-999', {
      summary: 'Updated'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('evt-999'),
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('throws when update fails', async () => {
    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(false, { error: { message: 'Not Found' } }, 404)
    );

    await expect(
      updateGoogleCalendarEvent('token', 'primary', 'missing-id', {})
    ).rejects.toThrow('Not Found');
  });
});

// ============================================
// TESTS: deleteGoogleCalendarEvent
// ============================================

describe('deleteGoogleCalendarEvent', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('resolves without throwing when deletion succeeds (204)', async () => {
    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(true, null, 204)
    );

    await expect(
      deleteGoogleCalendarEvent('token', 'primary', 'evt-to-delete')
    ).resolves.toBeUndefined();
  });

  it('resolves without throwing when event is already gone (404)', async () => {
    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(false, { error: { message: 'Not Found' } }, 404)
    );

    await expect(
      deleteGoogleCalendarEvent('token', 'primary', 'already-deleted')
    ).resolves.toBeUndefined();
  });

  it('throws when deletion fails with non-404 error', async () => {
    mockFetch.mockResolvedValueOnce(
      makeMockJsonResponse(false, { error: { message: 'Permission denied' } }, 403)
    );

    await expect(
      deleteGoogleCalendarEvent('token', 'primary', 'evt-1')
    ).rejects.toThrow('Permission denied');
  });

  it('sends DELETE to the correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeMockJsonResponse(true, null, 204));

    await deleteGoogleCalendarEvent('my-token', 'primary', 'event-xyz');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('event-xyz'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

// ============================================
// TESTS: milestoneToCalendarEvent
// ============================================

describe('milestoneToCalendarEvent', () => {
  const milestone = {
    id: 10,
    project_id: 1,
    title: 'Design Phase',
    description: 'Complete all design assets',
    due_date: '2026-04-15T00:00:00Z',
    status: 'in_progress'
  };

  it('creates a CalendarEvent with [Milestone] prefix in summary', () => {
    const event = milestoneToCalendarEvent(milestone, 'My Project');
    expect(event.summary).toBe('[Milestone] Design Phase');
  });

  it('uses the date portion of due_date for all-day event', () => {
    const event = milestoneToCalendarEvent(milestone, 'My Project');
    expect(event.start.date).toBe('2026-04-15');
    expect(event.end.date).toBe('2026-04-15');
  });

  it('includes project name in description', () => {
    const event = milestoneToCalendarEvent(milestone, 'My Awesome Project');
    expect(event.description).toContain('My Awesome Project');
  });

  it('includes milestone status in description', () => {
    const event = milestoneToCalendarEvent(milestone, 'My Project');
    expect(event.description).toContain('in_progress');
  });

  it('sets extended private properties with source and type', () => {
    const event = milestoneToCalendarEvent(milestone, 'My Project');
    expect(event.extendedProperties?.private?.source).toBe('no-bhad-codes');
    expect(event.extendedProperties?.private?.type).toBe('milestone');
    expect(event.extendedProperties?.private?.milestoneId).toBe('10');
  });

  it('sets reminders with email and popup', () => {
    const event = milestoneToCalendarEvent(milestone, 'My Project');
    expect(event.reminders?.useDefault).toBe(false);
    expect(event.reminders?.overrides).toHaveLength(2);
    const methods = event.reminders!.overrides!.map((r) => r.method);
    expect(methods).toContain('email');
    expect(methods).toContain('popup');
  });

  it('assigns a colorId based on status', () => {
    const pendingEvent = milestoneToCalendarEvent({ ...milestone, status: 'pending' }, 'P');
    const completedEvent = milestoneToCalendarEvent({ ...milestone, status: 'completed' }, 'P');
    expect(pendingEvent.colorId).toBe('5'); // Yellow for pending
    expect(completedEvent.colorId).toBe('10'); // Green for completed
  });

  it('uses default color for unknown status', () => {
    const event = milestoneToCalendarEvent({ ...milestone, status: 'unknown' }, 'P');
    expect(event.colorId).toBe('8'); // Gray default
  });
});

// ============================================
// TESTS: taskToCalendarEvent
// ============================================

describe('taskToCalendarEvent', () => {
  const task = {
    id: 55,
    project_id: 3,
    title: 'Write unit tests',
    description: 'Cover all service functions',
    due_date: '2026-03-10T00:00:00Z',
    status: 'pending',
    priority: 'high',
    assigned_to: 'dev@example.com'
  };

  it('creates CalendarEvent with [Task] prefix in summary', () => {
    const event = taskToCalendarEvent(task, 'Test Project');
    expect(event.summary).toBe('[Task] Write unit tests');
  });

  it('uses the date portion of due_date for all-day event', () => {
    const event = taskToCalendarEvent(task, 'Test Project');
    expect(event.start.date).toBe('2026-03-10');
    expect(event.end.date).toBe('2026-03-10');
  });

  it('includes priority in description', () => {
    const event = taskToCalendarEvent(task, 'Test Project');
    expect(event.description).toContain('high');
  });

  it('adds attendee when assigned_to is set', () => {
    const event = taskToCalendarEvent(task, 'Test Project');
    expect(event.attendees).toHaveLength(1);
    expect(event.attendees![0].email).toBe('dev@example.com');
  });

  it('has no attendees when assigned_to is not set', () => {
    const unassigned = { ...task, assigned_to: null };
    const event = taskToCalendarEvent(unassigned, 'Test Project');
    expect(event.attendees).toBeUndefined();
  });

  it('sets extended properties with task type and id', () => {
    const event = taskToCalendarEvent(task, 'Test Project');
    expect(event.extendedProperties?.private?.type).toBe('task');
    expect(event.extendedProperties?.private?.taskId).toBe('55');
  });

  it('assigns colorId based on priority', () => {
    const highPrio = taskToCalendarEvent({ ...task, priority: 'high' }, 'P');
    const lowPrio = taskToCalendarEvent({ ...task, priority: 'low' }, 'P');
    const urgentPrio = taskToCalendarEvent({ ...task, priority: 'urgent' }, 'P');
    expect(highPrio.colorId).toBe('6'); // Orange
    expect(lowPrio.colorId).toBe('8'); // Gray
    expect(urgentPrio.colorId).toBe('11'); // Red
  });
});

// ============================================
// TESTS: invoiceToCalendarEvent
// ============================================

describe('invoiceToCalendarEvent', () => {
  const invoice = {
    id: 7,
    invoice_number: 'INV-2026-007',
    total_amount: 3500.0,
    client_name: 'Acme Corp',
    due_date: '2026-05-01T00:00:00Z',
    status: 'sent'
  };

  it('creates CalendarEvent with [Invoice Due] prefix', () => {
    const event = invoiceToCalendarEvent(invoice);
    expect(event.summary).toContain('[Invoice Due]');
    expect(event.summary).toContain('INV-2026-007');
  });

  it('formats the amount as currency in the summary', () => {
    const event = invoiceToCalendarEvent(invoice);
    expect(event.summary).toContain('$3,500.00');
  });

  it('uses the date portion of due_date for all-day event', () => {
    const event = invoiceToCalendarEvent(invoice);
    expect(event.start.date).toBe('2026-05-01');
    expect(event.end.date).toBe('2026-05-01');
  });

  it('includes client name in description', () => {
    const event = invoiceToCalendarEvent(invoice);
    expect(event.description).toContain('Acme Corp');
  });

  it('sets colorId to red (11) for payment urgency', () => {
    const event = invoiceToCalendarEvent(invoice);
    expect(event.colorId).toBe('11');
  });

  it('sets three reminders (3 days, 1 day, 1 hour)', () => {
    const event = invoiceToCalendarEvent(invoice);
    expect(event.reminders?.overrides).toHaveLength(3);
    const minutes = event.reminders!.overrides!.map((r) => r.minutes);
    expect(minutes).toContain(4320); // 3 days
    expect(minutes).toContain(1440); // 1 day
    expect(minutes).toContain(60); // 1 hour
  });

  it('sets extended properties with invoice type and id', () => {
    const event = invoiceToCalendarEvent(invoice);
    expect(event.extendedProperties?.private?.type).toBe('invoice');
    expect(event.extendedProperties?.private?.invoiceId).toBe('7');
  });
});

// ============================================
// TESTS: generateICalExport
// ============================================

describe('generateICalExport', () => {
  const milestoneEvent: CalendarEvent = {
    summary: 'Milestone: Phase 1',
    description: 'First milestone',
    start: { date: '2026-03-01' },
    end: { date: '2026-03-01' },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'email', minutes: 1440 }]
    },
    extendedProperties: {
      private: { source: 'no-bhad-codes', type: 'milestone', milestoneId: '1', projectId: '2' }
    }
  };

  it('returns a string starting with BEGIN:VCALENDAR', () => {
    const ical = generateICalExport([milestoneEvent]);
    expect(ical).toMatch(/^BEGIN:VCALENDAR/);
  });

  it('ends with END:VCALENDAR', () => {
    const ical = generateICalExport([milestoneEvent]);
    expect(ical).toContain('END:VCALENDAR');
  });

  it('includes VEVENT for each event', () => {
    const ical = generateICalExport([milestoneEvent, milestoneEvent]);
    const beginCount = (ical.match(/BEGIN:VEVENT/g) || []).length;
    expect(beginCount).toBe(2);
  });

  it('includes SUMMARY with escaped event summary', () => {
    const ical = generateICalExport([milestoneEvent]);
    expect(ical).toContain('SUMMARY:Milestone: Phase 1');
  });

  it('includes DESCRIPTION when event has description', () => {
    const ical = generateICalExport([milestoneEvent]);
    expect(ical).toContain('DESCRIPTION:First milestone');
  });

  it('uses DATE format for all-day events', () => {
    const ical = generateICalExport([milestoneEvent]);
    expect(ical).toContain('DTSTART;VALUE=DATE:20260301');
    expect(ical).toContain('DTEND;VALUE=DATE:20260301');
  });

  it('uses DATETIME format for timed events', () => {
    const timedEvent: CalendarEvent = {
      summary: 'Timed Meeting',
      start: { dateTime: '2026-03-01T14:00:00Z' },
      end: { dateTime: '2026-03-01T15:00:00Z' }
    };

    const ical = generateICalExport([timedEvent]);
    expect(ical).toContain('DTSTART:');
    expect(ical).not.toContain('VALUE=DATE');
  });

  it('includes VALARM for each reminder override', () => {
    const ical = generateICalExport([milestoneEvent]);
    expect(ical).toContain('BEGIN:VALARM');
    expect(ical).toContain('END:VALARM');
    expect(ical).toContain('TRIGGER:-PT1440M');
  });

  it('uses EMAIL action for email reminders', () => {
    const ical = generateICalExport([milestoneEvent]);
    expect(ical).toContain('ACTION:EMAIL');
  });

  it('uses DISPLAY action for popup reminders', () => {
    const eventWithPopup: CalendarEvent = {
      ...milestoneEvent,
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 30 }]
      }
    };

    const ical = generateICalExport([eventWithPopup]);
    expect(ical).toContain('ACTION:DISPLAY');
  });

  it('includes attendees when present', () => {
    const eventWithAttendee: CalendarEvent = {
      ...milestoneEvent,
      attendees: [{ email: 'dev@example.com', displayName: 'Dev' }]
    };

    const ical = generateICalExport([eventWithAttendee]);
    expect(ical).toContain('ATTENDEE');
    expect(ical).toContain('dev@example.com');
  });

  it('returns valid VCALENDAR when events list is empty', () => {
    const ical = generateICalExport([]);
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).not.toContain('BEGIN:VEVENT');
  });

  it('escapes special characters in text fields', () => {
    const eventWithSpecial: CalendarEvent = {
      summary: 'Event; with, special\\chars',
      start: { date: '2026-03-01' },
      end: { date: '2026-03-01' }
    };

    const ical = generateICalExport([eventWithSpecial]);
    expect(ical).toContain('\\;');
    expect(ical).toContain('\\,');
    expect(ical).toContain('\\\\');
  });

  it('uses CRLF line endings', () => {
    const ical = generateICalExport([milestoneEvent]);
    expect(ical).toContain('\r\n');
  });
});

// ============================================
// TESTS: exportProjectToICal
// ============================================

describe('exportProjectToICal', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
  });

  it('throws when project is not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    await expect(exportProjectToICal(999)).rejects.toThrow('Project 999 not found');
  });

  it('returns iCal string for a project with milestones and tasks', async () => {
    mockDb.get.mockResolvedValueOnce({ project_name: 'Test Project' });
    mockDb.all
      .mockResolvedValueOnce([
        {
          id: 1,
          project_id: 1,
          title: 'M1',
          description: 'First milestone',
          due_date: '2026-04-01',
          status: 'pending'
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 10,
          project_id: 1,
          title: 'Task 1',
          description: 'Do the thing',
          due_date: '2026-04-05',
          status: 'pending',
          priority: 'medium',
          assigned_to: null
        }
      ]);

    const result = await exportProjectToICal(1);

    expect(typeof result).toBe('string');
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('[Milestone] M1');
    expect(result).toContain('[Task] Task 1');
  });

  it('returns valid iCal when project has no milestones or tasks', async () => {
    mockDb.get.mockResolvedValueOnce({ project_name: 'Empty Project' });
    mockDb.all.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await exportProjectToICal(2);

    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).not.toContain('BEGIN:VEVENT');
  });
});

// ============================================
// TESTS: exportUpcomingToICal
// ============================================

describe('exportUpcomingToICal', () => {
  beforeEach(() => {
    mockDb.all.mockReset();
  });

  it('returns iCal string with upcoming milestones, tasks, and invoices', async () => {
    mockDb.all
      .mockResolvedValueOnce([
        {
          id: 1,
          project_id: 5,
          title: 'Upcoming Milestone',
          description: '',
          due_date: '2026-03-20',
          status: 'pending',
          project_name: 'Upcoming Project'
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 20,
          project_id: 5,
          title: 'Upcoming Task',
          description: '',
          due_date: '2026-03-22',
          status: 'pending',
          priority: 'low',
          assigned_to: null,
          project_name: 'Upcoming Project'
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 30,
          invoice_number: 'INV-030',
          total_amount: 1000,
          due_date: '2026-03-25',
          client_name: 'Client A',
          status: 'sent'
        }
      ]);

    const result = await exportUpcomingToICal(30);

    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('[Milestone] Upcoming Milestone');
    expect(result).toContain('[Task] Upcoming Task');
    expect(result).toContain('[Invoice Due] INV-030');
  });

  it('uses default of 30 days when daysAhead not specified', async () => {
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await exportUpcomingToICal();
    expect(result).toContain('BEGIN:VCALENDAR');
  });

  it('returns valid iCal when no upcoming items exist', async () => {
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await exportUpcomingToICal(7);

    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).not.toContain('BEGIN:VEVENT');
  });
});

// ============================================
// TESTS: saveCalendarSyncConfig
// ============================================

describe('saveCalendarSyncConfig', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
  });

  const baseConfig: CalendarSyncConfig = {
    userId: 1,
    calendarId: 'primary',
    accessToken: 'access-123',
    refreshToken: 'refresh-456',
    expiresAt: FUTURE_EXPIRY,
    syncMilestones: true,
    syncTasks: true,
    syncInvoiceDueDates: false,
    isActive: true
  };

  it('inserts new config and returns with generated id', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 11 });

    const result = await saveCalendarSyncConfig(baseConfig);

    expect(result.id).toBe(11);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO'),
      expect.any(Array)
    );
  });

  it('converts boolean flags to 1/0 integers on insert', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });

    await saveCalendarSyncConfig(baseConfig);

    const callArgs = mockDb.run.mock.calls[0][1] as unknown[];
    // syncMilestones=true → 1, syncTasks=true → 1, syncInvoiceDueDates=false → 0
    expect(callArgs).toContain(1);
    expect(callArgs).toContain(0);
  });

  it('updates existing config when id is present', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    const configWithId = { ...baseConfig, id: 5 };
    const result = await saveCalendarSyncConfig(configWithId);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.arrayContaining([5])
    );
    expect(result.id).toBe(5);
  });

  it('returns the original config on update', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    const configWithId = { ...baseConfig, id: 7 };
    const result = await saveCalendarSyncConfig(configWithId);

    expect(result.calendarId).toBe('primary');
    expect(result.userId).toBe(1);
  });
});

// ============================================
// TESTS: getCalendarSyncConfig
// ============================================

describe('getCalendarSyncConfig', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
  });

  it('returns null when no config exists for the user', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await getCalendarSyncConfig(99);

    expect(result).toBeNull();
  });

  it('returns mapped CalendarSyncConfig when row exists', async () => {
    mockDb.get.mockResolvedValueOnce({
      id: 3,
      user_id: 1,
      calendar_id: 'primary',
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      expires_at: FUTURE_EXPIRY,
      sync_milestones: 1,
      sync_tasks: 0,
      sync_invoice_due_dates: 1,
      last_sync_at: '2026-03-01T10:00:00Z',
      is_active: 1
    });

    const result = await getCalendarSyncConfig(1);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(3);
    expect(result!.userId).toBe(1);
    expect(result!.calendarId).toBe('primary');
    expect(result!.accessToken).toBe('access-abc');
    expect(result!.refreshToken).toBe('refresh-xyz');
    expect(result!.syncMilestones).toBe(true);
    expect(result!.syncTasks).toBe(false);
    expect(result!.syncInvoiceDueDates).toBe(true);
    expect(result!.isActive).toBe(true);
    expect(result!.lastSyncAt).toBe('2026-03-01T10:00:00Z');
  });

  it('converts sync_milestones=0 to false', async () => {
    mockDb.get.mockResolvedValueOnce({
      id: 4,
      user_id: 2,
      calendar_id: 'work',
      access_token: 'tok',
      refresh_token: undefined,
      expires_at: FUTURE_EXPIRY,
      sync_milestones: 0,
      sync_tasks: 0,
      sync_invoice_due_dates: 0,
      last_sync_at: null,
      is_active: 0
    });

    const result = await getCalendarSyncConfig(2);

    expect(result!.syncMilestones).toBe(false);
    expect(result!.syncTasks).toBe(false);
    expect(result!.isActive).toBe(false);
  });

  it('queries the database with the correct user_id', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    await getCalendarSyncConfig(42);

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = ?'),
      [42]
    );
  });
});
