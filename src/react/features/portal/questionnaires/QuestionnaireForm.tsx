/**
 * QuestionnaireForm
 * Dynamic form renderer with conditional questions and auto-save
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Save, Send, Upload, X, Check, RefreshCw, ChevronDown } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import type {
  QuestionnaireFormProps,
  PortalQuestion,
  QuestionAnswer,
  ConditionalRule,
  QuestionType
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 1500;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB default

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a conditional rule is satisfied
 */
function isRuleSatisfied(
  rule: ConditionalRule,
  answers: QuestionAnswer[]
): boolean {
  const answer = answers.find(a => a.questionId === rule.questionId);
  if (!answer || answer.value === null || answer.value === undefined) {
    return false;
  }

  const answerValue = answer.value;
  const ruleValue = rule.value;

  switch (rule.operator) {
    case 'equals':
      if (Array.isArray(answerValue)) {
        return answerValue.includes(String(ruleValue));
      }
      return String(answerValue) === String(ruleValue);

    case 'not_equals':
      if (Array.isArray(answerValue)) {
        return !answerValue.includes(String(ruleValue));
      }
      return String(answerValue) !== String(ruleValue);

    case 'contains':
      if (Array.isArray(answerValue)) {
        return answerValue.some(v => String(v).includes(String(ruleValue)));
      }
      return String(answerValue).includes(String(ruleValue));

    case 'not_contains':
      if (Array.isArray(answerValue)) {
        return !answerValue.some(v => String(v).includes(String(ruleValue)));
      }
      return !String(answerValue).includes(String(ruleValue));

    case 'greater_than':
      return Number(answerValue) > Number(ruleValue);

    case 'less_than':
      return Number(answerValue) < Number(ruleValue);

    default:
      return false;
  }
}

/**
 * Check if a question should be visible based on conditional rules
 */
function isQuestionVisible(
  question: PortalQuestion,
  answers: QuestionAnswer[]
): boolean {
  // No conditional rules means always visible
  if (!question.conditionalRules || question.conditionalRules.length === 0) {
    return true;
  }

  // All rules must be satisfied (AND logic)
  return question.conditionalRules.every(rule => isRuleSatisfied(rule, answers));
}

/**
 * Get answer value for a question
 */
function getAnswerValue(
  questionId: string,
  answers: QuestionAnswer[]
): string | number | string[] | null {
  const answer = answers.find(a => a.questionId === questionId);
  return answer?.value ?? null;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// QUESTION INPUT COMPONENTS
// ============================================================================

interface QuestionInputProps {
  question: PortalQuestion;
  value: string | number | string[] | null;
  onChange: (value: string | number | string[] | null) => void;
  disabled?: boolean;
}

/**
 * Text Input Component
 */
function TextInput({ question, value, onChange, disabled }: QuestionInputProps) {
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={question.placeholder}
      disabled={disabled}
      className="tw-input"
    />
  );
}

/**
 * Textarea Input Component
 */
function TextareaInput({ question, value, onChange, disabled }: QuestionInputProps) {
  return (
    <textarea
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={question.placeholder}
      disabled={disabled}
      rows={4}
      className="tw-textarea"
      style={{ minHeight: '80px', resize: 'vertical' }}
    />
  );
}

/**
 * Select Input Component
 */
