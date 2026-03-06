/**
 * AddProjectModal
 * Form modal to add a new project with client selection and new-client toggle.
 * Replaces the EJS #add-project-modal from admin-modals.ejs.
 * Uses ModalDropdown for client, project type, budget, and timeline selections.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { FolderPlus, X } from 'lucide-react';
import { useScaleIn } from '@react/hooks/useGsap';
import { ModalDropdown } from '@react/components/portal/ModalDropdown';
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
  projectType: string;
  description: string;
  budget: string;
  timeline: string;
  notes: string;
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
  notes: ''
};

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
  const contentRef = useScaleIn<HTMLDivElement>();
  const titleId = React.useId();

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
        notes: formState.notes
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="admin-modal-overlay" />
        <DialogPrimitive.Content
          ref={contentRef}
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Header */}
          <div className="admin-modal-header">
            <div className="admin-modal-title">
              <FolderPlus size={20} />
              <h2 id={titleId}>Add New Project</h2>
            </div>
            <DialogPrimitive.Close className="admin-modal-close" aria-label="Close modal">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="admin-modal-body">
              {/* Client Selection */}
              <div className="form-group">
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

                  <div className="form-group">
                    <label className="field-label" htmlFor="new-project-client-name">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      id="new-project-client-name"
                      className="form-input"
                      placeholder="John Smith"
                      value={newClient.contactName}
                      onChange={handleNewClientChange('contactName')}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="field-label" htmlFor="new-project-client-email">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="new-project-client-email"
                      className="form-input"
                      placeholder="client@example.com"
                      value={newClient.email}
                      onChange={handleNewClientChange('email')}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="field-label" htmlFor="new-project-client-company">
                      Company Name
                    </label>
                    <input
                      type="text"
                      id="new-project-client-company"
                      className="form-input"
                      placeholder="Acme Inc."
                      value={newClient.companyName}
                      onChange={handleNewClientChange('companyName')}
                    />
                  </div>

                  <div className="form-group">
                    <label className="field-label" htmlFor="new-project-client-phone">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="new-project-client-phone"
                      className="form-input"
                      placeholder="(555) 123-4567"
                      value={newClient.phone}
                      onChange={handleNewClientChange('phone')}
                    />
                  </div>
                </fieldset>
              )}

              {/* Project Fields */}
              <div className="form-group">
                <label className="field-label">Project Type *</label>
                <ModalDropdown
                  options={projectTypeOptions}
                  value={formState.projectType}
                  onChange={handleDropdownChange('projectType')}
                  placeholder="Select project type"
                />
              </div>

              <div className="form-group">
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

              <div className="form-group">
                <label className="field-label">Budget *</label>
                <ModalDropdown
                  options={budgetOptions}
                  value={formState.budget}
                  onChange={handleDropdownChange('budget')}
                  placeholder="Select budget range"
                />
              </div>

              <div className="form-group">
                <label className="field-label">Timeline *</label>
                <ModalDropdown
                  options={timelineOptions}
                  value={formState.timeline}
                  onChange={handleDropdownChange('timeline')}
                  placeholder="Select timeline"
                />
              </div>

              <div className="form-group">
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
            </div>

            {/* Footer */}
            <div className="admin-modal-footer">
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
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
