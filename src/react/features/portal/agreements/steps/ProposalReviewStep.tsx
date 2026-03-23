/**
 * Proposal review step — shows proposal summary + "Approve" button.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { usePortalFetch } from '../../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '../../../../../constants/api-endpoints';

interface ProposalReviewStepProps {
  entityId: number;
  entityData?: Record<string, unknown>;
  onComplete: () => void;
  getAuthToken?: () => string | null;
}

export const ProposalReviewStep = React.memo(({
  entityId,
  entityData,
  onComplete,
  getAuthToken
}: ProposalReviewStepProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { portalFetch } = usePortalFetch({ getAuthToken });

  const formatCurrency = (amount: unknown) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const handleApprove = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await portalFetch(`${API_ENDPOINTS.PROPOSALS}/${entityId}/accept`, {
        method: 'POST'
      });
      onComplete();
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  }, [entityId, portalFetch, onComplete]);

  const status = entityData?.status as string | undefined;

  // If proposal is already accepted, show completed state
  if (status === 'accepted') {
    return (
      <div className="agreement-step-content">
        <div className="layout-row text-success" style={{ gap: 'var(--space-1)' }}>
          <Check size={20} />
          <span>Proposal approved</span>
        </div>
      </div>
    );
  }

  return (
    <div className="agreement-step-content">
      <h3>Review Your Proposal</h3>

      {entityData && (
        <div className="portal-card" style={{ marginBottom: 'var(--space-2)' }}>
          {entityData.project_type != null && entityData.project_type !== '' && (
            <div className="portal-detail-item">
              <span className="label">Project Type</span>
              <span>{String(entityData.project_type)}</span>
            </div>
          )}
          {entityData.selected_tier != null && (
            <div className="portal-detail-item">
              <span className="label">Selected Tier</span>
              <span style={{ textTransform: 'capitalize' }}>{String(entityData.selected_tier)}</span>
            </div>
          )}
          {entityData.final_price != null && (
            <div className="portal-detail-item">
              <span className="label">Total</span>
              <span className="text-primary font-semibold">
                {formatCurrency(entityData.final_price)}
              </span>
            </div>
          )}
        </div>
      )}

      <button
        className="btn-primary"
        onClick={handleApprove}
        disabled={isSubmitting}
        style={{ marginTop: 'var(--space-1)' }}
      >
        {isSubmitting ? (
          <><Loader2 size={16} className="animate-spin" /> Approving...</>
        ) : (
          <><Check size={16} /> Approve Proposal</>
        )}
      </button>
    </div>
  );
});
