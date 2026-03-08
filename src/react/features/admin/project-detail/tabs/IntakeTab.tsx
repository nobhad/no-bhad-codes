import * as React from 'react';
import { useCallback } from 'react';
import { InlineEdit, InlineSelect, InlineTextarea } from '@react/components/portal/InlineEdit';
import { DESIGN_STYLES } from '@react/features/portal/onboarding/types';
import type { Project } from '../../types';

interface IntakeTabProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/** Design level options from onboarding DESIGN_STYLES */
const DESIGN_LEVEL_OPTIONS = DESIGN_STYLES.map((style) => ({
  value: style,
  label: style
}));

const CONTENT_STATUS_OPTIONS = [
  { value: 'Ready', label: 'Ready' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Need Help', label: 'Need Help' },
  { value: 'Not Started', label: 'Not Started' }
];

const BRAND_ASSETS_OPTIONS = [
  { value: 'Have Full Brand Kit', label: 'Have Full Brand Kit' },
  { value: 'Have Logo Only', label: 'Have Logo Only' },
  { value: 'Need Brand Design', label: 'Need Brand Design' },
  { value: 'Not Sure', label: 'Not Sure' }
];

const TECH_COMFORT_OPTIONS = [
  { value: 'Very Comfortable', label: 'Very Comfortable' },
  { value: 'Somewhat Comfortable', label: 'Somewhat Comfortable' },
  { value: 'Not Very Comfortable', label: 'Not Very Comfortable' },
  { value: 'Prefer Not To', label: 'Prefer Not To' }
];

const HOSTING_OPTIONS = [
  { value: 'Have Hosting', label: 'Have Hosting' },
  { value: 'Need Hosting', label: 'Need Hosting' },
  { value: 'Not Sure', label: 'Not Sure' }
];

/**
 * IntakeTab
 * Displays and allows editing of all 14 intake-specific fields
 */
export function IntakeTab({
  project,
  onUpdateProject,
  showNotification
}: IntakeTabProps) {
  const handleSaveField = useCallback(
    async (field: keyof Project, value: string): Promise<boolean> => {
      const success = await onUpdateProject({ [field]: value });
      if (success) {
        showNotification?.('Updated successfully', 'success');
      } else {
        showNotification?.('Failed to update', 'error');
      }
      return success;
    },
    [onUpdateProject, showNotification]
  );

  return (
    <div className="project-overview-grid">
      <div className="project-overview-main">
        {/* Project Scope */}
        <div className="panel">
          <h3 className="section-title">Project Scope</h3>
          <div className="project-info-grid">
            <div className="project-info-field">
              <span className="field-label">Features</span>
              <InlineTextarea
                value={project.features || ''}
                placeholder="No features listed"
                onSave={(value) => handleSaveField('features', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Page Count</span>
              <InlineEdit
                value={project.page_count || ''}
                type="text"
                placeholder="Not specified"
                onSave={(value) => handleSaveField('page_count', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Integrations</span>
              <InlineTextarea
                value={project.integrations || ''}
                placeholder="No integrations listed"
                onSave={(value) => handleSaveField('integrations', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Add-ons</span>
              <InlineTextarea
                value={project.addons || ''}
                placeholder="No add-ons listed"
                onSave={(value) => handleSaveField('addons', value)}
              />
            </div>
          </div>
        </div>

        {/* Design & Content */}
        <div className="panel">
          <h3 className="section-title">Design & Content</h3>
          <div className="project-info-grid">
            <div className="project-info-field">
              <span className="field-label">Design Level</span>
              <InlineSelect
                value={project.design_level || ''}
                options={DESIGN_LEVEL_OPTIONS}
                placeholder="Not specified"
                onSave={(value) => handleSaveField('design_level', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Content Status</span>
              <InlineSelect
                value={project.content_status || ''}
                options={CONTENT_STATUS_OPTIONS}
                placeholder="Not specified"
                onSave={(value) => handleSaveField('content_status', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Brand Assets</span>
              <InlineSelect
                value={project.brand_assets || ''}
                options={BRAND_ASSETS_OPTIONS}
                placeholder="Not specified"
                onSave={(value) => handleSaveField('brand_assets', value)}
              />
            </div>
          </div>
        </div>

        {/* Technical */}
        <div className="panel">
          <h3 className="section-title">Technical</h3>
          <div className="project-info-grid">
            <div className="project-info-field">
              <span className="field-label">Tech Comfort</span>
              <InlineSelect
                value={project.tech_comfort || ''}
                options={TECH_COMFORT_OPTIONS}
                placeholder="Not specified"
                onSave={(value) => handleSaveField('tech_comfort', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Hosting Preference</span>
              <InlineSelect
                value={project.hosting_preference || ''}
                options={HOSTING_OPTIONS}
                placeholder="Not specified"
                onSave={(value) => handleSaveField('hosting_preference', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Current Site</span>
              <InlineEdit
                value={project.current_site || ''}
                type="text"
                placeholder="No current site"
                onSave={(value) => handleSaveField('current_site', value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Background */}
      <div className="project-overview-sidebar">
        <div className="panel">
          <h3 className="section-title">Background</h3>
          <div className="project-info-grid">
            <div className="project-info-field">
              <span className="field-label">Inspiration</span>
              <InlineTextarea
                value={project.inspiration || ''}
                placeholder="No inspiration listed"
                onSave={(value) => handleSaveField('inspiration', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Challenges</span>
              <InlineTextarea
                value={project.challenges || ''}
                placeholder="No challenges listed"
                onSave={(value) => handleSaveField('challenges', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Additional Info</span>
              <InlineTextarea
                value={project.additional_info || ''}
                placeholder="No additional info"
                onSave={(value) => handleSaveField('additional_info', value)}
              />
            </div>

            <div className="project-info-field">
              <span className="field-label">Referral Source</span>
              <InlineEdit
                value={project.referral_source || ''}
                type="text"
                placeholder="Not specified"
                onSave={(value) => handleSaveField('referral_source', value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
