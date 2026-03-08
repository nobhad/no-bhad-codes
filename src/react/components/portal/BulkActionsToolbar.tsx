import * as React from 'react';
import { X, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from './PortalButton';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from './PortalDropdown';

interface BulkAction {
  /** Unique identifier for the action */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Action variant for styling */
  variant?: 'default' | 'danger';
  /** Handler for the action */
  onClick: () => void;
  /** Whether action is loading */
  loading?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
}

interface StatusOption {
  value: string;
  label: string;
  color?: string;
}

interface BulkActionsToolbarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Total number of items */
  totalCount: number;
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Callback to select all */
  onSelectAll: () => void;
  /** Whether all items are selected */
  allSelected: boolean;
  /** Custom actions to show */
  actions?: BulkAction[];
  /** Status change options (if status change is supported) */
  statusOptions?: StatusOption[];
  /** Callback when status is changed */
  onStatusChange?: (status: string) => void;
  /** Callback for delete action */
  onDelete?: () => void;
  /** Whether delete is in progress */
  deleteLoading?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * BulkActionsToolbar
 * Toolbar that appears when items are selected in a table
 */
export function BulkActionsToolbar({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  allSelected,
  actions = [],
  statusOptions,
  onStatusChange,
  onDelete,
  deleteLoading = false,
  className
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={cn('bulk-actions-toolbar', className)}>
      {/* Selection info */}
      <div className="bulk-actions-info">
        <span className="bulk-actions-count">{selectedCount}</span>
        <span className="text-muted">selected</span>

        {!allSelected && selectedCount < totalCount && (
          <button
            type="button"
            className="btn-link"
            onClick={onSelectAll}
          >
            Select all {totalCount}
          </button>
        )}
      </div>

      <div className="bulk-actions-spacer" />

      {/* Actions */}
      <div className="bulk-actions-buttons">
        {/* Status change dropdown */}
        {statusOptions && statusOptions.length > 0 && onStatusChange && (
          <PortalDropdown>
            <PortalDropdownTrigger asChild>
              <PortalButton variant="secondary" size="sm">
                <ArrowRight className="icon-sm" />
                Change Status
              </PortalButton>
            </PortalDropdownTrigger>
            <PortalDropdownContent>
              {statusOptions.map((option) => (
                <PortalDropdownItem key={option.value} onClick={() => onStatusChange(option.value)}>
                  {option.color && (
                    <span
                      className="status-dot"
                      data-status={option.value}
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  {option.label}
                </PortalDropdownItem>
              ))}
            </PortalDropdownContent>
          </PortalDropdown>
        )}

        {/* Custom actions */}
        {actions.map((action) => (
          <PortalButton
            key={action.id}
            variant={action.variant === 'danger' ? 'danger' : 'secondary'}
            size="sm"
            onClick={action.onClick}
            loading={action.loading}
            disabled={action.disabled}
          >
            {action.icon}
            {action.label}
          </PortalButton>
        ))}

        {/* Delete action */}
        {onDelete && (
          <PortalButton
            variant="danger"
            size="sm"
            onClick={onDelete}
            loading={deleteLoading}
          >
            <Trash2 className="icon-sm" />
            Delete
          </PortalButton>
        )}

        {/* Clear selection */}
        <button
          type="button"
          className="icon-btn"
          onClick={onClearSelection}
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="icon-sm" />
        </button>
      </div>
    </div>
  );
}
