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

/** API response for client proposals */
export interface PortalProposalsResponse {
  proposals: PortalProposal[];
}

/** Proposal status display config */
export const PROPOSAL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  sent: { label: 'Sent', color: 'var(--status-pending)' },
  viewed: { label: 'Viewed', color: 'var(--status-in-progress)' },
  accepted: { label: 'Accepted', color: 'var(--status-completed)' },
  declined: { label: 'Declined', color: 'var(--status-cancelled)' },
  expired: { label: 'Expired', color: 'var(--portal-text-muted)' },
  pending: { label: 'Pending', color: 'var(--status-pending)' },
  draft: { label: 'Draft', color: 'var(--portal-text-muted)' }
};
