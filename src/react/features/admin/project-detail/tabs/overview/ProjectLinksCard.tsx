import * as React from 'react';
import { Link as LinkIcon, ExternalLink } from 'lucide-react';
import { InlineEdit } from '@react/components/portal/InlineEdit';
import type { Project } from '../../../types';

interface ProjectLinksCardProps {
  project: Project;
  onSaveField: (field: keyof Project, value: string) => Promise<boolean>;
}

/**
 * ProjectLinksCard
 * Displays and allows inline editing of project URLs:
 * preview, repository, and production.
 */
export function ProjectLinksCard({ project, onSaveField }: ProjectLinksCardProps) {
  return (
    <div className="panel">
      <h3 className="section-title">Links</h3>
      <div className="grid-2col">
        <div className="layout-form-field">
          <div className="field-label">
            <LinkIcon className="icon-sm" /> Preview URL
            {project.preview_url && (
              <a href={project.preview_url} target="_blank" rel="noopener noreferrer" className="inline-link-external" aria-label="Open preview URL">
                <ExternalLink className="icon-sm" />
              </a>
            )}
          </div>
          <InlineEdit
            value={project.preview_url || ''}
            type="text"
            placeholder="Set preview URL"
            onSave={(value) => onSaveField('preview_url', value)}
          />
        </div>

        <div className="layout-form-field">
          <div className="field-label">
            <LinkIcon className="icon-sm" /> Repository
            {project.repo_url && (
              <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="inline-link-external" aria-label="Open repository URL">
                <ExternalLink className="icon-sm" />
              </a>
            )}
          </div>
          <InlineEdit
            value={project.repo_url || ''}
            type="text"
            placeholder="Set repository URL"
            onSave={(value) => onSaveField('repo_url', value)}
          />
        </div>

        <div className="layout-form-field">
          <div className="field-label">
            <LinkIcon className="icon-sm" /> Production URL
            {project.production_url && (
              <a href={project.production_url} target="_blank" rel="noopener noreferrer" className="inline-link-external" aria-label="Open production URL">
                <ExternalLink className="icon-sm" />
              </a>
            )}
          </div>
          <InlineEdit
            value={project.production_url || ''}
            type="text"
            placeholder="Set production URL"
            onSave={(value) => onSaveField('production_url', value)}
          />
        </div>
      </div>
    </div>
  );
}
