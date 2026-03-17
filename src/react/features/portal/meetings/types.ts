/**
 * Portal Meeting Request Types
 * Type definitions and constants for client-facing meeting request management.
 * Mirrors server types from server/services/meeting-request-types.ts.
 */

// ============================================================================
// ENUM / UNION TYPES
// ============================================================================

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

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface MeetingRequest {
  id: number;
  clientId: number;
  projectId: number | null;
  meetingType: MeetingType;
  status: MeetingStatus;
  preferredSlot1: string | null;
  preferredSlot2: string | null;
  preferredSlot3: string | null;
  confirmedDatetime: string | null;
  durationMinutes: number;
  locationType: LocationType;
  locationDetails: string | null;
  clientNotes: string | null;
  adminNotes: string | null;
  declineReason: string | null;
  createdAt: string;
  confirmedAt: string | null;
  clientName: string;
  clientEmail: string;
  projectName: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  discovery_call: 'Discovery Call',
  consultation: 'Consultation',
  project_kickoff: 'Project Kickoff',
  check_in: 'Check-In',
  review: 'Review',
  other: 'Other'
};

export const MEETING_STATUS_CONFIG: Record<
  MeetingStatus,
  { label: string; color: string }
> = {
  requested: { label: 'Requested', color: 'var(--status-pending)' },
  confirmed: { label: 'Confirmed', color: 'var(--status-active)' },
  declined: { label: 'Declined', color: 'var(--status-cancelled)' },
  rescheduled: { label: 'Rescheduled', color: 'var(--status-pending)' },
  completed: { label: 'Completed', color: 'var(--status-completed)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-text-tertiary)' }
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  phone: 'Phone Call',
  in_person: 'In Person',
  other: 'Other'
};

export const MEETING_DURATIONS = [30, 45, 60, 90] as const;

export const DEFAULT_DURATION_MINUTES = 60;
