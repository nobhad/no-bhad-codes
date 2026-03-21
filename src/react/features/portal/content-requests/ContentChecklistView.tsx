/**
 * ContentChecklistView
 * Client portal view for content request checklists.
 * Shows checklists with progress bars and type-specific submission UI.
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Check, Clock, AlertCircle, Send } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { ProgressBar } from '@react/components/portal/ProgressBar';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { useFadeIn } from '@react/hooks/useGsap';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { PortalViewProps } from '../types';

// ============================================
// TYPES
// ============================================

interface ContentItem {
  id: number;
  checklistId: number;
  title: string;
  description: string | null;
  contentType: 'text' | 'file' | 'url' | 'structured';
  category: string;
  isRequired: boolean;
  status: string;
  dueDate: string | null;
  textContent: string | null;
  fileId: number | null;
  structuredData: Record<string, unknown> | null;
  adminNotes: string | null;
  submittedAt: string | null;
}

interface CompletionStats {
  total: number;
  pending: number;
  submitted: number;
  accepted: number;
  revisionNeeded: number;
  completionPercent: number;
}

interface ContentChecklist {
  id: number;
  name: string;
  description: string | null;
  status: string;
  projectName?: string;
  items: ContentItem[];
  completionStats: CompletionStats;
}

export interface ContentChecklistViewProps extends PortalViewProps {}

// ============================================
// STATUS LABELS
// ============================================

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  revision_needed: 'Revision Needed',
  accepted: 'Accepted',
  rejected: 'Rejected'
};

function getStatusIcon(status: string) {
  switch (status) {
  case 'accepted': return <Check />;
  case 'submitted': return <Clock />;
  case 'revision_needed': return <AlertCircle />;
  case 'rejected': return <AlertCircle />;
  default: return <Clock />;
  }
}

// ============================================
// SUBMISSION FORM
// ============================================

function ItemSubmissionForm({
  item,
  onSubmit
}: {
  item: ContentItem;
  onSubmit: (itemId: number, type: string, value: string | Record<string, unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(item.id, item.contentType, item.contentType === 'structured' ? JSON.parse(value) : value);
      setValue('');
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  }, [item.id, item.contentType, value, onSubmit]);

  // Already submitted — show submitted content
  if (item.status === 'submitted' || item.status === 'accepted') {
    return (
      <div className="content-item-submitted">
        {item.textContent && <p>{item.textContent}</p>}
        {item.fileId && <span>File uploaded</span>}
        {item.structuredData && <pre>{JSON.stringify(item.structuredData, null, 2)}</pre>}
      </div>
    );
  }

  if (item.contentType === 'file') {
    return (
      <div className="content-file-hint">
        Use the Files section to upload, then link the file here.
      </div>
    );
  }

  return (
    <div className="content-submission-form">
      {item.contentType === 'text' ? (
        <textarea
          className="form-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter your content here..."
          rows={3}
          disabled={submitting}
        />
      ) : (
        <input
          type={item.contentType === 'url' ? 'url' : 'text'}
          className="form-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={item.contentType === 'url' ? 'https://example.com' : 'Enter data as JSON...'}
          disabled={submitting}
        />
      )}
      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={submitting || !value.trim()}
      >
        <Send />
        {submitting ? 'Sending...' : 'Submit'}
      </button>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ContentChecklistView({ getAuthToken }: ContentChecklistViewProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const { data, isLoading, error, refetch } = usePortalData<{ checklists: ContentChecklist[] }>({
    getAuthToken,
    url: API_ENDPOINTS.CONTENT_REQUESTS_MY
  });

  const checklists = useMemo(() => data?.checklists || [], [data]);

  const handleSubmit = useCallback(async (itemId: number, type: string, value: string | Record<string, unknown>) => {
    const endpoint = type === 'structured'
      ? `${API_ENDPOINTS.CONTENT_REQUESTS}/items/${itemId}/submit-data`
      : `${API_ENDPOINTS.CONTENT_REQUESTS}/items/${itemId}/submit-${type}`;

    const body = type === 'text' ? { text: value }
      : type === 'url' ? { url: value }
        : type === 'structured' ? { data: value }
          : { file_id: value };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error('Submission failed');
    refetch();
  }, [refetch]);

  return (
    <TableLayout nested
      containerRef={containerRef}
      title="CONTENT"
      stats={
        <TableStats items={[
          { value: checklists.reduce((sum, c) => sum + c.completionStats.total, 0), label: 'total' },
          { value: checklists.reduce((sum, c) => sum + c.completionStats.accepted, 0), label: 'complete', variant: 'completed' },
          { value: checklists.reduce((sum, c) => sum + c.completionStats.pending, 0), label: 'pending', variant: 'pending' }
        ]} />
      }
    >
      {isLoading ? (
        <LoadingState message="Loading content checklists..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : checklists.length === 0 ? (
        <EmptyState message="No content has been requested yet." />
      ) : (
        <div className="portal-cards-list">
          {checklists.map((checklist) => (
            <div key={checklist.id} className="portal-card checklist-card">
              <div className="portal-card-header">
                <div>
                  <h3>{checklist.name}</h3>
                  {checklist.projectName && (
                    <span className="checklist-project-name">
                      {checklist.projectName}
                    </span>
                  )}
                </div>
                <ProgressBar
                  value={checklist.completionStats.completionPercent}
                  label=""
                  showPercent={false}
                  detail={`(${checklist.completionStats.accepted}/${checklist.completionStats.total} complete)`}
                />
              </div>

              <div>
                {checklist.items.map((item) => (
                  <div key={item.id} className="content-item-row">
                    <div className="content-item-header">
                      <div className="content-item-body">
                        <div className="content-item-title">
                          {getStatusIcon(item.status)}
                          <strong>{item.title}</strong>
                          {item.isRequired && <span className="content-item-required">*</span>}
                        </div>
                        {item.description && (
                          <p className="content-item-description">
                            {item.description}
                          </p>
                        )}
                        {item.adminNotes && item.status === 'revision_needed' && (
                          <div className="content-item-revision-notes">
                            {item.adminNotes}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={getStatusVariant(item.status)}>
                        {STATUS_LABELS[item.status] || item.status}
                      </StatusBadge>
                    </div>

                    {(item.status === 'pending' || item.status === 'revision_needed') && (
                      <div className="content-item-submission">
                        <ItemSubmissionForm item={item} onSubmit={handleSubmit} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </TableLayout>
  );
}
