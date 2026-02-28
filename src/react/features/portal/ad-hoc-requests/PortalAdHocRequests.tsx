/**
 * PortalAdHocRequests
 * Main ad-hoc requests view for the client portal with list and form
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Inbox, X } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { AdHocRequestCard } from './AdHocRequestCard';
import { NewRequestForm } from './NewRequestForm';
import type { AdHocRequest, NewAdHocRequestPayload } from './types';

export interface PortalAdHocRequestsProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const API_BASE = '/api/ad-hoc-requests/my-requests';

/**
 * PortalAdHocRequests Component
 */
export function PortalAdHocRequests({
  getAuthToken,
  showNotification,
}: PortalAdHocRequestsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(0.05, 0.1);

  const [requests, setRequests] = useState<AdHocRequest[]>([]);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Get auth headers for API requests
   */
  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = getAuthToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }, [getAuthToken]);

  /**
   * Fetch requests from API
   */
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_BASE, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  /**
   * Fetch available projects for dropdown
   */
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/projects', {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      // Projects are optional, don't fail the whole component
      console.warn('Could not fetch projects:', err);
    }
  }, [getHeaders]);

  /**
   * Submit new request
   */
  const handleSubmit = async (payload: NewAdHocRequestPayload) => {
    setIsSubmitting(true);

    try {
      let body: string | FormData;
      let requestHeaders: Record<string, string>;

      // Use FormData if there are attachments
      if (payload.attachments && payload.attachments.length > 0) {
        const formData = new FormData();
        formData.append('title', payload.title);
        formData.append('description', payload.description);
        formData.append('priority', payload.priority);
        if (payload.project_id) {
          formData.append('project_id', String(payload.project_id));
        }
        payload.attachments.forEach((file) => {
          formData.append('attachments', file);
        });
        body = formData;

        // Don't set Content-Type for FormData - browser will set it with boundary
        requestHeaders = {};
        const token = getAuthToken?.();
        if (token) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }
      } else {
        body = JSON.stringify({
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          project_id: payload.project_id,
        });
        requestHeaders = getHeaders();
      }

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: requestHeaders,
        credentials: 'include',
        body,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit request');
      }

      showNotification?.('Request submitted successfully', 'success');
      setIsModalOpen(false);

      // Refresh the list
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting request:', err);
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to submit request',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Approve a quote
   */
  const handleApprove = async (requestId: number) => {
    try {
      const response = await fetch(`${API_BASE}/${requestId}/approve`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve quote');
      }

      showNotification?.('Quote approved successfully', 'success');

      // Refresh the list
      await fetchRequests();
    } catch (err) {
      console.error('Error approving quote:', err);
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to approve quote',
        'error'
      );
      throw err; // Re-throw for the card to handle
    }
  };

  /**
   * Decline a quote
   */
  const handleDecline = async (requestId: number) => {
    try {
      const response = await fetch(`${API_BASE}/${requestId}/decline`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to decline quote');
      }

      showNotification?.('Quote declined', 'info');

      // Refresh the list
      await fetchRequests();
    } catch (err) {
      console.error('Error declining quote:', err);
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to decline quote',
        'error'
      );
      throw err; // Re-throw for the card to handle
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRequests();
    fetchProjects();
  }, [fetchRequests, fetchProjects]);

  // Loading state
  if (isLoading) {
    return (
      <div className="tw-loading">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading requests...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tw-error">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="tw-btn-secondary" onClick={fetchRequests}>Retry</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      {/* Header */}
      <div className="adhoc-header">
        <div>
          <h2 className="tw-heading">Ad-Hoc Requests</h2>
          <p className="tw-text-muted adhoc-desc">
            Submit requests for additional work outside your current project scope
          </p>
        </div>
        <button
          className="tw-btn-primary adhoc-btn"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="tw-h-3.5 tw-w-3.5" />
          New Request
        </button>
      </div>

      {/* Request List */}
      {requests.length === 0 ? (
        <div className="tw-empty-state">
          <Inbox className="tw-h-6 tw-w-6" />
          <p>No requests yet</p>
          <p className="proj-text-sm">Click "New Request" to submit your first ad-hoc request</p>
        </div>
      ) : (
        <div ref={listRef} className="tw-section">
          {requests.map((request) => (
            <AdHocRequestCard
              key={request.id}
              request={request}
              onApprove={handleApprove}
              onDecline={handleDecline}
            />
          ))}
        </div>
      )}

      {/* New Request Modal */}
      {isModalOpen && (
        <div
          className="adhoc-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="tw-panel adhoc-modal-content">
            <div className="tw-divider adhoc-modal-header">
              <div>
                <h3 className="tw-heading">New Ad-Hoc Request</h3>
                <p className="tw-text-muted adhoc-desc">
                  Describe what you need and we'll provide a quote
                </p>
              </div>
              <button className="tw-btn-icon" onClick={() => setIsModalOpen(false)}>
                <X className="tw-h-4 tw-w-4" />
              </button>
            </div>
            <NewRequestForm
              onSubmit={handleSubmit}
              onCancel={() => setIsModalOpen(false)}
              loading={isSubmitting}
              projects={projects}
            />
          </div>
        </div>
      )}
    </div>
  );
}
