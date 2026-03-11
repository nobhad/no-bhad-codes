/**
 * ===============================================
 * FORM FIELD FACTORY
 * ===============================================
 * @file src/react/factories/createFormField.tsx
 *
 * Reusable form field components with consistent styling.
 * Eliminates repeated form field patterns across components.
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@react/lib/utils';
import { type LucideIcon } from 'lucide-react';
import { FormDropdown } from '@react/components/portal/FormDropdown';

// ============================================
// TYPES
// ============================================

export interface FormFieldBaseProps {
  /** Field label */
  label?: string;
  /** Field name (for form data) */
  name: string;
  /** Error message to display */
  error?: string;
  /** Helper text below field */
  helperText?: string;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Icon to show on left side */
  iconLeft?: LucideIcon;
  /** Icon to show on right side */
  iconRight?: LucideIcon;
  /** Additional wrapper className */
  className?: string;
  /** Additional input className */
  inputClassName?: string;
}

export interface TextFieldProps extends FormFieldBaseProps {
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search';
  /** Input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-complete attribute */
  autoComplete?: string;
  /** Max length */
  maxLength?: number;
}

export interface TextAreaFieldProps extends FormFieldBaseProps {
  /** Textarea value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Number of rows */
  rows?: number;
  /** Allow resize */
  resize?: boolean;
  /** Max length */
  maxLength?: number;
}

export interface SelectFieldProps extends FormFieldBaseProps {
  /** Selected value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Select options */
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  /** Placeholder option text */
  placeholder?: string;
}

export interface CheckboxFieldProps extends Omit<FormFieldBaseProps, 'iconLeft' | 'iconRight'> {
  /** Checkbox checked state */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean) => void;
  /** Description text (shown below label) */
  description?: string;
}

export interface RadioGroupFieldProps extends Omit<FormFieldBaseProps, 'iconLeft' | 'iconRight'> {
  /** Selected value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Radio options */
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
}

// ============================================
// FIELD WRAPPER COMPONENT
// ============================================

