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
import { PortalInput } from '@react/components/portal/PortalInput';
import { Checkbox } from '@react/components/ui/checkbox';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
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
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deleteDialog = useConfirmDialog();
  const [contactToDelete, setContactToDelete] = useState<ClientContact | null>(null);

  // Sort contacts: primary first, then alphabetically
  const sortedContacts = [...contacts].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return getContactDisplayName(a).localeCompare(getContactDisplayName(b));
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
      name: getContactDisplayName(contact),
      email: contact.email || '',
      phone: contact.phone || '',
      title: contact.title || '',
      role: (contact.role as ContactRole) || 'other',
      is_primary: contact.isPrimary,
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
    <div className="panel panel-form-spacing">
      <div className="panel-header-row">
        <h3 className="heading">
          {editingId ? 'Edit Contact' : 'Add Contact'}
        </h3>
        <button
          onClick={handleCancel}
          className="icon-btn"
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
          <select
            value={formData.role}
            onChange={(e) => handleFieldChange('role', e.target.value)}
            className="input"
          >
            {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="align-end">
          <label className="checkbox-label">
            <Checkbox
              checked={formData.is_primary}
              onCheckedChange={(checked) => handleFieldChange('is_primary', checked === true)}
            />
            <span className="text-muted">
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
        <button className="btn-ghost" onClick={handleCancel}>
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Contact')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="section">
      {/* Header */}
      <div className="tab-section-header">
        <h2 className="heading text-lg">
          Contacts ({contacts.length})
        </h2>
        {!isAdding && !editingId && (
          <button className="btn-secondary" onClick={handleStartAdd}>
            <Plus className="icon-md" />
            Add Contact
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && renderForm()}

      {/* Contacts List */}
      {sortedContacts.length === 0 ? (
        <div className="empty-state">
          <User className="icon-xl" />
          <span>No contacts yet</span>
          <span className="empty-state-hint">Add contacts to keep track of key people</span>
        </div>
      ) : (
        <div className="card-grid-2col">
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
                  <div className="contact-avatar contacts-avatar">
                    <User className="icon-lg text-muted" />
                  </div>
                  <div>
                    <div className="contact-name-row">
                      <span className="heading">
                        {getContactDisplayName(contact)}
                      </span>
                      {contact.isPrimary && (
                        <Star className="icon-xs active-primary" />
                      )}
                    </div>
                    {contact.title && (
                      <span className="text-muted text-sm">
                        {contact.title}
                      </span>
                    )}
                  </div>
                </div>

                <PortalDropdown>
                  <PortalDropdownTrigger asChild>
                    <button className="icon-btn">
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
                    <PortalDropdownItem
                      onClick={() => handleDeleteClick(contact)}
                    >
                      <Trash2 className="icon-md dropdown-item-icon" />
                      Delete
                    </PortalDropdownItem>
                  </PortalDropdownContent>
                </PortalDropdown>
              </div>

              {/* Contact Details */}
              <div className="detail-list">
                <div className="contact-detail-row">
                  <Mail className="icon-sm text-muted" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm"
                    style={{ color: 'var(--portal-accent)' }}
                  >
                    {contact.email}
                  </a>
                </div>

                {contact.phone && (
                  <div className="contact-detail-row">
                    <Phone className="icon-sm text-muted" />
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-muted text-sm"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.role && (
                  <div className="contact-detail-row">
                    <Briefcase className="icon-sm text-muted" />
                    <span className="text-muted text-sm">
                      {CONTACT_ROLE_LABELS[contact.role] || contact.role}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {contact.notes && (
                <p className="text-muted contact-notes contacts-notes">
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
