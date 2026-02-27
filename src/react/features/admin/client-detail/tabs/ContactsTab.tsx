import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Star,
  X
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { PortalInput } from '@react/components/portal/PortalInput';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { ClientContact } from '../../types';
import { CONTACT_ROLE_LABELS } from '../../types';

interface ContactsTabProps {
  contacts: ClientContact[];
  onAddContact: (contact: Omit<ClientContact, 'id' | 'client_id' | 'created_at'>) => Promise<boolean>;
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
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deleteDialog = useConfirmDialog();
  const [contactToDelete, setContactToDelete] = useState<ClientContact | null>(null);

  // Sort contacts: primary first, then alphabetically
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.name.localeCompare(b.name);
  });

  // Start adding new contact
  const handleStartAdd = useCallback(() => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setIsAdding(true);
  }, []);

  // Start editing contact
  const handleStartEdit = useCallback((contact: ClientContact) => {
    setFormData({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || '',
      title: contact.title || '',
      role: (contact.role as ContactRole) || 'other',
      is_primary: contact.is_primary,
      notes: contact.notes || ''
    });
    setEditingId(contact.id);
    setIsAdding(false);
  }, []);

  // Cancel form
  const handleCancel = useCallback(() => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setIsAdding(false);
  }, []);

  // Update form field
  const handleFieldChange = useCallback(
    (field: keyof ContactFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Submit form
  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      showNotification?.('Name and email are required', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingId) {
        const success = await onUpdateContact(editingId, formData);
        if (success) {
          showNotification?.('Contact updated', 'success');
          handleCancel();
        } else {
          showNotification?.('Failed to update contact', 'error');
        }
      } else {
        const success = await onAddContact(formData);
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
  }, [formData, editingId, onAddContact, onUpdateContact, showNotification, handleCancel]);

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
      const success = await onUpdateContact(contact.id, { is_primary: true });
      if (success) {
        showNotification?.(`${contact.name} set as primary contact`, 'success');
      } else {
        showNotification?.('Failed to update contact', 'error');
      }
    },
    [onUpdateContact, showNotification]
  );

  // Render contact form
  const renderForm = () => (
    <div className="tw-panel tw-mb-4">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
        <h3 className="tw-heading" style={{ fontSize: '14px' }}>
          {editingId ? 'Edit Contact' : 'Add Contact'}
        </h3>
        <button
          onClick={handleCancel}
          className="tw-btn-icon"
        >
          <X className="tw-h-4 tw-w-4" />
        </button>
      </div>

      <div className="tw-grid tw-grid-cols-2 tw-gap-4">
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

        <div className="tw-flex tw-flex-col tw-gap-1.5">
          <label className="tw-label">
            Role
          </label>
          <select
            value={formData.role}
            onChange={(e) => handleFieldChange('role', e.target.value)}
            className="tw-input"
          >
            {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="tw-flex tw-items-end">
          <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_primary}
              onChange={(e) => handleFieldChange('is_primary', e.target.checked)}
              className="tw-w-4 tw-h-4"
              style={{ borderRadius: 0 }}
            />
            <span className="tw-text-muted" style={{ fontSize: '14px' }}>
              Primary Contact
            </span>
          </label>
        </div>
      </div>

      <div className="tw-mt-4">
        <PortalInput
          label="Notes"
          value={formData.notes}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('notes', e.target.value)}
          placeholder="Additional notes..."
        />
      </div>

      <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-4">
        <button className="tw-btn-ghost" onClick={handleCancel}>
          Cancel
        </button>
        <button
          className="tw-btn-primary"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Contact')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="tw-section">
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <h2 className="tw-heading" style={{ fontSize: '18px' }}>
          Contacts ({contacts.length})
        </h2>
        {!isAdding && !editingId && (
          <button className="tw-btn-secondary" onClick={handleStartAdd}>
            <Plus className="tw-h-4 tw-w-4" />
            Add Contact
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && renderForm()}

      {/* Contacts List */}
      {sortedContacts.length === 0 ? (
        <div className="tw-empty-state">
          <User className="tw-h-12 tw-w-12 tw-mb-3" />
          <p>No contacts yet</p>
          <p style={{ fontSize: '14px' }}>
            Add contacts to keep track of key people
          </p>
        </div>
      ) : (
        <div className="tw-grid tw-grid-cols-2 tw-gap-4">
          {sortedContacts.map((contact) => (
            <div
              key={contact.id}
              className={cn(
                'tw-card',
                contact.is_primary && 'tw-border-white'
              )}
            >
              {/* Contact Header */}
              <div className="tw-flex tw-items-start tw-justify-between tw-mb-3">
                <div className="tw-flex tw-items-center tw-gap-2">
                  <div className="tw-w-10 tw-h-10 tw-border tw-border-[rgba(255,255,255,0.3)] tw-flex tw-items-center tw-justify-center" style={{ borderRadius: 0 }}>
                    <User className="tw-h-5 tw-w-5 tw-text-muted" />
                  </div>
                  <div>
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <span className="tw-heading" style={{ fontSize: '14px' }}>
                        {contact.name}
                      </span>
                      {contact.is_primary && (
                        <Star className="tw-h-3 tw-w-3 tw-text-white tw-fill-current" />
                      )}
                    </div>
                    {contact.title && (
                      <span className="tw-text-muted" style={{ fontSize: '12px' }}>
                        {contact.title}
                      </span>
                    )}
                  </div>
                </div>

                <PortalDropdown>
                  <PortalDropdownTrigger asChild>
                    <button className="tw-btn-icon">
                      <Pencil className="tw-h-4 tw-w-4" />
                    </button>
                  </PortalDropdownTrigger>
                  <PortalDropdownContent align="end">
                    <PortalDropdownItem onClick={() => handleStartEdit(contact)}>
                      <Pencil className="tw-h-4 tw-w-4 tw-mr-2" />
                      Edit
                    </PortalDropdownItem>
                    {!contact.is_primary && (
                      <PortalDropdownItem onClick={() => handleSetPrimary(contact)}>
                        <Star className="tw-h-4 tw-w-4 tw-mr-2" />
                        Set as Primary
                      </PortalDropdownItem>
                    )}
                    <PortalDropdownItem
                      onClick={() => handleDeleteClick(contact)}
                    >
                      <Trash2 className="tw-h-4 tw-w-4 tw-mr-2" />
                      Delete
                    </PortalDropdownItem>
                  </PortalDropdownContent>
                </PortalDropdown>
              </div>

              {/* Contact Details */}
              <div className="tw-flex tw-flex-col tw-gap-2">
                <div className="tw-flex tw-items-center tw-gap-2">
                  <Mail className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="tw-text-primary"
                    style={{ fontSize: '12px' }}
                  >
                    {contact.email}
                  </a>
                </div>

                {contact.phone && (
                  <div className="tw-flex tw-items-center tw-gap-2">
                    <Phone className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                    <a
                      href={`tel:${contact.phone}`}
                      className="tw-text-muted"
                      style={{ fontSize: '12px' }}
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.role && (
                  <div className="tw-flex tw-items-center tw-gap-2">
                    <Briefcase className="tw-h-3.5 tw-w-3.5 tw-text-muted" />
                    <span className="tw-text-muted" style={{ fontSize: '12px' }}>
                      {CONTACT_ROLE_LABELS[contact.role] || contact.role}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {contact.notes && (
                <p className="tw-text-muted tw-mt-3 tw-pt-3" style={{ fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  {contact.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Contact"
        description={`Are you sure you want to delete ${contactToDelete?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
