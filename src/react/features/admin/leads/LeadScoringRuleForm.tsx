/**
 * LeadScoringRuleForm
 * Modal form for creating/editing a lead scoring rule.
 * Uses PortalModal + existing form patterns.
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Scale } from 'lucide-react';
import { PortalModal } from '@react/components/portal/PortalModal';

// ============================================
// TYPES
// ============================================

export interface ScoringRuleFormData {
  name: string;
  description: string;
  fieldName: string;
  operator: string;
  thresholdValue: string;
  points: number;
  isActive: boolean;
}

export interface ScoringRule extends ScoringRuleFormData {
  id: number;
  createdAt: string;
  updatedAt: string;
}

interface LeadScoringRuleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, the form is in "edit" mode */
  rule: ScoringRule | null;
  onSave: (data: ScoringRuleFormData) => Promise<void>;
  isSaving: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const FIELD_OPTIONS = [
  { value: 'budget_range', label: 'Budget Range' },
  { value: 'project_type', label: 'Project Type' },
  { value: 'description', label: 'Description' },
  { value: 'priority', label: 'Priority' },
  { value: 'client_type', label: 'Client Type' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'feature_count', label: 'Feature Count' },
  { value: 'design_level', label: 'Design Level' },
  { value: 'source_type', label: 'Referral Source' }
] as const;

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'in', label: 'In (comma-separated)' },
  { value: 'not_empty', label: 'Not Empty' }
] as const;

const INITIAL_FORM_STATE: ScoringRuleFormData = {
  name: '',
  description: '',
  fieldName: 'budget_range',
  operator: 'equals',
  thresholdValue: '',
  points: 10,
  isActive: true
};

// ============================================
// COMPONENT
// ============================================

export function LeadScoringRuleForm({
  open,
  onOpenChange,
  rule,
  onSave,
  isSaving
}: LeadScoringRuleFormProps) {
  const [form, setForm] = useState<ScoringRuleFormData>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = rule !== null;
  const title = isEditing ? 'Edit Scoring Rule' : 'New Scoring Rule';

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      setForm({
        name: rule.name,
        description: rule.description || '',
        fieldName: rule.fieldName,
        operator: rule.operator,
        thresholdValue: rule.thresholdValue,
        points: rule.points,
        isActive: rule.isActive
      });
    } else {
      setForm(INITIAL_FORM_STATE);
    }
    setErrors({});
  }, [rule, open]);

  // Whether threshold is needed (not_empty doesn't need one)
  const needsThreshold = useMemo(
    () => form.operator !== 'not_empty',
    [form.operator]
  );

  const updateField = useCallback(<K extends keyof ScoringRuleFormData>(
    key: K,
    value: ScoringRuleFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!form.fieldName) {
      newErrors.fieldName = 'Field is required';
    }
    if (!form.operator) {
      newErrors.operator = 'Operator is required';
    }
    if (needsThreshold && !form.thresholdValue.trim()) {
      newErrors.thresholdValue = 'Threshold value is required';
    }
    if (form.points === 0) {
      newErrors.points = 'Points must be non-zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, needsThreshold]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: ScoringRuleFormData = {
      ...form,
      thresholdValue: needsThreshold ? form.thresholdValue : ''
    };

    await onSave(data);
  }, [form, needsThreshold, validate, onSave]);

  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      icon={<Scale size={18} />}
      size="md"
      onSubmit={handleSubmit}
      footer={
        <div className="portal-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : (isEditing ? 'Update Rule' : 'Create Rule')}
          </button>
        </div>
      }
    >
      <div className="form-grid">
        {/* Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="rule-name">Name</label>
          <input
            id="rule-name"
            type="text"
            className="form-input"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g. High Budget Lead"
          />
          {errors.name && <span className="form-error-message">{errors.name}</span>}
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label" htmlFor="rule-description">Description</label>
          <input
            id="rule-description"
            type="text"
            className="form-input"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Optional description"
          />
        </div>

        {/* Field + Operator row */}
        <div className="form-row form-row--half">
          <div className="form-group">
            <label className="form-label" htmlFor="rule-field">Field</label>
            <select
              id="rule-field"
              className="form-input"
              value={form.fieldName}
              onChange={(e) => updateField('fieldName', e.target.value)}
            >
              {FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.fieldName && <span className="form-error-message">{errors.fieldName}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rule-operator">Operator</label>
            <select
              id="rule-operator"
              className="form-input"
              value={form.operator}
              onChange={(e) => updateField('operator', e.target.value)}
            >
              {OPERATOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.operator && <span className="form-error-message">{errors.operator}</span>}
          </div>
        </div>

        {/* Threshold Value */}
        {needsThreshold && (
          <div className="form-group">
            <label className="form-label" htmlFor="rule-threshold">
              Threshold Value
              {form.operator === 'in' && (
                <span className="field-label field-label--inline"> (comma-separated)</span>
              )}
            </label>
            <input
              id="rule-threshold"
              type="text"
              className="form-input"
              value={form.thresholdValue}
              onChange={(e) => updateField('thresholdValue', e.target.value)}
              placeholder={form.operator === 'in' ? 'value1, value2, value3' : 'Value to compare'}
            />
            {errors.thresholdValue && <span className="form-error-message">{errors.thresholdValue}</span>}
          </div>
        )}

        {/* Points + Active row */}
        <div className="form-row form-row--half">
          <div className="form-group">
            <label className="form-label" htmlFor="rule-points">Points</label>
            <input
              id="rule-points"
              type="number"
              className="form-input"
              value={form.points}
              onChange={(e) => updateField('points', parseInt(e.target.value, 10) || 0)}
              min={-100}
              max={100}
            />
            {errors.points && <span className="form-error-message">{errors.points}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rule-active">Status</label>
            <select
              id="rule-active"
              className="form-input"
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => updateField('isActive', e.target.value === 'active')}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>
    </PortalModal>
  );
}