interface FieldWrapperProps {
  label?: string;
  name: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function FieldWrapper({
  label,
  name,
  error,
  helperText,
  required,
  className,
  children
}: FieldWrapperProps) {
  return (
    <div className={cn('form-field', className)}>
      {label && (
        <label htmlFor={name} className="form-field-label">
          {label}
          {required && <span className="form-field-required">*</span>}
        </label>
      )}
      {children}
      {error && <span className="form-field-error">{error}</span>}
      {helperText && !error && (
        <span className="form-field-helper">{helperText}</span>
      )}
    </div>
  );
}

// ============================================
// TEXT FIELD COMPONENT
// ============================================

/**
 * Text input field with consistent styling.
 *
 * @example
 * <TextField
 *   label="Email"
 *   name="email"
 *   type="email"
 *   value={email}
 *   onChange={setEmail}
 *   iconLeft={Mail}
 *   required
 *   error={errors.email}
 * />
 */
export function TextField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required,
  disabled,
  iconLeft: IconLeft,
  iconRight: IconRight,
  className,
  inputClassName,
  autoComplete,
  maxLength
}: TextFieldProps) {
  const hasIconLeft = !!IconLeft;
  const hasIconRight = !!IconRight;

  return (
    <FieldWrapper
      label={label}
      name={name}
      error={error}
      helperText={helperText}
      required={required}
      className={className}
    >
      <div className="form-field-input-wrapper">
        {IconLeft && (
          <div className="form-field-icon form-field-icon-left">
            <IconLeft aria-hidden="true" />
          </div>
        )}
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className={cn(
            'form-field-input',
            hasIconLeft && 'form-field-input--icon-left',
            hasIconRight && 'form-field-input--icon-right',
            error && 'form-field-input--error',
            inputClassName
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {IconRight && (
          <div className="form-field-icon form-field-icon-right">
            <IconRight aria-hidden="true" />
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}

// ============================================
// TEXTAREA FIELD COMPONENT
// ============================================

/**
 * Textarea field with consistent styling.
 *
 * @example
 * <TextAreaField
 *   label="Description"
 *   name="description"
 *   value={description}
 *   onChange={setDescription}
 *   rows={4}
 *   placeholder="Enter description..."
 * />
 */
export function TextAreaField({
  label,
  name,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required,
  disabled,
  className,
  inputClassName,
  rows = 3,
  resize = true,
  maxLength
}: TextAreaFieldProps) {
  return (
    <FieldWrapper
      label={label}
      name={name}
      error={error}
      helperText={helperText}
      required={required}
      className={className}
    >
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className={cn(
          'form-field-textarea',
          !resize && 'form-field-textarea--no-resize',
          error && 'form-field-input--error',
          inputClassName
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
    </FieldWrapper>
  );
}

// ============================================
// SELECT FIELD COMPONENT
// ============================================

/**
 * Select field with consistent styling.
 *
 * @example
 * <SelectField
 *   label="Category"
 *   name="category"
 *   value={category}
 *   onChange={setCategory}
 *   options={[
 *     { value: 'web', label: 'Web Design' },
 *     { value: 'app', label: 'App Development' }
 *   ]}
 *   placeholder="Select a category"
 * />
 */
export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  error,
  helperText,
  required,
  disabled,
  iconLeft: IconLeft,
  className,
  inputClassName
}: SelectFieldProps) {
  const hasIconLeft = !!IconLeft;

  return (
    <FieldWrapper
      label={label}
      name={name}
      error={error}
      helperText={helperText}
      required={required}
      className={className}
    >
      <div className="form-field-input-wrapper">
        {IconLeft && (
          <div className="form-field-icon form-field-icon-left">
            <IconLeft aria-hidden="true" />
          </div>
        )}
        <FormDropdown
          id={name}
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            hasIconLeft && 'form-field-input--icon-left',
            error && 'form-field-input--error',
            inputClassName
          )}
          aria-label={label || name}
        />
      </div>
    </FieldWrapper>
  );
}

// ============================================
// CHECKBOX FIELD COMPONENT
// ============================================

/**
 * Checkbox field with consistent styling.
 *
 * @example
 * <CheckboxField
 *   label="Accept terms"
 *   name="terms"
 *   checked={acceptTerms}
 *   onChange={setAcceptTerms}
 *   description="I agree to the terms and conditions"
 *   required
 * />
 */
export function CheckboxField({
  label,
  name,
  checked,
  onChange,
  description,
  error,
  helperText,
  required,
  disabled,
  className
}: CheckboxFieldProps) {
  return (
    <div className={cn('form-field form-field--checkbox', className)}>
      <label htmlFor={name} className="form-field-checkbox-label">
        <input
          id={name}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          required={required}
          className="form-field-checkbox"
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <span className="form-field-checkbox-text">
          {label}
          {required && <span className="form-field-required">*</span>}
        </span>
      </label>
      {description && (
        <span className="form-field-checkbox-description">{description}</span>
      )}
      {error && <span className="form-field-error">{error}</span>}
      {helperText && !error && (
        <span className="form-field-helper">{helperText}</span>
      )}
    </div>
  );
}

// ============================================
// RADIO GROUP FIELD COMPONENT
// ============================================

/**
 * Radio group field with consistent styling.
 *
 * @example
 * <RadioGroupField
 *   label="Priority"
 *   name="priority"
 *   value={priority}
 *   onChange={setPriority}
 *   options={[
 *     { value: 'low', label: 'Low' },
 *     { value: 'medium', label: 'Medium' },
 *     { value: 'high', label: 'High', description: 'Urgent tasks' }
 *   ]}
 * />
 */
export function RadioGroupField({
  label,
  name,
  value,
  onChange,
  options,
  error,
  helperText,
  required,
  disabled,
  className,
  direction = 'vertical'
}: RadioGroupFieldProps) {
  return (
    <div className={cn('form-field', className)}>
      {label && (
        <span className="form-field-label">
          {label}
          {required && <span className="form-field-required">*</span>}
        </span>
      )}
      <div
        className={cn(
          'form-field-radio-group',
          direction === 'horizontal' && 'form-field-radio-group--horizontal'
        )}
        role="radiogroup"
        aria-labelledby={label ? `${name}-label` : undefined}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'form-field-radio-label',
              option.disabled && 'form-field-radio-label--disabled'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled || option.disabled}
              className="form-field-radio"
            />
            <span className="form-field-radio-text">
              {option.label}
              {option.description && (
                <span className="form-field-radio-description">
                  {option.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      {error && <span className="form-field-error">{error}</span>}
      {helperText && !error && (
        <span className="form-field-helper">{helperText}</span>
      )}
    </div>
  );
}

// ============================================
// FORM FIELD GROUP COMPONENT
// ============================================

interface FormFieldGroupProps {
  /** Group label */
  label?: string;
  /** Children fields */
  children: React.ReactNode;
  /** Number of columns (1-4) */
  columns?: 1 | 2 | 3 | 4;
  /** Additional className */
  className?: string;
}

/**
 * Group multiple form fields with optional grid layout.
 *
 * @example
 * <FormFieldGroup label="Contact Information" columns={2}>
 *   <TextField name="firstName" label="First Name" ... />
 *   <TextField name="lastName" label="Last Name" ... />
 * </FormFieldGroup>
 */
export function FormFieldGroup({
  label,
  children,
  columns = 1,
  className
}: FormFieldGroupProps) {
  return (
    <fieldset className={cn('form-field-group', className)}>
      {label && <legend className="form-field-group-label">{label}</legend>}
      <div
        className={cn(
          'form-field-group-content',
          columns > 1 && `form-field-group-content--cols-${columns}`
        )}
      >
        {children}
      </div>
    </fieldset>
  );
}

// ============================================
// USE FORM FIELD HOOK
// ============================================

interface UseFormFieldOptions<T> {
  /** Initial value */
  initialValue: T;
  /** Validation function */
  validate?: (value: T) => string | undefined;
  /** Transform value on change */
  transform?: (value: T) => T;
}

/**
 * Hook for managing form field state with validation.
 *
 * @example
 * const email = useFormField({
 *   initialValue: '',
 *   validate: (v) => !v.includes('@') ? 'Invalid email' : undefined
 * });
 *
 * <TextField
 *   name="email"
 *   value={email.value}
 *   onChange={email.onChange}
 *   error={email.error}
 *   onBlur={email.onBlur}
 * />
 */
export function useFormField<T>(options: UseFormFieldOptions<T>) {
  const { initialValue, validate, transform } = options;

  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  const onChange = useCallback(
    (newValue: T) => {
      const transformedValue = transform ? transform(newValue) : newValue;
      setValue(transformedValue);

      // Clear error on change if touched
      if (touched && validate) {
        setError(validate(transformedValue));
      }
    },
    [transform, touched, validate]
  );

  const onBlur = useCallback(() => {
    setTouched(true);
    if (validate) {
      setError(validate(value));
    }
  }, [validate, value]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setError(undefined);
    setTouched(false);
  }, [initialValue]);

  const isValid = !error && touched;

  return {
    value,
    onChange,
    onBlur,
    error: touched ? error : undefined,
    touched,
    isValid,
    reset,
    setValue,
    setError
  };
}

// ============================================
// EXPORTS
// ============================================

export const FormFields = {
  Text: TextField,
  TextArea: TextAreaField,
  Select: SelectField,
  Checkbox: CheckboxField,
  RadioGroup: RadioGroupField,
  Group: FormFieldGroup
};

export default FormFields;
