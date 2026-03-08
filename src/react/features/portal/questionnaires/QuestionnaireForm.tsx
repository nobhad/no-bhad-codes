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
import { buildEndpoint } from '@/constants/api-endpoints';

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
      className="input"
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
      className="textarea form-textarea-resizable"
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
    <div ref={selectRef} className="qform-select-container">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="select qform-select-btn"
      >
        <span className={!selectedOption ? 'text-muted' : 'text-primary'}>
          {selectedOption?.label || question.placeholder || 'Select an option'}
        </span>
        <ChevronDown className={cn(
          'icon-sm qform-chevron-icon',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="panel qform-select-dropdown">
          {question.options?.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn('list-item qform-select-option', option.value === value && 'table-row-selected')}
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
    <div className="qform-multiselect-container">
      {question.options?.map((option) => {
        const isSelected = selectedValues.includes(option.value);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
            disabled={disabled}
            className={cn(isSelected ? 'btn-primary' : 'btn-secondary', 'qform-multiselect-btn')}
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
      className="input"
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
  const fileMetadata = useMemo(() => {
    if (!value || typeof value !== 'string') return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, [value]);
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
    <div className="qform-file-upload">
      {fileMetadata ? (
        <div className="portal-card qform-file-selected">
          <div className="qform-file-info">
            <Check className="icon-xs qform-check-success" />
            <span className="text-primary qform-file-name">
              {fileMetadata.filename}
            </span>
            <span className="text-muted qform-file-size">
              ({formatFileSize(fileMetadata.fileSize)})
            </span>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="icon-btn"
            >
              <X className="icon-xs" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={cn(
            'portal-card qform-dropzone',
            dragActive && 'card-drag-highlight',
            disabled && 'qform-dropzone-disabled'
          )}
        >
          <Upload className="icon-sm" />
          <div className="qform-dropzone-text">
            <span className="text-primary qform-dropzone-label">
              Drop file here or click to upload
            </span>
            <div className="text-muted qform-dropzone-hint">
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
        className="hidden"
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
  file: FileInput
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
  onBack
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
        'Content-Type': 'application/json'
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const saveResponse = await fetch(buildEndpoint.questionnaireResponseSave(response.id), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          answers,
          progress
        })
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
        'Content-Type': 'application/json'
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // First save latest answers
      await saveAnswers();

      // Then submit
      const submitResponse = await fetch(buildEndpoint.questionnaireResponseSubmit(response.id), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          answers
        })
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
    <div ref={containerRef} className="section">
      {/* Header */}
      <div className="qform-header">
        <div className="qform-header-left">
          <button
            className="icon-btn"
            onClick={onBack}
            title="Back to questionnaires"
          >
            <ArrowLeft className="icon-xs" />
          </button>
          <div>
            <h2 className="heading qform-heading">
              {questionnaire.title}
            </h2>
            {questionnaire.description && (
              <p className="text-muted qform-description">
                {questionnaire.description}
              </p>
            )}
          </div>
        </div>

        {/* Save status */}
        <div className="qform-status">
          {isSaving && (
            <div className="text-muted qform-status-item">
              <RefreshCw className="icon-xs loading-spin" />
              Saving...
            </div>
          )}
          {!isSaving && lastSaved && (
            <div className="text-muted qform-status-item">
              <Check className="icon-xs qform-check-success" />
              Saved
            </div>
          )}
          {!isSaving && hasUnsavedChanges && (
            <div className="qform-unsaved">
              Unsaved changes
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isReadOnly && (
        <div className="qform-progress-row">
          <div className="progress-bar-sm flex-1">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-muted qform-progress-text">
            {progress}%
          </span>
        </div>
      )}

      {/* Questions */}
      <div className="section">
        {visibleQuestions.map((question, index) => {
          const InputComponent = QUESTION_COMPONENTS[question.type];
          const value = getAnswerValue(question.id, answers);

          return (
            <div
              key={question.id}
              className="portal-card"
            >
              {/* Question label */}
              <div className="qform-question-label-row">
                <span className="text-muted qform-question-number">
                  {index + 1}.
                </span>
                <div className="qform-question-label-container">
                  <label className="field-label">
                    {question.text}
                    {question.required && (
                      <span className="form-required">*</span>
                    )}
                  </label>
                  {question.helpText && (
                    <p className="text-muted qform-question-help">
                      {question.helpText}
                    </p>
                  )}
                </div>
              </div>

              {/* Question input */}
              <div className="qform-question-input">
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
        <div className="qform-actions">
          <button
            className="btn-secondary qform-btn-with-icon"
            onClick={saveAnswers}
            disabled={isSaving || !hasUnsavedChanges}
          >
            <Save className="icon-xs" />
            Save Draft
          </button>

          <button
            className="btn-primary qform-btn-with-icon"
            onClick={handleSubmit}
            disabled={progress < 100 || isSubmitting}
          >
            {isSubmitting ? (
              <RefreshCw className="icon-xs loading-spin" />
            ) : (
              <Send className="icon-xs" />
            )}
            Submit
          </button>
        </div>
      )}

      {/* Read-only notice */}
      {isReadOnly && (
        <div className="text-muted qform-readonly-notice">
          This questionnaire has been submitted and cannot be edited.
        </div>
      )}
    </div>
  );
}
