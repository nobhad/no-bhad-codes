/**
 * CreateEntityModals
 * Shared create modals for admin table ADD buttons.
 * Each modal follows the AddClientModal pattern:
 *   PortalModal → form fields → onSubmit → API POST → notification → refresh
 *
 * Entities without a POST endpoint (Design Reviews, standalone Contacts)
 * are omitted — their ADD buttons show "Coming Soon" notifications.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  FileText,
  Mail,
  FolderOpen,
  BookOpen,
  ClipboardList,
  Package,
  Clock,
  ListTodo,
  UserPlus,
  FileSignature,
  Send
} from 'lucide-react';
import { PortalModal } from '@react/components/portal/PortalModal';
import { PortalInput } from '@react/components/portal/PortalInput';
import { FormDropdown } from '@react/components/portal/FormDropdown';
import type { FormDropdownOption } from '@react/components/portal/FormDropdown';

// ============================================
// SHARED TYPES
// ============================================

interface BaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
  loading?: boolean;
}

// ============================================
// SHARED HELPERS
// ============================================

function ModalFooter({ loading, submitLabel, onCancel }: { loading: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Saving...' : submitLabel}
      </button>
    </>
  );
}

function useFormState<T extends Record<string, unknown>>(initial: T) {
  const [form, setForm] = useState<T>(initial);

  const handleText = useCallback(
    (field: keyof T) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleDropdown = useCallback(
    (field: keyof T) =>
      (value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
      },
    []
  );

  const handleCheckbox = useCallback(
    (field: keyof T) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.checked }));
      },
    []
  );

  const reset = useCallback(() => setForm(initial), [initial]);

  return { form, setForm, handleText, handleDropdown, handleCheckbox, reset };
}

// ============================================
// 1. CREATE CONTACT MODAL
// ============================================

const INITIAL_CONTACT = { name: '', email: '', phone: '', title: '', company: '' };

export interface CreateContactModalProps extends BaseModalProps {
  clientOptions?: FormDropdownOption[];
}

export function CreateContactModal({ open, onOpenChange, onSubmit, loading = false, clientOptions }: CreateContactModalProps) {
  const { form, handleText, handleDropdown, reset } = useFormState({
    ...INITIAL_CONTACT,
    clientId: ''
  });

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="Add Contact" icon={<UserPlus />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Contact'}</button></>}>
      {clientOptions && clientOptions.length > 0 && (
        <div className="form-field">
          <label className="field-label">Client</label>
          <FormDropdown options={clientOptions} value={form.clientId as string} onChange={handleDropdown('clientId')} placeholder="Select client" />
        </div>
      )}
      <div className="form-field"><PortalInput type="text" label="Name *" placeholder="Contact name" value={form.name as string} onChange={handleText('name')} required /></div>
      <div className="form-field"><PortalInput type="email" label="Email *" placeholder="email@example.com" value={form.email as string} onChange={handleText('email')} required /></div>
      <div className="form-field"><PortalInput type="tel" label="Phone" placeholder="(555) 123-4567" value={form.phone as string} onChange={handleText('phone')} /></div>
      <div className="form-field"><PortalInput type="text" label="Title" placeholder="Job title" value={form.title as string} onChange={handleText('title')} /></div>
      <div className="form-field"><PortalInput type="text" label="Company" placeholder="Company name" value={form.company as string} onChange={handleText('company')} /></div>
    </PortalModal>
  );
}

// ============================================
// 2. CREATE TASK MODAL
// ============================================

const PRIORITY_OPTIONS: FormDropdownOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

const INITIAL_TASK = { title: '', description: '', priority: 'normal', dueDate: '' };

export interface CreateTaskModalProps extends BaseModalProps {
  projectOptions?: FormDropdownOption[];
}

export function CreateTaskModal({ open, onOpenChange, onSubmit, loading = false, projectOptions }: CreateTaskModalProps) {
  const { form, handleText, handleDropdown, reset } = useFormState({
    ...INITIAL_TASK,
    projectId: ''
  });

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="Add Task" icon={<ListTodo />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Task'}</button></>}>
      <div className="form-field"><PortalInput type="text" label="Title *" placeholder="Task title" value={form.title as string} onChange={handleText('title')} required /></div>
      {projectOptions && projectOptions.length > 0 && (
        <div className="form-field">
          <label className="field-label">Project</label>
          <FormDropdown options={projectOptions} value={form.projectId as string} onChange={handleDropdown('projectId')} placeholder="Select project" />
        </div>
      )}
      <div className="form-field">
        <label className="field-label">Priority</label>
        <FormDropdown options={PRIORITY_OPTIONS} value={form.priority as string} onChange={handleDropdown('priority')} placeholder="Select priority" />
      </div>
      <div className="form-field"><PortalInput type="date" label="Due Date" value={form.dueDate as string} onChange={handleText('dueDate')} /></div>
      <div className="form-field">
        <label className="field-label" htmlFor="task-description">Description</label>
        <textarea id="task-description" className="form-textarea" rows={3} placeholder="Task description..." value={form.description as string} onChange={handleText('description')} />
      </div>
    </PortalModal>
  );
}

// ============================================
// 3. CREATE EMAIL TEMPLATE MODAL
// ============================================

const TEMPLATE_CATEGORY_OPTIONS: FormDropdownOption[] = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'notification', label: 'Notification' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' }
];

const INITIAL_TEMPLATE = { name: '', subject: '', category: '', description: '', body_html: '' };

export function CreateEmailTemplateModal({ open, onOpenChange, onSubmit, loading = false }: BaseModalProps) {
  const { form, handleText, handleDropdown, reset } = useFormState(INITIAL_TEMPLATE);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="New Email Template" icon={<Mail />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Template'}</button></>}>
      <div className="form-field"><PortalInput type="text" label="Template Name *" placeholder="Welcome Email" value={form.name as string} onChange={handleText('name')} required /></div>
      <div className="form-field"><PortalInput type="text" label="Subject *" placeholder="Email subject line" value={form.subject as string} onChange={handleText('subject')} required /></div>
      <div className="form-field">
        <label className="field-label">Category</label>
        <FormDropdown options={TEMPLATE_CATEGORY_OPTIONS} value={form.category as string} onChange={handleDropdown('category')} placeholder="Select category" />
      </div>
      <div className="form-field"><PortalInput type="text" label="Description" placeholder="Brief description" value={form.description as string} onChange={handleText('description')} /></div>
      <div className="form-field">
        <label className="field-label" htmlFor="template-body">Body *</label>
        <textarea id="template-body" className="form-textarea" rows={6} placeholder="Email body HTML..." value={form.body_html as string} onChange={handleText('body_html')} required />
      </div>
    </PortalModal>
  );
}

// ============================================
// 4. CREATE KB CATEGORY MODAL
// ============================================

const INITIAL_CATEGORY = { name: '', slug: '', description: '' };

export function CreateKBCategoryModal({ open, onOpenChange, onSubmit, loading = false }: BaseModalProps) {
  const { form, setForm, handleText, reset } = useFormState(INITIAL_CATEGORY);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setForm((prev) => ({ ...prev, name, slug }));
  }, [setForm]);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="New Category" icon={<FolderOpen />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Category'}</button></>}>
      <div className="form-field"><PortalInput type="text" label="Name *" placeholder="Category name" value={form.name as string} onChange={handleNameChange} required /></div>
      <div className="form-field"><PortalInput type="text" label="Slug *" placeholder="category-slug" value={form.slug as string} onChange={handleText('slug')} required /></div>
      <div className="form-field"><PortalInput type="text" label="Description" placeholder="Brief description" value={form.description as string} onChange={handleText('description')} /></div>
    </PortalModal>
  );
}

// ============================================
// 5. CREATE KB ARTICLE MODAL
// ============================================

const INITIAL_ARTICLE = { title: '', slug: '', category_id: '', summary: '', content: '', is_featured: false, is_published: false };

export interface CreateKBArticleModalProps extends BaseModalProps {
  categoryOptions: FormDropdownOption[];
}

export function CreateKBArticleModal({ open, onOpenChange, onSubmit, loading = false, categoryOptions }: CreateKBArticleModalProps) {
  const { form, setForm, handleText, handleDropdown, handleCheckbox, reset } = useFormState(INITIAL_ARTICLE);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setForm((prev) => ({ ...prev, title, slug }));
  }, [setForm]);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="New Article" icon={<BookOpen />} size="lg" onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Article'}</button></>}>
      <div className="form-field"><PortalInput type="text" label="Title *" placeholder="Article title" value={form.title as string} onChange={handleTitleChange} required /></div>
      <div className="form-field"><PortalInput type="text" label="Slug *" placeholder="article-slug" value={form.slug as string} onChange={handleText('slug')} required /></div>
      <div className="form-field">
        <label className="field-label">Category *</label>
        <FormDropdown options={categoryOptions} value={form.category_id as string} onChange={handleDropdown('category_id')} placeholder="Select category" />
      </div>
      <div className="form-field"><PortalInput type="text" label="Summary" placeholder="Brief summary" value={form.summary as string} onChange={handleText('summary')} /></div>
      <div className="form-field">
        <label className="field-label" htmlFor="article-content">Content *</label>
        <textarea id="article-content" className="form-textarea" rows={8} placeholder="Article content..." value={form.content as string} onChange={handleText('content')} required />
      </div>
      <div className="form-field">
        <label className="inline-checkbox"><input type="checkbox" checked={form.is_featured as boolean} onChange={handleCheckbox('is_featured')} /> Featured</label>
      </div>
      <div className="form-field">
        <label className="inline-checkbox"><input type="checkbox" checked={form.is_published as boolean} onChange={handleCheckbox('is_published')} /> Published</label>
      </div>
    </PortalModal>
  );
}

// ============================================
// 6. CREATE CONTRACT MODAL
// ============================================

const INITIAL_CONTRACT = { projectId: '', clientId: '', content: '', status: 'draft' };

export interface CreateContractModalProps extends BaseModalProps {
  clientOptions: FormDropdownOption[];
  projectOptions: FormDropdownOption[];
}

export function CreateContractModal({ open, onOpenChange, onSubmit, loading = false, clientOptions, projectOptions }: CreateContractModalProps) {
  const { form, handleText, handleDropdown, reset } = useFormState(INITIAL_CONTRACT);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="New Contract" icon={<FileSignature />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Contract'}</button></>}>
      <div className="form-field">
        <label className="field-label">Client *</label>
        <FormDropdown options={clientOptions} value={form.clientId as string} onChange={handleDropdown('clientId')} placeholder="Select client" />
      </div>
      <div className="form-field">
        <label className="field-label">Project *</label>
        <FormDropdown options={projectOptions} value={form.projectId as string} onChange={handleDropdown('projectId')} placeholder="Select project" />
      </div>
      <div className="form-field">
        <label className="field-label" htmlFor="contract-content">Contract Content *</label>
        <textarea id="contract-content" className="form-textarea" rows={6} placeholder="Contract terms..." value={form.content as string} onChange={handleText('content')} required />
      </div>
    </PortalModal>
  );
}

// ============================================
// 7. CREATE DOCUMENT REQUEST MODAL
// ============================================

const DOC_TYPE_OPTIONS: FormDropdownOption[] = [
  { value: 'document', label: 'Document' },
  { value: 'image', label: 'Image' },
  { value: 'form', label: 'Form' },
  { value: 'other', label: 'Other' }
];

const INITIAL_DOC_REQUEST = { title: '', description: '', client_id: '', project_id: '', document_type: '', priority: 'normal', due_date: '' };

export interface CreateDocumentRequestModalProps extends BaseModalProps {
  clientOptions: FormDropdownOption[];
  projectOptions: FormDropdownOption[];
}

export function CreateDocumentRequestModal({ open, onOpenChange, onSubmit, loading = false, clientOptions, projectOptions }: CreateDocumentRequestModalProps) {
  const { form, handleText, handleDropdown, reset } = useFormState(INITIAL_DOC_REQUEST);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="New Document Request" icon={<ClipboardList />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Request'}</button></>}>
      <div className="form-field"><PortalInput type="text" label="Title *" placeholder="Document title" value={form.title as string} onChange={handleText('title')} required /></div>
      <div className="form-field">
        <label className="field-label">Client *</label>
        <FormDropdown options={clientOptions} value={form.client_id as string} onChange={handleDropdown('client_id')} placeholder="Select client" />
      </div>
      <div className="form-field">
        <label className="field-label">Project</label>
        <FormDropdown options={projectOptions} value={form.project_id as string} onChange={handleDropdown('project_id')} placeholder="Select project" />
      </div>
      <div className="form-field">
        <label className="field-label">Document Type</label>
        <FormDropdown options={DOC_TYPE_OPTIONS} value={form.document_type as string} onChange={handleDropdown('document_type')} placeholder="Select type" />
      </div>
      <div className="form-field">
        <label className="field-label">Priority</label>
        <FormDropdown options={PRIORITY_OPTIONS} value={form.priority as string} onChange={handleDropdown('priority')} placeholder="Select priority" />
      </div>
      <div className="form-field"><PortalInput type="date" label="Due Date" value={form.due_date as string} onChange={handleText('due_date')} /></div>
      <div className="form-field">
        <label className="field-label" htmlFor="doc-request-desc">Description</label>
        <textarea id="doc-request-desc" className="form-textarea" rows={3} placeholder="What document is needed..." value={form.description as string} onChange={handleText('description')} />
      </div>
    </PortalModal>
  );
}

// ============================================
// 8. CREATE AD-HOC REQUEST MODAL (Admin)
// ============================================

const REQUEST_TYPE_OPTIONS: FormDropdownOption[] = [
  { value: 'bug-fix', label: 'Bug Fix' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'content-update', label: 'Content Update' },
  { value: 'design-change', label: 'Design Change' },
  { value: 'other', label: 'Other' }
];

const INITIAL_AD_HOC = { title: '', description: '', projectId: '', clientId: '', requestType: '', priority: 'normal', estimatedHours: '' };

export interface CreateAdHocRequestModalProps extends BaseModalProps {
  clientOptions: FormDropdownOption[];
  projectOptions: FormDropdownOption[];
}

export function CreateAdHocRequestModal({ open, onOpenChange, onSubmit, loading = false, clientOptions, projectOptions }: CreateAdHocRequestModalProps) {
  const { form, handleText, handleDropdown, reset } = useFormState(INITIAL_AD_HOC);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="New Ad-Hoc Request" icon={<Send />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Request'}</button></>}>
      <div className="form-field"><PortalInput type="text" label="Title *" placeholder="Request title" value={form.title as string} onChange={handleText('title')} required /></div>
      <div className="form-field">
        <label className="field-label">Client *</label>
        <FormDropdown options={clientOptions} value={form.clientId as string} onChange={handleDropdown('clientId')} placeholder="Select client" />
      </div>
      <div className="form-field">
        <label className="field-label">Project *</label>
        <FormDropdown options={projectOptions} value={form.projectId as string} onChange={handleDropdown('projectId')} placeholder="Select project" />
      </div>
      <div className="form-field">
        <label className="field-label">Request Type *</label>
        <FormDropdown options={REQUEST_TYPE_OPTIONS} value={form.requestType as string} onChange={handleDropdown('requestType')} placeholder="Select type" />
      </div>
      <div className="form-field">
        <label className="field-label">Priority</label>
        <FormDropdown options={PRIORITY_OPTIONS} value={form.priority as string} onChange={handleDropdown('priority')} placeholder="Select priority" />
      </div>
      <div className="form-field"><PortalInput type="number" label="Estimated Hours" placeholder="0" value={form.estimatedHours as string} onChange={handleText('estimatedHours')} /></div>
      <div className="form-field">
        <label className="field-label" htmlFor="adhoc-desc">Description *</label>
        <textarea id="adhoc-desc" className="form-textarea" rows={3} placeholder="Describe the request..." value={form.description as string} onChange={handleText('description')} required />
      </div>
    </PortalModal>
  );
}

// ============================================
// 9. CREATE DELIVERABLE MODAL
// ============================================

const DELIVERABLE_TYPE_OPTIONS: FormDropdownOption[] = [
  { value: 'design', label: 'Design' },
  { value: 'development', label: 'Development' },
  { value: 'content', label: 'Content' },
  { value: 'other', label: 'Other' }
];

const INITIAL_DELIVERABLE = { title: '', description: '', projectId: '', type: '', reviewDeadline: '' };

export interface CreateDeliverableModalProps extends BaseModalProps {
  projectOptions: FormDropdownOption[];
}

export function CreateDeliverableModal({ open, onOpenChange, onSubmit, loading = false, projectOptions }: CreateDeliverableModalProps) {
  const { form, handleText, handleDropdown, reset } = useFormState(INITIAL_DELIVERABLE);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="New Deliverable" icon={<Package />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Deliverable'}</button></>}>
      <div className="form-field"><PortalInput type="text" label="Title *" placeholder="Deliverable title" value={form.title as string} onChange={handleText('title')} required /></div>
      <div className="form-field">
        <label className="field-label">Project *</label>
        <FormDropdown options={projectOptions} value={form.projectId as string} onChange={handleDropdown('projectId')} placeholder="Select project" />
      </div>
      <div className="form-field">
        <label className="field-label">Type *</label>
        <FormDropdown options={DELIVERABLE_TYPE_OPTIONS} value={form.type as string} onChange={handleDropdown('type')} placeholder="Select type" />
      </div>
      <div className="form-field"><PortalInput type="date" label="Review Deadline" value={form.reviewDeadline as string} onChange={handleText('reviewDeadline')} /></div>
      <div className="form-field">
        <label className="field-label" htmlFor="deliverable-desc">Description</label>
        <textarea id="deliverable-desc" className="form-textarea" rows={3} placeholder="Description..." value={form.description as string} onChange={handleText('description')} />
      </div>
    </PortalModal>
  );
}

// ============================================
// 10. CREATE TIME ENTRY MODAL
// ============================================

const INITIAL_TIME_ENTRY = { projectId: '', hours: '', description: '', date: new Date().toISOString().split('T')[0], billable: true };

export interface CreateTimeEntryModalProps extends BaseModalProps {
  projectOptions: FormDropdownOption[];
}

export function CreateTimeEntryModal({ open, onOpenChange, onSubmit, loading = false, projectOptions }: CreateTimeEntryModalProps) {
  const { form, handleText, handleDropdown, handleCheckbox, reset } = useFormState(INITIAL_TIME_ENTRY);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="Add Time Entry" icon={<Clock />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Entry'}</button></>}>
      <div className="form-field">
        <label className="field-label">Project *</label>
        <FormDropdown options={projectOptions} value={form.projectId as string} onChange={handleDropdown('projectId')} placeholder="Select project" />
      </div>
      <div className="form-field"><PortalInput type="number" label="Hours *" placeholder="0.0" value={form.hours as string} onChange={handleText('hours')} required /></div>
      <div className="form-field"><PortalInput type="date" label="Date *" value={form.date as string} onChange={handleText('date')} required /></div>
      <div className="form-field">
        <label className="field-label" htmlFor="time-desc">Description</label>
        <textarea id="time-desc" className="form-textarea" rows={2} placeholder="What did you work on..." value={form.description as string} onChange={handleText('description')} />
      </div>
      <div className="form-field">
        <label className="inline-checkbox"><input type="checkbox" checked={form.billable as boolean} onChange={handleCheckbox('billable')} /> Billable</label>
      </div>
    </PortalModal>
  );
}

// ============================================
// 11. CREATE PROPOSAL MODAL
// ============================================

const INITIAL_PROPOSAL = { projectId: '', clientId: '', projectType: '', selectedTier: '', basePrice: '', finalPrice: '' };

const TIER_OPTIONS: FormDropdownOption[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'premium', label: 'Premium' },
  { value: 'custom', label: 'Custom' }
];

export interface CreateProposalModalProps extends BaseModalProps {
  clientOptions: FormDropdownOption[];
  projectOptions: FormDropdownOption[];
  projectTypeOptions: FormDropdownOption[];
}

export function CreateProposalModal({ open, onOpenChange, onSubmit, loading = false, clientOptions, projectOptions, projectTypeOptions }: CreateProposalModalProps) {
  const { form, handleText, handleDropdown, reset } = useFormState(INITIAL_PROPOSAL);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    reset();
  }, [form, onSubmit, reset]);

  const handleCancel = useCallback(() => { reset(); onOpenChange(false); }, [reset, onOpenChange]);

  return (
    <PortalModal open={open} onOpenChange={onOpenChange} title="New Proposal" icon={<FileText />} onSubmit={handleFormSubmit}
      footer={<><button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Proposal'}</button></>}>
      <div className="form-field">
        <label className="field-label">Client *</label>
        <FormDropdown options={clientOptions} value={form.clientId as string} onChange={handleDropdown('clientId')} placeholder="Select client" />
      </div>
      <div className="form-field">
        <label className="field-label">Project *</label>
        <FormDropdown options={projectOptions} value={form.projectId as string} onChange={handleDropdown('projectId')} placeholder="Select project" />
      </div>
      <div className="form-field">
        <label className="field-label">Project Type *</label>
        <FormDropdown options={projectTypeOptions} value={form.projectType as string} onChange={handleDropdown('projectType')} placeholder="Select type" />
      </div>
      <div className="form-field">
        <label className="field-label">Tier *</label>
        <FormDropdown options={TIER_OPTIONS} value={form.selectedTier as string} onChange={handleDropdown('selectedTier')} placeholder="Select tier" />
      </div>
      <div className="form-field"><PortalInput type="number" label="Base Price *" placeholder="0.00" value={form.basePrice as string} onChange={handleText('basePrice')} required /></div>
      <div className="form-field"><PortalInput type="number" label="Final Price *" placeholder="0.00" value={form.finalPrice as string} onChange={handleText('finalPrice')} required /></div>
    </PortalModal>
  );
}

// Suppress unused import warning — ModalFooter kept for future use
void ModalFooter;
