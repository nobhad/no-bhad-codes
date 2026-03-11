import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Pencil, ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { KEYS } from '../../../constants/keyboard';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from './PortalDropdown';

// ============================================================================
// Constants
// ============================================================================

/** Delay before saving on blur, allows button click events to register first */
const BLUR_SAVE_DELAY_MS = 150;

/** Normalize a value for fuzzy comparison (lowercase, hyphens → spaces) */
function normalizeValue(val: string): string {
  return val.toLowerCase().replace(/-/g, ' ').trim();
}

// ============================================================================
// Shared Hook — DRY state management for all inline-edit variants
// ============================================================================

interface UseInlineEditStateOptions {
  value: string;
  disabled: boolean;
  onSave: (value: string) => Promise<boolean> | boolean;
}

function useInlineEditState({ value, disabled, onSave }: UseInlineEditStateOptions) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setEditValue(value);
    setIsEditing(true);
  }, [disabled, value]);

  const cancelEditing = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const saveValue = useCallback(
    async (overrideValue?: string) => {
      const valueToSave = overrideValue ?? editValue;

      if (valueToSave === value) {
        setIsEditing(false);
        return;
      }

      setIsSaving(true);
      try {
        const success = await onSave(valueToSave);
        if (success) {
          setIsEditing(false);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [editValue, value, onSave]
  );

  return {
    isEditing,
    editValue,
    setEditValue,
    isSaving,
    startEditing,
    cancelEditing,
    saveValue
  };
}

// ============================================================================
// InlineEdit
// ============================================================================

interface InlineEditProps {
  /** Current value */
  value: string;
  /** Callback when value is saved */
  onSave: (value: string) => Promise<boolean> | boolean;
  /** Optional formatter for display */
  formatDisplay?: (value: string) => string;
  /** Optional parser for input */
  parseInput?: (value: string) => string;
  /** Placeholder when empty */
  placeholder?: string;
  /** Input type */
  type?: 'text' | 'number' | 'currency' | 'date';
  /** Additional class names */
  className?: string;
  /** Disable editing */
  disabled?: boolean;
  /** Show edit icon on hover */
  showEditIcon?: boolean;
}

/**
 * InlineEdit
 * Click-to-edit component for table cells
 */
export function InlineEdit({
  value,
  onSave: onSaveProp,
  formatDisplay,
  parseInput,
  placeholder = '-',
  type = 'text',
  className,
  disabled = false,
  showEditIcon = true
}: InlineEditProps) {
  // Wrap onSave to apply parseInput before saving
  const onSave = useCallback(
    (val: string) => {
      const parsed = parseInput ? parseInput(val) : val;
      return onSaveProp(parsed);
    },
    [onSaveProp, parseInput]
  );

  const {
    isEditing,
    editValue,
    setEditValue,
    isSaving,
    startEditing,
    cancelEditing,
    saveValue
  } = useInlineEditState({ value, disabled, onSave });

  const inputRef = useRef<HTMLInputElement>(null);

  // Format display value
  const displayValue = formatDisplay
    ? formatDisplay(value)
    : type === 'date'
      ? formatDateForDisplay(value) || placeholder
      : value || placeholder;

  // Format value for date input (YYYY-MM-DD)
  const getInputValue = useCallback(() => {
    if (type === 'date') {
      return formatDateForInput(editValue);
    }
    return editValue;
  }, [type, editValue]);

  // Focus input when entering edit mode; open native date picker for date type
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'date') {
        try {
          (inputRef.current as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
        } catch {
          // showPicker blocked or unsupported — fall back to native focus
        }
      } else {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  // Handle key events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === KEYS.ENTER) {
        e.preventDefault();
        saveValue();
      } else if (e.key === KEYS.ESCAPE) {
        e.preventDefault();
        cancelEditing();
      }
    },
    [saveValue, cancelEditing]
  );

  // Handle blur - save on blur
  const handleBlur = useCallback(() => {
    // Small delay to allow button clicks to register
    setTimeout(() => {
      if (isEditing && !isSaving) {
        saveValue();
      }
    }, BLUR_SAVE_DELAY_MS);
  }, [isEditing, isSaving, saveValue]);

  // Format input value based on type
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;

      if (type === 'number' || type === 'currency') {
        // Allow only numbers, commas, and decimal points
        newValue = newValue.replace(/[^0-9.,]/g, '');
      } else if (type === 'date') {
        // Date input returns YYYY-MM-DD, convert to ISO string for storage
        if (newValue) {
          try {
            const date = new Date(`${newValue  }T00:00:00`);
            if (!isNaN(date.getTime())) {
              newValue = date.toISOString();
            }
          } catch {
            // Keep the raw value if parsing fails
          }
        }
      }

      setEditValue(newValue);
    },
    [type, setEditValue]
  );

  if (isEditing) {
    return (
      <div
        className={cn('inline-edit-wrapper', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {type === 'date' ? (
          <div className="inline-edit-date-wrapper">
            <Calendar
              className="inline-edit-date-cal"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                try {
                  (inputRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.();
                } catch { /* unsupported */ }
              }}
            />
            <input
              ref={inputRef}
              type="date"
              value={getInputValue()}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              disabled={isSaving}
              className="inline-edit-input-compact inline-edit-input-compact--date"
            />
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={getInputValue()}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isSaving}
            className="inline-edit-input-compact"
          />
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => saveValue()}
          disabled={isSaving}
          className="inline-edit-btn inline-edit-btn-save"
          title="Save"
        >
          <Check />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancelEditing}
          disabled={isSaving}
          className="inline-edit-btn inline-edit-btn-cancel"
          title="Cancel"
        >
          <X />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-edit-display',
        disabled && 'is-disabled',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
      title={disabled ? undefined : 'Click to edit'}
    >
      {type === 'date' && !disabled && (
        <Calendar className="icon-sm" />
      )}
      <span className={cn('inline-edit-value', !value && 'is-placeholder')}>
        {displayValue}
      </span>
      {showEditIcon && !disabled && type !== 'date' && (
        <Pencil className="inline-edit-icon" />
      )}
    </div>
  );
}

