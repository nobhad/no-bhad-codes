import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useScaleIn } from '@react/hooks/useGsap';

export interface ModalDropdownOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Whether option is disabled */
  disabled?: boolean;
}

export interface ModalDropdownProps {
  /** Available options */
  options: ModalDropdownOption[];
  /** Selected value(s) */
  value: string | string[];
  /** Callback when selection changes */
  onChange: (value: string | string[]) => void;
  /** Placeholder text when no selection */
  placeholder?: string;
  /** Whether multiple selection is allowed */
  multiple?: boolean;
  /** Whether to show search input */
  searchable?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Label for the dropdown */
  label?: string;
  /** Error message */
  error?: string;
  /** Custom class name */
  className?: string;
  /** Custom trigger class name */
  triggerClassName?: string;
}

/**
 * ModalDropdown
 * Dropdown component that opens in a modal overlay
 * Supports single/multi select and keyboard navigation
 */
export function ModalDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  multiple = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  disabled = false,
  label,
  error,
  className,
  triggerClassName,
}: ModalDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const dropdownRef = useScaleIn<HTMLDivElement>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Convert value to array for consistent handling
  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

  // Filter options based on search
  const filteredOptions = searchable
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          opt.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
          opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Get display text for trigger
  const displayText = React.useMemo(() => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const selected = options.find((opt) => opt.value === selectedValues[0]);
      return selected?.label || selectedValues[0];
    }
    return `${selectedValues.length} selected`;
  }, [selectedValues, options, placeholder]);

  const handleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
      setSearchQuery('');
      setFocusedIndex(0);
    }
  }, [disabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (multiple) {
        const newValue = selectedValues.includes(optionValue)
          ? selectedValues.filter((v) => v !== optionValue)
          : [...selectedValues, optionValue];
        onChange(newValue);
      } else {
        onChange(optionValue);
        handleClose();
      }
    },
    [multiple, selectedValues, onChange, handleClose]
  );

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      // Small delay to allow animation
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          handleOpen();
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (filteredOptions[focusedIndex]) {
            handleSelect(filteredOptions[focusedIndex].value);
          }
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(filteredOptions.length - 1);
          break;
      }
    },
    [isOpen, filteredOptions, focusedIndex, handleOpen, handleClose, handleSelect]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      focusedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, focusedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.modal-dropdown-overlay')) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClose]);

  return (
    <div className={cn('modal-dropdown-container', className)}>
      {label && (
        <label className="tw-block tw-text-sm tw-font-medium tw-mb-1">{label}</label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          'modal-dropdown-trigger tw-w-full tw-flex tw-items-center tw-justify-between',
          'tw-px-3 tw-py-2 tw-text-left',
          'tw-border tw-border-white/20 tw-bg-transparent',
          'tw-transition-colors',
          'hover:tw-border-white/40',
          'focus:tw-outline-none focus:tw-border-primary',
          disabled && 'tw-opacity-50 tw-cursor-not-allowed',
          error && 'tw-border-danger',
          triggerClassName
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            'tw-truncate',
            selectedValues.length === 0 && 'tw-text-muted'
          )}
        >
          {displayText}
        </span>
        <ChevronDown
          className={cn(
            'tw-h-4 tw-w-4 tw-transition-transform tw-flex-shrink-0 tw-ml-2',
            isOpen && 'tw-rotate-180'
          )}
        />
      </button>

      {error && <p className="tw-text-sm tw-text-danger tw-mt-1">{error}</p>}

      {/* Modal Overlay */}
      {isOpen && (
        <div className="modal-dropdown-overlay tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/50">
          <div
            ref={dropdownRef}
            className="tw-w-full tw-max-w-md tw-mx-4 tw-bg-[var(--portal-bg-dark)] tw-border tw-border-white/20 tw-max-h-[80vh] tw-flex tw-flex-col"
            role="listbox"
            aria-label={label || 'Select options'}
          >
            {/* Header */}
            <div className="tw-flex tw-items-center tw-justify-between tw-p-3 tw-border-b tw-border-white/20">
              <span className="tw-font-medium">{label || 'Select'}</span>
              <button
                type="button"
                onClick={handleClose}
                className="tw-p-1 tw-text-muted hover:tw-text-white tw-transition-colors"
                aria-label="Close"
              >
                <X className="tw-h-5 tw-w-5" />
              </button>
            </div>

            {/* Search Input */}
            {searchable && (
              <div className="tw-p-3 tw-border-b tw-border-white/20">
                <div className="tw-relative">
                  <Search className="tw-absolute tw-left-3 tw-top-1/2 tw--translate-y-1/2 tw-h-4 tw-w-4 tw-text-muted" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFocusedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={searchPlaceholder}
                    className="tw-w-full tw-pl-10 tw-pr-3 tw-py-2 tw-bg-transparent tw-border tw-border-white/20 focus:tw-border-primary focus:tw-outline-none"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div
              ref={listRef}
              className="tw-overflow-y-auto tw-flex-1"
              onKeyDown={handleKeyDown}
            >
              {filteredOptions.length === 0 ? (
                <div className="tw-p-4 tw-text-center tw-text-muted">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = selectedValues.includes(option.value);
                  const isFocused = index === focusedIndex;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      disabled={option.disabled}
                      className={cn(
                        'tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-3 tw-text-left tw-transition-colors',
                        'hover:tw-bg-white/5',
                        isFocused && 'tw-bg-white/10',
                        isSelected && 'tw-text-primary',
                        option.disabled && 'tw-opacity-50 tw-cursor-not-allowed'
                      )}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {multiple && (
                        <div
                          className={cn(
                            'tw-w-5 tw-h-5 tw-border tw-flex tw-items-center tw-justify-center tw-flex-shrink-0',
                            isSelected
                              ? 'tw-bg-primary tw-border-primary'
                              : 'tw-border-white/40'
                          )}
                        >
                          {isSelected && <Check className="tw-h-3 tw-w-3 tw-text-black" />}
                        </div>
                      )}
                      <div className="tw-flex-1 tw-min-w-0">
                        <div className="tw-truncate">{option.label}</div>
                        {option.description && (
                          <div className="tw-text-sm tw-text-muted tw-truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {!multiple && isSelected && (
                        <Check className="tw-h-4 tw-w-4 tw-text-primary tw-flex-shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer for multi-select */}
            {multiple && (
              <div className="tw-flex tw-justify-end tw-gap-2 tw-p-3 tw-border-t tw-border-white/20">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="tw-btn-secondary tw-text-sm"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="tw-btn-primary tw-text-sm"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * useModalDropdown hook for external state control
 */
export function useModalDropdown<T extends string>(
  initialValue: T | T[] | null = null
) {
  const [value, setValue] = useState<T | T[] | null>(initialValue);

  const handleChange = useCallback((newValue: string | string[]) => {
    setValue(newValue as T | T[]);
  }, []);

  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue]);

  return {
    value,
    setValue,
    onChange: handleChange,
    reset,
  };
}
