/**
 * AddProjectModal
 * Form modal to add a new project with client selection and new-client toggle.
 * Captures all intake form fields so the project record is fully populated.
 * Uses shared PortalModal + PortalInput for consistent UI.
 * Uses ModalDropdown for client, project type, budget, and timeline selections.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { FolderPlus } from 'lucide-react';
import { PortalModal } from '@react/components/portal/PortalModal';
import { PortalInput } from '@react/components/portal/PortalInput';
import { ModalDropdown } from '@react/components/portal/ModalDropdown';
import { DESIGN_STYLES } from '@react/features/portal/onboarding/types';
import type { ModalDropdownOption } from '@react/components/portal/ModalDropdown';

// ============================================
// TYPES
// ============================================

export interface NewClientData {
  contactName: string;
  email: string;
  companyName: string;
  phone: string;
}

export interface AddProjectFormData {
  clientId: string;
  newClient: NewClientData | null;
  // Core project fields
  projectType: string;
  description: string;
  budget: string;
  timeline: string;
  notes: string;
  // Intake scope fields
  features: string;
  pageCount: string;
  integrations: string;
  addons: string;
  // Design & content fields
  designLevel: string;
  contentStatus: string;
  brandAssets: string;
  // Technical fields
  techComfort: string;
  hostingPreference: string;
  currentSite: string;
  // Background fields
  inspiration: string;
  challenges: string;
  referralSource: string;
}

export interface AddProjectModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when form is submitted */
  onSubmit: (data: AddProjectFormData) => void | Promise<void>;
  /** Available clients for selection */
  clientOptions: ModalDropdownOption[];
  /** Available project type options */
  projectTypeOptions: ModalDropdownOption[];
  /** Available budget range options */
  budgetOptions: ModalDropdownOption[];
  /** Available timeline options */
  timelineOptions: ModalDropdownOption[];
  /** Whether submission is in progress */
  loading?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const NEW_CLIENT_VALUE = '__new__';

const INITIAL_NEW_CLIENT: NewClientData = {
  contactName: '',
  email: '',
  companyName: '',
  phone: ''
};

const INITIAL_FORM_STATE = {
  clientId: '',
  projectType: '',
  description: '',
  budget: '',
  timeline: '',
  notes: '',
  features: '',
  pageCount: '',
  integrations: '',
  addons: '',
  designLevel: '',
  contentStatus: '',
  brandAssets: '',
  techComfort: '',
  hostingPreference: '',
  currentSite: '',
  inspiration: '',
  challenges: '',
  referralSource: ''
};

const DESIGN_LEVEL_OPTIONS: ModalDropdownOption[] = DESIGN_STYLES.map((style) => ({
  value: style,
  label: style
}));

