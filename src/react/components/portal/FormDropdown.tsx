/**
 * ===============================================
 * FORM DROPDOWN
 * ===============================================
 * @file src/react/components/portal/FormDropdown.tsx
 *
 * Simple custom dropdown for form selects.
 * No Radix — uses the existing custom-dropdown CSS pattern.
 * Visually matches form input styling.
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useClickOutside } from '@react/hooks/useClickOutside';
import { KEYS } from '../../../constants/keyboard';

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
  /** Additional className */
  className?: string;
  /** Element id (for label htmlFor) */
  id?: string;
  /** Accessible label */
  'aria-label'?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label || placeholder;
  const isPlaceholder = !selectedOption;

  const handleToggle = useCallback(() => {
    if (!disabled) setIsOpen((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
    },
    [onChange]
  );

  // Close on outside click
  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === KEYS.ESCAPE) setIsOpen(false);
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={cn('custom-dropdown', isOpen && 'open', className)}
      data-modal-dropdown
    >
      <button
        type="button"
        id={id}
        className="dropdown-trigger--custom dropdown-trigger--form"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleToggle}
      >
        <span className={cn('dropdown-value--form', isPlaceholder && 'text-secondary')}>
          {displayLabel}
        </span>
        <ChevronDown className="dropdown-caret--custom dropdown-caret--form" />
      </button>

      {isOpen && (
        <ul className="custom-dropdown-menu" role="listbox">
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={cn(
                'custom-dropdown-item',
                option.value === value && 'selected',
                option.disabled && 'disabled'
              )}
              onClick={() => {
                if (!option.disabled) handleSelect(option.value);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