function SelectInput({ question, value, onChange, disabled }: QuestionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = question.options?.find(opt => opt.value === value);

  return (
    <div ref={selectRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="tw-select"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', textAlign: 'left' }}
      >
        <span className={!selectedOption ? 'tw-text-muted' : 'tw-text-primary'}>
          {selectedOption?.label || question.placeholder || 'Select an option'}
        </span>
        <ChevronDown className={cn(
          'tw-h-3.5 tw-w-3.5 tw-text-muted',
          isOpen && 'tw-rotate-180'
        )} style={{ transition: 'transform 0.2s ease' }} />
      </button>

      {isOpen && (
        <div
          className="tw-panel"
          style={{
            position: 'absolute',
            zIndex: 50,
            width: '100%',
            marginTop: '0.25rem',
            maxHeight: '192px',
            overflow: 'auto'
          }}
        >
          {question.options?.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn('tw-list-item', option.value === value && 'tw-table-row-selected')}
              style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem' }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select Input Component
 */
function MultiselectInput({ question, value, onChange, disabled }: QuestionInputProps) {
  const selectedValues = Array.isArray(value) ? value : [];

  const handleToggle = (optionValue: string) => {
    if (disabled) return;

    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue];

    onChange(newValues.length > 0 ? newValues : null);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {question.options?.map((option) => {
        const isSelected = selectedValues.includes(option.value);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
            disabled={disabled}
            className={isSelected ? 'tw-btn-primary' : 'tw-btn-secondary'}
            style={{ fontSize: '11px', padding: '0.375rem 0.75rem' }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Number Input Component
 */
function NumberInput({ question, value, onChange, disabled }: QuestionInputProps) {
  return (
    <input
      type="number"
      value={value !== null && value !== undefined ? String(value) : ''}
      onChange={(e) => {
        const numValue = e.target.value === '' ? null : Number(e.target.value);
        onChange(numValue);
      }}
      placeholder={question.placeholder}
      min={question.min}
      max={question.max}
      disabled={disabled}
      className="tw-input"
    />
  );
}

/**
 * File Input Component
 */
function FileInput({ question, value, onChange, disabled }: QuestionInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Parse file metadata if available
  const fileMetadata = value && typeof value === 'string' ? JSON.parse(value) : null;
  const maxSize = question.maxFileSize || MAX_FILE_SIZE_BYTES;

  const handleFileSelect = (file: File) => {
    if (file.size > maxSize) {
      // This will be handled by parent through validation
      return;
    }

    // Store file info as JSON string (actual upload would happen on save)
    const metadata = {
      filename: file.name,
      fileSize: file.size,
      fileType: file.type,
      // In a real implementation, we'd upload and store a URL
      tempFile: true
    };
    onChange(JSON.stringify(metadata));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {fileMetadata ? (
        <div
          className="tw-card"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <Check className="tw-h-3.5 tw-w-3.5" style={{ color: 'var(--status-completed)', flexShrink: 0 }} />
            <span className="tw-text-primary" style={{ fontSize: '12px' }}>
              {fileMetadata.filename}
            </span>
            <span className="tw-text-muted" style={{ fontSize: '10px', flexShrink: 0 }}>
              ({formatFileSize(fileMetadata.fileSize)})
            </span>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="tw-btn-icon"
            >
              <X className="tw-h-3.5 tw-w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={cn('tw-card', dragActive && 'tw-table-row-selected')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '1.5rem',
            border: '2px dashed var(--portal-border-color)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1
          }}
        >
          <Upload className="tw-h-5 tw-w-5 tw-text-muted" />
          <div style={{ textAlign: 'center' }}>
            <span className="tw-text-primary" style={{ fontSize: '12px' }}>
              Drop file here or click to upload
            </span>
            <div className="tw-text-muted" style={{ fontSize: '10px', marginTop: '0.25rem' }}>
              {question.acceptedFileTypes && `Accepted: ${question.acceptedFileTypes}`}
              {question.acceptedFileTypes && ' | '}
              Max size: {formatFileSize(maxSize)}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={question.acceptedFileTypes}
        onChange={handleInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// ============================================================================
// QUESTION COMPONENT MAP
// ============================================================================

const QUESTION_COMPONENTS: Record<QuestionType, React.ComponentType<QuestionInputProps>> = {
  text: TextInput,
  textarea: TextareaInput,
  select: SelectInput,
  multiselect: MultiselectInput,
  number: NumberInput,
  file: FileInput,
};

// ============================================================================
// MAIN FORM COMPONENT
// ============================================================================

/**
 * QuestionnaireForm Component
 */
export function QuestionnaireForm({
  response,
  getAuthToken,
  showNotification,
  onSubmitSuccess,
  onBack,
}: QuestionnaireFormProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const [answers, setAnswers] = useState<QuestionAnswer[]>(response.answers || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questionnaire = response.questionnaire;
  const isReadOnly = response.status === 'submitted' || response.status === 'approved';

  /**
   * Get visible questions based on conditional logic
   */
  const visibleQuestions = useMemo(() => {
    return questionnaire.questions
      .filter(q => isQuestionVisible(q, answers))
      .sort((a, b) => a.order - b.order);
  }, [questionnaire.questions, answers]);

  /**
   * Calculate progress
   */
  const progress = useMemo(() => {
    const requiredQuestions = visibleQuestions.filter(q => q.required);
    if (requiredQuestions.length === 0) return 100;

    const answeredRequired = requiredQuestions.filter(q => {
      const answer = getAnswerValue(q.id, answers);
      return answer !== null && answer !== undefined && answer !== '';
    });

    return Math.round((answeredRequired.length / requiredQuestions.length) * 100);
  }, [visibleQuestions, answers]);

  /**
   * Save answers to API
   */
  const saveAnswers = useCallback(async () => {
    if (isReadOnly) return;

    setIsSaving(true);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const saveResponse = await fetch(`/api/questionnaires/responses/${response.id}/save`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          answers,
          progress,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save answers');
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save';
      showNotification?.(errorMessage, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [answers, progress, response.id, getAuthToken, showNotification, isReadOnly]);

  /**
   * Debounced auto-save on answer change
   */
  useEffect(() => {
    if (isReadOnly || !hasUnsavedChanges) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveAnswers();
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [answers, hasUnsavedChanges, saveAnswers, isReadOnly]);

  /**
   * Handle answer change
   */
  const handleAnswerChange = useCallback((questionId: string, value: string | number | string[] | null) => {
    setAnswers(prev => {
      const existing = prev.find(a => a.questionId === questionId);
      if (existing) {
        return prev.map(a =>
          a.questionId === questionId ? { ...a, value } : a
        );
      }
      return [...prev, { questionId, value }];
    });
    setHasUnsavedChanges(true);
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    // Validate required questions
    const missingRequired = visibleQuestions.filter(q => {
      if (!q.required) return false;
      const answer = getAnswerValue(q.id, answers);
      return answer === null || answer === undefined || answer === '';
    });

    if (missingRequired.length > 0) {
      showNotification?.(`Please answer all required questions (${missingRequired.length} remaining)`, 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // First save latest answers
      await saveAnswers();

      // Then submit
      const submitResponse = await fetch(`/api/questionnaires/responses/${response.id}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          answers,
        }),
      });

      if (!submitResponse.ok) {
        throw new Error('Failed to submit questionnaire');
      }

      onSubmitSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit';
      showNotification?.(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={containerRef} className="tw-section">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="tw-btn-icon"
            onClick={onBack}
            title="Back to questionnaires"
          >
            <ArrowLeft className="tw-h-4 tw-w-4" />
          </button>
          <div>
            <h2 className="tw-heading" style={{ fontSize: '14px' }}>
              {questionnaire.title}
            </h2>
            {questionnaire.description && (
              <p className="tw-text-muted" style={{ fontSize: '11px' }}>
                {questionnaire.description}
              </p>
            )}
          </div>
        </div>

        {/* Save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isSaving && (
            <div className="tw-text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '10px' }}>
              <RefreshCw className="tw-h-3 tw-w-3 tw-animate-spin" />
              Saving...
            </div>
          )}
          {!isSaving && lastSaved && (
            <div className="tw-text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '10px' }}>
              <Check className="tw-h-3 tw-w-3" style={{ color: 'var(--status-completed)' }} />
              Saved
            </div>
          )}
          {!isSaving && hasUnsavedChanges && (
            <div style={{ fontSize: '10px', color: 'var(--status-pending)' }}>
              Unsaved changes
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isReadOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="tw-progress-track" style={{ flex: 1 }}>
            <div
              className="tw-progress-bar"
              style={{ width: `${progress}%`, transition: 'width 0.3s ease' }}
            />
          </div>
          <span className="tw-text-muted" style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
            {progress}%
          </span>
        </div>
      )}

      {/* Questions */}
      <div className="tw-section">
        {visibleQuestions.map((question, index) => {
          const InputComponent = QUESTION_COMPONENTS[question.type];
          const value = getAnswerValue(question.id, answers);

          return (
            <div
              key={question.id}
              className="tw-card"
            >
              {/* Question label */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="tw-text-muted" style={{ fontSize: '10px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {index + 1}.
                </span>
                <div style={{ flex: 1 }}>
                  <label className="tw-label">
                    {question.text}
                    {question.required && (
                      <span style={{ color: 'var(--status-cancelled)', marginLeft: '0.125rem' }}>*</span>
                    )}
                  </label>
                  {question.helpText && (
                    <p className="tw-text-muted" style={{ fontSize: '10px', marginTop: '0.125rem' }}>
                      {question.helpText}
                    </p>
                  )}
                </div>
              </div>

              {/* Question input */}
              <div style={{ paddingLeft: '1.25rem' }}>
                <InputComponent
                  question={question}
                  value={value}
                  onChange={(newValue) => handleAnswerChange(question.id, newValue)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {!isReadOnly && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: '0.5rem' }}>
          <button
            className="tw-btn-secondary"
            onClick={saveAnswers}
            disabled={isSaving || !hasUnsavedChanges}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Save className="tw-h-3.5 tw-w-3.5" />
            Save Draft
          </button>

          <button
            className="tw-btn-primary"
            onClick={handleSubmit}
            disabled={progress < 100 || isSubmitting}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {isSubmitting ? (
              <RefreshCw className="tw-h-3.5 tw-w-3.5 tw-animate-spin" />
            ) : (
              <Send className="tw-h-3.5 tw-w-3.5" />
            )}
            Submit
          </button>
        </div>
      )}

      {/* Read-only notice */}
      {isReadOnly && (
        <div className="tw-text-muted" style={{ textAlign: 'center', padding: '0.75rem 0', fontSize: '11px' }}>
          This questionnaire has been submitted and cannot be edited.
        </div>
      )}
    </div>
  );
}
