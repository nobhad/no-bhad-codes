/**
 * MeetingRequestsList
 * Client view of their submitted meeting requests with status cards.
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Inbox,
  XCircle,
  RefreshCw,
  CalendarCheck,
  CalendarClock
} from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { ConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { usePortalData } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { createLogger } from '@/utils/logger';
import type { MeetingRequest, MeetingStatus } from './types';
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_CONFIG,
  LOCATION_TYPE_LABELS
} from './types';

const logger = createLogger('MeetingRequestsList');

// ============================================================================
// HELPERS
// ============================================================================

/** Statuses that allow cancellation */
const CANCELLABLE_STATUSES: MeetingStatus[] = ['requested', 'rescheduled'];

function formatDatetime(iso: string | null): string {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

// ============================================================================
// MEETING CARD SUB-COMPONENT (defined before main component to satisfy no-use-before-define)
// ============================================================================

interface MeetingCardProps {
  meeting: MeetingRequest;
  onCancel: (meeting: MeetingRequest) => void;
}

const MeetingCard = React.memo(({
  meeting,
  onCancel
}: MeetingCardProps) => {
  const statusConfig = MEETING_STATUS_CONFIG[meeting.status];
  const typeLabel = MEETING_TYPE_LABELS[meeting.meetingType] || meeting.meetingType;
  const canCancel = CANCELLABLE_STATUSES.includes(meeting.status);
  const isConfirmed = meeting.status === 'confirmed';

  return (
    <div className="portal-card">
      <div className="portal-card-header">
        <div className="flex items-center gap-2">
          <Calendar className="icon-sm text-accent" />
          <span className="cell-title">{typeLabel}</span>
        </div>
        <span
          className="status-badge"
          style={{
            color: statusConfig.color,
            borderColor: statusConfig.color
          }}
        >
          {statusConfig.label}
        </span>
      </div>

      <div className="card-body">
        {isConfirmed && meeting.confirmedDatetime && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <CalendarCheck className="icon-xs text-success" />
              <span>{formatDatetime(meeting.confirmedDatetime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="icon-xs text-muted" />
              <span>{meeting.durationMinutes} minutes</span>
            </div>
            {meeting.locationType && (
              <div className="flex items-center gap-2">
                <MapPin className="icon-xs text-muted" />
                <span>
                  {LOCATION_TYPE_LABELS[meeting.locationType] || meeting.locationType}
                  {meeting.locationDetails ? ` - ${meeting.locationDetails}` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {!isConfirmed && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <CalendarClock className="icon-xs text-muted" />
              <span className="text-muted">Awaiting confirmation</span>
            </div>
            <div className="flex flex-col gap-1 ml-5">
              <span className="text-muted text-xs">
                Preferred times:
              </span>
              {meeting.preferredSlot1 && (
                <span className="text-sm">
                  1. {formatDatetime(meeting.preferredSlot1)}
                </span>
              )}
              {meeting.preferredSlot2 && (
                <span className="text-sm">
                  2. {formatDatetime(meeting.preferredSlot2)}
                </span>
              )}
              {meeting.preferredSlot3 && (
                <span className="text-sm">
                  3. {formatDatetime(meeting.preferredSlot3)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="icon-xs text-muted" />
              <span>{meeting.durationMinutes} minutes</span>
            </div>
          </div>
        )}

        {meeting.status === 'declined' && meeting.declineReason && (
          <div className="flex items-start gap-2 mt-2">
            <XCircle className="icon-xs flex-shrink-0 text-danger" />
            <span className="text-muted">{meeting.declineReason}</span>
          </div>
        )}

        {meeting.clientNotes && (
          <p className="text-muted text-sm mt-2">
            {meeting.clientNotes}
          </p>
        )}

        {meeting.projectName && (
          <p className="text-muted text-xs mt-1">
            Project: {meeting.projectName}
          </p>
        )}
      </div>

      {canCancel && (
        <div className="card-footer flex justify-end">
          <button
            type="button"
            className="btn-danger flex items-center gap-1.5"
            onClick={() => onCancel(meeting)}
          >
            <XCircle className="icon-xs" />
            Cancel Request
          </button>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// PROPS
// ============================================================================

export interface MeetingRequestsListProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Toast notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Navigation callback */
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MeetingRequestsList = React.memo(({
  getAuthToken,
  showNotification
}: MeetingRequestsListProps) => {
  const {
    data: meetings,
    isLoading,
    error,
    refetch,
    portalFetch
  } = usePortalData<MeetingRequest[]>({
    getAuthToken,
    url: API_ENDPOINTS.MEETING_REQUESTS_MY,
    transform: (raw) => (raw as Record<string, unknown>).meetingRequests as MeetingRequest[] || []
  });

  const items = useMemo(() => meetings ?? [], [meetings]);

  const [cancelTarget, setCancelTarget] = useState<MeetingRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await portalFetch(`${API_ENDPOINTS.MEETING_REQUESTS}/${cancelTarget.id}/cancel`, {
        method: 'POST'
      });
      showNotification?.('Meeting request cancelled', 'success');
      setCancelTarget(null);
      await refetch();
    } catch (err) {
      logger.error('Error cancelling meeting request:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to cancel meeting request'),
        'error'
      );
    } finally {
      setIsCancelling(false);
    }
  }, [cancelTarget, portalFetch, showNotification, refetch]);

  if (isLoading) {
    return <LoadingState message="Loading meeting requests..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="icon-lg" />}
        message="No meeting requests yet."
      />
    );
  }

  return (
    <>
      <div className="portal-cards-list">
        {items.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            onCancel={setCancelTarget}
          />
        ))}
      </div>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => { if (!open) setCancelTarget(null); }}
        title="Cancel Meeting Request"
        description={`Are you sure you want to cancel this ${cancelTarget ? MEETING_TYPE_LABELS[cancelTarget.meetingType] : ''} request?`}
        confirmText="Cancel Request"
        variant="danger"
        loading={isCancelling}
        onConfirm={handleCancel}
      />
    </>
  );
});

// MeetingCard is defined above the main component (see line ~56)

// ============================================================================
// REFRESH BUTTON (exposed for parent layouts)
// ============================================================================

export interface MeetingRequestsRefreshProps {
  isLoading: boolean;
  onRefresh: () => void;
}

export function MeetingRequestsRefresh({ isLoading, onRefresh }: MeetingRequestsRefreshProps) {
  return (
    <button
      type="button"
      className="btn-secondary flex items-center gap-1.5"
      onClick={onRefresh}
      disabled={isLoading}
      title="Refresh"
    >
      <RefreshCw className={`icon-xs ${isLoading ? 'loading-spin' : ''}`} />
    </button>
  );
}
