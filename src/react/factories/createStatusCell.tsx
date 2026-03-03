/**
 * ===============================================
 * STATUS CELL FACTORY
 * ===============================================
 * @file src/react/factories/createStatusCell.tsx
 *
 * Reusable status cell components for tables.
 * Eliminates repeated status dropdown patterns across admin tables.
 */

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@react/lib/utils';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { StatusBadge, type StatusVariant } from '@react/components/portal/StatusBadge';

// ============================================
// TYPES
// ============================================

export interface StatusOption {
  /** Status value (stored in database) */
  value: string;
  /** Display label */
  label: string;
  /** Badge variant for styling */
  variant: StatusVariant;
  /** Whether this option is disabled */
  disabled?: boolean;
  /** Description text (shown in dropdown) */
  description?: string;
}

export interface StatusConfig {
  /** Available status options */
  options: StatusOption[];
  /** Default variant for unknown statuses */
  defaultVariant?: StatusVariant;
  /** Whether dropdown is disabled */
  disabled?: boolean;
}

export interface StatusCellProps {
  /** Current status value */
  value: string;
  /** Status configuration */
  config: StatusConfig;
  /** Callback when status changes */
  onChange?: (newStatus: string) => void;
  /** Row ID for data attributes */
  rowId?: string | number;
  /** Additional className */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show as read-only badge (no dropdown) */
  readOnly?: boolean;
}

// ============================================
// STATUS CELL COMPONENT
// ============================================

/**
 * Status cell with dropdown for changing status.
 *
 * @example
 * const STATUS_CONFIG: StatusConfig = {
 *   options: [
 *     { value: 'active', label: 'Active', variant: 'active' },
 *     { value: 'pending', label: 'Pending', variant: 'pending' },
 *     { value: 'completed', label: 'Completed', variant: 'completed' }
 *   ]
 * };
 *
 * <StatusCell
 *   value={project.status}
 *   config={STATUS_CONFIG}
 *   onChange={(status) => updateProject(project.id, { status })}
 * />
 */
export function StatusCell({
  value,
  config,
  onChange,
  rowId,
  className,
  size = 'sm',
  readOnly = false
}: StatusCellProps) {
  const { options, defaultVariant = 'pending', disabled } = config;

  // Find current status option
  const currentOption = options.find((opt) => opt.value === value);
  const currentLabel = currentOption?.label || value;
  const currentVariant = currentOption?.variant || defaultVariant;

  // Read-only mode - just show badge
  if (readOnly || !onChange) {
    return (
      <StatusBadge status={currentVariant} size={size} className={className}>
        {currentLabel}
      </StatusBadge>
    );
  }

  return (
    <PortalDropdown>
      <PortalDropdownTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn('status-dropdown-trigger', className)}
          data-status={value}
          data-id={rowId}
          disabled={disabled}
        >
          <StatusBadge status={currentVariant} size={size}>
            {currentLabel}
          </StatusBadge>
          <ChevronDown
            className="status-dropdown-caret"
            aria-hidden="true"
          />
        </button>
      </PortalDropdownTrigger>
      <PortalDropdownContent sideOffset={0} align="start">
        {options
          .filter((option) => option.value !== value)
          .map((option) => (
            <PortalDropdownItem
              key={option.value}
              onClick={() => onChange(option.value)}
              disabled={option.disabled}
              className="status-dropdown-item"
            >
              <StatusBadge status={option.variant} size="sm">
                {option.label}
              </StatusBadge>
              {option.description && (
                <span className="status-dropdown-item-description">
                  {option.description}
                </span>
              )}
            </PortalDropdownItem>
          ))}
      </PortalDropdownContent>
    </PortalDropdown>
  );
}

// ============================================
// COMMON STATUS CONFIGURATIONS
// ============================================

/**
 * Project status configuration.
 */
export const PROJECT_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'active', label: 'Active', variant: 'active' },
    { value: 'in_progress', label: 'In Progress', variant: 'active' },
    { value: 'on_hold', label: 'On Hold', variant: 'on-hold' },
    { value: 'completed', label: 'Completed', variant: 'completed' },
    { value: 'cancelled', label: 'Cancelled', variant: 'cancelled' }
  ]
};

/**
 * Client status configuration.
 */
export const CLIENT_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'active', label: 'Active', variant: 'active' },
    { value: 'inactive', label: 'Inactive', variant: 'inactive' },
    { value: 'prospect', label: 'Prospect', variant: 'new' }
  ]
};

/**
 * Invoice status configuration.
 */
export const INVOICE_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'draft', label: 'Draft', variant: 'inactive' },
    { value: 'sent', label: 'Sent', variant: 'active' },
    { value: 'paid', label: 'Paid', variant: 'completed' },
    { value: 'overdue', label: 'Overdue', variant: 'cancelled' },
    { value: 'cancelled', label: 'Cancelled', variant: 'cancelled' }
  ]
};

