import * as React from 'react';
import { Link as LinkIcon, ExternalLink, Pencil } from 'lucide-react';
import { InlineEdit } from '@react/components/portal/InlineEdit';
import type { Project } from '../../../types';

interface ProjectLinksCardProps {
  project: Project;
  onSaveField: (field: keyof Project, value: string) => Promise<boolean>;
}

/** Single link field: [pencil] value [external-link] */
function LinkField({
  label,
  value,
  placeholder,
  onSave
}: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<boolean>;
}) {
  return (
    <div className="layout-form-field">
      <div className="field-label">
        <LinkIcon className="icon-sm" /> {label}
      </div>
      <div className="project-info-field-value">
        <Pencil className="icon-sm inline-edit-icon" />
        <InlineEdit
          value={value}
          type="text"
          placeholder={placeholder}
          showEditIcon={false}
          onSave={onSave}
        />
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer" className="inline-link-external" aria-label={`Open ${label}`}>
            <ExternalLink className="icon-sm" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * ProjectLinksCard
 * Displays and allows inline editing of project URLs:
 * preview, repository, and production.
 */
export function ProjectLinksCard({ project, onSaveField }: ProjectLinksCardProps) {
  return (
    <div className="panel">
      <div className="data-table-header"><h3><span className="title-full">Links</span></h3></div>
      <div className="link-list">
        <LinkField
          label="Preview URL"
          value={project.preview_url || ''}
          placeholder="Set preview URL"
          onSave={(value) => onSaveField('preview_url', value)}
        />
        <LinkField
          label="Repository"
          value={project.repo_url || ''}
          placeholder="Set repository URL"
          onSave={(value) => onSaveField('repo_url', value)}
        />
        <LinkField
          label="Production URL"
          value={project.production_url || ''}
          placeholder="Set production URL"
          onSave={(value) => onSaveField('production_url', value)}
        />
      </div>
    </div>
  );
}
