/**
 * MeetingRequestForm
 * Client form component for submitting a new meeting request.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { CalendarPlus, RefreshCw } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { usePortalFetch } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { createLogger } from '@/utils/logger';
import type { MeetingType } from './types';
import {
  MEETING_TYPE_LABELS,
  MEETING_DURATIONS,
  DEFAULT_DURATION_MINUTES
} from './types';

const logger = createLogger('MeetingRequestForm');

// ============================================================================
// PROPS
// ============================================================================

export interface MeetingRequestFormProps {
  /** Optional project to associate with the meeting request */
  projectId?: number;
  /** Callback after successful submission */
  onSubmit?: () => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Toast notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MeetingRequestForm = React.memo(({
  projectId,
  onSubmit,
  onCancel,
  getAuthToken,
  showNotification
}: MeetingRequestFormProps) => {
  const { portalFetch } = usePortalFetch({ getAuthToken });

  // Form state
  const [meetingType, setMeetingType] = useState<MeetingType>('consultation');
  const [preferredSlot1, setPreferredSlot1] = useState('');
  const [preferredSlot2, setPreferredSlot2] = useState('');
  const [preferredSlot3, setPreferredSlot3] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_DURATION_MINUTES);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const meetingTypeEntries = Object.entries(MEETING_TYPE_LABELS) as [MeetingType, string][];

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!meetingType) {
      newErrors.meetingType = 'Meeting type is required';
    }

    if (!preferredSlot1) {
      newErrors.preferredSlot1 = 'At least one preferred time slot is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [meetingType, preferredSlot1]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        meetingType,
        preferredSlot1,
        durationMinutes,
        notes: notes.trim() || undefined
      };

      if (preferredSlot2) body.preferredSlot2 = preferredSlot2;
      if (preferredSlot3) body.preferredSlot3 = preferredSlot3;
      if (projectId) body.projectId = projectId;

      await portalFetch(API_ENDPOINTS.MEETING_REQUESTS, {
        method: 'POST',
        body
      });

      showNotification?.('Meeting request submitted', 'success');
      onSubmit?.();
    } catch (err) {
      logger.error('Error submitting meeting request:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to submit meeting request'),
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Meeting Type */}
      <div className="flex flex-col gap-1">
        <label className="field-label" htmlFor="meeting-type">
          Meeting Type
          <span className="form-required">*</span>
        </label>
        <select
          id="meeting-type"
          value={meetingType}
          onChange={(e) => {
            setMeetingType(e.target.value as MeetingType);
            if (errors.meetingType) {
              setErrors((prev) => ({ ...prev, meetingType: '' }));
            }
          }}
          disabled={isSubmitting}
          className={cn('form-input', errors.meetingType && 'input-error')}
        >
          {meetingTypeEntries.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.meetingType && (
          <span className="form-error-message">{errors.meetingType}</span>
        )}
      </div>

      {/* Preferred Slot 1 (required) */}
      <div className="flex flex-col gap-1 mt-3">
        <label className="field-label" htmlFor="preferred-slot-1">
          Preferred Time Slot 1
          <span className="form-required">*</span>
        </label>
        <input
          id="preferred-slot-1"
          type="datetime-local"
          value={preferredSlot1}
          onChange={(e) => {
            setPreferredSlot1(e.target.value);
            if (errors.preferredSlot1) {
              setErrors((prev) => ({ ...prev, preferredSlot1: '' }));
            }
          }}
          disabled={isSubmitting}
          className={cn('form-input', errors.preferredSlot1 && 'input-error')}
        />
        {errors.preferredSlot1 && (
          <span className="form-error-message">{errors.preferredSlot1}</span>
        )}
      </div>

      {/* Preferred Slot 2 (optional) */}
      <div className="flex flex-col gap-1 mt-3">
        <label className="field-label" htmlFor="preferred-slot-2">
          Preferred Time Slot 2
          <span className="text-muted"> (optional)</span>
        </label>
        <input
          id="preferred-slot-2"
          type="datetime-local"
          value={preferredSlot2}
          onChange={(e) => setPreferredSlot2(e.target.value)}
          disabled={isSubmitting}
          className="form-input"
        />
      </div>

      {/* Preferred Slot 3 (optional) */}
      <div className="flex flex-col gap-1 mt-3">
        <label className="field-label" htmlFor="preferred-slot-3">
          Preferred Time Slot 3
          <span className="text-muted"> (optional)</span>
        </label>
        <input
          id="preferred-slot-3"
          type="datetime-local"
          value={preferredSlot3}
          onChange={(e) => setPreferredSlot3(e.target.value)}
          disabled={isSubmitting}
          className="form-input"
        />
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1 mt-3">
        <label className="field-label" htmlFor="duration">Duration</label>
        <select
          id="duration"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          disabled={isSubmitting}
          className="form-input"
        >
          {MEETING_DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} minutes
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1 mt-3">
        <label className="field-label" htmlFor="meeting-notes">
          Notes
          <span className="text-muted"> (optional)</span>
        </label>
        <textarea
          id="meeting-notes"
          placeholder="Any details or agenda items for the meeting..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting}
          rows={3}
          className="form-input"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4">
        {onCancel && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn-primary flex items-center gap-1.5"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <RefreshCw className="icon-xs loading-spin" />
          ) : (
            <CalendarPlus className="icon-xs" />
          )}
          Request Meeting
        </button>
      </div>
    </form>
  );
});
