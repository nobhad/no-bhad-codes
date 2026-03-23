/**
 * MeetingRequestsTable
 * Admin table for viewing and managing all meeting requests.
 * Supports confirm, decline, and complete quick actions.
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  Inbox,
  Check,
  X,
  CheckCircle,
  Clock,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { getStatusVariant } from '@react/components/portal/StatusBadge';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { StatusBadge } from '@react/components/portal/StatusBadge';

import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePortalData } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('MeetingRequestsTable');

// ============================================================================
// TYPES (mirroring server types for admin context)
// ============================================================================

type MeetingType =
  | 'discovery_call'
  | 'consultation'
  | 'project_kickoff'
  | 'check_in'
  | 'review'
  | 'other';

type MeetingStatus =
  | 'requested'
  | 'confirmed'
  | 'declined'
  | 'rescheduled'
  | 'completed'
  | 'cancelled';

type LocationType =
  | 'zoom'
  | 'google_meet'
  | 'phone'
  | 'in_person'
  | 'other';

interface MeetingRequestAdmin {
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
  created_at: string;
  confirmed_at: string | null;
  clientName: string;
  clientEmail: string;
  projectName: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  discovery_call: 'Discovery Call',
  consultation: 'Consultation',
  project_kickoff: 'Project Kickoff',
  check_in: 'Check-In',
  review: 'Review',
  other: 'Other'
};

const MEETING_STATUS_LABELS: Record<MeetingStatus, { label: string; variant: string }> = {
  requested: { label: 'Requested', variant: 'pending' },
  confirmed: { label: 'Confirmed', variant: 'active' },
  declined: { label: 'Declined', variant: 'cancelled' },
  rescheduled: { label: 'Rescheduled', variant: 'warning' },
  completed: { label: 'Completed', variant: 'completed' },
  cancelled: { label: 'Cancelled', variant: 'cancelled' }
};

const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'zoom', label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'in_person', label: 'In Person' },
  { value: 'other', label: 'Other' }
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined', label: 'Declined' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const TABLE_COL_COUNT = 6;

// ============================================================================
// HELPERS
// ============================================================================

function formatSlots(meeting: MeetingRequestAdmin): string {
  const slots = [
    meeting.preferred_slot_1,
    meeting.preferred_slot_2,
    meeting.preferred_slot_3
  ].filter(Boolean);

  return slots
    .map((s) => {
      try {
        return new Date(s!).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      } catch {
        return s;
      }
    })
    .join(', ');
}

function formatConfirmedDate(iso: string | null): string {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleString(undefined, {
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
// PROPS
// ============================================================================

export interface MeetingRequestsTableProps {
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

export function MeetingRequestsTable({
  getAuthToken,
  showNotification
}: MeetingRequestsTableProps) {
  const containerRef = useFadeIn();

  const {
    data: meetingRequests,
    isLoading,
    error,
    refetch,
    portalFetch
  } = usePortalData<MeetingRequestAdmin[]>({
    getAuthToken,
    url: API_ENDPOINTS.MEETING_REQUESTS,
    transform: (raw) =>
      (raw as Record<string, unknown>).meetingRequests as MeetingRequestAdmin[] || []
  });

  const items = useMemo(() => meetingRequests ?? [], [meetingRequests]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Status filter
    if (statusFilter.length > 0 && !statusFilter.includes('all')) {
      result = result.filter((m) => statusFilter.includes(m.status));
    }

    // Search
    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.clientName.toLowerCase().includes(query) ||
          m.clientEmail.toLowerCase().includes(query) ||
          (m.projectName && m.projectName.toLowerCase().includes(query))
      );
    }

    return result;
  }, [items, statusFilter, search]);

  // Inline action states
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmDatetime, setConfirmDatetime] = useState('');
  const [confirmLocation, setConfirmLocation] = useState<LocationType>('zoom');
  const [confirmLocationDetails, setConfirmLocationDetails] = useState('');

  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((m) => m.status === 'requested' || m.status === 'rescheduled').length;
    const confirmed = items.filter((m) => m.status === 'confirmed').length;
    return { total, pending, confirmed };
  }, [items]);

  // Confirm action
  const handleConfirm = useCallback(async (id: number) => {
    if (!confirmDatetime) {
      showNotification?.('Please select a date and time', 'error');
      return;
    }
    setActionLoading(id);
    try {
      await portalFetch(`${API_ENDPOINTS.MEETING_REQUESTS}/${id}/confirm`, {
        method: 'POST',
        body: {
          confirmedDatetime: confirmDatetime,
          locationType: confirmLocation,
          locationDetails: confirmLocationDetails || undefined
        }
      });
      showNotification?.('Meeting confirmed', 'success');
      setConfirmingId(null);
      setConfirmDatetime('');
      setConfirmLocationDetails('');
      await refetch();
    } catch (err) {
      logger.error('Error confirming meeting:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to confirm meeting'),
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  }, [confirmDatetime, confirmLocation, confirmLocationDetails, portalFetch, showNotification, refetch]);

  // Decline action
  const handleDecline = useCallback(async (id: number) => {
    setActionLoading(id);
    try {
      await portalFetch(`${API_ENDPOINTS.MEETING_REQUESTS}/${id}/decline`, {
        method: 'POST',
        body: { reason: declineReason || undefined }
      });
      showNotification?.('Meeting declined', 'success');
      setDecliningId(null);
      setDeclineReason('');
      await refetch();
    } catch (err) {
      logger.error('Error declining meeting:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to decline meeting'),
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  }, [declineReason, portalFetch, showNotification, refetch]);

  // Complete action
  const handleComplete = useCallback(async (id: number) => {
    setActionLoading(id);
    try {
      await portalFetch(`${API_ENDPOINTS.MEETING_REQUESTS}/${id}/complete`, {
        method: 'POST'
      });
      showNotification?.('Meeting marked as completed', 'success');
      await refetch();
    } catch (err) {
      logger.error('Error completing meeting:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to complete meeting'),
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  }, [portalFetch, showNotification, refetch]);

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="MEETING REQUESTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending' },
            { value: stats.confirmed, label: 'confirmed', variant: 'active' }
          ]}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search by client..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS }
            ]}
            values={{ status: statusFilter }}
            onChange={(key, value) => {
              if (key === 'status') {
                setStatusFilter((prev) =>
                  prev.includes(value)
                    ? prev.filter((v) => v !== value)
                    : [...prev, value]
                );
              }
            }}
          />
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
        </>
      }
    >
      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead className="name-col">Client</PortalTableHead>
            <PortalTableHead className="category-col">Type</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead>Preferred Slots</PortalTableHead>
            <PortalTableHead className="date-col">Confirmed</PortalTableHead>
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>
        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={TABLE_COL_COUNT} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={TABLE_COL_COUNT} rows={5} />
          ) : filteredItems.length === 0 ? (
            <PortalTableEmpty
              colSpan={TABLE_COL_COUNT}
              icon={<Inbox />}
              message={search || statusFilter.length > 0
                ? 'No meeting requests match your filters'
                : 'No meeting requests yet'}
            />
          ) : (
            filteredItems.map((meeting) => (
              <React.Fragment key={meeting.id}>
                <PortalTableRow>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <Calendar className="icon-sm" />
                      <div className="cell-content">
                        <span className="cell-title">{meeting.clientName}</span>
                        <span className="cell-subtitle">{meeting.clientEmail}</span>
                        {meeting.projectName && (
                          <span className="cell-subtitle">{meeting.projectName}</span>
                        )}
                      </div>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell>
                    {MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type}
                  </PortalTableCell>
                  <PortalTableCell className="status-col">
                    <StatusBadge
                      status={getStatusVariant(MEETING_STATUS_LABELS[meeting.status]?.variant || 'pending')}
                      size="sm"
                    >
                      {MEETING_STATUS_LABELS[meeting.status]?.label || meeting.status}
                    </StatusBadge>
                  </PortalTableCell>
                  <PortalTableCell>
                    <span className="text-sm">
                      {formatSlots(meeting) || '--'}
                    </span>
                  </PortalTableCell>
                  <PortalTableCell className="date-col">
                    {formatConfirmedDate(meeting.confirmed_datetime)}
                  </PortalTableCell>
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="action-group">
                      {/* Confirm (for requested/rescheduled) */}
                      {(meeting.status === 'requested' || meeting.status === 'rescheduled') && (
                        <>
                          <IconButton
                            action="approve"
                            title="Confirm"
                            onClick={() => {
                              setConfirmingId(meeting.id);
                              setDecliningId(null);
                            }}
                          />
                          <IconButton
                            action="reject"
                            title="Decline"
                            onClick={() => {
                              setDecliningId(meeting.id);
                              setConfirmingId(null);
                            }}
                          />
                        </>
                      )}
                      {/* Complete (for confirmed) */}
                      {meeting.status === 'confirmed' && (
                        <IconButton
                          action="complete"
                          title="Mark Complete"
                          onClick={() => handleComplete(meeting.id)}
                          loading={actionLoading === meeting.id}
                        />
                      )}
                    </div>
                  </PortalTableCell>
                </PortalTableRow>

                {/* Inline Confirm Form */}
                {confirmingId === meeting.id && (
                  <PortalTableRow>
                    <PortalTableCell colSpan={TABLE_COL_COUNT}>
                      <div
                        className="flex flex-col gap-2 py-3 px-4"
                        style={{ background: 'var(--app-color-bg-secondary)' }}
                      >
                        <span className="cell-title flex items-center gap-1.5">
                          <Check className="icon-xs text-success" />
                          Confirm Meeting
                        </span>
                        <div className="flex gap-3 flex-wrap">
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="field-label" htmlFor={`confirm-dt-${meeting.id}`}>
                              <Clock className="icon-xs inline-block mr-1" />
                              Date & Time
                            </label>
                            <input
                              id={`confirm-dt-${meeting.id}`}
                              type="datetime-local"
                              value={confirmDatetime}
                              onChange={(e) => setConfirmDatetime(e.target.value)}
                              className="form-input"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="field-label" htmlFor={`confirm-loc-${meeting.id}`}>
                              <MapPin className="icon-xs inline-block mr-1" />
                              Location
                            </label>
                            <select
                              id={`confirm-loc-${meeting.id}`}
                              value={confirmLocation}
                              onChange={(e) => setConfirmLocation(e.target.value as LocationType)}
                              className="form-input"
                            >
                              {LOCATION_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="field-label" htmlFor={`confirm-details-${meeting.id}`}>
                              Details
                            </label>
                            <input
                              id={`confirm-details-${meeting.id}`}
                              type="text"
                              placeholder="Meeting link or address..."
                              value={confirmLocationDetails}
                              onChange={(e) => setConfirmLocationDetails(e.target.value)}
                              className="form-input"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setConfirmingId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-primary flex items-center gap-1.5"
                            onClick={() => handleConfirm(meeting.id)}
                            disabled={actionLoading === meeting.id}
                          >
                            {actionLoading === meeting.id ? (
                              <RefreshCw className="icon-xs loading-spin" />
                            ) : (
                              <CheckCircle className="icon-xs" />
                            )}
                            Confirm
                          </button>
                        </div>
                      </div>
                    </PortalTableCell>
                  </PortalTableRow>
                )}

                {/* Inline Decline Form */}
                {decliningId === meeting.id && (
                  <PortalTableRow>
                    <PortalTableCell colSpan={TABLE_COL_COUNT}>
                      <div
                        className="flex flex-col gap-2 py-3 px-4"
                        style={{ background: 'var(--app-color-bg-secondary)' }}
                      >
                        <span className="cell-title flex items-center gap-1.5">
                          <X className="icon-xs text-danger" />
                          Decline Meeting
                        </span>
                        <div className="flex flex-col gap-1">
                          <label className="field-label" htmlFor={`decline-reason-${meeting.id}`}>
                            Reason (optional)
                          </label>
                          <textarea
                            id={`decline-reason-${meeting.id}`}
                            placeholder="Reason for declining..."
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            rows={2}
                            className="form-input"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setDecliningId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-danger flex items-center gap-1.5"
                            onClick={() => handleDecline(meeting.id)}
                            disabled={actionLoading === meeting.id}
                          >
                            {actionLoading === meeting.id ? (
                              <RefreshCw className="icon-xs loading-spin" />
                            ) : (
                              <X className="icon-xs" />
                            )}
                            Decline
                          </button>
                        </div>
                      </div>
                    </PortalTableCell>
                  </PortalTableRow>
                )}
              </React.Fragment>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}
