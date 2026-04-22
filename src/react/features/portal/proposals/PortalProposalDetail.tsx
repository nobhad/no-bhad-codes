/**
 * PortalProposalDetail
 * Full proposal detail view for clients.
 * Shows scope, features, pricing, maintenance tier, and accept/decline actions.
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Layers, DollarSign, Calendar, Check,
  X, Wrench, ChevronDown, ChevronUp, Shield
} from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { apiPost, toFriendlyError } from '@/utils/api-client';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { formatCurrency } from '@react/factories';
import { formatCardDate } from '@react/utils/cardFormatters';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { PortalViewProps } from '../types';
import type { PortalProposalDetail as ProposalDetail, PortalProposalFeature } from './types';
import { TIER_LABELS, MAINTENANCE_LABELS, ACCEPTABLE_STATUSES } from './types';

export interface PortalProposalDetailProps extends PortalViewProps {
  proposalId?: number;
}

export function PortalProposalDetail({
  getAuthToken,
  showNotification
}: PortalProposalDetailProps) {
  const params = useParams();
  const navigate = useNavigate();
  const containerRef = useFadeIn<HTMLDivElement>();
  const proposalId = params.id ? parseInt(params.id, 10) : 0;

  const { data: proposal, isLoading, error, refetch } = usePortalData<ProposalDetail>({
    getAuthToken,
    url: `${API_ENDPOINTS.PROPOSALS}/${proposalId}`
  });

  const [accepting, setAccepting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const canAccept = proposal && ACCEPTABLE_STATUSES.includes(proposal.status);

  // Group features by category
  const featuresByCategory = useMemo(() => {
    if (!proposal?.features) return new Map<string, PortalProposalFeature[]>();
    const map = new Map<string, PortalProposalFeature[]>();
    for (const f of proposal.features) {
      const cat = f.featureCategory || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    }
    return map;
  }, [proposal?.features]);

  const includedFeatures = useMemo(
    () => proposal?.features.filter(f => f.isIncludedInTier) ?? [],
    [proposal?.features]
  );
  const addonFeatures = useMemo(
    () => proposal?.features.filter(f => f.isAddon) ?? [],
    [proposal?.features]
  );

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const handleAccept = useCallback(async () => {
    if (!proposal || accepting) return;
    setAccepting(true);
    try {
      const response = await apiPost(`${API_ENDPOINTS.PROPOSALS}/${proposal.id}/accept`);
      if (response.ok) {
        showNotification?.('Proposal accepted! Your project is being set up.', 'success');
        setShowConfirm(false);
        refetch();
      } else if (response.status === 409) {
        // 409 from the server is "this proposal is already in the
        // target state" — treat as success-equivalent UX so a
        // double-click or network-retry doesn't look like a failure.
        showNotification?.('This proposal has already been accepted.', 'info');
        setShowConfirm(false);
        refetch();
      } else {
        showNotification?.(
          await toFriendlyError(response, { fallback: 'Failed to accept proposal' }),
          'error'
        );
      }
    } catch {
      showNotification?.('Failed to accept proposal. Please try again.', 'error');
    } finally {
      setAccepting(false);
    }
  }, [proposal, accepting, showNotification, refetch]);

  if (!proposalId) return <EmptyState icon={<FileText className="icon-lg" />} message="Proposal not found" />;
  if (isLoading) return <LoadingState message="Loading proposal..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!proposal) return <EmptyState icon={<FileText className="icon-lg" />} message="Proposal not found" />;

  const tierLabel = TIER_LABELS[proposal.selectedTier] || proposal.selectedTier;
  const maintenanceLabel = proposal.maintenanceOption
    ? MAINTENANCE_LABELS[proposal.maintenanceOption] || proposal.maintenanceOption
    : null;
  const isBestTier = proposal.selectedTier === 'best';

  return (
    <div ref={containerRef} className="section">
      {/* Back button */}
      <button className="btn-ghost mb-2" onClick={() => navigate('/documents')}>
        <ArrowLeft className="icon-xs" />
        Back to Documents
      </button>

      {/* Header */}
      <div className="portal-detail-header">
        <div className="portal-detail-header-info">
          <h2 className="text-primary">{proposal.project.name}</h2>
          <div className="portal-card-meta">
            <StatusBadge status={getStatusVariant(proposal.status)}>{proposal.status}</StatusBadge>
            {proposal.selectedTier && (
              <span className="portal-card-meta-item">
                <Layers className="icon-xs" />
                {tierLabel} Tier
              </span>
            )}
            {proposal.createdAt && (
              <span className="portal-card-meta-item">
                <Calendar className="icon-xs" />
                {formatCardDate(proposal.createdAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pricing card */}
      <div className="portal-card mt-2">
        <div className="portal-card-header">
          <h3 className="text-primary">
            <DollarSign className="icon-xs" /> Pricing
          </h3>
        </div>
        <div className="portal-detail-grid">
          <div className="portal-detail-item">
            <span className="label">Project Type</span>
            <span className="text-primary">{proposal.projectType || 'Custom'}</span>
          </div>
          <div className="portal-detail-item">
            <span className="label">Selected Tier</span>
            <span className="text-primary">{tierLabel}</span>
          </div>
          <div className="portal-detail-item">
            <span className="label">Total Price</span>
            <span className="text-primary text-lg">
              {formatCurrency(proposal.finalPrice)}
            </span>
          </div>
          {proposal.basePrice !== proposal.finalPrice && (
            <div className="portal-detail-item">
              <span className="label">Base Price</span>
              <span className="text-secondary">{formatCurrency(proposal.basePrice)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      {proposal.features.length > 0 && (
        <div className="portal-card mt-2">
          <div className="portal-card-header">
            <h3 className="text-primary">
              <Check className="icon-xs" /> Included Features ({includedFeatures.length})
            </h3>
          </div>
          <div className="portal-feature-list">
            {Array.from(featuresByCategory.entries()).map(([category, features]) => {
              const included = features.filter(f => f.isIncludedInTier);
              if (included.length === 0) return null;
              const isExpanded = expandedCategories.has(category);
              return (
                <div key={category} className="portal-feature-category">
                  <button
                    className="portal-feature-category-header btn-ghost"
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="text-primary">{category} ({included.length})</span>
                    {isExpanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
                  </button>
                  {isExpanded && (
                    <ul className="portal-feature-items">
                      {included.map(f => (
                        <li key={f.featureId} className="portal-feature-item">
                          <Check className="icon-xs text-status-completed" />
                          <span>{f.featureName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Addon features */}
      {addonFeatures.length > 0 && (
        <div className="portal-card mt-2">
          <div className="portal-card-header">
            <h3 className="text-primary">Add-On Features ({addonFeatures.length})</h3>
          </div>
          <ul className="portal-feature-items">
            {addonFeatures.map(f => (
              <li key={f.featureId} className="portal-feature-item">
                <span>{f.featureName}</span>
                {f.featurePrice > 0 && (
                  <span className="text-secondary label">+{formatCurrency(f.featurePrice)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Maintenance plan */}
      {maintenanceLabel && (
        <div className="portal-card mt-2">
          <div className="portal-card-header">
            <h3 className="text-primary">
              <Wrench className="icon-xs" /> Maintenance Plan
            </h3>
          </div>
          <div className="portal-detail-grid">
            <div className="portal-detail-item">
              <span className="label">Selected Plan</span>
              <span className="text-primary">{maintenanceLabel}</span>
            </div>
            {isBestTier && proposal.maintenanceOption !== 'diy' && (
              <div className="portal-detail-item">
                <span className="label">Included</span>
                <span className="text-primary">
                  <Shield className="icon-xs text-status-completed" /> 3 months included with Best tier
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Client notes */}
      {proposal.clientNotes && (
        <div className="portal-card mt-2">
          <div className="portal-card-header">
            <h3 className="text-primary">Notes</h3>
          </div>
          <p className="text-secondary whitespace-pre-wrap">{proposal.clientNotes}</p>
        </div>
      )}

      {/* Accept/Decline actions */}
      {canAccept && !showConfirm && (
        <div className="portal-detail-actions mt-lg">
          <button className="btn btn-primary" onClick={() => setShowConfirm(true)}>
            <Check className="icon-xs" />
            Accept Proposal
          </button>
        </div>
      )}

      {/* Confirmation */}
      {showConfirm && (
        <div className="portal-card portal-card--highlight mt-lg">
          <div className="portal-card-header">
            <h3 className="text-primary">Confirm Acceptance</h3>
          </div>
          <p className="text-secondary">
            By accepting this proposal, you agree to the scope and pricing described above.
            Your project will be set up and you will be guided through the next steps.
          </p>
          <div className="portal-detail-actions mt-2">
            <button className="btn btn-primary" onClick={handleAccept} disabled={accepting}>
              {accepting ? 'Accepting...' : 'Confirm Acceptance'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={accepting}>
              <X className="icon-xs" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Already accepted message */}
      {proposal.status === 'accepted' && (
        <div className="portal-card mt-lg" style={{ borderColor: 'var(--status-completed)' }}>
          <p className="text-primary">
            <Check className="icon-xs text-status-completed" />{' '}
            You accepted this proposal{proposal.reviewedAt ? ` on ${formatCardDate(proposal.reviewedAt)}` : ''}.
          </p>
        </div>
      )}
    </div>
  );
}
