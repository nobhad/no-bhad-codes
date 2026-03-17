/**
 * ===============================================
 * MEETING REQUEST TYPES
 * ===============================================
 * @file server/services/meeting-request-types.ts
 *
 * Type definitions and constants for the meeting
 * request system (Phase 2B).
 */

// ============================================
// ENUMS / UNION TYPES
// ============================================

export type MeetingType =
  | 'discovery_call'
  | 'consultation'
  | 'project_kickoff'
  | 'check_in'
  | 'review'
  | 'other';

export type MeetingStatus =
  | 'requested'
  | 'confirmed'
  | 'declined'
  | 'rescheduled'
  | 'completed'
  | 'cancelled';

export type LocationType =
  | 'zoom'
  | 'google_meet'
  | 'phone'
  | 'in_person'
  | 'other';

// ============================================
// DATABASE ROW TYPE
// ============================================

export interface MeetingRequestRow {
  id: number;
  client_id: number;
  project_id: number | null;
  meeting_type: MeetingType;
  status: MeetingStatus;
  preferred_slot_1: string | null;
  preferred_slot_2: string | null;
  preferred_slot_3: string | null;
  confirmed_datetime: string | null;
  duration_minutes: number;
  location_type: LocationType;
  location_details: string | null;
  client_notes: string | null;
  admin_notes: string | null;
  decline_reason: string | null;
  calendar_event_id: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

// ============================================
// ENRICHED TYPE (WITH JOINS)
// ============================================

export interface MeetingRequestWithNames extends MeetingRequestRow {
  clientName: string;
  clientEmail: string;
  projectName: string | null;
}

// ============================================
// PARAMETER TYPES
// ============================================

export interface CreateMeetingRequestParams {
  projectId?: number;
  meetingType: MeetingType;
  preferredSlot1: string;
  preferredSlot2?: string;
  preferredSlot3?: string;
  durationMinutes?: number;
  notes?: string;
}

export interface ConfirmMeetingParams {
  confirmedDatetime: string;
  durationMinutes?: number;
  locationType: LocationType;
  locationDetails?: string;
  adminNotes?: string;
  createCalendarEvent?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  discovery_call: 'Discovery Call',
  consultation: 'Consultation',
  project_kickoff: 'Project Kickoff',
  check_in: 'Check-In',
  review: 'Review',
  other: 'Other'
};

export const DEFAULT_DURATION_MINUTES = 60;

export const MEETING_DURATIONS = [30, 45, 60, 90] as const;

export const VALID_MEETING_TYPES: MeetingType[] = [
  'discovery_call',
  'consultation',
  'project_kickoff',
  'check_in',
  'review',
  'other'
];

export const VALID_MEETING_STATUSES: MeetingStatus[] = [
  'requested',
  'confirmed',
  'declined',
  'rescheduled',
  'completed',
  'cancelled'
];

export const VALID_LOCATION_TYPES: LocationType[] = [
  'zoom',
  'google_meet',
  'phone',
  'in_person',
  'other'
];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  phone: 'Phone Call',
  in_person: 'In Person',
  other: 'Other'
};
