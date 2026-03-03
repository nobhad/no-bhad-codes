/**
 * InlineEditField
 * React implementation of inline editing for settings fields.
 * Click to edit, Enter/blur to save, Escape to cancel.
 */

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Loader2, Check, X } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('InlineEditField');

export interface InlineEditFieldProps {
  /** Field label */
  label: string;
  /** Current value */
  value: string;
  /** Callback when value is saved */
  onSave: (newValue: string) => Promise<boolean>;
  /** Input type */
  type?: 'text' | 'email' | 'tel' | 'number' | 'date';
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Validation function - returns error message or null */
  validate?: (value: string) => string | null;
  /** Format function for display value */
  formatDisplay?: (value: string) => string;
  /** Additional class name */
  className?: string;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Icon to show before the label */
  icon?: React.ReactNode;
}

/**
 * InlineEditField Component
 * Shows value as text, click to edit inline
 */
export function InlineEditField({
  label,
  value,
  onSave,
  type = 'text',
  placeholder = '-',
  required = false,
  validate,
  formatDisplay,
  className,
  readOnly = false,
  icon
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when prop value changes
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

  // Enter edit mode
  const startEditing = useCallback(() => {
    if (readOnly) return;
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  }, [readOnly, value]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  }, [value]);

  // Save value
  const saveValue = useCallback(async () => {
    const trimmedValue = editValue.trim();

    // Required validation
    if (required && !trimmedValue) {
      setError(`${label} is required`);
      inputRef.current?.focus();
      return;
    }

    // Custom validation
    if (validate) {
      const validationError = validate(trimmedValue);
      if (validationError) {
        setError(validationError);
        inputRef.current?.focus();
        return;
      }
    }

    // Only save if value changed
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const success = await onSave(trimmedValue);
      if (success) {
        setIsEditing(false);
      } else {
        setError('Failed to save');
      }
    } catch (err) {
      logger.error('[InlineEditField] Save error:', err);
      setError('Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, required, validate, onSave, label]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  }, [saveValue, cancelEditing]);

  // Handle blur
  const handleBlur = useCallback(() => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (isEditing && !isSaving) {
        saveValue();
      }
    }, 150);
  }, [isEditing, isSaving, saveValue]);

  // Display value
  const displayValue = formatDisplay ? formatDisplay(value) : value;

  return (
    <div className={cn('inline-edit-row', className)}>
      <div className="inline-edit-label">
        {icon && <span className="inline-edit-icon">{icon}</span>}
        <span className="field-label">{label}</span>
        {required && <span className="inline-edit-required">*</span>}
      </div>

      {isEditing ? (
        <div className="inline-edit-input-wrapper">
          <input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={isSaving}
            className={cn('inline-edit-input', error && 'has-error')}
            aria-invalid={!!error}
            aria-describedby={error ? `${label}-error` : undefined}
          />
          <div className="inline-edit-actions">
            {isSaving ? (
              <Loader2 className="inline-edit-spinner" />
            ) : (
              <>
                <button
                  type="button"
                  onClick={saveValue}
                  className="inline-edit-btn save"
                  title="Save"
                  aria-label="Save"
                >
                  <Check />
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="inline-edit-btn cancel"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <X />
                </button>
              </>
            )}
          </div>
          {error && (
            <span id={`${label}-error`} className="inline-edit-error">
              {error}
            </span>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'inline-edit-value',
            !readOnly && 'editable',
            !displayValue && 'placeholder'
          )}
          onClick={startEditing}
          role={readOnly ? undefined : 'button'}
          tabIndex={readOnly ? undefined : 0}
          onKeyDown={(e) => {
            if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              startEditing();
            }
          }}
          aria-label={readOnly ? undefined : `Edit ${label}`}
        >
          <span>{displayValue || placeholder}</span>
          {!readOnly && (
            <Pencil className="inline-edit-pencil" />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * InlineEditSelect Component
 * Select dropdown variant for inline editing
 */
export interface InlineEditSelectProps {
  /** Field label */
  label: string;
  /** Current value */
  value: string;
  /** Options for the select */
  options: Array<{ value: string; label: string }>;
  /** Callback when value is saved */
  onSave: (newValue: string) => Promise<boolean>;
  /** Additional class name */
  className?: string;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Icon to show before the label */
  icon?: React.ReactNode;
}

export function InlineEditSelect({
  label,
  value,
  options,
  onSave,
  className,
  readOnly = false,
  icon
}: InlineEditSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Update edit value when prop value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus select when entering edit mode
  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  // Enter edit mode
  const startEditing = useCallback(() => {
    if (readOnly) return;
    setIsEditing(true);
    setEditValue(value);
  }, [readOnly, value]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
  }, [value]);

  // Save value
  const saveValue = useCallback(async (newValue: string) => {
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
    } catch (err) {
      logger.error('[InlineEditSelect] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [value, onSave]);

  // Get display label for current value
  const displayLabel = options.find(o => o.value === value)?.label || value || '-';

  return (
    <div className={cn('inline-edit-row', className)}>
      <div className="inline-edit-label">
        {icon && <span className="inline-edit-icon">{icon}</span>}
        <span className="field-label">{label}</span>
      </div>

      {isEditing ? (
        <div className="inline-edit-input-wrapper">
          <select
            ref={selectRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              saveValue(e.target.value);
            }}
            onBlur={cancelEditing}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditing();
              }
            }}
            disabled={isSaving}
            className="inline-edit-select"
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {isSaving && <Loader2 className="inline-edit-spinner" />}
        </div>
      ) : (
        <div
          className={cn(
            'inline-edit-value',
            !readOnly && 'editable'
          )}
          onClick={startEditing}
          role={readOnly ? undefined : 'button'}
          tabIndex={readOnly ? undefined : 0}
          onKeyDown={(e) => {
            if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              startEditing();
            }
          }}
          aria-label={readOnly ? undefined : `Edit ${label}`}
        >
          <span>{displayLabel}</span>
          {!readOnly && (
            <Pencil className="inline-edit-pencil" />
          )}
        </div>
      )}
    </div>
  );
}
