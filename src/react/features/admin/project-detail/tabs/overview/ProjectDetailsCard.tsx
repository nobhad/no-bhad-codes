import * as React from 'react';
import { DollarSign } from 'lucide-react';
import { InlineEdit, InlineSelect, InlineTextarea, formatCurrencyDisplay, parseCurrencyInput } from '@react/components/portal/InlineEdit';
import type { Project } from '../../../types';
import { PROJECT_TYPE_LABELS } from '../../../types';

/** Project type options for InlineSelect */
const PROJECT_TYPE_OPTIONS = [
  { value: 'simple-site', label: 'Simple Site' },
  { value: 'business-site', label: 'Business Site' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'web-app', label: 'Web App' },
  { value: 'browser-extension', label: 'Browser Extension' }
];

interface ProjectDetailsCardProps {
  project: Project;
  onSaveField: (field: keyof Project, value: string) => Promise<boolean>;
}

/**
 * ProjectDetailsCard
 * Displays and allows inline editing of core project fields:
 * type, timeline, dates, budget, price, and description.
 */
export function ProjectDetailsCard({ project, onSaveField }: ProjectDetailsCardProps) {
  return (
    <div className="panel">
      <div className="data-table-header">
        <h3><span className="title-full">Project Details</span></h3>
      </div>

      <div className="grid-2col">
        <div className="layout-form-field">
          <span className="field-label">Type</span>
          <InlineSelect
            value={project.project_type || ''}
            options={PROJECT_TYPE_OPTIONS}
            placeholder="Select type"
            formatDisplay={(val) => PROJECT_TYPE_LABELS[val] || val || 'Select type'}
            onSave={(value) => onSaveField('project_type', value)}
          />
        </div>

        <div className="layout-form-field">
          <span className="field-label">Timeline</span>
          <InlineEdit
            value={project.timeline || ''}
            type="text"
            placeholder="Set timeline"
            onSave={(value) => onSaveField('timeline', value)}
          />
        </div>

        <div className="layout-form-field">
          <span className="field-label">Start Date</span>
          <InlineEdit
            value={project.start_date || ''}
            type="date"
            placeholder="Set start date"
            onSave={(value) => onSaveField('start_date', value)}
          />
        </div>

        <div className="layout-form-field">
          <span className="field-label">Target End Date</span>
          <InlineEdit
            value={project.end_date || ''}
            type="date"
            placeholder="Set end date"
            onSave={(value) => onSaveField('end_date', value)}
          />
        </div>

        <div className="layout-form-field">
          <span className="field-label">Budget</span>
          <div className="project-info-field-value">
            <DollarSign className="icon-sm" />
            <InlineEdit
              value={String(project.budget || '')}
              type="currency"
              placeholder="Set budget"
              formatDisplay={formatCurrencyDisplay}
              parseInput={parseCurrencyInput}
              onSave={(value) => onSaveField('budget', value)}
            />
          </div>
        </div>

        <div className="layout-form-field">
          <span className="field-label">Quoted Price</span>
          <div className="project-info-field-value">
            <DollarSign className="icon-sm" />
            <InlineEdit
              value={String(project.price || '')}
              type="currency"
              placeholder="Set price"
              formatDisplay={formatCurrencyDisplay}
              parseInput={parseCurrencyInput}
              onSave={(value) => onSaveField('price', value)}
            />
          </div>
        </div>
      </div>

      <div className="panel-description">
        <span className="field-label">Description</span>
        <InlineTextarea
          value={project.description || ''}
          placeholder="Add description"
          onSave={(value) => onSaveField('description', value)}
        />
      </div>
    </div>
  );
}
