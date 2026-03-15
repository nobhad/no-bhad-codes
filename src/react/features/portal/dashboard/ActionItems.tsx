/**
 * ActionItems
 * "Needs Your Attention" section showing pending actions for the client.
 * Each item renders as a StatCard for consistent structure.
 */

import * as React from 'react';
import { StatCard } from '@react/components/portal';

// ============================================================================
// TYPES
// ============================================================================

export interface ActionItemCounts {
  pendingContracts: number;
  pendingInvoices: number;
  pendingApprovals: number;
  pendingQuestionnaires: number;
  pendingDocRequests: number;
}

interface ActionItemsProps {
  counts: ActionItemCounts;
  onNavigate?: (tab: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

interface ActionItemConfig {
  key: keyof ActionItemCounts;
  label: string;
  navigateTo: string;
  alert?: boolean;
}

const ACTION_ITEMS: ActionItemConfig[] = [
  { key: 'pendingContracts', label: 'Contracts to Sign', navigateTo: 'documents' },
  { key: 'pendingInvoices', label: 'Invoices Pending', navigateTo: 'documents', alert: true },
  { key: 'pendingApprovals', label: 'Approvals Waiting', navigateTo: 'deliverables' },
  { key: 'pendingQuestionnaires', label: 'Questionnaires', navigateTo: 'files' },
  { key: 'pendingDocRequests', label: 'Documents Requested', navigateTo: 'files' }
];

// ============================================================================
// COMPONENT
// ============================================================================

export const ActionItems = React.memo(({ counts, onNavigate }: ActionItemsProps) => {
  // Only show items with counts > 0
  const activeItems = ACTION_ITEMS.filter((item) => (counts[item.key] ?? 0) > 0);

  if (activeItems.length === 0) return null;

  // Returns fragment of StatCards — placed directly inside dashboard-stats-grid
  return (
    <>
      {activeItems.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          value={counts[item.key]}
          variant={item.alert ? 'alert' : 'warning'}
          onClick={onNavigate ? () => onNavigate(item.navigateTo) : undefined}
        />
      ))}
    </>
  );
});
