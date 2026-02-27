import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { cn } from '@react/lib/utils';

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
  onSave,
  formatDisplay,
  parseInput,
  placeholder = '-',
  type = 'text',
  className,
  disabled = false,
  showEditIcon = true,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
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

  // Reset edit value when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Start editing
  const startEditing = useCallback(() => {
    if (disabled) return;
    setEditValue(value);
    setIsEditing(true);
  }, [disabled, value]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  // Save value
  const saveValue = useCallback(async () => {
    const newValue = parseInput ? parseInput(editValue) : editValue;

    // Skip if value hasn't changed
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const success = await onSave(newValue);
      if (success) {
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [editValue, parseInput, value, onSave]);

  // Handle key events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveValue();
      } else if (e.key === 'Escape') {
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
    }, 150);
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
            const date = new Date(newValue + 'T00:00:00');
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
    [type]
  );

  if (isEditing) {
    return (
      <div
        className={cn('inline-edit-wrapper', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type={type === 'date' ? 'date' : 'text'}
          value={getInputValue()}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          className="inline-edit-input-compact"
        />
        <button
          type="button"
          onClick={saveValue}
          disabled={isSaving}
          className="inline-edit-btn inline-edit-btn-save"
          title="Save"
        >
          <Check />
        </button>
        <button
          type="button"
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
      <span className={cn('inline-edit-value', !value && 'is-placeholder')}>
        {displayValue}
      </span>
      {showEditIcon && !disabled && (
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
    maximumFractionDigits: 0,
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
