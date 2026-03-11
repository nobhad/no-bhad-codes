/**
 * ActionItems
 * "Needs Your Attention" section showing pending actions for the client.
 * Each item is clickable and navigates to the relevant tab.
 */

import * as React from 'react';
import {
  FileSignature,
  Receipt,
  CheckCircle,
  ClipboardList,
  Upload,
  AlertTriangle
} from 'lucide-react';
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  navigateTo: string;
  priority: number;
}

const ACTION_ITEMS: ActionItemConfig[] = [
  { key: 'pendingContracts', icon: FileSignature, label: 'contracts to sign', navigateTo: 'documents', priority: 1 },
  { key: 'pendingInvoices', icon: Receipt, label: 'invoices pending', navigateTo: 'documents', priority: 2 },
  { key: 'pendingApprovals', icon: CheckCircle, label: 'approvals waiting', navigateTo: 'deliverables', priority: 3 },
  { key: 'pendingQuestionnaires', icon: ClipboardList, label: 'questionnaires to complete', navigateTo: 'files', priority: 4 },
  { key: 'pendingDocRequests', icon: Upload, label: 'documents requested', navigateTo: 'files', priority: 5 }
];

// ============================================================================
// COMPONENT
// ============================================================================

export const ActionItems = React.memo(({ counts, onNavigate }: ActionItemsProps) => {
  // Only show items with counts > 0
  const activeItems = ACTION_ITEMS.filter((item) => (counts[item.key] ?? 0) > 0);

  if (activeItems.length === 0) return null;

  return (
    <div className="action-items-section">
      <h3>
        <AlertTriangle className="icon-xs" />
        Needs Your Attention
      </h3>
      <div className="action-items-grid">
        {activeItems.map((item) => {
          const count = counts[item.key];
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              className="attention-card has-items"
              onClick={onNavigate ? () => onNavigate(item.navigateTo) : undefined}
              type="button"
            >
              <div className="attention-icon">
                <Icon className="icon-sm" />
              </div>
              <div className="attention-content">
                <span className="attention-count">{count}</span>
                <span className="field-label">{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