/**
 * Format currency for display
 */
export function formatCurrencyDisplay(value: string): string {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Parse currency input to number string
 */
export function parseCurrencyInput(value: string): string {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '0';
  return String(Math.round(num));
}

/**
 * Format date for display (e.g., "Jan 15, 2025")
 */
export function formatDateForDisplay(value: string): string | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return null;
  }
}

/**
 * Format date for input element (YYYY-MM-DD)
 */
export function formatDateForInput(value: string): string {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    // Format as YYYY-MM-DD for date input
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Parse date input to ISO string
 */
export function parseDateInput(value: string): string {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toISOString();
  } catch {
    return '';
  }
}

// ============================================================================
// InlineSelect
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
}

interface InlineSelectProps {
  /** Current value */
  value: string;
  /** Callback when value is saved */
  onSave: (value: string) => Promise<boolean> | boolean;
  /** Dropdown options */
  options: SelectOption[];
  /** Optional formatter for display */
  formatDisplay?: (value: string) => string;
  /** Placeholder when empty */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Disable editing */
  disabled?: boolean;
  /** Show edit icon on hover */
  showEditIcon?: boolean;
}

/**
 * InlineSelect
 * Click-to-edit dropdown component
 */
export function InlineSelect({
  value,
  onSave,
  options,
  formatDisplay,
  placeholder = '-',
  className,
  disabled = false,
  showEditIcon = true
}: InlineSelectProps) {
  const {
    isEditing,
    editValue,
    isSaving,
    startEditing,
    cancelEditing,
    saveValue
  } = useInlineEditState({ value, disabled, onSave });

  /** Find an option by normalized value comparison */
  const findOption = useCallback(
    (val: string) => {
      const norm = normalizeValue(val);
      return options.find((o) => normalizeValue(o.value) === norm);
    },
    [options]
  );

  const displayValue = formatDisplay
    ? formatDisplay(value)
    : findOption(value)?.label || value || placeholder;

  const handleSelect = useCallback(
    (optionValue: string) => {
      saveValue(optionValue);
    },
    [saveValue]
  );

  if (isEditing) {
    const matchedOption = editValue ? findOption(editValue) : null;
    const triggerLabel = matchedOption?.label || editValue || placeholder;
    const normalizedEdit = editValue ? normalizeValue(editValue) : '';

    return (
      <div
        className={cn('inline-edit-wrapper', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <PortalDropdown defaultOpen onOpenChange={(open) => { if (!open) cancelEditing(); }}>
          <PortalDropdownTrigger asChild>
            <button className="form-dropdown-trigger" disabled={isSaving}>
              <span className="form-dropdown-value">
                {triggerLabel}
              </span>
              <ChevronDown className="form-dropdown-caret" />
            </button>
          </PortalDropdownTrigger>
          <PortalDropdownContent align="start" sideOffset={0}>
            {options
              .filter((opt) => normalizeValue(opt.value) !== normalizedEdit)
              .map((opt) => (
                <PortalDropdownItem
                  key={opt.value}
                  onSelect={() => handleSelect(opt.value)}
                >
                  {opt.label}
                </PortalDropdownItem>
              ))}
          </PortalDropdownContent>
        </PortalDropdown>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-edit-display',
        disabled && 'is-disabled',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
      title={disabled ? undefined : 'Click to edit'}
    >
      <span className={cn('inline-edit-value', !value && 'is-placeholder')}>
        {displayValue}
      </span>
      {showEditIcon && !disabled && (
        <Pencil className="inline-edit-icon" />
      )}
    </div>
  );
}

// ============================================================================
// InlineTextarea
// ============================================================================

interface InlineTextareaProps {
  /** Current value */
  value: string;
  /** Callback when value is saved */
  onSave: (value: string) => Promise<boolean> | boolean;
  /** Placeholder when empty */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Disable editing */
  disabled?: boolean;
  /** Show edit icon on hover */
  showEditIcon?: boolean;
  /** Minimum rows */
  minRows?: number;
}

/**
 * InlineTextarea
 * Click-to-edit multiline text component
 */
export function InlineTextarea({
  value,
  onSave,
  placeholder = '-',
  className,
  disabled = false,
  showEditIcon = true,
  minRows = 3
}: InlineTextareaProps) {
  const {
    isEditing,
    editValue,
    setEditValue,
    isSaving,
    startEditing,
    cancelEditing,
    saveValue
  } = useInlineEditState({ value, disabled, onSave });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayValue = value || placeholder;

  const autoGrow = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      autoGrow(textareaRef.current);
    }
  }, [isEditing, autoGrow]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === KEYS.ESCAPE) {
        e.preventDefault();
        cancelEditing();
      }
      // Ctrl/Cmd + Enter to save
      if (e.key === KEYS.ENTER && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveValue();
      }
    },
    [saveValue, cancelEditing]
  );

  // Save on blur with delay to allow button clicks
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (isEditing && !isSaving) {
        saveValue();
      }
    }, BLUR_SAVE_DELAY_MS);
  }, [isEditing, isSaving, saveValue]);

  if (isEditing) {
    return (
      <div
        className={cn('inline-edit-wrapper inline-edit-wrapper--textarea', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          className="inline-edit-input-compact inline-edit-textarea"
          rows={minRows}
        />
        <div className="inline-edit-actions">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => saveValue()}
            disabled={isSaving}
            className="inline-edit-btn inline-edit-btn-save"
            title="Save"
          >
            <Check />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelEditing}
            disabled={isSaving}
            className="inline-edit-btn inline-edit-btn-cancel"
            title="Cancel"
          >
            <X />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-edit-display inline-edit-display--multiline',
        disabled && 'is-disabled',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
      title={disabled ? undefined : 'Click to edit'}
    >
      <span className={cn('inline-edit-value inline-edit-value--multiline', !value && 'is-placeholder')}>
        {displayValue}
      </span>
      {showEditIcon && !disabled && (
        <Pencil className="inline-edit-icon" />
      )}
    </div>
  );
}
