import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Pencil,
  Trash2,
  Star,
  X,
  ChevronDown,
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { cn } from '@react/lib/utils';
import { PortalInput } from '@react/components/portal/PortalInput';
import { Checkbox } from '@react/components/ui/checkbox';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { PortalButton } from '@react/components/portal/PortalButton';
import { EmptyState } from '@react/components/portal/EmptyState';
import { useFormState } from '@react/hooks/useFormState';
import type { ClientContact } from '../../types';
import { CONTACT_ROLE_LABELS } from '../../types';

/** Helper to get display name from contact */
function getContactDisplayName(contact: ClientContact): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed';
}

interface ContactsTabProps {
  contacts: ClientContact[];
  onAddContact: (contact: Omit<ClientContact, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  onUpdateContact: (
    contactId: number,
    updates: Partial<ClientContact>
  ) => Promise<boolean>;
  onDeleteContact: (contactId: number) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type ContactRole = 'primary' | 'billing' | 'technical' | 'decision_maker' | 'other';

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  title: string;
  role: ContactRole;
  is_primary: boolean;
  notes: string;
}

const EMPTY_FORM: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  title: '',
  role: 'other',
  is_primary: false,
  notes: ''
};

/**
 * ContactsTab
 * Manage client contacts
 */
export function ContactsTab({
  contacts,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  showNotification
}: ContactsTabProps) {
  const {
    isAdding: _isAdding,
    editingId,
    formData,
    isSubmitting,
    startAdd: handleStartAdd,
    startEdit,
    cancelForm: handleCancel,
    updateField,
    setIsSubmitting,
    isFormOpen
  } = useFormState<ContactFormData>({ initialData: EMPTY_FORM });

  const deleteDialog = useConfirmDialog();
  const [contactToDelete, setContactToDelete] = useState<ClientContact | null>(null);

  // Sort contacts: primary first, then alphabetically
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return getContactDisplayName(a).localeCompare(getContactDisplayName(b));
  });

  // Start editing contact — maps ClientContact to ContactFormData
  const handleStartEdit = useCallback((contact: ClientContact) => {
    startEdit(contact.id, {
      name: getContactDisplayName(contact),
      email: contact.email || '',
      phone: contact.phone || '',
      title: contact.title || '',
      role: (contact.role as ContactRole) || 'other',
      is_primary: contact.isPrimary,
      notes: contact.notes || ''
    });
  }, [startEdit]);

  // Update form field
  const handleFieldChange = useCallback(
    (field: keyof ContactFormData, value: string | boolean) => {
      updateField(field, value as ContactFormData[keyof ContactFormData]);
    },
    [updateField]
  );

  // Submit form — split name into firstName/lastName for backend
  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      showNotification?.('Name and email are required', 'error');
      return;
    }

    setIsSubmitting(true);

    // Split name into firstName/lastName
    const nameParts = formData.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const contactData = {
      firstName,
      lastName,
      email: formData.email,
      phone: formData.phone || undefined,
      title: formData.title || undefined,
      role: formData.role as ClientContact['role'],
      isPrimary: formData.is_primary,
      notes: formData.notes || undefined
    };

    try {
      if (editingId) {
        const success = await onUpdateContact(editingId, contactData);
        if (success) {
          showNotification?.('Contact updated', 'success');
          handleCancel();
        } else {
          showNotification?.('Failed to update contact', 'error');
        }
      } else {
        const success = await onAddContact(contactData as Omit<ClientContact, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>);
        if (success) {
          showNotification?.('Contact added', 'success');
          handleCancel();
        } else {
          showNotification?.('Failed to add contact', 'error');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingId, onAddContact, onUpdateContact, showNotification, handleCancel, setIsSubmitting]);

  // Handle delete
  const handleDeleteClick = useCallback(
    (contact: ClientContact) => {
      setContactToDelete(contact);
      deleteDialog.open();
    },
    [deleteDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!contactToDelete) return;

    const success = await onDeleteContact(contactToDelete.id);
    if (success) {
      showNotification?.('Contact deleted', 'success');
    } else {
      showNotification?.('Failed to delete contact', 'error');
    }
    setContactToDelete(null);
  }, [contactToDelete, onDeleteContact, showNotification]);

  // Set as primary
  const handleSetPrimary = useCallback(
    async (contact: ClientContact) => {
      const success = await onUpdateContact(contact.id, { isPrimary: true });
      if (success) {
        showNotification?.(`${getContactDisplayName(contact)} set as primary contact`, 'success');
      } else {
        showNotification?.('Failed to update contact', 'error');
      }
    },
    [onUpdateContact, showNotification]
  );

  // Render contact form
  const renderForm = () => (
    <div className="panel">
      <div className="panel-header-row">
        <h3 className="heading">
          <span className="title-full">{editingId ? 'Edit Contact' : 'Add Contact'}</span>
        </h3>
        <button
          onClick={handleCancel}
          className="icon-btn"
          aria-label="Cancel editing"
        >
          <X className="icon-md" />
        </button>
      </div>

      <div className="form-grid-2col">
        <PortalInput
          label="Name"
          value={formData.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('name', e.target.value)}
          placeholder="Contact name"
          required
        />

        <PortalInput
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('email', e.target.value)}
          placeholder="email@example.com"
          required
        />

        <PortalInput
          label="Phone"
          value={formData.phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('phone', e.target.value)}
          placeholder="(555) 123-4567"
        />

        <PortalInput
          label="Title"
          value={formData.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('title', e.target.value)}
          placeholder="Job title"
        />

        <div className="form-field-col">
          <label className="field-label">
            Role
          </label>
          <PortalDropdown>
            <PortalDropdownTrigger asChild>
              <button className="dropdown-trigger--form" type="button">
                <span className="dropdown-value--form">
                  {CONTACT_ROLE_LABELS[formData.role as keyof typeof CONTACT_ROLE_LABELS] || formData.role}
                </span>
                <ChevronDown className="dropdown-caret--form" />
              </button>
            </PortalDropdownTrigger>
            <PortalDropdownContent align="start" sideOffset={0}>
              {Object.entries(CONTACT_ROLE_LABELS)
                .filter(([value]) => value !== formData.role)
                .map(([value, label]) => (
                  <PortalDropdownItem
                    key={value}
                    onSelect={() => handleFieldChange('role', value)}
                  >
                    {label}
                  </PortalDropdownItem>
                ))}
            </PortalDropdownContent>
          </PortalDropdown>
        </div>

        <div className="align-end">
          <label className="checkbox-label">
            <Checkbox
              checked={formData.is_primary}
              onCheckedChange={(checked) => handleFieldChange('is_primary', checked === true)}
            />
            <span className="text-secondary">
              Primary Contact
            </span>
          </label>
        </div>
      </div>

      <div className="form-field-full">
        <PortalInput
          label="Notes"
          value={formData.notes}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('notes', e.target.value)}
          placeholder="Additional notes..."
        />
      </div>

      <div className="form-actions">
        <PortalButton variant="ghost" onClick={handleCancel}>
          Cancel
        </PortalButton>
        <PortalButton onClick={handleSubmit} loading={isSubmitting}>
          {editingId ? 'Save Changes' : 'Add Contact'}
        </PortalButton>
      </div>
    </div>
  );

  return (
    <div className="subsection">
      <div className="panel">
        <div className="data-table-header">
          <h3><span className="title-full">Contacts</span></h3>
          {!isFormOpen && (
            <div className="data-table-actions">
              <IconButton action="add" onClick={handleStartAdd} title="Add Contact" />
            </div>
          )}
        </div>

        {/* Add/Edit Form */}
        {isFormOpen && renderForm()}

        {/* Contacts List */}
        {sortedContacts.length === 0 ? (
          <EmptyState
            icon={<Inbox className="icon-lg" />}
            message="No contacts yet. Add contacts to keep track of key people."
          />
        ) : (
          <div className="grid-2col">
            {sortedContacts.map((contact) => (
              <div
                key={contact.id}
                className={cn(
                  'portal-card',
                  contact.isPrimary && 'border-primary-accent'
                )}
              >
                {/* Contact Header */}
                <div className="contact-card-header">
                  <div className="contact-identity">
                    <div className="contact-avatar">
                      <User className="icon-lg text-secondary" />
                    </div>
                    <div>
                      <div className="contact-name-row">
                        <span className="heading">
                          {getContactDisplayName(contact)}
                        </span>
                        {contact.isPrimary && (
                          <Star className="icon-xs is-active-primary" />
                        )}
                      </div>
                      {contact.title && (
                        <span className="text-secondary">
                          {contact.title}
                        </span>
                      )}
                    </div>
                  </div>

                  <PortalDropdown>
                    <PortalDropdownTrigger asChild>
                      <button className="icon-btn" aria-label="Contact actions">
                        <Pencil className="icon-md" />
                      </button>
                    </PortalDropdownTrigger>
                    <PortalDropdownContent align="end">
                      <PortalDropdownItem onClick={() => handleStartEdit(contact)}>
                        <Pencil className="icon-md dropdown-item-icon" />
                        Edit
                      </PortalDropdownItem>
                      {!contact.isPrimary && (
                        <PortalDropdownItem onClick={() => handleSetPrimary(contact)}>
                          <Star className="icon-md dropdown-item-icon" />
                          Set as Primary
                        </PortalDropdownItem>
                      )}
                      <PortalDropdownItem onClick={() => handleDeleteClick(contact)}>
                        <Trash2 className="icon-md dropdown-item-icon" />
                        Delete
                      </PortalDropdownItem>
                    </PortalDropdownContent>
                  </PortalDropdown>
                </div>

                {/* Contact Details */}
                <div className="detail-list">
                  <div className="contact-detail-row">
                    <Mail className="icon-sm text-secondary" />
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-accent"
                    >
                      {contact.email}
                    </a>
                  </div>

                  {contact.phone && (
                    <div className="contact-detail-row">
                      <Phone className="icon-sm text-secondary" />
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-secondary"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}

                  {contact.role && (
                    <div className="contact-detail-row">
                      <Briefcase className="icon-sm text-secondary" />
                      <span className="text-secondary">
                        {CONTACT_ROLE_LABELS[contact.role] || contact.role}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {contact.notes && (
                  <p className="text-secondary contact-notes">
                    {contact.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Contact"
        description={`Are you sure you want to delete ${contactToDelete ? getContactDisplayName(contactToDelete) : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
