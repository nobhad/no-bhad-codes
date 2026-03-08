import * as React from 'react';
import { useState, useCallback, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useScaleIn } from '@react/hooks/useGsap';
import { KEYS } from '../../../constants/keyboard';

/** Delay before focusing search input, allows open animation to start */
const SEARCH_FOCUS_DELAY_MS = 100;

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
  triggerClassName
}: ModalDropdownProps) {
  const triggerId = useId();
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
      }, SEARCH_FOCUS_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === KEYS.ENTER || e.key === KEYS.SPACE || e.key === KEYS.ARROW_DOWN) {
          e.preventDefault();
          handleOpen();
        }
        return;
      }

      switch (e.key) {
      case KEYS.ESCAPE:
        e.preventDefault();
        handleClose();
        break;
      case KEYS.ARROW_DOWN:
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case KEYS.ARROW_UP:
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case KEYS.ENTER:
      case KEYS.SPACE:
        e.preventDefault();
        if (filteredOptions[focusedIndex]) {
          handleSelect(filteredOptions[focusedIndex].value);
        }
        break;
      case KEYS.HOME:
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case KEYS.END:
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

  // Focus trap: keep focus within modal when open
  useEffect(() => {
    if (!isOpen) return;

    const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleTrapFocus = (e: KeyboardEvent) => {
      if (e.key === KEYS.ESCAPE) {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key !== KEYS.TAB) return;

      const modal = dropdownRef.current;
      if (!modal) return;

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Auto-focus the first interactive element
    const modal = dropdownRef.current;
    if (modal) {
      // Delay to allow animation / search focus effect to complete
      const timer = setTimeout(() => {
        // If searchable, the search input useEffect handles focus.
        // Otherwise, focus the first focusable element in the modal.
        if (!searchable) {
          const firstFocusable = modal.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
          firstFocusable?.focus();
        }
      }, SEARCH_FOCUS_DELAY_MS);

      document.addEventListener('keydown', handleTrapFocus);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleTrapFocus);
      };
    }

    document.addEventListener('keydown', handleTrapFocus);
    return () => document.removeEventListener('keydown', handleTrapFocus);
  }, [isOpen, handleClose, searchable]);

  return (
    <div className={cn('modal-dropdown-container', className)}>
      {label && (
        <label htmlFor={triggerId} className="field-label">{label}</label>
      )}

      {/* Trigger Button */}
      <button
        id={triggerId}
        type="button"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          'modal-dropdown-trigger',
          disabled && 'is-disabled',
          error && 'has-error',
          triggerClassName
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            'text-truncate',
            selectedValues.length === 0 && 'text-muted'
          )}
        >
          {displayText}
        </span>
        <ChevronDown
          className={cn(
            'modal-dropdown-chevron',
            isOpen && 'is-open'
          )}
        />
      </button>

      {error && <p className="form-error-message">{error}</p>}

      {/* Modal Overlay */}
      {isOpen && (
        <div className="modal-dropdown-overlay">
          <div
            ref={dropdownRef}
            className="modal-dropdown-panel"
            role="listbox"
            aria-label={label || 'Select options'}
          >
            {/* Header */}
            <div className="modal-dropdown-header">
              <span className="heading">{label || 'Select'}</span>
              <button
                type="button"
                onClick={handleClose}
                className="icon-btn icon-btn-sm"
                aria-label="Close"
              >
                <X className="icon-md" />
              </button>
            </div>

            {/* Search Input */}
            {searchable && (
              <div className="modal-dropdown-search-section">
                <div className="modal-dropdown-search-wrapper">
                  <Search className="modal-dropdown-search-icon" />
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
                    className="form-input modal-dropdown-search-input"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div
              ref={listRef}
              className="modal-dropdown-list"
              onKeyDown={handleKeyDown}
            >
              {filteredOptions.length === 0 ? (
                <div className="modal-dropdown-empty">
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
                        'modal-dropdown-option',
                        isFocused && 'is-focused',
                        isSelected && 'is-selected',
                        option.disabled && 'is-disabled'
                      )}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {multiple && (
                        <div
                          className={cn(
                            'modal-dropdown-checkbox',
                            isSelected && 'is-checked'
                          )}
                        >
                          {isSelected && <Check className="modal-dropdown-check-icon" />}
                        </div>
                      )}
                      <div className="modal-dropdown-option-text">
                        <div className="text-truncate">{option.label}</div>
                        {option.description && (
                          <div className="modal-dropdown-option-desc">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {!multiple && isSelected && (
                        <Check className="modal-dropdown-selected-icon" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer for multi-select */}
            {multiple && (
              <div className="modal-dropdown-footer">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="btn-secondary btn-sm"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-primary btn-sm"
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
    reset
  };
}
