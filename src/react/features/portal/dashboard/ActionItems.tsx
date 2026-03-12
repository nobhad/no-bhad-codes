/**
 * ActionItems
 * "Needs Your Attention" section showing pending actions for the client.
 * Each item is clickable and navigates to the relevant tab.
 */

import * as React from 'react';
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

  // Returns fragment of cards — intended to be placed directly inside a grid/flex row
  return (
    <>
      {activeItems.map((item) => {
        const count = counts[item.key];

        return (
          <button
            key={item.key}
            className={`attention-card has-items${item.alert ? ' attention-card--alert' : ''}`}
            onClick={onNavigate ? () => onNavigate(item.navigateTo) : undefined}
            type="button"
          >
            <span className="field-label">{item.label}</span>
            <span className="attention-count">{count}</span>
          </button>
        );
      })}
    </>
  );
});
