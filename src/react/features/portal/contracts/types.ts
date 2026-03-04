/**
 * Portal Contracts Types
 * Types for the client portal contract views
 */

/** Contract statuses visible to clients */
export type PortalContractStatus = 'draft' | 'sent' | 'signed' | 'active' | 'expired';

/** Client-facing contract from API */
export interface PortalContract {
  id: number;
  projectId: number | null;
  projectName: string | null;
  status: string;
  signedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/** API response for client contracts */
export interface PortalContractsResponse {
  contracts: PortalContract[];
}

/** Contract status display config */
export const CONTRACT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--portal-text-muted)' },
  sent: { label: 'Sent', color: 'var(--status-pending)' },
  signed: { label: 'Signed', color: 'var(--status-completed)' },
  active: { label: 'Active', color: 'var(--status-completed)' },
  expired: { label: 'Expired', color: 'var(--status-cancelled)' }
};
