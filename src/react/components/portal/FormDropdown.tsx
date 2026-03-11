/**
 * ===============================================
 * FORM DROPDOWN
 * ===============================================
 * @file src/react/components/portal/FormDropdown.tsx
 *
 * PortalDropdown-based replacement for native <select> in form contexts.
 * Visually matches the .select class styling with consistent portal dropdown behavior.
 * Selected option is hidden from the dropdown list.
 */

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@react/lib/utils';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from './PortalDropdown';

// ============================================================================
// TYPES
// ============================================================================

export interface FormDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormDropdownProps {
  /** Currently selected value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Dropdown options */
  options: FormDropdownOption[];
  /** Placeholder when no value selected */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional trigger className */
  className?: string;
  /** Element id (for label htmlFor) */
  id?: string;
  /** Accessible label */
  'aria-label'?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Normalize a value for fuzzy comparison (lowercase, hyphens → spaces) */
function normalizeValue(val: string): string {
  return val.toLowerCase().replace(/-/g, ' ').trim();
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * FormDropdown
 * Drop-in replacement for native <select> using the PortalDropdown system.
 * Hides the currently selected option from the dropdown list.
 *
 * @example
 * <FormDropdown
 *   id="project-type"
 *   value={projectType}
 *   onChange={setProjectType}
 *   options={[
 *     { value: 'web', label: 'Web Design' },
 *     { value: 'app', label: 'App Development' }
 *   ]}
 *   placeholder="Select project type..."
 *   aria-label="Filter by project type"
 * />
 */
export function FormDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled,
  className,
  id,
  'aria-label': ariaLabel
}: FormDropdownProps) {
  const normalizedValue = normalizeValue(value);
  const selectedOption = options.find((opt) => normalizeValue(opt.value) === normalizedValue);
  const displayLabel = selectedOption?.label || placeholder;
  const isPlaceholder = !selectedOption;

  return (
    <PortalDropdown>
      <PortalDropdownTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          className={cn('form-dropdown-trigger', className)}
          aria-label={ariaLabel}
          disabled={disabled}
        >
          <span className={cn('form-dropdown-value', isPlaceholder && 'text-muted')}>
            {displayLabel}
          </span>
          <ChevronDown className="form-dropdown-caret" />
        </button>
      </PortalDropdownTrigger>
      <PortalDropdownContent>
        {options
          .filter((option) => normalizeValue(option.value) !== normalizedValue)
          .map((option) => (
            <PortalDropdownItem
              key={option.value}
              onClick={() => onChange(option.value)}
              disabled={option.disabled}
            >
              {option.label}
            </PortalDropdownItem>
          ))}
      </PortalDropdownContent>
    </PortalDropdown>
  );
}
