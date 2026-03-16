import * as React from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { IconButton } from '@react/factories';
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
        <span className="text-secondary">selected</span>

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
              <button className="dropdown-trigger">
                Change Status
                <ChevronDown className="dropdown-caret" />
              </button>
            </PortalDropdownTrigger>
            <PortalDropdownContent sideOffset={0}>
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
          <IconButton
            key={action.id}
            action={action.id as 'edit' | 'delete' | 'view'}
            title={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
          />
        ))}

        {/* Delete action */}
        {onDelete && (
          <IconButton action="delete" title="Delete selected" onClick={onDelete} disabled={deleteLoading} />
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
