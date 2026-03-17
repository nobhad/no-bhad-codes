import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import type { StatusVariant } from '@react/components/portal/StatusBadge';
import { PortalTableCell } from '@react/components/portal/PortalTable';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';

/** Title-case fallback for statuses not in config (e.g., "in-progress" → "In Progress") */
function formatStatusFallback(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Minimal shape required from status config objects */
interface StatusConfigEntry {
  label: string;
  [key: string]: unknown;
}

interface StatusDropdownProps {
  /** Current status value */
  status: string;
  /** Map of status keys to config objects (must have `label`) */
  statusConfig: Record<string, StatusConfigEntry>;
  /** Callback when user selects a new status */
  onStatusChange: (newStatus: string) => void;
  /** Accessible label for the trigger button */
  ariaLabel?: string;
  /** Size for the trigger StatusBadge (defaults to 'sm') */
  triggerSize?: 'sm' | 'md' | 'lg';
  /** Custom label resolver for the trigger badge (overrides config lookup) */
  renderTriggerLabel?: (status: string) => string;
  /** Custom status variant resolver (defaults to getStatusVariant) */
  getVariant?: (status: string) => StatusVariant;
  /** PortalDropdownContent alignment (defaults to 'start') */
  align?: 'start' | 'center' | 'end';
  /** PortalDropdownContent sideOffset (defaults to 0) */
  sideOffset?: number;
}

/**
 * Standalone status dropdown (no table cell wrapper).
 * Use this in detail panels or anywhere outside a table row.
 */
export function StatusDropdown({
  status,
  statusConfig,
  onStatusChange,
  ariaLabel = 'Change status',
  triggerSize = 'sm',
  renderTriggerLabel,
  getVariant = getStatusVariant,
  align = 'start',
  sideOffset = 0
}: StatusDropdownProps) {
  const triggerLabel = renderTriggerLabel
    ? renderTriggerLabel(status)
    : statusConfig[status]?.label || formatStatusFallback(status);

  return (
    <PortalDropdown>
      <PortalDropdownTrigger asChild>
        <button className="dropdown-trigger--status" aria-label={ariaLabel}>
          <StatusBadge status={getVariant(status)} size={triggerSize}>
            {triggerLabel}
          </StatusBadge>
          <ChevronDown className="dropdown-caret--status" />
        </button>
      </PortalDropdownTrigger>
      <PortalDropdownContent sideOffset={sideOffset} align={align}>
        {Object.entries(statusConfig)
          .filter(([s]) => s !== status)
          .map(([s, config]) => (
            <PortalDropdownItem
              key={s}
              onClick={() => onStatusChange(s)}
            >
              <StatusBadge status={getVariant(s)} size="sm">
                {config.label}
              </StatusBadge>
            </PortalDropdownItem>
          ))}
      </PortalDropdownContent>
    </PortalDropdown>
  );
}

interface StatusDropdownCellProps extends StatusDropdownProps {
  /** Additional className for the PortalTableCell (defaults to 'status-col') */
  cellClassName?: string;
}

/**
 * Status dropdown wrapped in a PortalTableCell.
 * Drop-in replacement for the repeated status cell pattern in admin tables.
 */
export function StatusDropdownCell({
  cellClassName = 'status-col',
  ...dropdownProps
}: StatusDropdownCellProps) {
  return (
    <PortalTableCell className={cellClassName} onClick={(e) => e.stopPropagation()}>
      <StatusDropdown {...dropdownProps} />
    </PortalTableCell>
  );
}