/**
 * Lead status configuration.
 */
export const LEAD_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'new', label: 'New', variant: 'new' },
    { value: 'contacted', label: 'Contacted', variant: 'active' },
    { value: 'qualified', label: 'Qualified', variant: 'qualified' },
    { value: 'proposal', label: 'Proposal', variant: 'active' },
    { value: 'won', label: 'Won', variant: 'completed' },
    { value: 'lost', label: 'Lost', variant: 'cancelled' }
  ]
};

/**
 * Task status configuration.
 */
export const TASK_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'pending', label: 'Pending', variant: 'pending' },
    { value: 'in_progress', label: 'In Progress', variant: 'active' },
    { value: 'completed', label: 'Completed', variant: 'completed' },
    { value: 'blocked', label: 'Blocked', variant: 'on-hold' }
  ]
};

/**
 * Deliverable status configuration.
 */
export const DELIVERABLE_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'pending', label: 'Pending', variant: 'pending' },
    { value: 'in_progress', label: 'In Progress', variant: 'active' },
    { value: 'review', label: 'In Review', variant: 'qualified' },
    { value: 'approved', label: 'Approved', variant: 'completed' },
    { value: 'rejected', label: 'Rejected', variant: 'cancelled' }
  ]
};

/**
 * Contract status configuration.
 */
export const CONTRACT_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'draft', label: 'Draft', variant: 'inactive' },
    { value: 'sent', label: 'Sent', variant: 'active' },
    { value: 'signed', label: 'Signed', variant: 'completed' },
    { value: 'expired', label: 'Expired', variant: 'cancelled' }
  ]
};

/**
 * Document request status configuration.
 */
export const DOCUMENT_REQUEST_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'pending', label: 'Pending', variant: 'pending' },
    { value: 'uploaded', label: 'Uploaded', variant: 'active' },
    { value: 'under_review', label: 'Under Review', variant: 'qualified' },
    { value: 'approved', label: 'Approved', variant: 'completed' },
    { value: 'rejected', label: 'Rejected', variant: 'cancelled' }
  ]
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get status variant from a status config.
 */
export function getStatusVariant(
  status: string,
  config: StatusConfig
): StatusVariant {
  const option = config.options.find((opt) => opt.value === status);
  return option?.variant || config.defaultVariant || 'pending';
}

/**
 * Get status label from a status config.
 */
export function getStatusLabel(status: string, config: StatusConfig): string {
  const option = config.options.find((opt) => opt.value === status);
  return option?.label || status;
}

/**
 * Create a status config from a simple map.
 *
 * @example
 * const config = createStatusConfig({
 *   active: { label: 'Active', variant: 'active' },
 *   inactive: { label: 'Inactive', variant: 'pending' }
 * });
 */
export function createStatusConfig(
  statuses: Record<string, { label: string; variant: StatusVariant; disabled?: boolean }>
): StatusConfig {
  return {
    options: Object.entries(statuses).map(([value, config]) => ({
      value,
      ...config
    }))
  };
}

// ============================================
// PRIORITY CELL COMPONENT
// ============================================

export interface PriorityCellProps {
  /** Current priority value */
  value: 'low' | 'medium' | 'high' | 'urgent' | string;
  /** Callback when priority changes */
  onChange?: (newPriority: string) => void;
  /** Additional className */
  className?: string;
  /** Show as read-only */
  readOnly?: boolean;
}

const PRIORITY_CONFIG: StatusConfig = {
  options: [
    { value: 'low', label: 'Low', variant: 'inactive' },
    { value: 'medium', label: 'Medium', variant: 'pending' },
    { value: 'high', label: 'High', variant: 'on-hold' },
    { value: 'urgent', label: 'Urgent', variant: 'cancelled' }
  ]
};

/**
 * Priority cell with dropdown.
 *
 * @example
 * <PriorityCell
 *   value={task.priority}
 *   onChange={(priority) => updateTask(task.id, { priority })}
 * />
 */
export function PriorityCell({
  value,
  onChange,
  className,
  readOnly
}: PriorityCellProps) {
  return (
    <StatusCell
      value={value}
      config={PRIORITY_CONFIG}
      onChange={onChange}
      className={className}
      readOnly={readOnly}
    />
  );
}

// ============================================
// EXPORTS
// ============================================

export const StatusConfigs = {
  project: PROJECT_STATUS_CONFIG,
  client: CLIENT_STATUS_CONFIG,
  invoice: INVOICE_STATUS_CONFIG,
  lead: LEAD_STATUS_CONFIG,
  task: TASK_STATUS_CONFIG,
  deliverable: DELIVERABLE_STATUS_CONFIG,
  contract: CONTRACT_STATUS_CONFIG,
  documentRequest: DOCUMENT_REQUEST_STATUS_CONFIG
};

export default StatusCell;
