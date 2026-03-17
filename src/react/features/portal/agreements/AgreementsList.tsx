/**
 * ===============================================
 * AGREEMENTS LIST
 * ===============================================
 * @file src/react/features/portal/agreements/AgreementsList.tsx
 *
 * Client-facing list of their agreements.
 */

import * as React from 'react';
import { useCallback } from 'react';
import { FileCheck, ArrowRight, Check, Clock, Loader2 } from 'lucide-react';
import { usePortalData } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import type { Agreement, AgreementsListProps } from './types';

function getStatusIcon(status: string) {
  switch (status) {
  case 'completed':
    return <Check size={16} style={{ color: 'var(--app-color-success)' }} />;
  case 'in_progress':
  case 'viewed':
    return <Loader2 size={16} style={{ color: 'var(--app-color-primary)' }} />;
  default:
    return <Clock size={16} style={{ color: 'var(--app-color-text-muted)' }} />;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
  case 'completed': return 'Completed';
  case 'in_progress': return 'In Progress';
  case 'sent': return 'Awaiting Review';
  case 'viewed': return 'In Progress';
  case 'draft': return 'Draft';
  case 'cancelled': return 'Cancelled';
  case 'expired': return 'Expired';
  default: return status;
  }
}

export function AgreementsList({
  getAuthToken,
  showNotification: _showNotification,
  onNavigate
}: AgreementsListProps) {
  const { data, isLoading, error } = usePortalData<{ agreements: Agreement[] }>({
    getAuthToken,
    url: API_ENDPOINTS.AGREEMENTS_MY,
    transform: (raw) => raw as { agreements: Agreement[] }
  });

  const agreements = data?.agreements || [];

  const handleOpen = useCallback((id: number) => {
    onNavigate?.('agreements', String(id));
  }, [onNavigate]);

  if (isLoading) {
    return (
      <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-card">
        <p className="form-error-message">{error}</p>
      </div>
    );
  }

  if (agreements.length === 0) {
    return (
      <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <FileCheck size={32} style={{ color: 'var(--app-color-text-muted)', margin: '0 auto' }} />
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>No agreements yet</p>
      </div>
    );
  }

  return (
    <div className="portal-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {agreements.map((agreement) => {
        const completedSteps = agreement.steps?.filter((s) => s.status === 'completed').length || 0;
        const totalSteps = agreement.steps?.length || 0;
        const isActionable = ['sent', 'viewed', 'in_progress'].includes(agreement.status);

        return (
          <div key={agreement.id} className="portal-card card-clickable" onClick={() => handleOpen(agreement.id)}>
            <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{agreement.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {getStatusIcon(agreement.status)}
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                  {getStatusLabel(agreement.status)}
                </span>
              </div>
            </div>

            {totalSteps > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'var(--app-color-border)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(completedSteps / totalSteps) * 100}%`,
                    backgroundColor: 'var(--app-color-success)',
                    borderRadius: 2,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <span className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {completedSteps} of {totalSteps} steps
                </span>
              </div>
            )}

            {isActionable && (
              <button className="btn-primary" style={{ marginTop: '0.75rem' }}>
                Continue <ArrowRight size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