const CONTENT_STATUS_OPTIONS: ModalDropdownOption[] = [
  { value: 'Ready', label: 'Ready' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Need Help', label: 'Need Help' },
  { value: 'Not Started', label: 'Not Started' }
];

const BRAND_ASSETS_OPTIONS: ModalDropdownOption[] = [
  { value: 'Have Full Brand Kit', label: 'Have Full Brand Kit' },
  { value: 'Have Logo Only', label: 'Have Logo Only' },
  { value: 'Need Brand Design', label: 'Need Brand Design' },
  { value: 'Not Sure', label: 'Not Sure' }
];

const TECH_COMFORT_OPTIONS: ModalDropdownOption[] = [
  { value: 'Very Comfortable', label: 'Very Comfortable' },
  { value: 'Somewhat Comfortable', label: 'Somewhat Comfortable' },
  { value: 'Not Very Comfortable', label: 'Not Very Comfortable' },
  { value: 'Prefer Not To', label: 'Prefer Not To' }
];

const HOSTING_OPTIONS: ModalDropdownOption[] = [
  { value: 'Have Hosting', label: 'Have Hosting' },
  { value: 'Need Hosting', label: 'Need Hosting' },
  { value: 'Not Sure', label: 'Not Sure' }
];

// ============================================
// COMPONENT
// ============================================

export function AddProjectModal({
  open,
  onOpenChange,
  onSubmit,
  clientOptions,
  projectTypeOptions,
  budgetOptions,
  timelineOptions,
  loading = false
}: AddProjectModalProps) {
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [newClient, setNewClient] = useState<NewClientData>(INITIAL_NEW_CLIENT);

  const isNewClient = formState.clientId === NEW_CLIENT_VALUE;

  // Build client options with "Add New Client" entry
  const clientOptionsWithNew: ModalDropdownOption[] = React.useMemo(
    () => [
      ...clientOptions,
      { value: NEW_CLIENT_VALUE, label: '+ Add New Client' }
    ],
    [clientOptions]
  );

  const handleTextChange = useCallback(
    (field: keyof typeof INITIAL_FORM_STATE) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormState((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleDropdownChange = useCallback(
    (field: keyof typeof INITIAL_FORM_STATE) =>
      (value: string | string[]) => {
        const selected = Array.isArray(value) ? value[0] : value;
        setFormState((prev) => ({ ...prev, [field]: selected }));
      },
    []
  );

  const handleNewClientChange = useCallback(
    (field: keyof NewClientData) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewClient((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const resetForm = useCallback(() => {
    setFormState(INITIAL_FORM_STATE);
    setNewClient(INITIAL_NEW_CLIENT);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const data: AddProjectFormData = {
        clientId: isNewClient ? '' : formState.clientId,
        newClient: isNewClient ? newClient : null,
        projectType: formState.projectType,
        description: formState.description,
        budget: formState.budget,
        timeline: formState.timeline,
        notes: formState.notes,
        features: formState.features,
        pageCount: formState.pageCount,
        integrations: formState.integrations,
        addons: formState.addons,
        designLevel: formState.designLevel,
        contentStatus: formState.contentStatus,
        brandAssets: formState.brandAssets,
        techComfort: formState.techComfort,
        hostingPreference: formState.hostingPreference,
        currentSite: formState.currentSite,
        inspiration: formState.inspiration,
        challenges: formState.challenges,
        referralSource: formState.referralSource
      };
      await onSubmit(data);
      resetForm();
    },
    [formState, newClient, isNewClient, onSubmit, resetForm]
  );

  const handleCancel = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Project"
      icon={<FolderPlus size={20} />}
      onSubmit={handleSubmit}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Project'}
          </button>
        </>
      }
    >
      {/* Client Selection */}
      <div className="form-field">
        <label className="field-label">Client *</label>
        <ModalDropdown
          options={clientOptionsWithNew}
          value={formState.clientId}
          onChange={handleDropdownChange('clientId')}
          placeholder="Select a client"
          searchable={clientOptions.length > 5}
        />
      </div>

      {/* New Client Fields (shown when "Add New Client" is selected) */}
      {isNewClient && (
        <fieldset>
          <legend>New Client Details</legend>

          <div className="form-field">
            <PortalInput
              type="text"
              label="Contact Name"
              placeholder="John Smith"
              value={newClient.contactName}
              onChange={handleNewClientChange('contactName')}
              required
            />
          </div>

          <div className="form-field">
            <PortalInput
              type="email"
              label="Email"
              placeholder="client@example.com"
              value={newClient.email}
              onChange={handleNewClientChange('email')}
              required
            />
          </div>

          <div className="form-field">
            <PortalInput
              type="text"
              label="Company Name"
              placeholder="Acme Inc."
              value={newClient.companyName}
              onChange={handleNewClientChange('companyName')}
            />
          </div>

          <div className="form-field">
            <PortalInput
              type="tel"
              label="Phone"
              placeholder="(555) 123-4567"
              value={newClient.phone}
              onChange={handleNewClientChange('phone')}
            />
          </div>
        </fieldset>
      )}

      {/* Core Project Fields */}
      <div className="form-field">
        <label className="field-label">Project Type *</label>
        <ModalDropdown
          options={projectTypeOptions}
          value={formState.projectType}
          onChange={handleDropdownChange('projectType')}
          placeholder="Select project type"
        />
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="new-project-description">
          Description *
        </label>
        <textarea
          id="new-project-description"
          className="form-textarea"
          rows={3}
          placeholder="Brief project description..."
          value={formState.description}
          onChange={handleTextChange('description')}
          required
        />
      </div>

      <div className="form-field">
        <label className="field-label">Budget *</label>
        <ModalDropdown
          options={budgetOptions}
          value={formState.budget}
          onChange={handleDropdownChange('budget')}
          placeholder="Select budget range"
        />
      </div>

      <div className="form-field">
        <label className="field-label">Timeline *</label>
        <ModalDropdown
          options={timelineOptions}
          value={formState.timeline}
          onChange={handleDropdownChange('timeline')}
          placeholder="Select timeline"
        />
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="new-project-notes">
          Additional Notes
        </label>
        <textarea
          id="new-project-notes"
          className="form-textarea"
          rows={2}
          placeholder="Any additional details..."
          value={formState.notes}
          onChange={handleTextChange('notes')}
        />
      </div>

      {/* ---- Project Scope ---- */}
      <fieldset>
        <legend>Project Scope</legend>

        <div className="form-field">
          <label className="field-label" htmlFor="new-project-features">
            Features Requested
          </label>
          <textarea
            id="new-project-features"
            className="form-textarea"
            rows={2}
            placeholder="Contact forms, booking system, payment processing..."
            value={formState.features}
            onChange={handleTextChange('features')}
          />
        </div>

        <div className="form-field">
          <PortalInput
            type="text"
            label="Page Count"
            placeholder="e.g. 5-10 pages"
            value={formState.pageCount}
            onChange={handleTextChange('pageCount')}
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="new-project-integrations">
            Integrations
          </label>
          <textarea
            id="new-project-integrations"
            className="form-textarea"
            rows={2}
            placeholder="Stripe, CRM, Google Calendar..."
            value={formState.integrations}
            onChange={handleTextChange('integrations')}
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="new-project-addons">
            Add-ons
          </label>
          <textarea
            id="new-project-addons"
            className="form-textarea"
            rows={2}
            placeholder="SEO optimization, analytics setup, maintenance plan..."
            value={formState.addons}
            onChange={handleTextChange('addons')}
          />
        </div>
      </fieldset>

      {/* ---- Design & Content ---- */}
      <fieldset>
        <legend>Design &amp; Content</legend>

        <div className="form-field">
          <label className="field-label">Design Level</label>
          <ModalDropdown
            options={DESIGN_LEVEL_OPTIONS}
            value={formState.designLevel}
            onChange={handleDropdownChange('designLevel')}
            placeholder="Select design style"
          />
        </div>

        <div className="form-field">
          <label className="field-label">Content Status</label>
          <ModalDropdown
            options={CONTENT_STATUS_OPTIONS}
            value={formState.contentStatus}
            onChange={handleDropdownChange('contentStatus')}
            placeholder="Is content ready?"
          />
        </div>

        <div className="form-field">
          <label className="field-label">Brand Assets</label>
          <ModalDropdown
            options={BRAND_ASSETS_OPTIONS}
            value={formState.brandAssets}
            onChange={handleDropdownChange('brandAssets')}
            placeholder="What brand assets are available?"
          />
        </div>
      </fieldset>

      {/* ---- Technical ---- */}
      <fieldset>
        <legend>Technical</legend>

        <div className="form-field">
          <label className="field-label">Client Tech Comfort</label>
          <ModalDropdown
            options={TECH_COMFORT_OPTIONS}
            value={formState.techComfort}
            onChange={handleDropdownChange('techComfort')}
            placeholder="How comfortable with tech?"
          />
        </div>

        <div className="form-field">
          <label className="field-label">Hosting Preference</label>
          <ModalDropdown
            options={HOSTING_OPTIONS}
            value={formState.hostingPreference}
            onChange={handleDropdownChange('hostingPreference')}
            placeholder="Hosting situation?"
          />
        </div>

        <div className="form-field">
          <PortalInput
            type="text"
            label="Current Site URL"
            placeholder="https://current-site.com (if any)"
            value={formState.currentSite}
            onChange={handleTextChange('currentSite')}
          />
        </div>
      </fieldset>

      {/* ---- Background ---- */}
      <fieldset>
        <legend>Background</legend>

        <div className="form-field">
          <label className="field-label" htmlFor="new-project-challenges">
            Known Challenges
          </label>
          <textarea
            id="new-project-challenges"
            className="form-textarea"
            rows={2}
            placeholder="What problems need solving?"
            value={formState.challenges}
            onChange={handleTextChange('challenges')}
          />
        </div>

        <div className="form-field">
          <PortalInput
            type="text"
            label="Referral Source"
            placeholder="How did they hear about you?"
            value={formState.referralSource}
            onChange={handleTextChange('referralSource')}
          />
        </div>
      </fieldset>
    </PortalModal>
  );
}
