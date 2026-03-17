/**
 * Portal Proposals Types
 * Types for the client portal proposal views
 */

/** Proposal statuses visible to clients */
export type PortalProposalStatus = 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

/** Client-facing proposal from API */
export interface PortalProposal {
  id: number;
  title: string;
  status: string;
  amount: number | null;
  projectType: string | null;
  selectedTier: string | null;
  sentAt: string | null;
  validUntil: string | null;
  createdAt: string;
}

/** Full proposal detail from GET /api/proposals/:id */
export interface PortalProposalDetail {
  id: number;
  projectId: number;
  clientId: number;
  projectType: string;
  selectedTier: string;
  basePrice: number;
  finalPrice: number;
  maintenanceOption: string | null;
  status: string;
  clientNotes: string | null;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  project: { name: string };
  client: { name: string; email: string; company: string | null };
  features: PortalProposalFeature[];
}

export interface PortalProposalFeature {
  featureId: string;
  featureName: string;
  featurePrice: number;
  featureCategory: string;
  isIncludedInTier: boolean;
  isAddon: boolean;
}

/** API response for client proposals */
export interface PortalProposalsResponse {
  proposals: PortalProposal[];
}

/** Tier display labels */
export const TIER_LABELS: Record<string, string> = {
  good: 'Good',
  better: 'Better',
  best: 'Best'
};

/** Maintenance tier display labels */
export const MAINTENANCE_LABELS: Record<string, string> = {
  diy: 'DIY (Self-Managed)',
  essential: 'Essential Care',
  standard: 'Standard Care',
  premium: 'Premium Care'
};

/** Statuses that allow acceptance */
export const ACCEPTABLE_STATUSES = ['sent', 'pending', 'reviewed'];

/** Proposal status display config */
export const PROPOSAL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  sent: { label: 'Sent', color: 'var(--status-pending)' },
  viewed: { label: 'Viewed', color: 'var(--status-in-progress)' },
  accepted: { label: 'Accepted', color: 'var(--status-completed)' },
  declined: { label: 'Declined', color: 'var(--status-cancelled)' },
  expired: { label: 'Expired', color: 'var(--color-text-tertiary)' },
  pending: { label: 'Pending', color: 'var(--status-pending)' },
  draft: { label: 'Draft', color: 'var(--color-text-tertiary)' }
};
